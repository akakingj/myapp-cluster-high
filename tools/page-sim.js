#!/usr/bin/env node
'use strict';
/*
 * The app's page, simulated: the built package's own app.js on the kit's
 * real runtime (kit/runtime/mgu.js, display.js, the settings store, the
 * renderer client), with only BMW's SDK stood in for.
 *
 *   node tools/page-sim.js          build, run both ways, report
 *
 * tools/car-sim.js runs the package the way the platform's autostart does:
 * no screens, the cluster service alone. test/page.test.js presses the
 * page's places through stand-ins for the kit. Neither runs the page ON the
 * kit, which is where a call the kit does not have, or a setting the built
 * spec has lost, would only show on the car. This does, twice:
 *
 *   gpu   with the Store's renderer (its client writing to a file, as the
 *         kit's own tooling has it): the page in the kit's frame (its
 *         header with Settings, the bar with Cluster on / off and Logs),
 *         worked with the controller and a finger - round its places, a
 *         card, a place's values, Settings a step at a time, Logs, back.
 *   soft  without the renderer: the plain page in the HMI's frame, its
 *         jobs done by the HMI's bar buttons.
 *
 * It fails on anything the kit logs as an error, on a place that is missing
 * or does not do its job, and on a setting that does not reach the store.
 *
 * What it cannot prove: BMW's HMI and the renderer themselves.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'app.base.json'), 'utf8'));
const ID = spec.id;
const PKG = path.join(ROOT, 'dist', ID);
const SRC = path.join(PKG, 'source');
const OUT = path.join(ROOT, 'build', 'page-sim');

/* ------------------------------------------------- the head unit's parts */
function installHeadUnit(settings) {
    const nm = path.join(SRC, 'node_modules');
    const put = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(nm, rel)), { recursive: true });
        fs.writeFileSync(path.join(nm, rel), text);
    };
    /* BMW's SDK, with the app's screens: components made as they are asked for, every call answered */
    put('oap-sdk/package.json', '{"name":"oap-sdk","version":"0.0.0-sim","main":"index.js"}');
    put('oap-sdk/index.js', `'use strict';
const EventEmitter = require('events');
const sim = global.__sim = { log: [], closed: [], comps: {}, pushed: 0 };
const ok = () => Promise.resolve();
class Comp extends EventEmitter {
  constructor(name, id) { super(); this.name = name; this.id = id; this.props = {}; }
  getId() { return this.id; }
  setProperty(k, v) { this.props[k] = v; return ok(); }
  setValue(row, cell) { if (cell === 'Graphic') sim.pushed++; return ok(); }
  setRowCount() { return ok(); }
  updateResources() { return ok(); }
}
class Rhmi extends EventEmitter {
  constructor() { super(); this.n = 100; }
  getByName(name) {
    if (name === 'KIT_HMI_ID8') return null;                 /* an iDrive 7 head unit */
    return sim.comps[name] || (sim.comps[name] = new Comp(name, this.n++));
  }
  openState() { return ok(); }
  closeState(name) { sim.closed.push(name); return ok(); }
  mapEntryState() { return ok(); }
  openEntryState() { return ok(); }
  getResourceBundle() { return { createResourceHandles: ok, getResourceHandle: () => 1, destroyResourceHandles: ok }; }
}
class OnlineApp extends EventEmitter {
  constructor() { super(); this.rhmiApplication = new Rhmi(); this.startReason = 'ENTRY_POINT'; }
  start() { setTimeout(() => this.emit('appStatusProxyReady'), 5); return ok(); }
  registerActive() { return ok(); }
  registerHmiVisible() { return ok(); }
  unregisterHmiVisible() { return ok(); }
  initialized() { return ok(); }
  getLastExecutedEntryPointUuid() { return null; }
}
const say = (level) => function () {
  sim.log.push({ level, text: Array.prototype.map.call(arguments, (a) => (a && a.stack) || String(a)).join(' ') });
};
module.exports = { OnlineApp, logging: { getSDKLogger: () => ({
  error: say('error'), warn: say('warn'), info: say('info'), debug() {} }) } };
`);
    /* the native SOME/IP binding: a car that is not saying anything */
    put('someip/package.json', '{"name":"someip","version":"0.0.0-sim","main":"index.js"}');
    put('someip/index.js', `'use strict';
exports.buildProxy = () => Promise.resolve({
  init() { return Promise.resolve(); }, isAvailable() { return false; }, subscribeToAvailability() {},
  getValue() { return Promise.reject(new Error('no value')); }, subscribe() { return Promise.resolve(); },
  shutdown() { return Promise.resolve(); }
});
`);
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', ID, 'app.json'), 'utf8'));
    const dir = path.join(PKG, 'someipInterfaces');
    fs.mkdirSync(dir, { recursive: true });
    Object.keys(app.signals).forEach((iface) => {
        const fields = {};
        Object.keys(app.signals[iface]).filter((f) => f[0] !== '_').forEach((f) => { fields[f] = { getter: true, notifier: true }; });
        fs.writeFileSync(path.join(dir, iface.replace(/\./g, '_') + '.json'), JSON.stringify({ interface: iface, fields }));
    });
    const data = path.join(PKG, 'data');
    fs.rmSync(data, { recursive: true, force: true });
    fs.mkdirSync(data, { recursive: true });
    /* (null: a new install, which has saved nothing yet) */
    if (settings) fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify(settings));
    fs.mkdirSync(path.join(PKG, 'rhmiData', 'resources'), { recursive: true });
    return data;
}

