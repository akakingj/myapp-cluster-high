'use strict';
/*
 * A diesel (General: "Engine", petrol as it comes).
 *
 * The car sends a diesel's engine speed as it sends a petrol's - the same
 * signal and scale, which the open projects written on diesels read - so
 * nothing about reading it changes. What a diesel needs is its own range:
 * a dial to 6,000, red from 4,500, the limit at 5,000, shift lights that
 * can be reached - and an engine unit that is asked only what means the
 * same on every engine. The M styles' own dial is held in
 * test/track.test.js; this is everything else.
 * Run: node --test test/diesel.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const Panel = require('../src/geometry/panel.js');
const Palette = require('../src/theme/palette.js');
const Themes = require('../src/theme/index.js');
const Toro = require('../src/theme/lambo.js');
const State = require('../src/engine/state.js');
const Clock = require('../src/engine/clock.js');
const Driver = require('../src/car/cluster.js');
const Main = require('../src/car/main.js');
const Vehicle = require('../src/car/vehicle.js');
const Engine = require('../src/car/engine.js');
const Sim = require('../preview/sim.js');
const atlas = require('../assets/fonts/atlas.json');
const spec = require('../app/app.base.json');

const KIT = path.join(__dirname, '..', 'kit', 'runtime');
const { ReadOnlyDiag } = require(path.join(KIT, 'readonly-diag.js'));
const { DidReader } = require(path.join(KIT, 'dids.js'));

const P = Panel.profile('x3m40i');
const STYLES = ['toro', 'track', 'mplus'];
const item = (key) => spec.settings.find((x) => x.key === key);
/* the app's settings as a new install has them: every default, as the kit hands them over */
const defaults = () => { const o = {}; spec.settings.forEach((s) => { o[s.key] = s.default; }); return o; };
const layer = (t, id) => t.layers.find((L) => L.id === id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CDS = 'de.bmw.infotainment.vehicle.CDS';
const COND = 'de.bmw.infrastructure.VehicleCondition';

/* ------------------------------------------------------------ the setting */

test('Engine is a setting on GENERAL: petrol as it comes, diesel only when the owner says so', () => {
    const e = item('engine');
    assert.ok(e, 'there is an Engine setting');
    assert.deepStrictEqual([e.tab, e.type, e.default, e.label], ['general', 'choice', 'petrol', 'Engine']);
    assert.deepStrictEqual(e.options.map((o) => o[0]), ['petrol', 'diesel']);
    assert.strictEqual(e.when, undefined, 'offered whatever the style');
    assert.match(e.options[1][1], /^Diesel: .*6,000/);
    /* it stands with the car's own choice, before the limits it changes */
    const keys = spec.settings.map((s) => s.key);
    assert.ok(keys.indexOf('engine') === keys.indexOf('profile') + 1 && keys.indexOf('engine') < keys.indexOf('rpmRedline'));

    /* a new install, and one from before the setting (its saved settings have no such key), are petrol:
       every style builds exactly what it builds with no engine named */
    for (const style of STYLES) {
        const fresh = Object.assign(defaults(), { style });
        assert.strictEqual(fresh.engine, 'petrol');
        const before = Object.assign({}, fresh);
        delete before.engine;
        const a = Themes.build(atlas, 'x3m40i', fresh), b = Themes.build(atlas, 'x3m40i', before);
        assert.strictEqual(a.settings.engine, 'petrol');
        assert.deepStrictEqual(a.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h]), b.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h]));
        const raw = { rpm: 6900, speedKmh: 120, gear: '4', fuelPct: 50, oilTempC: 100, coolantC: 90 };
        const sa = State.present(raw, P, a.settings), sb = State.present(raw, P, b.settings);
        assert.deepStrictEqual(sa, sb);
        a.layers.forEach((L, i) => assert.deepStrictEqual(L.uniforms(sa, 0), b.layers[i].uniforms(sb, 0), style + '/' + L.id));
        assert.deepStrictEqual([a.settings.scaleMaxRpm, a.settings.rpmRedline, a.settings.rpmLimiter], [8000, 6750, 7000]);
    }
    /* anything but "diesel" is petrol */
    for (const v of [undefined, null, '', 'petrol', 'auto', 'DIESEL', true, 1]) {
        assert.strictEqual(Palette.resolve({ engine: v }, P).engine, 'petrol', String(v));
    }
    assert.strictEqual(Palette.resolve({ engine: 'diesel' }, P).engine, 'diesel');
});

