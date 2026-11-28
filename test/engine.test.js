'use strict';
/*
 * The engine unit's readings (src/car/engine.js): what a head unit without
 * BeeM-Flash is asked instead. Run against the kit's own diagnostic stack -
 * its read-only link, its DID reader, its transport - with only the head
 * unit's SOME/IP service stood in for, so what is tested is what goes out.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const Engine = require('../src/car/engine.js');
const KIT = path.join(__dirname, '..', 'kit', 'runtime');
const { ReadOnlyDiag, check } = require(path.join(KIT, 'readonly-diag.js'));
const { DidReader } = require(path.join(KIT, 'dids.js'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 2000)) { if (fn()) return true; await wait(5); } return !!fn(); };
const be = (n, bytes) => { const out = []; for (let i = bytes - 1; i >= 0; i--) out.push(Math.floor(n / Math.pow(256, i)) % 256); return out; };

/*
 * The head unit's diagnostic service (InternalTasu), as kit/runtime/diag.js
 * uses it. answers: { '22 4436': [bytes] | 'nrc31' | null (no reply), '01 0F': ... }.
 * Every request is recorded.
 */
function car(answers) {
    const sent = [];
    let onResponse = null, available = true;
    const signals = {
        proxy: () => Promise.resolve({ tasu: true }),
        on: (p, name, fn) => { if (name === 'sendTasuResponse') onResponse = fn; return Promise.resolve(); },
        onAvailable: (p, fn) => { fn(available); return Promise.resolve(); },
        call(p, method, params) {
            const data = Array.prototype.slice.call(params.udsData);
            const sid = params.serviceID, key = sid.toString(16).toUpperCase().padStart(2, '0') + ' ' +
                data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
            sent.push({ method, target: params.targetAddress, source: params.sourceAddress, sid, data, key, t: Date.now() });
            const a = typeof answers === 'function' ? answers(key) : answers[key];
            if (a !== null && a !== undefined) {
                const uds = a === 'nrc31' ? [0x7F, sid, 0x31] : [sid + 0x40].concat(data, a);
                /* a 9-byte header, the answering unit's address in [6] */
                const frame = [0, 0, 0, 0, 0, 0, params.targetAddress, 0, 0].concat(uds);
                setTimeout(() => onResponse({ udsResponse: Buffer.from(frame), errorCode: 'NO_ERROR' }), 2);
            }
            return Promise.resolve({ TasuErrorEnum: 'NO_ERROR' });
        }
    };
    return { signals, sent, setAvailable(v) { available = v; } };
}

/* the app shell's host.diag(), on that car (app/entry.js) */
function opener(c, logs) {
    const log = { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m), error: (m) => logs.push('ERROR ' + m) };
    let made = 0;
    const open = () => {
        made++;
        const link = new ReadOnlyDiag(c.signals, log, { gapMs: 1 });
        return { link, reader: new DidReader(link, { ecu: 0x12 }), ready: link.init() };
    };
    return { open, log, made: () => made };
}

/* a healthy B58 at 3000 rpm, as the upstream catalogue scales it */
const B58 = {
    '22 4436': be(5000, 2),                     /* 5000 hPa absolute */
    '22 4201': be(Math.round(1014 / 0.0390625), 2),
    '22 580F': [112],                           /* 112 x 0.75 - 48 = 36 C */
    '22 5853': be(14130, 2),                    /* 14.13 V */
    '22 580B': be(Math.round(200 / 0.00390625), 2),    /* 200 kPa absolute */
    '22 F433': [100]                            /* 100 kPa */
};
const ALL = { oil: true, iat: true, volts: true, boost: true };

/* run the engine's clock forward, a frame at a time, until fn says so */
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