/* ================================================================ child */
async function child(mode) {
    const Module = require('module');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(20); } return !!fn(); };
    const problems = [], notes = [];
    const check = (ok, what) => { if (!ok) problems.push(what); return ok; };

    /* the app asks the kit to run it: let it, and keep the ctx the kit made */
    let ctx = null, started = null;
    const load = Module._load;
    Module._load = function (request, parent, isMain) {
        const m = load.call(this, request, parent, isMain);
        if (request === './kit/mgu' && m && typeof m.run === 'function' && !m.__sim) {
            const run = m.run;
            const wrapped = Object.assign({}, m, { __sim: true, run(impl) { started = run(impl).then((c) => { ctx = c; return c; }); return started; } });
            return wrapped;
        }
        return m;
    };
    process.chdir(path.join(PKG, 'data'));
    require(path.join(SRC, 'javascript', 'app.js'));
    await until(() => started, 3000);
    if (!started) { console.log(JSON.stringify({ problems: ['the app never asked the kit to run it'] })); process.exit(0); }
    await started.catch((e) => problems.push('the kit failed to start the app: ' + (e && e.stack || e)));
    const sim = global.__sim;
    const errors = () => sim.log.filter((l) => l.level === 'error').map((l) => l.text);
    if (!ctx) { console.log(JSON.stringify({ problems: problems.concat(['no screens: the kit did not hand a ctx over']).concat(errors()) })); process.exit(0); }

    const d = ctx.display, s = ctx.settings;
    const comp = (name) => ctx.ui.rhmi.getByName(name);
    comp('MAIN').emit('visible', { visible: true });           /* the driver opened the app */
    const keys = () => (d.pageTargets || []).map((t) => t.key);
    const has = (k) => keys().indexOf(k) >= 0;
    const target = (k) => (d.pageTargets || []).filter((t) => t.key === k)[0];
    const knob = (n, more) => Object.assign({ frontRotaryEncoderOperation: n, frontRotaryEncoderPushButton: 0, frontRotaryEncoderDeflection: 0 }, more);
    let k = 500;
    const turn = (n) => { for (let i = 0; i < Math.abs(n); i++) d._ccu(knob(k += n > 0 ? 1 : -1)); };
    const push = async () => { d._ccu(knob(k, { frontRotaryEncoderPushButton: 1 })); d._ccu(knob(k)); await wait(120); };
    const left = async () => { d._ccu(knob(k, { frontRotaryEncoderDeflection: 10 })); d._ccu(knob(k)); await wait(120); };
    const tap = async (key) => {
        const t = target(key);
        if (!check(!!t, 'no place "' + key + '" to tap (' + keys().join(' ') + ')')) return;
        const x = t.x + t.w / 2, y = t.y + t.h / 2;
        d._touch(1, x, y); d._touch(3, x, y);
        await wait(150);
    };

    if (mode === 'gpu') {
        check(await until(() => d.place && d.gpu && d.gpu.ready && d.gpu.visible, 6000), 'the renderer never showed the page');
        check(await until(() => has('design:mplus'), 4000), 'the page drew no places (' + keys().join(' ') + ')');
        /* ---- the kit's frame: its header (Settings its last tab), the page, the bar */
        check(d.fill() === false, 'the screen is a "fill" screen');
        check(d.own(), 'the kit is not running the screen');
        check(d.headH() > 0 && d.barH() > 0, 'the kit\'s header or bar is missing (' + d.headH() + ', ' + d.barH() + ')');
        check(JSON.stringify(d.buttons().map((b) => b.id)) === '["BTN_SHOW","BTN_LOGS"]', 'the bar is not Cluster on / off and Logs: ' + d.buttons().map((b) => b.id).join(' '));
        const tl = d._tabList();
        check(tl.settings === tl.tabs.length - 1 && tl.tabs[tl.settings] === 'Settings', 'Settings is not the header\'s tab: ' + JSON.stringify(tl));
        /* ---- the page: the style's own places on its picture, a card for each design */
        const DESIGNS = ['toro_genuine', 'toro_modern', 'toro_revuelto', 'track', 'mplus', 'mtrack'];
        ['place:tCentre'].concat(DESIGNS.map((id) => 'design:' + id)).forEach((key) => check(has(key), 'the page has no place "' + key + '"'));
        check(!keys().some((q) => /^(tab|set|exit|show)/.test(q)), 'the page still has tabs or rows of its own: ' + keys().join(' '));
        check(!keys().some((q) => /^place:[pmk][A-Z]/.test(q)), 'Toro\'s page shows another style\'s places: ' + keys().join(' '));
        notes.push('the page in the kit\'s frame, ' + keys().length + ' places: ' + keys().join(' '));
        /* ---- the controller: round the header, the places and the bar, each heard */
        d._ccu(knob(k));
        turn(1);
        const seen = [d.focusKey];
        for (let i = 0; i < 16; i++) { turn(1); if (seen.indexOf(d.focusKey) < 0) seen.push(d.focusKey); }
        check(seen.length >= 10, 'the controller reaches only ' + seen.length + ' places: ' + seen.join(' '));
        /* ---- a press on a card: that design on the cluster */
        d.focusPage('design:mplus'); await push();
        check(s.get('style') === 'mplus', 'pressing M Sport Plus\'s card did not choose it (' + s.get('style') + ')');
        check(await until(() => has('place:pCentre'), 1500), 'the page does not show M Sport Plus\'s own places (' + keys().join(' ') + ')');
        d.focusPage('design:toro_modern'); await push();
        check(s.get('style') === 'toro' && s.get('background') === 'modern', 'pressing Toro hex\'s card did not choose it');
        /* ---- a place on the picture: its list, a value picked, into this style's own setting */
        d.focusPage('design:mplus'); await push();
        await until(() => has('place:pCentre'), 1500);
        const pc0 = s.get('pCentre');
        d.focusPage('place:pCentre'); await push();
        check(await until(() => !!d.sheet, 1500), 'M Sport Plus\'s centre place opened no list');
        if (d.sheet) {
            turn(1);
            d._ccu(knob(k, { frontRotaryEncoderPushButton: 1 })); d._ccu(knob(k));
            await until(() => !d.sheet, 1500);
            check(s.get('pCentre') !== pc0, 'the centre picked on the page did not reach M Sport Plus\'s own setting (pCentre ' + s.get('pCentre') + ')');
        }
        check(s.get('mCentre') === 'off' && s.get('tCentre') === 'off', 'another style\'s centre changed with it');
        /* ---- Settings, a step at a time: the top, then General, then the style in use's own */
        d._openTab(tl.settings);
        check(await until(() => !!(d.sheet && d.sheet.settings), 1500), 'the header\'s Settings opened no list');
        const sh = d.sheet || { rows: () => [] };
        const labels = () => sh.rows().map((r) => r.label);
        const to = async (label) => {
            const i = labels().indexOf(label);
            if (!check(i >= 0, 'Settings has no row "' + label + '" (' + labels().join(' | ') + ')')) return false;
            turn(i - sh.focus);
            d._ccu(knob(k, { frontRotaryEncoderPushButton: 1 })); d._ccu(knob(k));
            await wait(120);
            return true;
        };
        const top = labels();
        ['Show on the cluster', 'Style', 'Skin', 'General', 'M Sport Plus'].forEach((l) => check(top.indexOf(l) >= 0, 'the settings\' top has no "' + l + '": ' + top.join(' | ')));
        check(['Toro', 'M Sport', 'M Track'].every((l) => top.indexOf(l) < 0), 'the settings\' top lists another style\'s: ' + top.join(' | '));
        if (await to('M Sport Plus')) {
            check(sh.group === 'M Sport Plus', 'M Sport Plus did not open its list');
            check(labels().length > 3 && labels().indexOf('Footer, left') < 0, 'M Sport Plus\'s list is not its own adjustments: ' + labels().join(' | '));
            d._ccu(knob(k, { frontRotaryEncoderDeflection: 10 })); d._ccu(knob(k)); await wait(120);
            check(sh.group === null && !!d.sheet, 'pushed left in a group did not go back to the top');
        }
        if (await to('General')) {
            check(sh.group === 'General', 'General did not open its list');
            /* a switch: turned at a press */
            const hol = s.get('holiday');
            if (await to(spec.settings.filter((q) => q.key === 'holiday')[0].label)) check(s.get('holiday') === !hol, 'a press on a switch did not turn it');
            /* ---- Shift now at: a row of General's for every car (no Car to choose): off as it comes, a list of values,
               Auto chosen with the controller */
            check(s.get('profile') === undefined, 'General > Car is still there: ' + s.get('profile'));
            check(s.get('shiftAt') === 'off', 'Shift now at does not come off: ' + s.get('shiftAt'));
            const shiftLabel = (spec.settings.filter((q) => q.key === 'shiftAt')[0] || {}).label;
            if (await to(shiftLabel)) {
                check(!!sh.open, 'Shift now at opened no list');
                turn(1);
                d._ccu(knob(k, { frontRotaryEncoderPushButton: 1 })); d._ccu(knob(k));
                await wait(120);
                check(s.get('shiftAt') === 'auto', 'choosing Auto for Shift now at did not reach the store: ' + s.get('shiftAt'));
            }
        }
        d.closeSheet();
        await until(() => !d.sheet, 1000);
        /* ---- values an older version saved: as the store hands them on (on / off was a switch) */
        check(s.get('enabled') === 'on', 'a saved switch (true) was not carried to "On": ' + JSON.stringify(s.get('enabled')));
        check(s.get('bottomExtra') === '18', 'a saved "A little" (24) was not carried to the largest trim: ' + JSON.stringify(s.get('bottomExtra')));
        /* ---- Logs: its codes in the page's place; pushed left with nothing further left, the page again; on the page, out */
        d._click('BTN_LOGS');
        check(await until(() => has('logs:make'), 2000), 'Logs did not show its codes (' + keys().join(' ') + ')');
        /* pushed left until nothing is further left (the header's Settings, the bar's first button, the page's places) */
        const edge = async (done) => { for (let i = 0; i < 6 && !done(); i++) await left(); };
        await edge(() => has('design:mplus') || sim.closed.length > 0);
        check(has('design:mplus'), 'pushed left on Logs did not go back to the page');
        check(sim.closed.length === 0, 'pushed left on Logs closed the screen');
        await edge(() => sim.closed.length > 0);
        check(sim.closed.indexOf('MAIN') >= 0, 'pushed left on the page did not leave the app');
        /* ---- on / off: the bar's */
        const en = s.get('enabled');
        d._click('BTN_SHOW'); await wait(150);
        check(s.get('enabled') === (en === 'on' ? 'off' : 'on'), 'the bar\'s Cluster on / off did not turn the cluster ' + (en === 'on' ? 'off' : 'on'));
    } else {
        /* the plain page: the HMI shows what the app pushes, and its bar does the jobs */
        check(await until(() => sim.pushed > 0, 8000), 'the plain page was never pushed to the HMI');
        /* a new install: Shift now at and the cold-engine guard as they come */
        /* (Cold engine on as it comes, as Cluster Layouts', AK 0.17.0) */
        check(s.get('shiftAt') === 'off' && s.get('coldGuard') === 'on', 'a new install does not come with Shift now at off and Cold engine on: ' + s.get('shiftAt') + ' ' + s.get('coldGuard'));
        check(!d.own(), 'the kit says it runs the screen with no renderer there');
        const en = s.get('enabled');
        comp('BTN_SHOW').emit('action', {}); await wait(200);
        check(s.get('enabled') === (en === 'on' ? 'off' : 'on'), 'the bar\'s Cluster on / off did not switch it');
        const before0 = sim.pushed;
        comp('BTN_LOGS').emit('action', {}); await wait(300);
        check(sim.pushed > before0, 'the bar\'s Logs drew nothing');
        ['BTN_SHOW', 'BTN_LOGS'].forEach((b) => check(comp(b).props.Visible !== 0, 'the HMI\'s ' + b + ' is hidden with no page to do its job'));
        notes.push('pushed ' + sim.pushed + ' frames to the HMI');
    }
    /* what was saved is what the next start reads */
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(path.join(PKG, 'data', 'settings.json'), 'utf8')); } catch (e) { problems.push('settings.json: ' + e.message); }
    ['style', 'enabled', 'shiftAt'].forEach((key) => check(saved[key] === s.get(key), 'the saved ' + key + ' (' + saved[key] + ') is not the one in use (' + s.get(key) + ')'));
    errors().forEach((e) => problems.push('the kit logged an error: ' + e.split('\n')[0].slice(0, 220)));
    /* (the offline build has no RHMI description: the kit says so, and it is not the car's case) */
    const warns = sim.log.filter((l) => l.level === 'warn' && !/no rhmiData\/application\.json/.test(l.text))
        .map((l) => l.text.split('\n')[0].slice(0, 160));
    /* everything the kit said, for whoever reads a failure */
    try { fs.writeFileSync(path.join(OUT, mode + '-kit.log'), sim.log.map((l) => l.level + ' ' + l.text).join('\n') + '\n'); } catch (e) { /* the result says enough */ }
    console.log('RESULT ' + JSON.stringify({ problems, notes, warns: Array.from(new Set(warns)).slice(0, 12) }));
    process.exit(0);
}