test('Redline and Limiter can be set for a diesel, and Toro\'s dial scale is a petrol\'s choice', () => {
    const red = item('rpmRedline').options.map((o) => o[0]), lim = item('rpmLimiter').options.map((o) => o[0]);
    assert.deepStrictEqual([red[0], lim[0]], ['auto', 'auto']);
    const nums = (a) => a.slice(1).map(Number);
    /* every step of 250 from a diesel's range to a petrol's, in order */
    assert.deepStrictEqual(nums(red), Array.from({ length: 17 }, (_, i) => 4000 + 250 * i));
    assert.deepStrictEqual(nums(lim), Array.from({ length: 19 }, (_, i) => 4500 + 250 * i));
    /* each is shown as the figure it is */
    for (const o of item('rpmRedline').options.slice(1).concat(item('rpmLimiter').options.slice(1))) {
        assert.strictEqual(o[1].replace(',', ''), o[0]);
    }
    /* the choices that were there before are all still there, and both still come as "From the car" */
    for (const v of ['5500', '6000', '6750', '7000', '8000']) assert.ok(red.includes(v), v);
    for (const v of ['6000', '7000', '7300'.replace('7300', '7250'), '9000']) assert.ok(lim.includes(v), v);
    assert.deepStrictEqual([item('rpmRedline').default, item('rpmLimiter').default], ['auto', 'auto']);
    /* every diesel choice is honoured as chosen */
    for (const r of nums(red).filter((v) => v < 6000)) {
        const s = Palette.resolve({ engine: 'diesel', rpmRedline: String(r), rpmLimiter: 'auto' }, P);
        assert.strictEqual(s.rpmRedline, r);
        assert.ok(s.rpmLimiter >= r && s.rpmLimiter <= 6000);
    }
    for (const l of nums(lim).filter((v) => v < 6000)) {
        const s = Palette.resolve({ engine: 'diesel', rpmRedline: 'auto', rpmLimiter: String(l) }, P);
        assert.strictEqual(s.rpmLimiter, Math.max(l, s.rpmRedline));
    }
    /* a diesel's dial reads 0 - 6: the scale's own choice is offered to a petrol only */
    assert.deepStrictEqual(item('scaleMaxRpm').when, { style: 'toro', engine: 'petrol' });
    assert.strictEqual(item('scaleMaxRpm').default, '8000');
});

/* ------------------------------------------------------------- the limits */

