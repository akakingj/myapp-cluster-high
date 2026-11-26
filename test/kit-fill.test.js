'use strict';
/*
 * The kit's "fill" page: an app's page alone on the whole iDrive screen
 * (app.json: a canvas screen with "hmi": false and "fill": true), as
 * BeeM-Flash's kit has it - and this app's own screen, framed by the kit's
 * header and bar as AK Cluster Layouts'. The kit's display is run here against its own
 * renderer client writing to a file (what the kit's tooling replays), with
 * a stand-in for the HMI.
 * Run: node --test test/kit-fill.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const KIT = path.join(__dirname, '..', 'kit', 'runtime');
const tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kitfill-')), 'frames.bin');
process.env.MGU_RENDERD_FILE = tmpFile;          /* the renderer client writes there instead of to a socket */
const { Display, FULL } = require(path.join(KIT, 'display.js'));
const themes = require(path.join(KIT, 'themes.js'));
const appSpec = require('../app/app.base.json');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function make(screen) {
    const closed = [], hidden = {}, errors = [];
    const ui = {
        onVisible() {}, onFocus() {},
        /* the app's screen is up; the HMI's own settings screen is not over it */
        isVisible: (name) => name === 'MAIN', hasFocus: () => true,
        visible(id, on) { hidden[id] = !on; },
        close(name) { closed.push(name); return Promise.resolve(); },
        rhmi: { getByName: () => null }
    };
    const log = { info() {}, warn() {}, error(...a) { errors.push(a.map((e) => (e && e.stack) || String(e)).join(' ')); } };
    const settings = { get: () => undefined, onChange() {} };
    const spec = { id: 'test_app', title: 'Test', screens: [screen], settings: [] };
    const d = new Display(ui, log, spec, settings, () => themes.theme());
    return { d, closed, hidden, errors };
}
async function ready(x) {
    for (let i = 0; i < 50 && !(x.d.place && x.d.gpu && x.d.gpu.ready); i++) await wait(10);
    /* the picture shows once the HMI's page animation is over */
    for (let i = 0; i < 80 && !x.d.gpu.visible; i++) await wait(10);
    assert.ok(x.d.place, 'the renderer placed the page');
    return x;
}
function stop(x) {
    assert.deepStrictEqual(x.errors, [], 'the display logged an error');
    ['poll', 'keepTimer', 'sheetTimer', 'showTimer', 'frontTimer'].forEach((k) => { clearInterval(x.d[k]); clearTimeout(x.d[k]); });
    /* (the controller's hold is kept alive on a timer of the renderer client's) */
    if (x.d.gpu) { x.d.gpu.closed = true; clearTimeout(x.d.gpu.retry); clearInterval(x.d.gpu.grabTimer); }
}
const BUTTONS = [['BTN_SHOW', 'Cluster on / off'], ['BTN_DESIGN', 'Design'], ['BTN_CENTRE', 'Centre picture'], ['BTN_SETTINGS', 'Settings']];
const FILL = { name: 'MAIN', kind: 'canvas', title: 'Test', hmi: false, fill: true, buttons: BUTTONS };
const knob = (n) => ({ frontRotaryEncoderOperation: n, frontRotaryEncoderPushButton: 0, frontRotaryEncoderDeflection: 0 });

test('the app\'s one screen is a canvas in the kit\'s frame (no "fill"): Show on the cluster, Logs, Settings in its bar', () => {
    const s = appSpec.screens[0];
    assert.strictEqual(appSpec.screens.length, 1);
    assert.deepStrictEqual([s.name, s.kind, s.hmi, s.fill], ['MAIN', 'canvas', undefined, undefined]);
    assert.deepStrictEqual(s.buttons.map((b) => b[0]), ['BTN_SHOW', 'BTN_LOGS', 'BTN_SETTINGS']);
});

test('fill: the page is the whole 1920 x 720 screen - no header, no column - with 80 more rows below its 520', async (t) => {
    const x = await ready(make(FILL));
    t.after(() => stop(x));
    const d = x.d;
    assert.strictEqual(d.fill(), true);
    assert.strictEqual(d.headH(), 0, 'no header');
    assert.strictEqual(d.left(), 0, 'no back arrow column');
    assert.ok(d.own(), 'the kit runs the screen');
    /* the page's own buttons leave the bar; with them gone there is no bar at all */
    ['BTN_SHOW', 'BTN_DESIGN', 'BTN_CENTRE'].forEach((b) => d.hideButton(b, true));
    assert.strictEqual(d.barH(), 0);
    const pl = d.place;
    assert.deepStrictEqual([pl.x, pl.y, pl.w, pl.h, pl.full], [0, 0, 1920, 720, true]);
    assert.deepStrictEqual([pl.scale, pl.ox, pl.oy, pl.extra], [1.2, 0, 0, 80], 'the 1600-wide page across the 1920, from the corner');
    assert.strictEqual(pl.oyMid, undefined);
    /* what the app draws on */
    const cv = d.canvas(1600, 520);
    assert.strictEqual(cv.own, true);
    assert.strictEqual(cv.extra, 80);
    assert.strictEqual(cv.textScale, 1.2, 'text is set for the size it is shown at');
    /* put back, a button is on the bar again (the way out of "own") */
    d.hideButton('BTN_SHOW', false);
    assert.strictEqual(d.barH(), FULL.barH);
    d.hideButton('BTN_SHOW', true);
});