/* =============================================================== parent */
function runChild(mode, settings) {
    installHeadUnit(settings);
    const env = Object.assign({}, process.env);
    /* no cluster service's neighbours here, and no renderer socket unless this run has its file */
    delete env.MGU_RENDERD_FILE;
    delete env.MGU_RENDERD_SOCKET;
    if (mode === 'gpu') env.MGU_RENDERD_FILE = path.join(OUT, 'frames-' + mode + '.bin');
    else env.MGU_RENDERD_SOCKET = path.join(OUT, 'no-renderer.sock');
    const r = cp.spawnSync(process.execPath, [__filename, '--child', mode], { cwd: ROOT, env, encoding: 'utf8', timeout: 90000 });
    fs.writeFileSync(path.join(OUT, mode + '.log'), (r.stdout || '') + '\n--- stderr\n' + (r.stderr || ''));
    const line = (r.stdout || '').split('\n').filter((l) => l.indexOf('RESULT ') === 0)[0];
    if (!line) return { problems: ['the run gave no result (' + (r.error ? r.error.message : 'exit ' + r.status) + '): ' + String(r.stderr || '').trim().split('\n').slice(-3).join(' | ')], notes: [], warns: [] };
    return JSON.parse(line.slice(7));
}

function main() {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    process.stdout.write('building the package with the kit\'s builder... ');
    cp.execSync('node tools/stage-app.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    cp.execSync('python3 kit/tools/build.py --preview-only ' + ID, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    console.log('done');
    let failed = 0;
    [['gpu', 'with the Store\'s renderer: the kit\'s frame, the controller',
      /* as a car that ran Beta 3 has it saved: the old shared centre, "A little" of the strip */
      { enabled: true, style: 'toro', centre: 'camera', bottomExtra: '24' }],
     ['soft', 'without the renderer, a new install: the plain page and the HMI\'s bar', null]
    ].forEach(([mode, what, settings]) => {
        const r = runChild(mode, settings);
        console.log('\n' + what);
        r.notes.forEach((n) => console.log('  ' + n));
        if (r.warns.length) { console.log('  warnings from the kit:'); r.warns.forEach((w) => console.log('    ' + w)); }
        if (r.problems.length) { failed++; r.problems.forEach((p) => console.log('  FAILED: ' + p)); } else console.log('  as expected');
    });
    console.log('\nwrote ' + path.relative(ROOT, OUT) + '/ (logs, the renderer\'s frames)');
    process.exit(failed ? 1 : 0);
}

if (process.argv[2] === '--child') child(process.argv[3]).catch((e) => { console.log('RESULT ' + JSON.stringify({ problems: ['the run threw: ' + (e && e.stack || e)], notes: [], warns: [] })); process.exit(0); });
else main();