test('a diesel\'s limits: the dial to 6,000, red from 4,500, the limit at 5,000 - for every car, unless set', () => {
    assert.deepStrictEqual(Palette.DIESEL, { scaleMaxRpm: 6000, rpmRedline: 4500, rpmLimiter: 5000, shiftSpan: 1300 });
    const r = (cfg, profile) => {
        const s = Palette.resolve(Object.assign({ engine: 'diesel' }, cfg), Panel.profile(profile || 'x3m40i'));
        return [s.scaleMaxRpm, s.rpmMax, s.rpmRedline, s.rpmLimiter, s.flashFromRpm, s.shiftFromRpm];
    };
    const OWN = [6000, 6000, 4500, 5000, 4850, 3200];
    assert.deepStrictEqual(r({}), OWN);
    /* whichever car is chosen: a profile's limits are a petrol engine's */
    for (const id of Object.keys(Panel.PROFILES)) assert.deepStrictEqual(r({}, id), OWN, id);
    /* as the app sends them: strings, "From the car", and the dial scale a petrol had chosen */
    assert.deepStrictEqual(r({ rpmRedline: 'auto', rpmLimiter: 'auto', scaleMaxRpm: '8000' }), OWN);
    assert.deepStrictEqual(r({ scaleMaxRpm: '10000' }), OWN, 'the dial reads 0 - 6 whatever a petrol had chosen');
    /* set: honoured, kept in order, the flash a breath before the limit */
    assert.deepStrictEqual(r({ rpmRedline: '5000', rpmLimiter: '5500' }), [6000, 6000, 5000, 5500, 5350, 3700]);
    assert.deepStrictEqual(r({ rpmRedline: '5500' }), [6000, 6000, 5500, 5500, 5350, 4200], 'the limit is never below the redline');
    assert.deepStrictEqual(r({ rpmLimiter: '4500' }), [6000, 6000, 4500, 4500, 4350, 3200]);
    assert.deepStrictEqual(r({ rpmRedline: '4000', rpmLimiter: '4750' }), [6000, 6000, 4000, 4750, 4600, 2700]);
    /* a petrol's figure left in the settings - at or past the top of a diesel's dial - is not a diesel's limit */
    assert.deepStrictEqual(r({ rpmRedline: '7000', rpmLimiter: '7250' }), OWN);
    assert.deepStrictEqual(r({ rpmRedline: '6000', rpmLimiter: '6000' }), OWN);
    assert.deepStrictEqual(r({ rpmRedline: '6750', rpmLimiter: '5250' }), [6000, 6000, 4500, 5250, 5100, 3200]);

    /* and a petrol is what it was: its car's limits, the scale it chose, the shift lights from 1,800 below the redline */
    const p = (cfg, profile) => {
        const s = Palette.resolve(cfg, Panel.profile(profile || 'x3m40i'));
        return [s.scaleMaxRpm, s.rpmRedline, s.rpmLimiter, s.flashFromRpm, s.shiftFromRpm];
    };
    assert.deepStrictEqual(p({}), [8000, 6750, 7000, 6850, 4950]);
    assert.deepStrictEqual(p({ engine: 'petrol', scaleMaxRpm: '10000', rpmRedline: '7250', rpmLimiter: '7500' }), [10000, 7250, 7500, 7350, 5450]);
    assert.deepStrictEqual(p({}, 'mCarS58'), [8000, 7200, 7300, 7150, 5400]);
    /* the new, lower choices work for a petrol too (they are only numbers) */
    assert.deepStrictEqual(p({ rpmRedline: '4500', rpmLimiter: '5000' }), [8000, 4500, 5000, 4850, 2700]);
});

/* ------------------------------------------------------------------- Toro */

test('Toro on a diesel: the dial marked 1 to 6, red from 4.5, and shift lights a diesel can reach', () => {
    const d = Toro.build(atlas, 'x3m40i', { engine: 'diesel' }), p = Toro.build(atlas, 'x3m40i', {});
    const state = (t, rpm) => State.present({ rpm }, P, t.settings);
    const vals = (t) => { const u = layer(t, 'arcNums').uniforms(state(t, 0), 0); return Array.from({ length: u.u_cfg[0] }, (_, i) => u.u_gt[i * 4]); };
    assert.deepStrictEqual(vals(d), [1, 2, 3, 4, 5, 6]);
    assert.deepStrictEqual(vals(p), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.strictEqual(d.dial.redV, 4.5);
    assert.strictEqual(p.dial.redV, 6.75);
    /* it is the dial a petrol has with "0 - 6,000" chosen: the same layers, in the same places */
    const six = Toro.build(atlas, 'x3m40i', { scaleMaxRpm: 6000 });
    assert.deepStrictEqual(d.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h, L.z]), six.layers.map((L) => [L.id, L.shader, L.x, L.y, L.w, L.h, L.z]));
    /* the needle travels the whole dial: 3,000 is half-way round, 6,000 the end */
    const rev = (t, rpm) => layer(t, 'dial').uniforms(state(t, rpm), 0).u_frac;
    assert.deepStrictEqual([rev(d, 0), rev(d, 3000), rev(d, 6000), rev(d, 7000)], [0, 3, 6, 6]);
    assert.strictEqual(rev(p, 3000), 3);

    /* the shift lights: none at 3,200, all at 5,000, the strobe at the limit */
    const shift = (t, rpm) => layer(t, 'shift').uniforms(state(t, rpm), 0);
    assert.strictEqual(shift(d, 3200).u_frac, 0);
    assert.strictEqual(shift(d, 3000).u_frac, 0);
    assert.ok(Math.abs(shift(d, 4100).u_frac - 0.5) < 1e-9);
    assert.strictEqual(shift(d, 5000).u_frac, 1);
    assert.deepStrictEqual([shift(d, 4900).u_strobe, shift(d, 4940).u_strobe, shift(d, 5000).u_strobe], [0, 1, 1]);
    /* a petrol's begin where they always did: 1,800 below its redline, full at its limiter */
    assert.strictEqual(shift(p, 4950).u_frac, 0);
    assert.ok(Math.abs(shift(p, 5975).u_frac - 0.5) < 1e-9);
    assert.strictEqual(shift(p, 7000).u_frac, 1);
    assert.strictEqual(shift(p, 5000).u_strobe, 0);
    /* ... which a diesel never came near: at a diesel's limit a petrol's lights are barely on */
    assert.ok(shift(p, 5000).u_frac < 0.03);

    /* the limiter: the flash and the dial's warning at a diesel's limit, not a petrol's */
    assert.strictEqual(state(d, 5000).limiter, 1);
    assert.strictEqual(state(d, 4850).limiter, 0);
    assert.strictEqual(state(p, 5000).limiter, 0);
    assert.strictEqual(layer(d, 'dial').uniforms(state(d, 5000), 0).u_warn, 1);
    assert.strictEqual(layer(p, 'dial').uniforms(state(p, 5000), 0).u_warn, 0);
});

