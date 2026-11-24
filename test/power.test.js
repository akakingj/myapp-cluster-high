'use strict';
/*
 * A plug-in hybrid's Power % in the rev counter's place, as Cluster Layouts and the car's own cluster show it:
 * the pedal's demand 0 - 100, the regeneration (CHARGE) below 0 to -100, in its electric and hybrid modes; the rev
 * counter in SPORT, XTRABOOST and with the lever in S or M. The battery's power from eDrive Live's shared folder.
 *   node --test test/power.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Panel = require('../src/geometry/panel.js');
const Palette = require('../src/theme/palette.js');
const State = require('../src/engine/state.js');
const Vehicle = require('../src/car/vehicle.js');
const Providers = require('../src/car/providers.js');
const Themes = require('../src/theme/index.js');
const atlas = require('../assets/fonts/atlas.json');

const PROFILE = Panel.profile('carprofile');
const pct = (raw, electric) => State.powerPct(raw, electric || 'hybrid');

test('when: a plug-in hybrid\'s electric and hybrid modes; the rev counter in its sport ones, with the lever in S or M, on any other car', () => {
    assert.strictEqual(pct({ phevMode: 'electric', kw: -10 }, 'off'), null, 'not a plug-in hybrid (General: Electric range off)');
    assert.notStrictEqual(pct({ phevMode: 'electric' }), null);
    assert.notStrictEqual(pct({ phevMode: 'hybrid', rpm: 2500 }), null, 'HYBRID with the engine running too');
    assert.strictEqual(pct({ phevMode: 'sport', rpm: 0 }), null);
    assert.strictEqual(pct({ phevMode: 'hybrid', driveMode: 'SPORT' }), null);
    assert.strictEqual(pct({ phevMode: 'hybrid', program: 'S' }), null);
    assert.strictEqual(pct({ phevMode: 'hybrid', program: 'M' }), null);
    /* before the car has named a mode: Power % with the engine off, the rev counter with it running */
    assert.notStrictEqual(pct({ rpm: 0 }), null);
    assert.strictEqual(pct({ rpm: 1800 }), null);
    assert.strictEqual(pct({}), null);
    /* an electric car has no rev counter to keep */
    assert.notStrictEqual(pct({}, 'bev'), null);
});

test('how much: the pedal\'s demand, else the battery\'s power over its limits; the regeneration below 0', () => {
    assert.strictEqual(pct({ phevMode: 'electric', pedalPct: 45, kw: 30 }), 45);
    assert.strictEqual(pct({ phevMode: 'electric', pedalPct: 130 }), 100);
    /* off the pedal, charging: over the battery's charge limit (eDrive Live's, else 35 kW) */
    assert.strictEqual(pct({ phevMode: 'electric', pedalPct: 0, kw: -17.5 }), -50);
    assert.strictEqual(pct({ phevMode: 'electric', pedalPct: 0, kw: -10, kwIn: 40 }), -25);
    assert.strictEqual(pct({ phevMode: 'electric', kw: -90 }), -100);
    /* no pedal read: the power drawn over its discharge limit (eDrive Live's, else 100 kW) */
    assert.strictEqual(pct({ phevMode: 'electric', kw: 50 }), 50);
    assert.strictEqual(pct({ phevMode: 'electric', kw: 50, kwOut: 200 }), 25);
    assert.strictEqual(pct({ phevMode: 'electric' }), 0);
    /* and through the state, with the shift lights and the limiter's flash off */
    const st = State.present({ phevMode: 'electric', kw: -17.5, rpm: 0, gear: 'D' }, PROFILE, { electric: 'hybrid', shiftWarn: true });
    assert.strictEqual(st.power, -50);
    assert.strictEqual(st.limiter, 0);
    assert.strictEqual(st.shiftNow, false);
    assert.strictEqual(State.present({ rpm: 3000 }, PROFILE, {}).power, null);
});

test('its scale: the 0 on the mark nearest a quarter up, 100 at the top, the regeneration below the 0', () => {
    assert.strictEqual(Palette.powerZero(8), 2);
    assert.strictEqual(Palette.powerZero(7), 2);
    assert.strictEqual(Palette.powerZero(6), 2);
    assert.strictEqual(Palette.powerAt(0, 8), 2);
    assert.strictEqual(Palette.powerAt(100, 8), 8);
    assert.strictEqual(Palette.powerAt(50, 8), 5);
    assert.strictEqual(Palette.powerAt(-100, 8), 0);
    assert.strictEqual(Palette.powerAt(-50, 8), 1);
    assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => Palette.powerFigure(k, 8)), ['', '', '0', '', '', '50', '', '', '100']);
    assert.strictEqual(Palette.powerWord(-3), 'CHARGE');
    assert.strictEqual(Palette.powerWord(40), 'POWER');
});

