'use strict';
/*
 * The app's own page on the iDrive screen: the whole screen where the kit
 * runs it, with a way out, a CLUSTER tab and a tab of settings for each
 * style - and the plain page with the HMI's bar everywhere else. The staged
 * app is run as it is (tools/page-harness.js) and its places are pressed.
 * Run: node --test test/page.test.js      (after node tools/stage-app.js)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const Harness = require('../tools/page-harness.js');
const Themes = require('../src/theme/index.js');
const Track = require('../src/theme/track.js');
const Centre = require('../src/car/centre.js');
const { Recorder } = require(path.join(Harness.KIT, 'record.js'));
const spec = require('../app/app.base.json');

const TABS = ['cluster', 'general', 'toro', 'msport', 'mplus', 'mtrack'];
const STYLE_OF = { toro: 'toro', msport: 'track', mplus: 'mplus', mtrack: 'mtrack' };
const item = (k) => spec.settings.find((s) => s.key === k);
const keys = (page, prefix) => page.targets().map((t) => t.key).filter((k) => k.indexOf(prefix) === 0);
/* what the page should offer on a tab, from the manifest: the tab's settings whose own conditions hold */
function offered(tab, values) {
    return spec.settings.filter((s) => s.tab === tab && Object.keys(s.when || {}).every((k) =>
        k === 'style' || [].concat(s.when[k]).indexOf(values[k]) >= 0)).map((s) => s.key);
}

test('the settings are in five groups, and each style keeps its own adjustments under its own names', () => {
    for (const s of spec.settings) {
        assert.ok(['general', 'toro', 'msport', 'mplus', 'mtrack'].indexOf(s.tab) >= 0, s.key + ' has no tab');
        if (s.tab === 'general') assert.ok(!(s.when && s.when.style), s.key + ': a general setting tied to a style');
        /* the HMI's own settings list (where the kit does not draw ours) offers only the style in use */
        else assert.strictEqual(s.when && s.when.style, STYLE_OF[s.tab], s.key + ': shown only for its style');
        if (s.type === 'choice') assert.ok(s.options.some((o) => o[0] === String(s.default)), s.key + ': its default is one of its values');
    }
    assert.strictEqual(new Set(spec.settings.map((s) => s.key)).size, spec.settings.length, 'no key twice');
    /* every name a style's builder is handed (src/theme/index.js OWN) is a setting on that style's tab */
    const tabOf = { toro: 'toro', track: 'msport', mplus: 'mplus', mtrack: 'mtrack' };
    for (const style of Object.keys(Themes.OWN)) {
        for (const name of Object.keys(Themes.OWN[style])) {
            const s = item(Themes.OWN[style][name]);
            assert.ok(s, `${style}: no setting ${Themes.OWN[style][name]}`);
            assert.strictEqual(s.tab, tabOf[style]);
            const values = s.options.map((o) => o[0]);
            if (name === 'centre') {
                values.forEach((v) => assert.ok(Centre.PREFS.indexOf(v) >= 0, `${s.key}: ${v}`));
                assert.strictEqual(values.indexOf('turn') >= 0, style === 'track' || style === 'mplus', 'the turn card is the M View styles\'');
                assert.ok(['off', 'waze', 'map', 'camera'].every((v) => values.indexOf(v) >= 0), s.key + ': closed, Waze, BMW\'s own map, the camera');
            }
            if (/^foot/.test(name)) assert.deepStrictEqual(values, Track.FOOT_KINDS, s.key);
        }
    }
    /* the two M styles have the same adjustments, each its own copy */
    assert.deepStrictEqual(Object.keys(Themes.OWN.track), Object.keys(Themes.OWN.mplus));
    Object.keys(Themes.OWN.track).forEach((n) => assert.notStrictEqual(Themes.OWN.track[n], Themes.OWN.mplus[n]));
    /* M Track Mode has its own: what its left wing holds, its four gauge rows, how a row marks its reading */
    assert.deepStrictEqual(Object.keys(Themes.OWN.mtrack),
        ['centre', 'wing', 'row1', 'row2', 'row3', 'row4', 'rowMark', 'footL', 'footM', 'footR']);
    const MTrack = require('../src/theme/mtrack.js');
    for (const n of [1, 2, 3, 4]) {
        /* each row: as BMW's, any reading a row can show, or nothing */
        assert.deepStrictEqual(item('kRow' + n).options.map((o) => o[0]), ['auto'].concat(MTrack.ROW_KINDS));
        assert.strictEqual(item('kRow' + n).default, 'auto');
    }
    assert.deepStrictEqual(item('kRowMark').options.map((o) => o[0]), ['mark', 'fill']);
    assert.ok(/gauges/i.test(item('kCentre').options[0][1]), 'as it comes the wing holds the gauges, and its setting says so');
    /* as each comes: Toro, M Sport and M Track Mode whole, M Sport Plus with the phone's map; the frame's own footer */
    assert.deepStrictEqual([item('tCentre').default, item('mCentre').default, item('pCentre').default, item('kCentre').default],
        ['off', 'off', 'waze', 'off']);
    for (const p of ['m', 'p', 'k']) {
        assert.deepStrictEqual([item(p + 'FootL').default, item(p + 'FootM').default, item(p + 'FootR').default], ['time', 'range', 'outside']);
    }
    assert.strictEqual(item('centre'), undefined, 'the one centre for every style is gone');
});

