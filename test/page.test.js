'use strict';
/*
 * The app's own page on the iDrive screen, as AK Cluster Layouts': the design,
 * its places and the designs' cards, the bar's Show on the cluster and Logs, and
 * the settings in the kit's list a step at a time (General, then the style in
 * use's own). The staged app is run as it is (tools/page-harness.js) and its
 * places are pressed.
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

const Sheet = require(path.join(Harness.KIT, 'sheet.js'));
const TOP = ['enabled', 'autoStart', 'style'];
/* the groups every style has, as Cluster Layouts' sections and in their order, then each style's own */
const SHARED = ['Display', 'Readouts and gauges', 'Red zone and shift', 'Units and clock', 'Car'];
const GROUP_STYLE = { Display: null, 'Readouts and gauges': null, 'Red zone and shift': null, 'Units and clock': null, Car: null,
    Toro: 'toro', 'M Sport': 'track', 'M Sport Plus': 'mplus', 'M Track': 'mtrack' };
const GROUP_OF = { toro: 'Toro', track: 'M Sport', mplus: 'M Sport Plus', mtrack: 'M Track' };
const item = (k) => spec.settings.find((s) => s.key === k);
const keys = (page, prefix) => page.targets().map((t) => t.key).filter((k) => k.indexOf(prefix) === 0);
/* the kit's settings list (kit/runtime/mgu.js, BTN_SETTINGS): its rows' words at the top, or in a group */
function listed(page, group) {
    const sh = Sheet.listSheet(page.settings, null, {});
    if (group) sh.group = group;
    return sh.rows().map((r) => r.label);
}
/* what a group should list, from the manifest: its settings offered now */
const offered = (group, values) => spec.settings.filter((s) => s.group === group && !s.hidden && Object.keys(s.when || {}).every((k) =>
    [].concat(s.when[k]).indexOf(values[k]) >= 0)).map((s) => s.label);

test('the settings: on / off and the style on top, then Cluster Layouts\' sections and a group each style keeps its own under', () => {
    assert.deepStrictEqual(spec.settings.filter((s) => !s.group).map((s) => s.key), TOP);
    for (const s of spec.settings) {
        if (TOP.indexOf(s.key) >= 0) continue;
        assert.ok(s.group in GROUP_STYLE, s.key + ': no group');
        if (GROUP_STYLE[s.group] === null) assert.ok(!(s.when && s.when.style), s.key + ': a shared setting tied to a style');
        /* a style's own: offered only while it is the style in use */
        else assert.strictEqual(s.when && s.when.style, GROUP_STYLE[s.group], s.key + ': shown only for its style');
        if (s.type === 'choice') assert.ok(s.options.some((o) => o[0] === String(s.default)), s.key + ': its default is one of its values');
    }
    assert.strictEqual(new Set(spec.settings.map((s) => s.key)).size, spec.settings.length, 'no key twice');
    /* every name a style's builder is handed (src/theme/index.js OWN) is a setting in that style's group */
    for (const style of Object.keys(Themes.OWN)) {
        for (const name of Object.keys(Themes.OWN[style])) {
            const s = item(Themes.OWN[style][name]);
            assert.ok(s, `${style}: no setting ${Themes.OWN[style][name]}`);
            assert.strictEqual(s.group, GROUP_OF[style]);
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
        ['centre', 'wing', 'row1', 'row2', 'row3', 'row4', 'rowMark', 'stripL', 'stripR', 'footL', 'footM', 'footR']);
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

/* each style's places on the page, as app/entry.js has them, and the designs' cards */
const PLACES = {
    toro: ['tCentre', 'tCentreSize', 'gearPlace', 'showBoost', 'showAuxLeft', 'electricGauge', 'modeLabel', 'shiftStyle',
        'gaugeL1', 'gaugeL2', 'gaugeR1', 'gaugeR2'],
    track: ['mCentre', 'mCentreSize', 'mGear', 'mSpeed2', 'mFootL', 'mFootM', 'mFootR', 'mPanel'],
    mplus: ['pCentre', 'pCentreSize', 'pGear', 'pSpeed2', 'pFootL', 'pFootM', 'pFootR', 'pPanel'],
    mtrack: ['kCentre', 'kWing', 'kRow1', 'kRow2', 'kRow3', 'kRow4', 'kStripL', 'kStripR', 'kFootL', 'kFootM', 'kFootR']
};
/* the readings' places: set on the page alone, not in the settings list */
const PAGE_ONLY = ['gaugeL1', 'gaugeL2', 'gaugeR1', 'gaugeR2', 'mFootL', 'mFootM', 'mFootR', 'pFootL', 'pFootM', 'pFootR',
    'kRow1', 'kRow2', 'kRow3', 'kRow4', 'kStripL', 'kStripR', 'kFootL', 'kFootM', 'kFootR'];
const DESIGN_IDS = ['toro_genuine', 'toro_modern', 'toro_revuelto', 'track', 'mplus', 'mtrack'];
const placesOf = (style, values) => PLACES[style].filter((k) => Object.keys(item(k).when || {}).every((w) =>
    w === 'style' || [].concat(item(k).when[w]).indexOf(values[w]) >= 0)).map((k) => 'place:' + k);

test('the page: on / off under the picture, the design\'s places, then its cards - and no bar or tabs of its own (the kit\'s and the HMI\'s are there)', () => {
    for (const own of [true, false]) {
        const page = Harness.open({ values: { style: 'mplus' }, own });
        assert.deepStrictEqual(page.targets().map((t) => t.key), ['show'].concat(placesOf('mplus', page.values), DESIGN_IDS.map((d) => 'design:' + d)));
        assert.deepStrictEqual([page.shot().w, page.shot().h], [1600, 520]);
        page.targets().forEach((t) => {
            assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= 1600 && t.y + t.h <= 520, t.key + ' off the page');
            assert.ok(t.w >= 76 && t.h >= 44, t.key + ' is too small for a finger: ' + t.w + ' x ' + t.h);
        });
        /* no two places overlap */
        const T = page.targets();
        for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
            const a = T[i], b = T[j];
            assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, a.key + ' overlaps ' + b.key);
        }
    }
    /* the bar: Show on the cluster, Logs, Settings */
    assert.deepStrictEqual(spec.screens[0].buttons.map((b) => b[0]), ['BTN_SHOW', 'BTN_LOGS', 'BTN_SETTINGS']);
    assert.ok(!('fill' in spec.screens[0]) && !('hmi' in spec.screens[0]), 'the kit\'s header and bar round the page');
});