test('every identifier asked is in the table of where it is published, and the table lists no other', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'ENGINE-READINGS.md'), 'utf8');
    const rows = doc.split('\n').filter((l) => /^\|.*`(DID|OBD) [0-9A-F]{2,4}`/.test(l));
    const listed = {};
    rows.forEach((l) => {
        const cells = l.split('|').map((x) => x.trim());
        const id = /`((?:DID|OBD) [0-9A-F]{2,4})`/.exec(cells[2])[1];
        assert.ok(cells[4].length > 20 && /SAE J1979|ALMSTRA\/idv7lol|cauliflowermossgrape\/idrive7-apps|ZEKAI-Design\/ID7-Cluster-Themes|eroobeeroo\/idrive7-cluster-info|MGU App Kit/.test(cells[4]),
            id + ' has no published source beside it');
        assert.ok(!/BeeM/i.test(cells[4]), id + ' is credited to BeeM-Flash: it must not be here');
        listed[id] = cells[4];
    });
    const asked = {};
    const ids = Engine.identifiers();
    Object.keys(ids).forEach((name) => ids[name].forEach((id) => { asked[id] = true; }));
    assert.deepStrictEqual(Object.keys(asked).sort(), Object.keys(listed).sort());
    assert.strictEqual(Object.keys(asked).length, 36);
    /* and the kit's own guard takes every one of them for a read, of the engine unit and nothing else - but the
       gearbox oil's, of the gearbox unit (EGS 0x18), and the battery's charge, of the battery unit (SME 0x07) */
    Object.keys(Engine.CANDIDATES).forEach((name) => Engine.CANDIDATES[name].forEach((cand) => {
        const ecu = name === 'gearboxT' ? 0x18 : name === 'hvSoc' ? 0x07 : 0x12;
        assert.strictEqual(cand.ecu, ecu, name);
        assert.ok(cand.timeoutMs <= 1000, 'a short wait: ' + name);
        if (cand.obd) assert.doesNotThrow(() => check(ecu, 0x01, [parseInt(cand.obd, 16)], false));
        else assert.doesNotThrow(() => check(ecu, 0x22, [parseInt(cand.did, 16) >> 8, parseInt(cand.did, 16) & 0xFF], false));
    }));
});

test('the gearbox oil, from the gearbox unit (EGS 0x18, DID 6000: + 40), only while shown, as Cluster Layouts reads it', async () => {
    const c = car((key) => (key === '22 6000' ? [122] : null)), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    await run(e, clock, { allowed: true, needs: { oil: false } }, null);
    assert.strictEqual(c.sent.length, 0, 'not shown: never asked');
    assert.ok(await run(e, clock, { allowed: true, needs: { gearbox: true } }, () => e.values(clock.t).gearboxC !== undefined), logs.join(' | '));
    assert.strictEqual(e.values(clock.t).gearboxC, 82);
    c.sent.forEach((r) => assert.deepStrictEqual([r.target, r.sid, r.key], [0x18, 0x22, '22 6000']));
    assert.ok(logs.some((l) => /gearbox oil from the gearbox unit \(6000\)/.test(l)), logs.join(' | '));
    /* a diesel's gearbox is the same unit: asked too */
    const d = Engine.create({ open: opener(car((key) => (key === '22 6000' ? [100] : null)), []).open, now: () => clock.t });
    assert.ok(await run(d, clock, { allowed: true, diesel: true, needs: { gearbox: true } }, () => d.values(clock.t).gearboxC === 60));
    e.stop(); d.stop();
});

test('a plug-in hybrid\'s charge, from the battery unit (SME 0x07, DID DDBC: 0.1 %), only while wanted, as Cluster Layouts reads it (0.29.4)', async () => {
    const c = car((key) => (key === '22 DDBC' ? be(390, 2) : null)), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    await run(e, clock, { allowed: true, needs: { hvsoc: false } }, null);
    assert.strictEqual(c.sent.length, 0, 'not wanted (eDrive Live shares it, or no electric range): never asked');
    assert.ok(await run(e, clock, { allowed: true, needs: { hvsoc: true } }, () => e.values(clock.t).socPct !== undefined), logs.join(' | '));
    assert.ok(Math.abs(e.values(clock.t).socPct - 39) < 1e-9, String(e.values(clock.t).socPct));
    c.sent.forEach((r) => assert.deepStrictEqual([r.target, r.sid, r.key], [0x07, 0x22, '22 DDBC']));
    assert.ok(logs.some((l) => /battery charge from the battery unit \(DDBC\)/.test(l)), logs.join(' | '));
    /* a diesel plug-in hybrid's battery unit is the same: asked too */
    const d = Engine.create({ open: opener(car((key) => (key === '22 DDBC' ? be(805, 2) : null)), []).open, now: () => clock.t });
    assert.ok(await run(d, clock, { allowed: true, diesel: true, needs: { hvsoc: true } }, () => d.values(clock.t).socPct !== undefined));
    assert.ok(Math.abs(d.values(clock.t).socPct - 80.5) < 1e-9);
    e.stop(); d.stop();
});