test('own: the bar across the top - the way out, a tab each, the style in use marked - then the page', () => {
    const page = Harness.open({ values: { style: 'mplus' } });
    const order = page.targets().map((t) => t.key);
    assert.deepStrictEqual(order.slice(0, 7), ['exit', 'tab:cluster', 'tab:general', 'tab:toro', 'tab:msport', 'tab:mplus', 'tab:mtrack'],
        'the controller\'s knob: out, the tabs, then the page');
    assert.deepStrictEqual(order.slice(7), ['show', 'prev', 'next', 'centre:off', 'centre:waze', 'centre:map', 'centre:camera', 'centre:turn']);
    /* the page is the whole screen: 1600 x 600 of its own units */
    assert.deepStrictEqual([page.shot().w, page.shot().h], [1600, 600]);
    page.targets().forEach((t) => {
        assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1600 && t.y + t.h <= 600, t.key + ' off the screen');
        assert.ok(t.w >= 76 && t.h >= 44, t.key + ' is too small for a finger: ' + t.w + ' x ' + t.h);
    });
    /* no two places overlap */
    const T = page.targets();
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
        const a = T[i], b = T[j];
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, a.key + ' overlaps ' + b.key);
    }
    /* its jobs are on the page: the HMI's bar buttons for them are put away */
    assert.deepStrictEqual(page.hidden, { BTN_SHOW: true, BTN_DESIGN: true, BTN_CENTRE: true });
    /* the way out closes the app's screen */
    page.run('exit');
    assert.deepStrictEqual(page.closed, ['MAIN']);
});