test('the page: on / off at the bar or under the picture, a design by its card, and each of its places - one press each', () => {
    const page = Harness.open({ values: { style: 'track', enabled: 'off' } });
    page.click('BTN_SHOW');
    assert.strictEqual(page.values.enabled, 'on');
    page.run('show');
    assert.strictEqual(page.values.enabled, 'off');
    page.run('show');
    assert.strictEqual(page.values.enabled, 'on');
    page.click('BTN_SHOW');
    assert.strictEqual(page.values.enabled, 'off');
    /* a card: its style (and Toro's background) */
    page.run('design:toro_modern');
    assert.deepStrictEqual([page.values.style, page.values.background], ['toro', 'modern']);
    assert.deepStrictEqual(keys(page, 'place:'), placesOf('toro', page.values));
    /* a switch goes over at a press */
    const boost = page.values.showBoost;
    page.run('place:showBoost');
    assert.strictEqual(page.values.showBoost, !boost);
    for (const style of ['track', 'mplus', 'mtrack']) {
        page.run('design:' + style);
        assert.strictEqual(page.values.style, style);
        assert.deepStrictEqual(keys(page, 'place:'), placesOf(style, page.values), style);
    }
    /* a place offered only while another says so: the centre's size, with a picture there */
    page.values.mCentre = 'off';
    page.run('design:mplus'); page.run('design:track');
    assert.ok(keys(page, 'place:').indexOf('place:mCentreSize') < 0);
    page.values.mCentre = 'waze';
    page.run('design:mplus'); page.run('design:track');
    assert.ok(keys(page, 'place:').indexOf('place:mCentreSize') >= 0);
});

test('a place with values: its list over the page, the value set marked; picked, it closes', () => {
    const page = Harness.open({ values: { style: 'track' } });
    page.run('place:mFootR');
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
    page.run('place:mFootL');
    assert.strictEqual(page.sheet().back(), 'close');
    assert.strictEqual(page.values.mFootL, 'time');
});