/* ------------------------------------------------------- the engine speed */

test('the engine speed is read the same way for either engine: the car\'s own signal, a quarter of a turn a count', () => {
    /* (a diesel at idle as an open project written on one tests it: 3160 counts, 790 rpm) */
    const r = Vehicle.createReader({});
    r.receive(CDS, 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 3160 }, 1000);
    assert.strictEqual(r.raw(1000).rpm, 790);
    r.receive(CDS, 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 18000 }, 1100);
    assert.strictEqual(r.raw(1100).rpm, 4500);
    r.receive(CDS, 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: 65535 }, 1200);
    assert.strictEqual(r.raw(1200).rpm, 4500, 'the invalid marker is no reading: the last one stands until it ages out');
    /* the one signal, asked of the car for every engine */
    assert.strictEqual(Vehicle.SIGNALS[CDS].statusEngineSpeed2, 'rs');
    /* and each style shows it on a diesel's dial */
    for (const style of STYLES) {
        const t = Themes.build(atlas, 'x3m40i', { style, engine: 'diesel' });
        const st = State.present(r.raw(1100), P, t.settings);
        assert.strictEqual(st.rpm, 4500);
        if (style === 'toro') assert.strictEqual(layer(t, 'dial').uniforms(st, 0).u_frac, 4.5);
        else assert.strictEqual(layer(t, 'revDial').uniforms(st, 0).u_val, 6, '4,500 of 6,000: three quarters up the dial');
    }
});

/* ---------------------------------------------- what goes to the renderer */

function fakeCR() {
    const calls = { effect: [], uniform: [] };
    let ref = 0;
    return {
        calls,
        asset() { return ++ref; },
        effect(o) { calls.effect.push(o); return ++ref; },
        uniform(r, name, values) { calls.uniform.push({ ref: r, name, values }); },
        bind() {}, drop() {}, pixels() {}, set() {}, animate() { return 1; }, stop() {}
    };
}