test('CLUSTER: on / off, the design, and what shows in this style\'s middle - each one press', () => {
    const page = Harness.open({ values: { style: 'track', enabled: false } });
    page.run('show');
    assert.strictEqual(page.values.enabled, true);
    page.run('show');
    assert.strictEqual(page.values.enabled, false);
    /* the middle: this style's own setting, no other's */
    assert.deepStrictEqual(keys(page, 'centre:'), item('mCentre').options.map((o) => 'centre:' + o[0]));
    page.run('centre:camera');
    assert.deepStrictEqual([page.values.mCentre, page.values.pCentre, page.values.tCentre], ['camera', 'waze', 'off']);
    /* the arrows step through the designs, round and back */
    page.run('next');
    assert.strictEqual(page.values.style, 'mplus');
    assert.deepStrictEqual(keys(page, 'centre:'), item('pCentre').options.map((o) => 'centre:' + o[0]));
    page.run('centre:map');
    assert.deepStrictEqual([page.values.mCentre, page.values.pCentre, page.values.tCentre], ['camera', 'map', 'off']);
    /* M Track Mode: its picture goes in its left wing, in place of its gauges - and it has no turn card */
    page.run('next');
    assert.strictEqual(page.values.style, 'mtrack');
    assert.deepStrictEqual(keys(page, 'centre:'), ['centre:off', 'centre:waze', 'centre:map', 'centre:camera']);
    page.run('centre:waze');
    assert.deepStrictEqual([page.values.mCentre, page.values.pCentre, page.values.tCentre, page.values.kCentre],
        ['camera', 'map', 'off', 'waze']);
    page.run('next');
    assert.deepStrictEqual([page.values.style, page.values.background], ['toro', 'genuine']);
    /* Toro has no turn card */
    assert.deepStrictEqual(keys(page, 'centre:'), ['centre:off', 'centre:waze', 'centre:map', 'centre:camera']);
    page.run('centre:waze');
    assert.deepStrictEqual([page.values.mCentre, page.values.pCentre, page.values.tCentre, page.values.kCentre],
        ['camera', 'map', 'waze', 'waze']);
    page.run('prev');
    assert.strictEqual(page.values.style, 'mtrack');
    page.run('prev');
    assert.strictEqual(page.values.style, 'mplus');
    /* and the cluster is built with the style's own: the app's names reach the builder */
    const atlas = require('../assets/fonts/atlas.json');
    assert.strictEqual(Themes.build(atlas, 'x3m40i', page.values).settings.centre, 'map');
    assert.strictEqual(Themes.build(atlas, 'x3m40i', Object.assign({}, page.values, { style: 'track' })).settings.centre, 'camera');
    assert.strictEqual(Themes.build(atlas, 'x3m40i', Object.assign({}, page.values, { style: 'toro' })).settings.centre, 'waze');
    assert.strictEqual(Themes.build(atlas, 'x3m40i', Object.assign({}, page.values, { style: 'mtrack' })).settings.centre, 'waze');
});

test('a tab of settings holds its own style\'s adjustments and nothing of another\'s', () => {
    for (const style of ['toro', 'track', 'mplus', 'mtrack']) {
        const page = Harness.open({ values: { style } });
        for (const tab of TABS.slice(1)) {
            page.run('tab:' + tab);
            assert.deepStrictEqual(keys(page, 'set:'), offered(tab, page.values).map((k) => 'set:' + k), style + ' / ' + tab);
            /* another style's page says so, and offers the way to it */
            const other = STYLE_OF[tab] && STYLE_OF[tab] !== style;
            assert.deepStrictEqual(keys(page, 'use:'), other ? ['use:' + STYLE_OF[tab]] : [], style + ' / ' + tab);
            /* the bar is still there, first */
            assert.strictEqual(page.targets()[0].key, 'exit');
        }
        page.run('tab:cluster');
        assert.strictEqual(keys(page, 'set:').length, 0);
    }
    /* Toro's own are nowhere on an M tab, and the other way round */
    const page = Harness.open({ values: { style: 'toro' } });
    page.run('tab:msport');
    const m = keys(page, 'set:');
    assert.ok(m.indexOf('set:mFootL') >= 0 && m.indexOf('set:mCentre') >= 0 && m.indexOf('set:mPanel') >= 0);
    assert.ok(m.every((k) => !/^set:(accent|background|shiftStyle|zoom|tCentre|[pk][A-Z])/.test(k)), m.join(' '));
    page.run('tab:toro');
    const t = keys(page, 'set:');
    assert.ok(t.indexOf('set:accent') >= 0 && t.indexOf('set:tCentre') >= 0);
    assert.ok(t.every((k) => !/^set:[mpk](Foot|Panel|Pop|Centre|Row)/.test(k)), t.join(' '));
    /* M Track Mode's tab: its wing, its four rows, its footer - and no other style's */
    page.run('tab:mtrack');
    const k = keys(page, 'set:');
    assert.deepStrictEqual(k, ['kCentre', 'kWing', 'kRow1', 'kRow2', 'kRow3', 'kRow4', 'kRowMark', 'kFootL', 'kFootM', 'kFootR'].map((n) => 'set:' + n));
    /* "use this style" takes it, and the offer goes */
    page.run('tab:mplus');
    page.run('use:mplus');
    assert.strictEqual(page.values.style, 'mplus');
    assert.deepStrictEqual(keys(page, 'use:'), []);
});