test('the readings, decoded: oil pressure over ambient, intake air, battery, boost over the barometer', async () => {
    const c = car(B58), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    assert.deepStrictEqual(e.values(clock.t), { oilBar: undefined, iatC: undefined, batteryV: undefined, boostBar: undefined,
        pedalPct: undefined, throttlePct: undefined, timingDeg: undefined, boostTargetBar: undefined, hpfpBar: undefined, lpfpBar: undefined, tankPct: undefined, gearboxC: undefined, socPct: undefined });
    assert.ok(await run(e, clock, { allowed: true, needs: ALL }, () => {
        const v = e.values(clock.t);
        return v.oilBar !== undefined && v.iatC !== undefined && v.batteryV !== undefined && v.boostBar !== undefined;
    }), 'all four read: ' + JSON.stringify(e.values(clock.t)) + ' ' + logs.join(' | '));
    const v = e.values(clock.t);
    assert.ok(Math.abs(v.oilBar - (5000 - 1014) / 1000) < 0.002, 'oil ' + v.oilBar);
    assert.strictEqual(v.iatC, 36);
    assert.ok(Math.abs(v.batteryV - 14.13) < 1e-9);
    assert.ok(Math.abs(v.boostBar - 1.0) < 0.001, 'boost ' + v.boostBar);
    e.stop();
    /* everything that went out: reads of the engine unit, from the head unit's tester address */
    assert.ok(c.sent.length >= 6);
    c.sent.forEach((r) => {
        assert.strictEqual(r.method, 'sendTasuRequest');
        assert.strictEqual(r.target, 0x12, 'only the engine unit');
        assert.ok(r.sid === 0x22 || r.sid === 0x01, 'only reads: ' + r.key);
    });
    assert.strictEqual(o.made(), 1, 'one link, made once');
    assert.ok(logs.some((l) => /oil pressure from the engine unit \(4436\)/.test(l)), logs.join(' | '));
    assert.deepStrictEqual(e.info(ALL, clock.t).have.sort(), ['battery', 'boost', 'intake air', 'oil pressure']);
});

test('the boost target over the barometer and the fuel pressures, as Cluster Layouts reads them, only while shown', async () => {
    const answers = Object.assign({}, B58, {
        '22 4AB0': be(Math.round(180 / 0.00390625), 2),     /* 180 kPa absolute: 0.8 bar over 100 */
        '22 F423': be(2000, 2),                              /* 200.0 bar */
        '22 F40A': [170]                                     /* 5.1 bar */
    });
    const c = car(answers), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    const needs = { boostTarget: true, hpfp: true, lpfp: true };
    assert.ok(await run(e, clock, { allowed: true, needs }, () => {
        const v = e.values(clock.t);
        return v.boostTargetBar !== undefined && v.hpfpBar !== undefined && v.lpfpBar !== undefined;
    }), logs.join(' | '));
    const v = e.values(clock.t);
    assert.ok(Math.abs(v.boostTargetBar - 0.8) < 0.001, 'target ' + v.boostTargetBar);
    assert.ok(Math.abs(v.hpfpBar - 200) < 1e-9);
    assert.ok(Math.abs(v.lpfpBar - 5.1) < 1e-9);
    assert.strictEqual(v.oilBar, undefined, 'oil pressure not shown: not asked');
    assert.ok(!c.sent.some((r) => r.key === '22 4436'));
    assert.deepStrictEqual(e.info(needs, clock.t).have.sort(), ['boost target', 'high fuel pressure', 'low fuel pressure']);
    e.stop();
});