test('on the cluster: a diesel\'s M dial goes up as its own shader, is driven, and flashes at a diesel\'s limit', () => {
    const SHADERS = Main.shaders();
    assert.ok(SHADERS.mgauge6 && SHADERS.mnum6, 'the service has the diesel dial\'s shaders');
    assert.deepStrictEqual(Clock.GATES.mgauge6, Clock.GATES.mgauge, 'on the clock\'s list, as the petrol dial is');
    for (const style of ['track', 'mplus']) {
        const cr = fakeCR();
        const theme = Themes.build(atlas, 'x3m40i', { style, engine: 'diesel' });
        const d = Driver.create({ cr, theme, shaders: SHADERS, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
        d.ready();
        const refs = d.refs(), byRef = {};
        theme.layers.forEach((L) => { byRef[refs[L.id]] = L; });
        assert.ok(refs.revDial && refs.revScale, 'both layers went up');
        const sent = (id, name) => cr.calls.uniform.filter((u) => u.ref === refs[id] && u.name === name).map((u) => u.values);
        const at = (rpm, now) => {
            cr.calls.uniform.length = 0;
            d.tick(Object.assign(State.present({ rpm, speedKmh: 80, gear: '4', oilTempC: 100, fuelPct: 50 }, P, theme.settings), { now }));
        };
        at(3000, 1000000);
        assert.deepStrictEqual(sent('revDial', 'u_val').pop(), [4], '3,000 rpm: half-way up');
        assert.ok(!cr.calls.uniform.some((u) => u.name === 'u_time' && byRef[u.ref].shader === 'mgauge6'), 'cruising: the dial is not animating');
        at(5000, 1000100);
        assert.ok(Math.abs(sent('revDial', 'u_val').pop()[0] - 5000 / 750) < 1e-6);
        const timed = new Set(cr.calls.uniform.filter((u) => u.name === 'u_time').map((u) => byRef[u.ref].shader));
        assert.ok(timed.has('mgauge6'), style + ': at a diesel\'s limit the dial is given the time, or its flash stands still');
        assert.ok(timed.has('flash'), style + ': and the screen\'s edges');
    }
});

/* ------------------------------------------------------- the engine unit */

const be = (n, bytes) => { const out = []; for (let i = bytes - 1; i >= 0; i--) out.push(Math.floor(n / Math.pow(256, i)) % 256); return out; };
/* the head unit's diagnostic service, as test/engine.test.js stands it in: every request recorded */
function car(answers) {
    const sent = [];
    let onResponse = null;
    const signals = {
        proxy: () => Promise.resolve({ tasu: true }),
        on: (p, name, fn) => { if (name === 'sendTasuResponse') onResponse = fn; return Promise.resolve(); },
        onAvailable: (p, fn) => { fn(true); return Promise.resolve(); },
        call(p, method, params) {
            const data = Array.prototype.slice.call(params.udsData);
            const sid = params.serviceID, key = sid.toString(16).toUpperCase().padStart(2, '0') + ' ' +
                data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
            sent.push({ method, target: params.targetAddress, sid, key });
            const a = typeof answers === 'function' ? answers(key) : answers[key];
            if (a !== null && a !== undefined) {
                const uds = a === 'nrc31' ? [0x7F, sid, 0x31] : [sid + 0x40].concat(data, a);
                const frame = [0, 0, 0, 0, 0, 0, params.targetAddress, 0, 0].concat(uds);
                setTimeout(() => onResponse({ udsResponse: Buffer.from(frame), errorCode: 'NO_ERROR' }), 2);
            }
            return Promise.resolve({ TasuErrorEnum: 'NO_ERROR' });
        }
    };
    return { signals, sent };
}
function opener(c, logs) {
    const log = { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m), error: (m) => logs.push('ERROR ' + m) };
    const open = () => {
        const link = new ReadOnlyDiag(c.signals, log, { gapMs: 1 });
        return { link, reader: new DidReader(link, { ecu: 0x12 }), ready: link.init() };
    };
    return { open, log };
}
async function run(e, clock, st, fn, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 3000)) {
        e.tick(clock.t, st);
        if (fn && fn()) return true;
        await wait(4);
        clock.t += 16;
    }
    return fn ? !!fn() : true;
}
/* an engine unit that answers everything it is asked - BMW's petrol identifiers with figures that would pass for readings */
const ANSWERS_ALL = {
    '22 4436': be(5000, 2), '22 586F': be(5000, 2), '22 4201': be(Math.round(1014 / 0.0390625), 2),
    '22 580F': [112], '22 5853': be(14130, 2), '22 580B': be(Math.round(200 / 0.00390625), 2),
    '22 F433': [100], '22 F40F': [61], '22 F442': be(13900, 2), '22 F470': [0, 0, 0].concat(be(Math.round(180 / 0.03125), 2)),
    '01 33': [100], '01 0F': [61], '01 42': be(13900, 2), '01 70': [0, 0, 0].concat(be(Math.round(180 / 0.03125), 2)), '01 0B': [180]
};
const PETROL_ONLY = /^22 (4436|586F|4201|580F|5853|580B)$/;
const ALL = { oil: true, iat: true, volts: true, boost: true };