test('a row offered only with another setting comes and goes with it', () => {
    const page = Harness.open({ values: { style: 'toro', background: 'genuine', intro: false, revFlash: 'off' } });
    page.run('tab:toro');
    assert.ok(keys(page, 'set:').indexOf('set:nodeColour') < 0);
    page.settings.set('background', 'modern');
    assert.ok(keys(page, 'set:').indexOf('set:nodeColour') >= 0 && keys(page, 'set:').indexOf('set:hexTint') >= 0);
    assert.ok(keys(page, 'set:').indexOf('set:flashColour') < 0, 'no flash: no colour for it');
    page.run('tab:general');
    assert.ok(keys(page, 'set:').indexOf('set:introMessage') < 0 && keys(page, 'set:').indexOf('set:flashStyle') < 0);
    page.settings.set('intro', true);
    page.settings.set('revFlash', 'both');
    const g = keys(page, 'set:');
    assert.ok(g.indexOf('set:introMessage') >= 0 && g.indexOf('set:introSeconds') >= 0 && g.indexOf('set:flashStyle') >= 0);
});

test('a row pressed: a switch turns, a choice opens its values in the kit\'s own list and takes the one picked', () => {
    const page = Harness.open({ values: { style: 'track', holiday: false } });
    page.run('tab:general');
    page.focus('set:holiday');                       /* (out of view: the controller brings it in) */
    page.run('set:holiday');
    assert.strictEqual(page.values.holiday, true);
    assert.strictEqual(page.sheet(), null, 'a switch needs no list');
    page.run('tab:msport');
    page.run('set:mFootR');
    const sh = page.sheet();
    assert.ok(sh, 'the values, as a list over the page');
    assert.strictEqual(sh.title, item('mFootR').label);
    assert.deepStrictEqual(sh.rows().map((r) => r.label), item('mFootR').options.map((o) => o[1]));
    assert.strictEqual(sh.rows().findIndex((r) => r.on), Track.FOOT_KINDS.indexOf('outside'), 'the one in use is marked');
    /* the controller: down to "Intake air temperature", press */
    sh.move(Track.FOOT_KINDS.indexOf('iat') - sh.sub);
    assert.strictEqual(sh.press(), 'close', 'picked: the list closes');
    assert.strictEqual(page.values.mFootR, 'iat');
    assert.strictEqual(page.values.pFootR, 'outside', 'the other M style keeps its own');
    /* Back leaves it as it was */
    page.closeSheet();
    page.run('set:mFootL');
    assert.strictEqual(page.sheet().back(), 'close');
    assert.strictEqual(page.values.mFootL, 'time');
});