test('the car\'s own plug-in hybrid modes, by name or number', () => {
    const m = (v) => Vehicle.phevModeOf({ actualValueModeDrivingExperience: v });
    assert.strictEqual(m('PHEV_ELECTRIC_STANDARD'), 'electric');
    assert.strictEqual(m('PHEV_ELECTRIC_INDIVIDUAL'), 'electric');
    assert.strictEqual(m('PHEV_HYBRID_ECO'), 'hybrid');
    assert.strictEqual(m('PHEV_BATTERY_CONTROL'), 'hybrid');
    assert.strictEqual(m('PHEV_SPORT_STANDARD'), 'sport');
    assert.strictEqual(m('PHEV_SPORT_PLUS'), 'sport');
    assert.strictEqual(m('XTRABOOST'), 'sport');
    assert.strictEqual(m(0x14), 'electric');
    assert.strictEqual(m(0x11), 'hybrid');
    assert.strictEqual(m(0x0F), 'sport');
    /* a petrol car's modes are not a plug-in hybrid's */
    assert.strictEqual(m('COMFORT'), undefined);
    assert.strictEqual(m('SPORT_DYNAMIC'), undefined);
    assert.strictEqual(m(0x04), undefined);
    /* through the reader */
    const r = Vehicle.createReader({});
    r.receive('de.bmw.infotainment.drivingexcitement.FES', 'statusFESVehicleDynamicSwitchHMI',
        { actualValueModeDrivingExperience: 'PHEV_ELECTRIC_STANDARD' }, 1000);
    assert.strictEqual(r.raw(1500, 60).phevMode, 'electric');
    r.setFeed('kw', -12, 1000); r.setFeed('kwIn', 40, 1000);
    assert.deepStrictEqual([r.raw(1500, 60).kw, r.raw(1500, 60).kwIn], [-12, 40]);
    assert.strictEqual(r.raw(9000, 60).kw, undefined, 'eDrive Live stopping leaves no power');
});