test('a diesel\'s engine unit is asked only the standard identifiers, and never for oil pressure', async () => {
    /* what a diesel is asked: every one a standard PID, by OBD or through UDS; nothing of the DME 8's */
    const std = Engine.identifiers(true), all = Engine.identifiers();
    assert.deepStrictEqual(std, { oilAbs: [], ambient: ['DID F433', 'OBD 33'], iat: ['DID F40F', 'OBD 0F'], volts: ['DID F442', 'OBD 42'],
                                  boostAbs: ['DID F470', 'OBD 70', 'OBD 0B'], baro: ['DID F433', 'OBD 33'] });
    Object.keys(std).forEach((name) => std[name].forEach((id) => {
        assert.ok(all[name].includes(id), id + ' is one of the published identifiers');
        assert.match(id, /^(OBD [0-9A-F]{2}|DID F4[0-9A-F]{2})$/);
    }));
    /* (and the order among them is the one a petrol's list has) */
    Object.keys(std).forEach((name) => assert.deepStrictEqual(std[name], all[name].filter((id) => std[name].includes(id))));

    const c = car(ANSWERS_ALL), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    assert.ok(await run(e, clock, { allowed: true, needs: ALL, diesel: true }, () => {
        const v = e.values(clock.t);
        return v.iatC !== undefined && v.batteryV !== undefined && v.boostBar !== undefined;
    }), logs.join(' | '));
    /* a few more frames: anything that was going to be asked has been */
    await run(e, clock, { allowed: true, needs: ALL, diesel: true }, null, 300);
    const v = e.values(clock.t);
    assert.strictEqual(v.iatC, 21, '61 - 40: the standard reading, not the DME\'s own');
    assert.ok(Math.abs(v.batteryV - 13.9) < 1e-9);
    assert.ok(Math.abs(v.boostBar - 0.8) < 1e-9, '(180 - 100) kPa');
    assert.strictEqual(v.oilBar, undefined, 'no oil pressure: there is no standard form of it');
    assert.ok(c.sent.length >= 4);
    c.sent.forEach((r) => {
        assert.ok(!PETROL_ONLY.test(r.key), 'a diesel was asked a petrol engine unit\'s identifier: ' + r.key);
        assert.match(r.key, /^(22 F4[0-9A-F]{2}|01 [0-9A-F]{2})$/, r.key);
        assert.strictEqual(r.target, 0x12);
        assert.ok(r.sid === 0x22 || r.sid === 0x01, 'only reads');
    });
    /* oil pressure is not wanted of a diesel: it is neither "read" nor "missing" */
    const info = e.info(ALL, clock.t);
    assert.deepStrictEqual(info.have.sort(), ['battery', 'boost', 'intake air']);
    assert.deepStrictEqual(info.missing, []);
    assert.strictEqual(e.jobs.oil.asked, 0);
    assert.ok(logs.some((l) => /a diesel: only the standard identifiers/.test(l)), logs.join(' | '));
    /* asked for oil pressure alone, a diesel's engine unit is asked nothing at all */
    const c2 = car(ANSWERS_ALL), o2 = opener(c2, []), clock2 = { t: 5000 };
    const e2 = Engine.create({ open: o2.open, log: o2.log, now: () => clock2.t });
    await run(e2, clock2, { allowed: true, needs: { oil: true }, diesel: true }, null, 250);
    assert.strictEqual(c2.sent.length, 0);
    assert.strictEqual(e2.info({ oil: true }, clock2.t).state, 'idle');
    e.stop(); e2.stop();
});