test('Settings, a step at a time: the top, the shared sections, and the style in use\'s own - nothing of another style\'s', () => {
    for (const style of Object.keys(GROUP_OF)) {
        const page = Harness.open({ values: { style } });
        assert.deepStrictEqual(listed(page), TOP.map((k) => item(k).label).concat(SHARED, [GROUP_OF[style]]), style);
        for (const g of SHARED.concat([GROUP_OF[style]])) assert.deepStrictEqual(listed(page, g), offered(g, page.values), style + ' / ' + g);
    }
    /* the readings' places are set on the page alone */
    PAGE_ONLY.forEach((n) => assert.ok(item(n).hidden && item(n).page, n));
    const page = Harness.open({ values: { style: 'track' } });
    const m = listed(page, 'M Sport');
    assert.ok(m.indexOf(item('mCentre').label) >= 0 && m.indexOf(item('mPanel').label) >= 0);
    assert.ok(PAGE_ONLY.every((n) => m.indexOf(item(n).label) < 0 || item(n).group !== 'M Sport'));
    /* a group opened and gone back from: the top again, on the row it was opened from */
    const sh = Sheet.listSheet(page.settings, null, {});
    sh.move(TOP.length);
    sh.press();
    assert.strictEqual(sh.group, 'Display');
    sh.back();
    assert.strictEqual(sh.group, null);
    assert.strictEqual(sh.focus, TOP.length);
});

test('a row offered only with another setting comes and goes with it', () => {
    const page = Harness.open({ values: { style: 'toro', background: 'genuine', intro: false, revFlash: 'off' } });
    const has = (g, k) => listed(page, g).indexOf(item(k).label) >= 0;
    assert.ok(!has('Toro', 'nodeColour'));
    page.settings.set('background', 'modern');
    assert.ok(has('Toro', 'nodeColour') && has('Toro', 'hexTint'));
    assert.ok(!has('Toro', 'flashColour'), 'no flash: no colour for it');
    assert.ok(!has('Display', 'introMessage') && !has('Red zone and shift', 'flashStyle'));
    page.settings.set('intro', true);
    page.settings.set('revFlash', 'both');
    assert.ok(has('Display', 'introMessage') && has('Display', 'introSeconds') && has('Red zone and shift', 'flashStyle'));
});

test('nothing on the page relies on clipping (the head unit\'s software renderer has none)', () => {
    const clip = Recorder.prototype.clip;
    let n = 0;
    Recorder.prototype.clip = function () { n++; return clip.apply(this, arguments); };
    try {
        for (const own of [true, false]) {
            const page = Harness.open({ values: { style: 'toro' }, own });
            page.click('BTN_LOGS');
        }
    } finally { Recorder.prototype.clip = clip; }
    assert.strictEqual(n, 0);
});

test('without the renderer: the same page in the HMI\'s own, a place stepping to its next value', () => {
    const page = Harness.open({ values: { style: 'track', enabled: 'off' }, own: false });
    page.click('BTN_SHOW');
    assert.strictEqual(page.values.enabled, 'on');
    page.run('design:mplus');
    assert.strictEqual(page.values.style, 'mplus');
    /* no list over the page there: the middle steps through this style's own choices */
    const opts = item('pCentre').options.map((o) => o[0]);
    const seen = [];
    for (let i = 0; i < opts.length; i++) { page.run('place:pCentre'); seen.push(page.values.pCentre); }
    assert.deepStrictEqual(seen.slice().sort(), opts.slice().sort(), 'every choice, once round');
    assert.strictEqual(page.values.mCentre, 'off', 'M Sport\'s own is untouched');
});

test('with no cluster service the page still draws, and says so', () => {
    const page = Harness.open({ values: { style: 'toro' }, service: null });
    assert.ok(page.shot().words().length > 0);
    assert.ok(page.target('design:toro_genuine'));
});