test('an engine unit that refuses BMW\'s identifiers is asked the standard ones, and the one that answers is kept', async () => {
    /* only OBD-II: 0F intake air, 42 voltage, 0B manifold pressure, 33 barometer */
    const answers = (key) => ({ '01 0F': [76], '01 42': be(13800, 2), '01 0B': [180], '01 33': [99] }[key] || (/^22 /.test(key) ? 'nrc31' : null));
    const c = car(answers), logs = [], o = opener(c, logs), clock = { t: 5000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    const needs = { iat: true, volts: true, boost: true };
    assert.ok(await run(e, clock, { allowed: true, needs }, () => {
        const v = e.values(clock.t);
        return v.iatC !== undefined && v.batteryV !== undefined && v.boostBar !== undefined;
    }), logs.join(' | '));
    const v = e.values(clock.t);
    assert.strictEqual(v.iatC, 36, '76 - 40');
    assert.ok(Math.abs(v.batteryV - 13.8) < 1e-9);
    assert.ok(Math.abs(v.boostBar - 0.81) < 1e-9, '(180 - 99) kPa');
    assert.strictEqual(v.oilBar, undefined, 'not asked for: not read');
    assert.ok(!c.sent.some((r) => /4436|4201/.test(r.key)), 'oil pressure was never asked');
    /* asked again, the one that answered goes first: no more refusals */
    const before = c.sent.length;
    clock.t += 6000;
    await run(e, clock, { allowed: true, needs: { iat: true } }, () => c.sent.length > before);
    assert.strictEqual(c.sent[before].key, '01 0F');
    e.stop();
});

test('oil pressure: no figure without the ambient reading, none outside 0 - 20 bar, never below zero', async () => {
    const cases = [
        [{ '22 4436': be(5000, 2) }, undefined, 'no ambient pressure at all'],
        [{ '22 4436': be(1000, 2), '22 4201': be(Math.round(1014 / 0.0390625), 2) }, 0, 'engine barely turning: 14 hPa under ambient is nought'],
        [{ '22 4436': be(65535, 2), '22 586F': be(4200, 2), '22 4201': be(Math.round(1000 / 0.0390625), 2) }, 3.2, 'FFFF is no reading: the other identifier'],
        [{ '22 4436': be(400, 2), '22 4201': be(Math.round(1014 / 0.0390625), 2) }, undefined, 'far under ambient: not a pressure'],
        [{ '22 4436': be(5000, 2), '22 4201': be(Math.round(300 / 0.0390625), 2), '22 F433': [98] }, 4.02, 'an ambient that is not one: the barometer instead']
    ];
    for (const [answers, want, why] of cases) {
        const c = car(answers), o = opener(c, []), clock = { t: 9000 };
        const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
        await run(e, clock, { allowed: true, needs: { oil: true } }, () => e.values(clock.t).oilBar !== undefined || e.jobs.oil.misses > 0);
        const got = e.values(clock.t).oilBar;
        if (want === undefined) assert.strictEqual(got, undefined, why);
        else assert.ok(got !== undefined && Math.abs(got - want) < 0.005, why + ': ' + got);
        e.stop();
    }
});

test('nothing is asked unless allowed, and only what a style shows', async () => {
    const c = car(B58), o = opener(c, []), clock = { t: 100000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    await run(e, clock, { allowed: false, needs: ALL }, null, 200);
    assert.strictEqual(c.sent.length, 0, 'engine off, parked, BeeM-Flash feeding: not a request');
    assert.strictEqual(o.made(), 0, 'not even a link');
    assert.strictEqual(e.info(ALL, clock.t).state, 'waiting');
    await run(e, clock, { allowed: true, needs: {} }, null, 200);
    assert.strictEqual(c.sent.length, 0, 'nothing shown needs it');
    assert.strictEqual(e.info({}, clock.t).state, 'idle');
    await run(e, clock, { allowed: true, needs: { volts: true } }, () => e.values(clock.t).batteryV !== undefined);
    assert.deepStrictEqual(Array.from(new Set(c.sent.map((r) => r.key))), ['22 5853'], 'the battery, and nothing else');
    e.stop();
});

test('lightly: one request at a time, each reading at its own pace', async () => {
    const c = car(B58), o = opener(c, []), clock = { t: 0 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    /* 10 s of engine clock */
    await run(e, clock, { allowed: true, needs: { oil: true, iat: true, volts: true } }, () => clock.t >= 10000, 8000);
    e.stop();
    const n = (re) => c.sent.filter((r) => re.test(r.key)).length;
    assert.ok(n(/4436/) >= 12 && n(/4436/) <= 21, 'oil pressure about twice a second: ' + n(/4436/));
    assert.ok(n(/580F/) >= 4 && n(/580F/) <= 6, 'intake air every 2 s: ' + n(/580F/));
    assert.ok(n(/5853/) >= 2 && n(/5853/) <= 3, 'battery every 5 s: ' + n(/5853/));
    assert.strictEqual(n(/4201/), 1, 'ambient pressure once a minute');
    assert.strictEqual(n(/580B|F470/), 0, 'boost was not wanted');
    assert.ok(Engine.READINGS.oil.everyMs >= 500 && Engine.READINGS.boost.everyMs >= 200 && Engine.READINGS.iat.everyMs >= 2000 &&
        Engine.READINGS.volts.everyMs >= 5000, 'no reading faster than upstream asks');
});

test('an engine unit that does not answer is asked three times, then once a minute - and at once when the engine next starts', async () => {
    const c = car({}), logs = [], o = opener(c, logs), clock = { t: 0 };
    /* (answers nothing; one identifier per reading here, so the count is plain) */
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    const st = { allowed: true, needs: { volts: true } };
    const asks = () => c.sent.filter((r) => r.key === '22 5853').length;
    /* the candidates of one ask: 5853, F442, OBD 42 - each waits its 0.6 s out */
    assert.ok(await until(() => { e.tick(clock.t, st); clock.t += 3000; return e.jobs.volts.misses >= Engine.MISS_LIMIT; }, 15000), 'three asks missed');
    assert.strictEqual(e.values(clock.t).batteryV, undefined);
    assert.strictEqual(e.info(st.needs, clock.t).state, 'silent');
    assert.ok(logs.some((l) => /no battery from the engine unit; asked again every minute/.test(l)), logs.join(' | '));
    const quiet = asks();
    /* half a minute on: not asked */
    clock.t = e.jobs.volts.next - 30000;
    await run(e, clock, st, null, 150);
    assert.strictEqual(asks(), quiet, 'quiet for the minute');
    /* the engine stops and starts again: asked at once */
    e.tick(clock.t, { allowed: false, needs: st.needs });
    e.tick(clock.t, st);
    assert.ok(await until(() => asks() > quiet, 3000), 'asked as the engine starts');
    e.stop();
});

test('standing down drops what is on its way: no reading arrives after the engine has stopped', async () => {
    /* answers come 60 ms late */
    const c = car(B58), o = opener(c, []), clock = { t: 0 };
    const slow = c.signals.call;
    c.signals.call = (p, m, params) => new Promise((res) => setTimeout(() => res(slow(p, m, params)), 60));
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    e.tick(0, { allowed: true, needs: { iat: true } });
    await wait(10);
    e.tick(16, { allowed: false, needs: { iat: true } });        /* the engine stopped */
    await wait(250);
    assert.strictEqual(e.values(32).iatC, undefined, 'the late answer was not taken');
    assert.strictEqual(e.info({ iat: true }, 32).state, 'waiting');
    e.stop();
    e.tick(48, { allowed: true, needs: ALL });
    await wait(50);
    assert.ok(c.sent.length <= 1, 'stopped: nothing more is asked');
});

test('a reading goes when it is no longer fresh: a gauge never holds an old number', async () => {
    const c = car(B58), o = opener(c, []), clock = { t: 0 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    await run(e, clock, { allowed: true, needs: { oil: true, volts: true } }, () => e.values(clock.t).oilBar !== undefined && e.values(clock.t).batteryV !== undefined);
    const at = clock.t;
    e.tick(at, { allowed: false, needs: {} });
    assert.ok(e.values(at + Engine.READINGS.oil.keepMs - 600).oilBar !== undefined);
    assert.strictEqual(e.values(at + Engine.READINGS.oil.keepMs + 600).oilBar, undefined, 'oil pressure after 2.5 s');
    assert.ok(e.values(at + 15000).batteryV !== undefined, 'the battery is asked slowly and kept longer');
    assert.strictEqual(e.values(at + Engine.READINGS.volts.keepMs + 6000).batteryV, undefined);
    e.stop();
});

test('no diagnostic link on the head unit: said once, tried again a minute later, never thrown', async () => {
    const logs = [], clock = { t: 0 };
    let tries = 0;
    const e = Engine.create({ open: () => { tries++; throw new Error('no SOME/IP config for InternalTasu'); },
        log: { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m) }, now: () => clock.t });
    for (let i = 0; i < 50; i++) { e.tick(clock.t, { allowed: true, needs: ALL }); clock.t += 100; }
    assert.strictEqual(tries, 1);
    assert.strictEqual(e.info(ALL, clock.t).state, 'nolink');
    assert.strictEqual(logs.filter((l) => /^WARN engine/.test(l)).length, 1);
    clock.t += Engine.RETRY_MS;
    e.tick(clock.t, { allowed: true, needs: ALL });
    assert.strictEqual(tries, 2);
    /* and with no way to open one at all */
    const none = Engine.create({ now: () => 0 });
    none.tick(0, { allowed: true, needs: ALL });
    assert.deepStrictEqual(none.values(0), { oilBar: undefined, iatC: undefined, batteryV: undefined, boostBar: undefined,
        pedalPct: undefined, throttlePct: undefined, timingDeg: undefined, boostTargetBar: undefined, hpfpBar: undefined, lpfpBar: undefined, tankPct: undefined, gearboxC: undefined, socPct: undefined });
    e.stop(); none.stop();
});

test('the head unit\'s diagnostic service not up: nothing is sent, and it counts as no answer', async () => {
    const c = car(B58), o = opener(c, []), clock = { t: 0 };
    c.setAvailable(false);
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    await run(e, clock, { allowed: true, needs: { volts: true } }, () => e.jobs.volts.misses >= 1, 1500);
    assert.strictEqual(c.sent.length, 0);
    assert.ok(e.jobs.volts.misses >= 1);
    e.stop();
});

test('the manifest asks for the diagnostic transport the way every app that reads the car does, and as optional', () => {
    const app = require('../apps/akakingj_cluster_id8/app.json');
    const t = app.signals['com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu'];
    assert.deepStrictEqual({ i: t._instances, m: t._methods, b: t._broadcasts }, { i: 'SystemFunctionsInternalTasuInst1', m: ['sendTasuRequest'], b: ['sendTasuResponse'] });
    assert.ok(typeof t._optional === 'string' && /read only/.test(t._optional), 'a head unit without it still installs the app');
    assert.deepStrictEqual(Object.keys(t).filter((k) => k[0] !== '_'), [], 'no fields are subscribed: it is asked, not listened to');
});

test('the accelerator pedal, the throttle and the ignition angle: BMW\'s identifiers, then the standard ones; only while shown', async () => {
    /* 5814: 4096 x 0.01220703 = 50 %; 4600: 101 % is just past the stop, read as 100; 59FA: -4 x 0.75 = -3 degrees */
    const answers = { '22 5814': be(4096, 2), '22 4600': be(Math.round(101 / 0.0078125), 2), '22 59FA': [0xFC] };
    const c = car(answers), o = opener(c, []), clock = { t: 50000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    const needs = { pedal: true, throttle: true, timing: true };
    assert.ok(await run(e, clock, { allowed: true, needs }, () => {
        const v = e.values(clock.t);
        return v.pedalPct !== undefined && v.throttlePct !== undefined && v.timingDeg !== undefined;
    }), JSON.stringify(e.values(clock.t)));
    const v = e.values(clock.t);
    assert.ok(Math.abs(v.pedalPct - 50) < 0.01, 'pedal ' + v.pedalPct);
    assert.strictEqual(v.throttlePct, 100);
    assert.strictEqual(v.timingDeg, -3);
    assert.deepStrictEqual(e.info(needs, clock.t).have.sort(), ['accelerator pedal', 'ignition timing', 'throttle']);
    e.stop();
    /* only the standard ones answering: OBD 49 and 11 (x 100 / 255), OBD 0E (x 0.5 - 64) */
    const std = (key) => ({ '01 49': [51], '01 11': [255], '01 0E': [148] }[key] || (/^22 /.test(key) ? 'nrc31' : null));
    const c2 = car(std), o2 = opener(c2, []), clock2 = { t: 50000 };
    const e2 = Engine.create({ open: o2.open, log: o2.log, now: () => clock2.t });
    assert.ok(await run(e2, clock2, { allowed: true, needs }, () => {
        const w = e2.values(clock2.t);
        return w.pedalPct !== undefined && w.throttlePct !== undefined && w.timingDeg !== undefined;
    }));
    const w = e2.values(clock2.t);
    assert.ok(Math.abs(w.pedalPct - 20) < 1e-9 && Math.abs(w.throttlePct - 100) < 1e-9 && w.timingDeg === 10, JSON.stringify(w));
    e2.stop();
    /* not shown: never asked */
    const c3 = car(answers), o3 = opener(c3, []), clock3 = { t: 0 };
    const e3 = Engine.create({ open: o3.open, log: o3.log, now: () => clock3.t });
    await run(e3, clock3, { allowed: true, needs: { volts: true } }, null, 200);
    assert.ok(!c3.sent.some((r) => /5814|4600|59FA|01 49|01 11|01 0E/.test(r.key)));
    e3.stop();
});

test('the fuel tank\'s level, as Cluster Layouts reads it: the engine unit\'s own %, every 10 s, kept a minute, only while shown', async () => {
    const answers = Object.assign({}, B58, { '22 F42F': [128] });          /* 128 / 255 = 50.2 % */
    const c = car(answers), logs = [], o = opener(c, logs), clock = { t: 1000000 };
    const e = Engine.create({ open: o.open, log: o.log, now: () => clock.t });
    /* not shown: never asked */
    await run(e, clock, { allowed: true, needs: { iat: true } }, null, 200);
    assert.ok(!c.sent.some((r) => r.key === '22 F42F'));
    const needs = { tank: true };
    assert.ok(await run(e, clock, { allowed: true, needs }, () => e.values(clock.t).tankPct !== undefined), logs.join(' | '));
    assert.ok(Math.abs(e.values(clock.t).tankPct - 128 / 255 * 100) < 1e-9);
    assert.ok(logs.some((l) => /fuel tank level from the engine unit \(F42F\)/.test(l)), logs.join(' | '));
    /* asked again only 10 s on */
    const asked = () => c.sent.filter((r) => r.key === '22 F42F').length, n = asked();
    for (let i = 0; i < 50; i++) { clock.t += 100; e.tick(clock.t, { allowed: true, needs }); await wait(1); }
    assert.strictEqual(asked(), n, 'not asked again within 10 s');
    /* standing down: the figure is kept for a minute, then gone */
    e.tick(clock.t, { allowed: false, needs });
    clock.t += 30000;
    assert.notStrictEqual(e.values(clock.t).tankPct, undefined);
    clock.t += 31000;
    assert.strictEqual(e.values(clock.t).tankPct, undefined);
    e.stop();
    /* a diesel is asked it too: a standard PID */
    assert.deepStrictEqual(Engine.identifiers(true).tank, ['DID F42F', 'OBD 2F']);
});