test('eDrive Live\'s power, from the shared folder: asked for while wanted, its own wanted file gone when not', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-'));
    let t = 100000;
    const p = Providers.create({ dir, now: () => t, log: { info() {}, warn() {} } });
    assert.deepStrictEqual(p.tick(false), {});
    assert.ok(!fs.existsSync(path.join(dir, 'wanted-akakingj_cluster_id8.json')), 'not wanted: not asked');
    assert.deepStrictEqual(p.tick(true), { kw: undefined, kwOut: undefined, kwIn: undefined });
    const want = JSON.parse(fs.readFileSync(path.join(dir, 'wanted-akakingj_cluster_id8.json'), 'utf8'));
    assert.strictEqual(want.power, true);
    /* eDrive Live answers */
    fs.writeFileSync(path.join(dir, 'edrive.json'), JSON.stringify({ t: Date.now(), power: { kw: -14.2, outMax: 110, inMax: 45 } }));
    t += 300;
    assert.deepStrictEqual(p.tick(true), { kw: -14.2, kwOut: 110, kwIn: 45 });
    /* a stale file is none; another app's wanted file is not a provider */
    fs.writeFileSync(path.join(dir, 'edrive.json'), JSON.stringify({ t: Date.now() - 5000, power: { kw: -3 } }));
    fs.writeFileSync(path.join(dir, 'wanted-other.json'), JSON.stringify({ t: Date.now(), power: { kw: 9 } }));
    t += 300;
    assert.strictEqual(p.tick(true).kw, undefined);
    p.tick(false);
    assert.ok(!fs.existsSync(path.join(dir, 'wanted-akakingj_cluster_id8.json')), 'removed as soon as not wanted');
    assert.ok(fs.existsSync(path.join(dir, 'wanted-other.json')), 'another app\'s left alone');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('each style\'s rev counter: Power % on its marks, the 0 a quarter up, CHARGE below it in green, its figures and its word', () => {
    const raw = (kw, pedal) => ({ phevMode: 'electric', kw, pedalPct: pedal, rpm: 0, gear: 'D', speedKmh: 40 });
    for (const style of ['toro', 'track', 'mplus', 'mtrack']) {
        const t = Themes.build(atlas, 'carprofile', { style, electric: 'hybrid', units: 'metric' });
        const s = (r) => State.present(r, PROFILE, t.settings);
        const dial = t.layers.find((L) => /^(revDial|dial)$/.test(L.id));
        const charge = dial.uniforms(s(raw(-17.5, 0)), 0), drive = dial.uniforms(s(raw(30, 60)), 0), rpm = dial.uniforms(s({ rpm: 3000 }), 0);
        if (style === 'toro') {
            assert.ok(charge.u_zero > 0 && charge.u_frac < charge.u_zero && drive.u_frac > drive.u_zero, style);
            assert.strictEqual(rpm.u_zero, 0);
            assert.deepStrictEqual(charge.u_regen, Palette.REGEN);
        } else if (style === 'mtrack') {
            assert.ok(charge.u_yz > 0 && charge.u_ym > charge.u_yz && drive.u_ym < drive.u_yz, style + ': the marker below the 0, then above it');
            assert.strictEqual(rpm.u_yz, 0);
        } else {
            assert.ok(charge.u_zv > 0 && charge.u_val < charge.u_zv && drive.u_val > drive.u_zv, style);
            assert.deepStrictEqual(charge.u_zone, [0, 0, 0, 0], style + ': no red field');
            assert.strictEqual(rpm.u_zv, 0);
        }
        /* no more layers than the rev counter alone has, but Toro's (its Power % figures and word) */
        if (style !== 'toro') assert.ok(!t.layers.some((L) => /^pct/.test(L.id)), style);
        /* the shaders declare what they are given */
        const shaders = Object.assign({}, require('../src/shaders/dial.js'), require('../src/shaders/mcluster.js'), require('../src/shaders/tcluster.js'));
        const src = shaders[dial.shader];
        Object.keys(charge).forEach((k) => assert.ok(new RegExp('uniform \\w+ ' + k + '\\b').test(src), style + ': ' + k));
    }
});

test('Electric range on Automatic: a plug-in hybrid found by its drive modes, kept; a petrol car stays one', { timeout: 15000 }, async (t) => {
    const Main = require('../src/car/main.js');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const spec = require('../app/app.base.json'), item = spec.settings.find((s) => s.key === 'electric');
    assert.strictEqual(item.default, 'auto');
    assert.strictEqual(item.options[0][0], 'auto');
    assert.deepStrictEqual(item.profileMap, { phev: 'hybrid', petrol: 'off', diesel: 'off' }, 'a Car profile set to a plug-in hybrid says so itself');
    function run(dir, modes) {
        const logs = [], cr = { on() {}, asset: () => 1, effect: () => 1, uniform() {}, bind() {}, set() {}, drop() {}, pixels() {}, close() {} };
        let onValue = null, clock = 1000000;
        const host = { dataDir: dir, log: { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m) },
                       settings: () => ({ profile: 'carprofile', enabled: true, electric: 'auto' }), onSettingsChanged() {},
                       subscribe(sig, cb) { onValue = cb; } };
        const providers = { tick: () => ({}), sharing: () => false, release() {} };
        const svc = Main.start(host, { cr, now: () => clock, providers, presence: { othersShowing: () => false, mark() {} } });
        t.after(() => svc.stop());
        onValue('de.bmw.infrastructure.VehicleCondition', 'VehicleCondition', { statusConditionVehicle: 'FAHREN' });
        if (modes) onValue('de.bmw.infotainment.drivingexcitement.FES', 'statusFESVehicleDynamicSwitchHMI', { actualValueModeDrivingExperience: modes });
        return { logs, tick: (ms) => { clock += ms; } };
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phev-'));
    const a = run(dir, 'PHEV_HYBRID_STANDARD');
    for (let i = 0; i < 6; i++) { a.tick(1000); await wait(120); }
    assert.ok(a.logs.some((l) => /vehicle: a plug-in hybrid \(its drive modes/.test(l)), a.logs.join(' | '));
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'vehicle.json'), 'utf8')).phev, true);
    /* a petrol car's modes: nothing found, nothing saved */
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'phev-'));
    const b = run(dir2, 'COMFORT');
    for (let i = 0; i < 6; i++) { b.tick(1000); await wait(120); }
    assert.ok(!b.logs.some((l) => /plug-in hybrid/.test(l)));
    assert.ok(!fs.existsSync(path.join(dir2, 'vehicle.json')));
    fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir2, { recursive: true, force: true });
});