test('the page\'s words fit the head unit\'s string budget (the kit\'s builder checks it: kit/tools/localize.py)', () => {
    /* every drop-down row is a string of its own; past 1024 with the kit's 256 dynamic ones the build stops */
    const out = require('child_process').execFileSync('python3', ['-I', '-c', [
        'import sys, json',
        'sys.path.insert(0, "kit/tools")',
        'import localize',
        'seen = []',
        'orig = localize.unicode_resources',
        'def wrap(ui, strings, language="en"):',
        '    r = orig(ui, strings, language); seen.append(len(strings)); return r',
        'localize.unicode_resources = wrap',
        'import runpy',
        'for lang in (["--language", "en"], ["--language", "ko"]):',
        '    sys.argv = ["build.py", "--preview-only"] + lang + ["akakingj_cluster_id8"]',
        '    runpy.run_path("kit/tools/build.py", run_name="__main__")',
        'print(json.dumps(seen))'].join('\n')], { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const seen = JSON.parse(out.trim().split('\n').pop());
    assert.strictEqual(seen.length, 2);
    seen.forEach((n) => assert.ok(n <= 1024, n + ' strings'));
    require('fs').rmSync(path.join(__dirname, '..', 'dist'), { recursive: true, force: true });
});

test('Logs: the codes to photograph, three a page, and the whole as a file, as Cluster Layouts\' Logs', () => {
    const fs = require('fs');
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'id8-logs-'));
    const page = Harness.open({ values: { style: 'toro' }, dataDir: dir });
    page.click('BTN_LOGS');
    assert.deepStrictEqual(page.targets().map((t) => t.key), ['logs:prev', 'logs:next', 'logs:make']);
    const saved = fs.readdirSync(path.join(dir, 'exports'));
    assert.strictEqual(saved.length, 1);
    assert.match(saved[0], /^cluster-logs-id8-/);
    const text = fs.readFileSync(path.join(dir, 'exports', saved[0]), 'utf8');
    assert.match(text, /^=== AK Cluster ID8 /);
    ['settings', 'service', 'engine unit', 'data now', 'this app\'s log'].forEach((t) => assert.ok(text.indexOf('--- ' + t + ' ---') >= 0, t));
    /* the codes: the same as Cluster Layouts' (CLG1) */
    const Logs = require('../src/car/logs.js');
    const pages = Math.ceil(Logs.codes(text).codes.length / 3);
    assert.ok(pages >= 1);
    page.run('logs:make');
    assert.strictEqual(fs.readdirSync(path.join(dir, 'exports')).length, 2, 'made again: another file');
    /* Logs pressed again: its next page, past the last back to the page */
    for (let i = 1; i < pages; i++) { page.click('BTN_LOGS'); assert.ok(page.target('logs:make'), 'page ' + (i + 1)); }
    page.click('BTN_LOGS');
    assert.ok(page.target('design:toro_genuine'));
    /* the controller pushed left on Logs: back to the page; on the page it is the kit's (the screen closes) */
    page.click('BTN_LOGS');
    assert.strictEqual(page.back(), true);
    assert.ok(page.target('design:toro_genuine'));
    assert.strictEqual(page.back(), false);
});

test('in a drive mode with a style of its own (Style in Sport / in ECO PRO), the page shows that design and a card picks it there', () => {
    const page = Harness.open({ values: { style: 'toro', background: 'genuine', styleSport: 'mtrack', styleEco: 'same' }, mode: 'sport' });
    assert.deepStrictEqual(keys(page, 'place:'), placesOf('mtrack', page.values), 'M Track Mode\'s places');
    page.run('design:mplus');
    assert.deepStrictEqual([page.values.styleSport, page.values.style, page.values.background], ['mplus', 'toro', 'genuine']);
    /* ECO PRO with Same as Style: a card is Style's */
    const eco = Harness.open({ values: { style: 'toro', background: 'genuine', styleSport: 'mtrack', styleEco: 'same' }, mode: 'eco' });
    eco.run('design:toro_modern');
    assert.deepStrictEqual([eco.values.style, eco.values.background, eco.values.styleSport], ['toro', 'modern', 'mtrack']);
});

test('Settings > Start-up words: the head unit\'s keyboard; OK with words makes them the start-up message, left without OK changes nothing', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const page = Harness.open({ values: { intro: false, introMessage: 'mgu' }, typed: '  안녕하세요   동하님  ' });
    assert.deepStrictEqual(page.rows.map((r) => r.label), ['Start-up words']);
    assert.strictEqual(page.rows[0].value(), 'Not typed yet');
    assert.strictEqual(page.rows[0].open(), null, 'the settings stay open under the keyboard');
    await wait(20);
    assert.deepStrictEqual(page.typing, ['Start-up words'], 'the keyboard\'s title');
    assert.deepStrictEqual([page.values.introWords, page.values.introMessage, page.values.intro], ['안녕하세요 동하님', 'custom', true]);
    assert.strictEqual(page.rows[0].value(), '안녕하세요 동하님');
    const left = Harness.open({ values: { intro: false, introMessage: 'mgu', introWords: 'Ciao' }, typed: null });
    left.rows[0].open();
    await wait(20);
    assert.deepStrictEqual([left.values.introWords, left.values.introMessage, left.values.intro], ['Ciao', 'mgu', false]);
});