test('a long page of settings scrolls: the controller brings a row into view, a finger drags it, a tap presses', () => {
    const page = Harness.open({ values: { style: 'toro' } });
    page.run('tab:general');
    const rows = offered('general', page.values);
    assert.ok(rows.length >= 12, 'more rows than the screen holds');
    const onScreen = (t) => t.y >= 0 && t.y + t.h <= 600;
    const at = (k) => page.target('set:' + k);
    assert.ok(onScreen(at(rows[0])) && !onScreen(at(rows[rows.length - 1])), 'the last row starts out of view');
    /* a row out of view is no place for a finger: it stands well clear of the page */
    assert.ok(at(rows[rows.length - 1]).y > 2000);
    /* the controller lands on it (the kit says so): it is brought in, whole */
    page.focus('set:' + rows[rows.length - 1]);
    assert.ok(onScreen(at(rows[rows.length - 1])), 'in view: ' + JSON.stringify(at(rows[rows.length - 1])));
    assert.ok(!onScreen(at(rows[0])), 'the first has gone up out of it');
    assert.ok(at(rows[0]).y < -2000);
    page.focus('set:' + rows[0]);
    assert.ok(onScreen(at(rows[0])));
    /* a finger: a drag up the list moves it by as much */
    const y0 = at(rows[3]).y;
    assert.strictEqual(page.touch(1, 800, 500), true, 'a touch on the list is the page\'s');
    page.touch(2, 800, 480); page.touch(2, 800, 380); page.touch(3, 800, 380);
    assert.ok(Math.abs((y0 - at(rows[3]).y) - 120) < 1.5 || !onScreen(at(rows[3])), 'the list followed the finger');
    const before = JSON.stringify(page.values);
    assert.strictEqual(JSON.stringify(page.values), before, 'a drag presses nothing');
    /* a tap presses the row under it */
    page.focus('set:autoStart');
    const r = at('autoStart'), was = page.values.autoStart;
    page.touch(1, r.x + 200, r.y + r.h / 2); page.touch(3, r.x + 200, r.y + r.h / 2);
    assert.strictEqual(page.values.autoStart, !was);
    /* the bar is not the list's: a touch there is left to the kit (its places) */
    assert.strictEqual(page.touch(1, 500, 30), false);
    /* and on CLUSTER nothing is */
    page.run('tab:cluster');
    assert.strictEqual(page.touch(1, 800, 400), false);
});

test('pushed left with nothing further left: a settings page goes back to CLUSTER, CLUSTER leaves to the kit', () => {
    const page = Harness.open({ values: { style: 'toro' } });
    page.run('tab:toro');
    assert.strictEqual(page.back(false), false, 'not at the edge: the kit moves the controller left');
    assert.strictEqual(page.back(true), true, 'at the edge: back to CLUSTER');
    assert.ok(page.target('show'), 'CLUSTER is showing');
    assert.strictEqual(page.focused(), 'tab:cluster', 'the controller is put on its tab');
    assert.strictEqual(page.back(true), false, 'from CLUSTER the kit closes the screen');
});

test('nothing on the page relies on clipping (the head unit\'s software renderer has none)', () => {
    const clip = Recorder.prototype.clip;
    let n = 0;
    Recorder.prototype.clip = function () { n++; return clip.apply(this, arguments); };
    try {
        for (const own of [true, false]) {
            const page = Harness.open({ values: { style: 'toro' }, own });
            if (own) TABS.forEach((t) => { page.run('tab:' + t); page.focus('set:introSeconds'); });
        }
    } finally { Recorder.prototype.clip = clip; }
    assert.strictEqual(n, 0);
});

test('without the renderer: the plain page in the HMI\'s own, its bar buttons doing the jobs', () => {
    const page = Harness.open({ values: { style: 'track', enabled: false }, own: false });
    assert.deepStrictEqual([page.shot().w, page.shot().h], [1600, 520]);
    assert.deepStrictEqual(page.targets(), [], 'no places: the HMI\'s bar and settings list are used');
    assert.ok(Object.keys(page.hidden).every((b) => page.hidden[b] === false), 'its bar buttons stay');
    page.click('BTN_SHOW');
    assert.strictEqual(page.values.enabled, true);
    page.click('BTN_DESIGN');
    assert.strictEqual(page.values.style, 'mplus');
    /* the middle steps through this style's own choices */
    const opts = item('pCentre').options.map((o) => o[0]);
    const seen = [page.values.pCentre];
    for (let i = 0; i < opts.length; i++) { page.click('BTN_CENTRE'); seen.push(page.values.pCentre); }
    assert.deepStrictEqual(seen.slice(1).sort(), opts.slice().sort(), 'every choice, once round');
    assert.strictEqual(page.values.mCentre, 'off', 'M Sport\'s own is untouched');
});

test('with no cluster service the page still draws, and says so', () => {
    const page = Harness.open({ values: { style: 'toro' }, service: null });
    assert.ok(page.target('show'));
});