test('fill: every touch on the screen is the page\'s, and nothing of the HMI shows through', async (t) => {
    const x = await ready(make(FILL));
    t.after(() => stop(x));
    const d = x.d;
    ['BTN_SHOW', 'BTN_DESIGN', 'BTN_CENTRE'].forEach((b) => d.hideButton(b, true));
    const claims = [];
    d.gpu.claim = (rects) => { claims.push(rects); };
    let cleared = 0;
    const cv = d.canvas(1600, 520);
    cv.fillRect(0, 0, 1600, 520 + cv.extra, '#101010');
    cv.target(20, 10, 90, 50, () => {}, 'exit', 25);
    /* (spy on the chrome's recorder: a see-through hole is a clear(0) under a clip) */
    d.present('MAIN_GFX', cv, () => Promise.resolve());
    const orig = d.chromeRec.clear.bind(d.chromeRec);
    d.chromeRec.clear = (c) => { if (!c) cleared++; return orig(c); };
    d._repaint();
    assert.strictEqual(cleared, 0, 'no see-through status corner or column');
    const last = claims[claims.length - 1];
    /* the claims are in the page's own px: all of 1600 x 600 */
    const page = last[last.length - 1];
    assert.deepStrictEqual([page.x, page.y, Math.round(page.w), Math.round(page.h)], [0, 0, 1600, 600]);
    assert.strictEqual(last[0].h, 0, 'the header\'s claim is empty: there is none');
    /* the HMI's own bar buttons are hidden under the page */
    assert.strictEqual(x.hidden.BTN_SHOW, true);
});

test('fill: the controller goes round the page\'s own places; pushed left at the edge the app is asked, then the screen closes', async (t) => {
    const x = await ready(make(FILL));
    t.after(() => stop(x));
    const d = x.d;
    ['BTN_SHOW', 'BTN_DESIGN', 'BTN_CENTRE'].forEach((b) => d.hideButton(b, true));
    const pressed = [], focus = [], backs = [];
    d.onPageFocus = (k) => focus.push(k);
    function frame() {
        const cv = d.canvas(1600, 520);
        cv.fillRect(0, 0, 1600, 600, '#101010');
        cv.target(20, 10, 90, 50, () => pressed.push('exit'), 'exit', 25);
        cv.target(350, 10, 150, 50, () => pressed.push('a'), 'tab:a', 25);
        cv.target(520, 10, 150, 50, () => pressed.push('b'), 'tab:b', 25);
        cv.target(40, 200, 500, 60, () => pressed.push('row'), 'row', -1);
        d.present('MAIN_GFX', cv, () => Promise.resolve());
    }
    frame();
    assert.deepStrictEqual(d._ring().map((p) => p.k), ['tgt:exit', 'tgt:tab:a', 'tgt:tab:b', 'tgt:row'],
        'the page\'s places in the order drawn: no header tabs, no bar');
    let k = 100;
    d._ccu(knob(k));                                  /* the first reading: where the knob is */
    d._ccu(knob(++k));                                /* one click: onto the first place */
    d._ccu(knob(++k));
    assert.strictEqual(d.focusKey, 'tgt:tab:a');
    assert.deepStrictEqual(focus.slice(-2), ['exit', 'tab:a'], 'the app hears where the controller is');
    d._ccu(Object.assign(knob(k), { frontRotaryEncoderPushButton: 1 }));
    assert.deepStrictEqual(pressed, ['a'], 'a press runs the place');
    d._ccu(knob(k));
    /* the app can put the controller somewhere itself */
    d.focusPage('row');
    assert.strictEqual(d.focusKey, 'tgt:row');
    /* a place with a negative radius draws its own focus: the kit adds no ring (and does not fail) */
    frame();
    d._repaint();
    /* pushed left from the first place: nothing further left - the app's back first */
    d.focusPage('exit');
    d.onBack = (edge) => { backs.push(edge); return edge; };          /* takes it at the edge */
    d._ccu(Object.assign(knob(k), { frontRotaryEncoderDeflection: 10 }));
    assert.deepStrictEqual(backs, [false, true]);
    assert.deepStrictEqual(x.closed, [], 'the app took it: the screen stays');
    d._ccu(knob(k));
    d.onBack = () => false;                                            /* the app has nowhere to go back to */
    d._ccu(Object.assign(knob(k), { frontRotaryEncoderDeflection: 10 }));
    assert.deepStrictEqual(x.closed, ['MAIN'], 'the screen closes, as with the HMI\'s back arrow');
});

test('a screen without "fill" (the app\'s): header, back column, the page between, the bar under it', async (t) => {
    const x = await ready(make(appSpec.screens[0]));
    t.after(() => stop(x));
    const d = x.d;
    assert.strictEqual(d.fill(), false);
    assert.strictEqual(d.headH(), FULL.headH);
    assert.strictEqual(d.left(), 84);
    const pl = d.place;
    /* the part of the page it shows (FULL.src) starts right of the back column and under the header */
    assert.ok(pl.full && pl.scale < 1.2, JSON.stringify(pl));
    assert.ok(pl.ox + FULL.src.x * pl.scale >= 84 && pl.oy + FULL.src.y * pl.scale >= FULL.headH, JSON.stringify(pl));
    assert.strictEqual(pl.extra, undefined);
    assert.ok(d._ring().every((p) => !p.tgt));
    /* the bar: Show on the cluster and Logs; Settings is the header's last tab */
    assert.deepStrictEqual(d.buttons().map((b) => b.id), ['BTN_SHOW', 'BTN_LOGS']);
    assert.deepStrictEqual(d._tabList().tabs, ['Settings']);
    /* "fill" needs "hmi": false with it */
    const y = await ready(make({ name: 'MAIN', kind: 'canvas', title: 'Test', fill: true, buttons: BUTTONS }));
    t.after(() => stop(y));
    assert.strictEqual(y.d.fill(), false);
});