test('what the documents say a diesel is asked is what it is asked', () => {
    const fs = require('fs');
    const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ENGINE-READINGS.md'), 'utf8');
    const part = doc.slice(doc.indexOf('## A diesel'), doc.indexOf('## What is not known'));
    assert.ok(part.length > 400, 'there is a section on diesels');
    const named = new Set([...part.matchAll(/`((?:DID|OBD) [0-9A-F]{2,4})`/g)].map((m) => m[1]));
    const asked = new Set();
    const std = Engine.identifiers(true);
    Object.keys(std).forEach((name) => std[name].forEach((id) => asked.add(id)));
    assert.deepStrictEqual([...named].sort(), [...asked].sort());
    /* and the petrol engine units' own are named there only as what is NOT asked */
    for (const did of ['4436', '586F', '4201', '580F', '5853', '580B']) {
        assert.ok(part.includes('`' + did + '`'), did + ' is named as not asked');
        assert.ok(!asked.has('DID ' + did));
    }
    /* the public instructions name the setting as the app does */
    const pub = fs.readFileSync(path.join(__dirname, '..', 'docs', 'RELEASE-README.md'), 'utf8');
    assert.match(pub, /## If your car is a diesel/);
    assert.match(pub, /Press \*\*Engine\*\* and choose \*\*Diesel\*\*/);
    assert.strictEqual(item('engine').label, 'Engine');
    assert.match(item('engine').options[1][1], /^Diesel/);
    for (const fig of ['0 – 6,000', '4,500', '5,000', '3,200']) assert.ok(pub.includes(fig), fig);
    assert.deepStrictEqual([Palette.DIESEL.scaleMaxRpm, Palette.DIESEL.rpmRedline, Palette.DIESEL.rpmLimiter,
        Palette.DIESEL.rpmRedline - Palette.DIESEL.shiftSpan], [6000, 4500, 5000, 3200]);
    /* ... and the lines' setting */
    const flat = pub.replace(/\s+/g, ' ');
    assert.ok(flat.includes(item('mLines').label) && flat.includes(item('mLines').options[1][1]));
});

test('a petrol engine unit is asked as before; changing the engine starts the readings again', async () => {
    const c = car(ANSWERS_ALL), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    const got = () => { const v = e.values(clock.t); return v.oilBar !== undefined && v.iatC !== undefined && v.batteryV !== undefined && v.boostBar !== undefined; };
    /* no engine named (an earlier caller): petrol */
    assert.ok(await run(e, clock, { allowed: true, needs: ALL }, got), logs.join(' | '));
    let v = e.values(clock.t);
    assert.strictEqual(v.iatC, 36, 'the DME\'s own intake air: 112 x 0.75 - 48');
    assert.ok(Math.abs(v.oilBar - (5000 - 1014) / 1000) < 0.002);
    assert.ok(c.sent.some((r) => r.key === '22 4436') && c.sent.some((r) => r.key === '22 580F'));
    assert.ok(!logs.some((l) => /diesel/.test(l)), 'nothing said of engines until one is chosen');
    /* the owner says diesel: what the petrol identifiers said is dropped at once, and they are not asked again */
    const before = c.sent.length;
    e.tick(clock.t, { allowed: true, needs: ALL, diesel: true });
    assert.deepStrictEqual(e.values(clock.t), { oilBar: undefined, iatC: undefined, batteryV: undefined, boostBar: undefined });
    assert.ok(await run(e, clock, { allowed: true, needs: ALL, diesel: true }, () => e.values(clock.t).iatC !== undefined && e.values(clock.t).boostBar !== undefined),
        logs.join(' | '));
    await run(e, clock, { allowed: true, needs: ALL, diesel: true }, null, 200);
    v = e.values(clock.t);
    assert.strictEqual(v.iatC, 21);
    assert.strictEqual(v.oilBar, undefined);
    c.sent.slice(before + 1).forEach((r) => assert.ok(!PETROL_ONLY.test(r.key), 'after the change: ' + r.key));
    /* and back */
    e.tick(clock.t, { allowed: true, needs: ALL, diesel: false });
    assert.ok(await run(e, clock, { allowed: true, needs: ALL, diesel: false }, got), logs.join(' | '));
    assert.strictEqual(e.values(clock.t).iatC, 36);
    e.stop();
});

/* ------------------------------------------------------------ the service */

function harness(t, initial, more) {
    const on = {};
    let ref = 100;
    const sent = [];
    const cr = {
        on(ev, f) { on[ev] = f; },
        asset() { return ++ref; },
        effect(o) { sent.push(o); return ++ref; },
        uniform() {}, bind() {}, set() {}, drop() {}, pixels() {}, close() {}
    };
    let onValue = null, changed = null, clock = 1000000;
    let values = Object.assign({ profile: 'x3m40i', enabled: true }, initial);
    const logs = [];
    const host = {
        log: { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m) },
        settings: () => values,
        onSettingsChanged(fn) { changed = fn; },
        subscribe(sig, cb) { onValue = cb; }
    };
    const svc = Main.start(host, Object.assign({ cr, now: () => clock }, more));
    t.after(() => svc.stop());
    return {
        logs, svc, on, sent,
        rpm: (v) => onValue(CDS, 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: v * 4 }),
        condition: (c) => onValue(COND, 'VehicleCondition', { statusConditionVehicle: c }),
        change(next) { values = Object.assign({}, values, next); changed(); }
    };
}
const fakeEngine = () => {
    const ticks = [];
    return { ticks, tick(now, st) { ticks.push(st); }, values: () => ({}), info: () => ({ state: 'idle', have: [], missing: [] }), stop() {} };
};
const fakeFeed = () => ({ start() {}, stop() {}, poll() {}, live: () => false, values: () => ({}), info: () => 'BeeM-Flash: not running', present: () => false });

