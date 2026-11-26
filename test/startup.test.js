'use strict';
/*
 * Coming up quicker (0.23.1): the cluster's start reads the style in use alone and none of the page's pictures;
 * the page reads its pictures when it first draws them, and without them draws its sketches; the start-up timings
 * go in the log once a start; Show on the cluster, pressed, is acted on at once and comes up as SHOW_SETTLE_MS ends.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const Startup = require('../src/car/startup.js');

const APP = path.join(__dirname, '..', 'apps', 'akakingj_cluster_id8');

/* a cold start of the packaged service in a process of its own: what it read by the first frame */
function coldStart(style) {
    const script = `
        const Main = require(${JSON.stringify(path.join(APP, 'service.js'))});
        const on = {}; let shown = false;
        const cr = { on(e, f) { on[e] = f; }, asset() { return 1; }, effect() { return 2; }, uniform() {}, bind() {},
            pixels() {}, drop() {}, close() {}, set(r, o) { if (o && o.visible === true) shown = true; } };
        let onValue = null; const logs = [];
        const host = { log: { info(m) { logs.push(m); }, warn(m) { logs.push(m); } },
            settings: () => ({ profile: 'carprofile', enabled: 'on', style: ${JSON.stringify(style)} }),
            onSettingsChanged() {}, subscribe(s, cb) { onValue = cb; } };
        const svc = Main.start(host, { cr, presence: { othersShowing() { return false; }, mark() {} }, showSettleMs: 0,
            centre: { want() {}, state: () => ({}) } });
        on.ready();
        onValue('de.bmw.infrastructure.VehicleCondition', 'VehicleCondition', { statusConditionVehicle: 'FAHREN' });
        onValue('de.bmw.infotainment.vehicle.CDS', 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 8000 });
        const t = Date.now();
        const iv = setInterval(() => {
            if (!shown && Date.now() - t < 5000) return;
            clearInterval(iv); svc.stop();
            const read = Object.keys(require.cache).map((k) => path.basename(k));
            process.stdout.write(JSON.stringify({ shown, read, startup: logs.filter((l) => /^startup: /.test(l)) }));
        }, 5);
        const path = require('path');`;
    return JSON.parse(execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
}

test('the cluster\'s start reads the style in use alone, and none of the page\'s pictures', () => {
    for (const [style, file] of [['toro', 'theme_toro.js'], ['track', 'theme_track.js'], ['mplus', 'theme_track.js'], ['mtrack', 'theme_mtrack.js']]) {
        const r = coldStart(style);
        assert.ok(r.shown, style + ': up');
        assert.deepStrictEqual(r.read.filter((n) => /^theme_/.test(n)), [file], style);
        assert.ok(r.read.indexOf('previews_data.js') < 0 && r.read.indexOf('previews.js') < 0, style + ': no pictures read');
        /* the timings, each once: from the service on (the modules' line is the page's, app/entry.js) */
        const stages = r.startup.map((l) => l.replace(/^startup: (.+?) \+.*$/, '$1'));
        assert.deepStrictEqual(stages, ['service', 'atlas', 'connected', 'on the cluster', 'first frame'], style);
        assert.ok(r.startup.every((l) => /^startup: .+ \+\d+ ms \(uptime \d+\.\d s\) \d\d:\d\d:\d\d\.\d{3}$/.test(l)), r.startup.join(' | '));
    }
});

test('the styles\' builders: read when first asked for, the drive mode\'s own read ahead', () => {
    delete require.cache[require.resolve('../src/theme/index.js')];
    const T = require('../src/theme/index.js');
    assert.deepStrictEqual(T.loaded(), []);
    assert.deepStrictEqual(Object.keys(T.THEMES), ['toro', 'track', 'mplus', 'mtrack'], 'every style still listed');
    T.preload('mtrack');
    assert.deepStrictEqual(T.loaded(), ['mtrack']);
    T.preload('mplus');
    assert.deepStrictEqual(T.loaded().sort(), ['mtrack', 'track']);
    T.preload('nonsense');
    assert.strictEqual(typeof T.THEMES.toro.build, 'function');
});

test('the page: its pictures read as it first draws them; without them, its sketches and no stop', () => {
    const Harness = require('../tools/page-harness.js');
    const data = path.join(APP, 'previews_data.js');
    delete require.cache[data];
    Harness.open({ values: { style: 'toro' } });
    assert.ok(require.cache[data], 'read once the page drew');
    /* pictures that can't be read (none packaged): the page draws all the same */
    delete require.cache[path.join(APP, 'previews.js')];
    delete require.cache[data];
    const load = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === './previews.js') throw new Error('Cannot find module \'./previews.js\'');
        return load.call(this, request, parent, isMain);
    };
    try {
        const page = Harness.open({ values: { style: 'mtrack' } });
        assert.ok(page.targets().length > 5, 'the page drawn');
        assert.ok(!require.cache[data]);
    } finally { Module._load = load; }
});

test('the timings: each step once a start, from the app\'s first line, with the wall clock; Show pressed, its steps', () => {
    const logs = [];
    let t = 1000;
    const S = Startup.create({ info: (m) => logs.push(m) }, { t0: 400, now: () => t, uptime: () => 12.34 });
    assert.strictEqual(S.mark('modules', 700), true);
    assert.strictEqual(S.mark('modules'), false, 'once');
    t = 1500; S.mark('first frame');
    assert.match(logs[0], /^startup: modules \+300 ms \(uptime 12\.3 s\) \d\d:\d\d:\d\d\.\d{3}$/);
    assert.match(logs[1], /^startup: first frame \+1100 ms/);
    S.show(true); t = 1503; S.showStep('applied'); t = 1505; S.showStep('wanted'); t = 2705; S.showStep('up');
    t = 2720; S.showStep('first frame');
    assert.strictEqual(logs[2], 'show: on the cluster +1220 ms (applied +3, wanted +5, up +1205, first frame +1220)');
    assert.strictEqual(S.showing(), false);
    S.showStep('up');
    assert.strictEqual(logs.length, 3, 'nothing while not pressed');
});