test('the service: the owner\'s Engine choice reaches the engine unit\'s reader, and changes with the setting', { timeout: 20000 }, async (t) => {
    const engine = fakeEngine();
    const h = harness(t, { style: 'toro', beemFlash: 'off', engine: 'diesel' }, { engine, feed: fakeFeed() });
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    await wait(320);
    assert.strictEqual(h.svc.status(), 'On the cluster');
    const last = () => engine.ticks[engine.ticks.length - 1];
    assert.strictEqual(last().diesel, true);
    assert.strictEqual(last().allowed, true, 'a diesel\'s engine unit may still be asked: the standard readings');
    /* Toro's left gauge wants oil pressure; whether there is any to ask is the reader's to know */
    h.change({ engine: 'petrol' });
    h.rpm(1500);
    await wait(700);                 /* a change of settings is applied once they have settled */
    assert.strictEqual(last().diesel, false);
    /* as it comes: not a diesel */
    const engine2 = fakeEngine();
    const h2 = harness(t, { style: 'track', beemFlash: 'off' }, { engine: engine2, feed: fakeFeed() });
    h2.on.ready(); h2.condition('FAHREN'); h2.rpm(1500);
    await wait(320);
    assert.strictEqual(engine2.ticks[engine2.ticks.length - 1].diesel, false);
    assert.ok(!h2.sent.some((e) => /STEP = 8\.0 \/ 6\.0/.test(String(e.shader || e.fragment || e.source || JSON.stringify(e)))), 'a petrol car is sent no diesel dial');
});

test('the service: a diesel\'s M dial is what goes up, once the owner says diesel', { timeout: 20000 }, async (t) => {
    const h = harness(t, { style: 'track', beemFlash: 'on' }, { engine: fakeEngine(), feed: fakeFeed() });
    h.on.ready(); h.condition('FAHREN'); h.rpm(800);
    await wait(320);
    const hasDiesel = () => h.sent.some((e) => /STEP = 8\.0 \/ 6\.0/.test(JSON.stringify(e)));
    assert.ok(h.sent.length > 30, 'the layers went up');
    assert.ok(!hasDiesel(), 'petrol as it comes');
    h.change({ engine: 'diesel' });
    h.rpm(800);
    await wait(700);                 /* a change of settings is applied once they have settled */
    assert.ok(hasDiesel(), 'the dial with a diesel\'s marks was sent to the cluster');
    assert.strictEqual(h.svc.status(), 'On the cluster');
});

/* --------------------------------------------------------- the preview */

test('the preview drives a diesel like one: it changes up at a diesel\'s limit, and a petrol drive is what it was', () => {
    const run2 = (opts) => {
        const sim = Sim.create(P, opts);
        let peak = 0;
        const trace = [];
        for (let i = 0; i < 60 * 20; i++) { sim.step(1 / 60); const r = sim.raw(); peak = Math.max(peak, r.rpm); if (i % 30 === 0) trace.push(Math.round(r.rpm)); }
        return { peak, trace };
    };
    const petrol = run2(), same = run2(null), diesel = run2({ shiftAt: 4880 });
    assert.deepStrictEqual(same.trace, petrol.trace);
    assert.ok(petrol.peak > 6500 && petrol.peak < 7300, 'a petrol pull: ' + Math.round(petrol.peak));
    assert.ok(diesel.peak > 4400 && diesel.peak < 5300, 'a diesel pull: ' + Math.round(diesel.peak));
});
