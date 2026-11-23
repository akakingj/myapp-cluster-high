'use strict';
/*
 * The service end to end, against a recording stand-in for cluster-render
 * and a fake head unit: signals in, uniforms out, and the cluster handed
 * back to BMW whenever it should be.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Main = require('../src/car/main.js');

const CDS = 'de.bmw.infotainment.vehicle.CDS';
const COND = 'de.bmw.infrastructure.VehicleCondition';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function harness(t, initial, centre, more) {
    const calls = { effect: 0, uniform: 0, drop: 0, asset: 0, pixels: 0 };
    const on = {};
    let ref = 100;
    const cr = {
        on(e, f) { on[e] = f; },
        asset() { calls.asset++; return ++ref; },
        effect() { calls.effect++; return ++ref; },
        uniform() { calls.uniform++; },
        bind() {}, set() {},
        drop() { calls.drop++; }, pixels() { calls.pixels++; }, close() {}
    };
    let onValue = null, changed = null;
    let clock = 1000000;
    let values = Object.assign({ profile: 'x3m40i', enabled: true }, initial);
    const logs = [];
    const host = {
        dataDir: more && more.dataDir,
        log: { info: m => logs.push(m), warn: m => logs.push('WARN ' + m) },
        settings: () => values,
        onSettingsChanged(fn) { changed = fn; },
        subscribe(sig, cb) { onValue = cb; calls.signals = sig; }
    };
    const deps = Object.assign({ cr, now: () => clock, centre }, more);
    delete deps.dataDir;
    const svc = Main.start(host, deps);
    t.after(() => svc.stop());   /* a failed assertion must not leave a timer running */
    return {
        calls, logs, svc, on,
        send: (s, f, v) => onValue(s, f, v),
        tick: ms => { clock += ms; },
        rpm: v => onValue(CDS, 'statusEngineSpeed2', { actualValueRPMEngineCrankshaft: v * 4 }),
        condition: c => onValue(COND, 'VehicleCondition', { statusConditionVehicle: c }),
        change(next) { values = Object.assign({}, values, next); changed(); }
    };
}

test('subscribes everything the cluster reads, G-force and car state included', { timeout: 10000 }, (t) => {
    const h = harness(t);
    const sig = h.calls.signals;
    for (const svc of ['de.bmw.infotainment.vehicle.CDS', 'de.bmw.infotainment.vehicle.Vehicle2',
                       'de.bmw.infrastructure.VehicleInformation', 'de.bmw.infotainment.vehicle.CDS2',
                       'de.bmw.infrastructure.VehicleCondition']) {
        assert.ok(sig[svc], `missing ${svc}`);
    }
    assert.ok(sig['de.bmw.infrastructure.VehicleInformation'].DataPowerTrain2, 'the engaged gear');
});

test('it is off until turned on: installing never takes the cluster', { timeout: 10000 }, async (t) => {
    const h = harness(t, { enabled: undefined });
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    assert.strictEqual(h.calls.effect, 0, 'nothing on the cluster');
    assert.strictEqual(h.svc.status(), 'Off - BMW original cluster');
});

test('turned on with the car ready, it draws', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    assert.strictEqual(h.calls.asset, 1, 'one atlas');
    assert.ok(h.calls.effect > 30, 'the layers go up');
    assert.ok(h.calls.uniform > 0, 'and are driven');
    assert.strictEqual(h.svc.status(), 'On the cluster');
});

test('nothing goes up while the car is off or switching on', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('WOHNEN');                     /* 5: parked, someone inside */
    h.rpm(0);
    await wait(320);
    assert.strictEqual(h.calls.effect, 0);
    assert.strictEqual(h.svc.status(), 'Waiting for the car to switch on');
    h.condition('FAHRBEREITSCHAFT_HERSTELLEN'); /* 8: drive readiness starting */
    await wait(320);
    assert.strictEqual(h.calls.effect, 0, 'no new layout while the KOMBI switches on');
    h.condition('FAHREN');
    await wait(320);
    assert.ok(h.calls.effect > 30);
});

test('switching off hands the cluster back to BMW', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(1500);
    await wait(320);
    const drops = h.calls.drop;
    h.condition('FAHRBEREITSCHAFT_BEENDEN');   /* 12: drive readiness ending */
    await wait(120);
    assert.ok(h.calls.drop > drops, 'layers dropped');
    assert.ok(h.logs.some(l => /handed back to BMW/.test(l)));
});

test('a car that sends no state falls back to the engine speed', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    await wait(300);
    assert.strictEqual(h.calls.effect, 0, 'no engine speed, no state: off');
    h.rpm(900);
    await wait(320);
    assert.ok(h.calls.effect > 30);
    h.tick(5000);                              /* the reading goes stale */
    await wait(120);
    assert.ok(h.logs.some(l => /handed back to BMW/.test(l)));
});

test('nothing is drawn until cluster-render is there', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    assert.strictEqual(h.calls.effect, 0);
    assert.strictEqual(h.svc.status(), 'Waiting for cluster-render');
    h.on.ready();
    await wait(320);
    assert.ok(h.calls.effect > 30);
});

test('a changed setting rebuilds the cluster, old layers down first', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    const made = h.calls.effect, drops = h.calls.drop;
    h.change({ background: 'modern', scaleMaxRpm: 7000 });
    await wait(600);                           /* settle, then rebuild */
    assert.ok(h.calls.drop >= drops + made, 'every old layer and the atlas dropped');
    assert.ok(h.calls.effect > made, 'and rebuilt');
    assert.strictEqual(h.svc.theme().settings.background, 'modern');
    assert.strictEqual(h.svc.theme().settings.scaleMaxRpm, 7000);
    assert.strictEqual(h.calls.asset, 2, 'one atlas at a time');
});

test('turning it off from the settings hands the cluster back', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    assert.ok(h.svc.isRunning());
    h.change({ enabled: false });
    await wait(700);
    assert.ok(!h.svc.isRunning());
    assert.strictEqual(h.svc.status(), 'Off - BMW original cluster');
});

test('a reconnect re-sends the atlas without remaking the layers', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    h.condition('FAHREN');
    h.rpm(2000);
    await wait(320);
    const layers = h.calls.effect, pixels = h.calls.pixels;
    h.on.disconnected();
    h.on.ready();
    assert.strictEqual(h.calls.effect, layers, 'the client replays its layers itself');
    assert.strictEqual(h.calls.pixels, pixels + 1, 'the atlas bytes are ours to send');
});

test('a bad signal payload never brings the service down', { timeout: 10000 }, async (t) => {
    const h = harness(t);
    h.on.ready();
    for (const v of [null, undefined, 42, 'x', {}, { statusConditionVehicle: {} }]) {
        h.send(COND, 'VehicleCondition', v);
        h.send(CDS, 'statusEngineSpeed2', v);
        h.send('de.bmw.infotainment.vehicle.CDS2', 'statusLateralAccelerationMassCenter', v);
    }
    await wait(300);
    assert.ok(!h.logs.some(l => /^WARN frame/.test(l)), 'no frame failed');
});

/* A centre that records what it is asked for and hands out a fixed state. */
function fakeCentre() {
    const asked = [];
    let stopped = false;
    return {
        asked, isStopped: () => stopped,
        start() {}, want(p) { if (asked[asked.length - 1] !== p) asked.push(p); },
        state: () => ({ mode: 'map', open: 1, maneuver: null }),
        info: () => ({ waze: 'Waze map showing', turnView: 'No route', wazeUp: true, cameraUp: false }),
        stop() { stopped = true; }
    };
}

test('Track: the centre is asked for only while our layers are up, and given back', { timeout: 10000 }, async (t) => {
    const c = fakeCentre();
    const h = harness(t, { style: 'track', centre: 'waze' }, c);
    h.on.ready();
    h.condition('WOHNEN');
    await wait(300);
    assert.deepStrictEqual(c.asked, ['off'], 'parked: nothing moved into the cluster');
    h.condition('FAHREN');
    h.rpm(1500);
    await wait(300);
    assert.strictEqual(c.asked[c.asked.length - 1], 'waze');
    assert.strictEqual(h.svc.centre().waze, 'Waze map showing');
    const glass = h.svc.driver() && h.svc.theme().layers.find((L) => L.id === 'back');
    assert.ok(glass, 'the M style\'s back glass, with its window, is up');
    h.condition('FAHRBEREITSCHAFT_BEENDEN');
    await wait(300);
    assert.strictEqual(c.asked[c.asked.length - 1], 'off', 'key-off gives the map back');
    h.svc.stop();
    assert.ok(c.isStopped());
});

test('Toro asks for the map only when its own centre is set to it', { timeout: 10000 }, async (t) => {
    const off = fakeCentre();
    const h = harness(t, { style: 'toro', centre: 'off' }, off);
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    await wait(300);
    assert.deepStrictEqual(off.asked, ['off'], 'nothing moved while the opening is shut');

    const on = fakeCentre();
    const h2 = harness(t, { style: 'toro', centre: 'waze' }, on);
    h2.on.ready(); h2.condition('FAHREN'); h2.rpm(1500);
    await wait(300);
    assert.strictEqual(on.asked[on.asked.length - 1], 'waze', 'the opening asks for the map');
});

test('switching style rebuilds the cluster and moves the centre with it', { timeout: 10000 }, async (t) => {
    const c = fakeCentre();
    const h = harness(t, { style: 'toro', centre: 'camera' }, c);
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    await wait(300);
    assert.strictEqual(h.svc.theme().id, 'toro');
    h.change({ style: 'track' });
    await wait(800);
    assert.strictEqual(h.svc.theme().id, 'track');
    assert.strictEqual(c.asked[c.asked.length - 1], 'camera');
    h.change({ centre: 'off' });
    await wait(800);
    assert.strictEqual(c.asked[c.asked.length - 1], 'off');
});

test('each style follows its own centre setting, as the app\'s tabs save them', { timeout: 15000 }, async (t) => {
    const c = fakeCentre();
    const last = () => c.asked[c.asked.length - 1];
    /* the three keys the app's page writes: Toro's, M Sport's, M Sport Plus's */
    const h = harness(t, { style: 'toro', tCentre: 'camera', mCentre: 'map', pCentre: 'waze' }, c);
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    await wait(300);
    assert.strictEqual(last(), 'camera', 'Toro shows what Toro\'s tab says');
    h.change({ mCentre: 'turn' });
    await wait(800);
    assert.strictEqual(last(), 'camera', 'a change on another style\'s tab leaves Toro alone');
    h.change({ style: 'track' });
    await wait(800);
    assert.strictEqual(last(), 'turn', 'M Sport: its own');
    h.change({ style: 'mplus' });
    await wait(800);
    assert.strictEqual(last(), 'waze', 'M Sport Plus: its own');
    h.change({ pCentre: 'map' });
    await wait(800);
    assert.strictEqual(last(), 'map', 'BMW\'s own map is a choice of its own, passed on as it is');
    /* Toro has no turn card: a value it does not offer closes its opening */
    h.change({ style: 'toro', tCentre: 'turn' });
    await wait(800);
    assert.strictEqual(last(), 'off');
});

/* ------------------------------------------ BeeM-Flash, or the car itself */

const FES = 'de.bmw.infotainment.drivingexcitement.FES';
/* BeeM-Flash's feed, as the service uses it: started, stopped, live or not, its channels */
function fakeFeed(values) {
    let running = false, live = false, folder = false;
    const f = {
        starts: 0, stops: 0,
        setLive(v) { live = v; },
        setFolder(v) { folder = v; },
        present: () => folder,
        start() { if (!running) f.starts++; running = true; },
        stop() { if (running) f.stops++; running = false; },
        running: () => running, live: () => running && live, seen: () => live,
        value: (k) => (running && live ? values[k] : undefined),
        channels: () => ({}),
        info: () => (running && live ? 'BeeM-Flash: 3 channels' : 'BeeM-Flash: not running')
    };
    return f;
}
/* the engine unit's reader: records every say-so it is given, and has these readings */
function fakeEngine(values) {
    const e = {
        ticks: [], stopped: false,
        tick(now, st) { e.ticks.push({ now, allowed: st.allowed, needs: Object.assign({}, st.needs) }); },
        values: () => values,
        info: () => ({ state: 'reading', have: ['oil pressure'], missing: [] }),
        stop() { e.stopped = true; }
    };
    return e;
}
const lastTick = (e) => e.ticks[e.ticks.length - 1];
const ENGINE = { oilBar: 4.1, iatC: 30, batteryV: 14.1, boostBar: 0.8 };
const FEED = { oilPressure: 5.5, iat: 44, battery: 13.2 };

test('BeeM-Flash off: its feed is never looked for, and the engine unit is asked only with the car on and the engine running', { timeout: 15000 }, async (t) => {
    const feed = fakeFeed(FEED), engine = fakeEngine(ENGINE);
    feed.setLive(true);                    /* BeeM-Flash is there and feeding: off means it is not used */
    const h = harness(t, { style: 'toro', beemFlash: 'off' }, null, { feed, engine });
    h.on.ready();
    h.condition('WOHNEN');
    await wait(300);
    assert.strictEqual(feed.starts, 0, 'the feed is not started');
    assert.ok(engine.ticks.length > 0 && engine.ticks.every((x) => x.allowed === false), 'parked: the engine unit is not asked');
    /* ignition on, engine not running */
    h.condition('FAHREN'); h.rpm(0);
    await wait(300);
    assert.ok(h.svc.isRunning(), 'our layers are up');
    assert.strictEqual(lastTick(engine).allowed, false, 'engine off: not asked - that is when a control unit is coded or flashed');
    h.rpm(350);
    await wait(100);
    assert.strictEqual(lastTick(engine).allowed, false, 'cranking: not yet');
    h.rpm(1500);
    await wait(300);
    assert.strictEqual(lastTick(engine).allowed, true, 'running: asked');
    assert.deepStrictEqual(lastTick(engine).needs, { oil: true, iat: false, volts: false, boost: true },
        'Toro shows oil pressure and boost, and the Sport Display has sent no boost');
    /* what it reads reaches the gauges; BeeM-Flash's figures do not */
    const raw = h.svc.reader.raw(1000000);
    assert.strictEqual(raw.oilPressBar, 4.1);
    assert.strictEqual(raw.boostBar, 0.8);
    assert.strictEqual(raw.iatC, 30);
    assert.strictEqual(raw.batteryV, 14.1);
    assert.match(h.svc.feed(), /^Engine unit: oil pressure/);
    assert.ok(h.logs.some((l) => /readings: the engine unit only \(BeeM-Flash off\)/.test(l)), 'the log says which');
    /* stopped at a light by auto start-stop: still in drive readiness, still asked - for three minutes */
    h.rpm(0);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, true, 'auto-stopped in drive readiness');
    h.tick(Main.AUTO_STOP_MS - 5000); h.rpm(0);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, true, 'just under three minutes');
    h.tick(10000); h.rpm(0);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, false, 'three minutes stopped: no longer');
    /* running again, then switched to ignition-only: at once not asked, whatever the engine did a moment ago */
    h.rpm(900);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, true);
    h.condition('PRUEFEN_ANALYSE_DIAGNOSE'); h.rpm(0);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, false, 'ignition on, engine off: the state a unit is coded or flashed in');
    /* key off: not asked again */
    h.condition('FAHREN'); h.rpm(900);
    await wait(200);
    h.condition('FAHRBEREITSCHAFT_BEENDEN');
    await wait(300);
    assert.strictEqual(lastTick(engine).allowed, false);
    h.svc.stop();
    assert.ok(engine.stopped);
});

test('BeeM-Flash on: its readings are used, and the engine unit is never asked - feeding or not', { timeout: 15000 }, async (t) => {
    const feed = fakeFeed(FEED), engine = fakeEngine(ENGINE);
    const h = harness(t, { style: 'toro', beemFlash: 'on' }, null, { feed, engine });
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    await wait(300);
    assert.strictEqual(feed.starts, 1);
    assert.ok(engine.ticks.every((x) => x.allowed === false), 'BeeM-Flash not feeding yet: still not asked');
    assert.match(h.svc.feed(), /BeeM-Flash: not running \(engine unit not asked\)/);
    feed.setLive(true);
    await wait(300);
    assert.strictEqual(h.svc.reader.raw(1000000).oilPressBar, 5.5, 'BeeM-Flash\'s oil pressure');
    assert.strictEqual(h.svc.reader.raw(1000000).iatC, 44);
    assert.ok(engine.ticks.every((x) => x.allowed === false));
    assert.match(h.svc.feed(), /^BeeM-Flash: 3 channels$/);
});

test('automatic: a head unit that has BeeM-Flash is never asked - feeding, paused, or after a restart; one that has none is', { timeout: 20000 }, async (t) => {
    const DAY = 24 * 3600 * 1000;
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-readings-'));
    const feed = fakeFeed(FEED), engine = fakeEngine(ENGINE);
    const h = harness(t, { style: 'toro' }, null, { feed, engine, dataDir });      /* the setting as it comes */
    assert.strictEqual(Main.feedModeOf({}), 'auto');
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    feed.setLive(true);
    await wait(300);
    assert.strictEqual(lastTick(engine).allowed, false, 'BeeM-Flash is feeding: it has the readings, and the link');
    assert.strictEqual(h.svc.reader.raw(1000000).oilPressBar, 5.5, 'its figure, not the engine unit\'s');
    /* BeeM-Flash stops feeding (paused, a tool on its bridge, a flash): still its head unit */
    feed.setLive(false);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, false, 'not feeding: still not asked');
    assert.match(h.svc.feed(), /BeeM-Flash: not running \(engine unit not asked\)/);
    h.tick(13 * DAY); h.rpm(1500);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, false, '13 days on: still BeeM-Flash\'s head unit');
    /* remembered across a restart of the head unit, where its folder (in RAM) is gone */
    const memo = JSON.parse(fs.readFileSync(path.join(dataDir, 'readings.json'), 'utf8'));
    assert.strictEqual(typeof memo.beemFedAt, 'number');
    const feedB = fakeFeed({}), engineB = fakeEngine(ENGINE);
    const hb = harness(t, { style: 'toro' }, null, { feed: feedB, engine: engineB, dataDir });
    hb.on.ready(); hb.condition('FAHREN'); hb.rpm(1500);
    await wait(300);
    assert.strictEqual(lastTick(engineB).allowed, false, 'a new start, BeeM-Flash not up yet: remembered');
    /* two weeks without it: gone, and the car is asked instead */
    h.tick(2 * DAY); h.rpm(1500);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, true, '15 days on, engine running: the engine unit');
    assert.strictEqual(h.svc.reader.raw(1000000 + 15 * DAY).oilPressBar, 4.1);
    assert.match(h.svc.feed(), /^No BeeM-Flash\. Engine unit: oil pressure/);
    /* and BeeM-Flash's the moment it feeds again */
    feed.setLive(true);
    await wait(200);
    assert.strictEqual(lastTick(engine).allowed, false);

    /* its folder there (it has run since the head unit started) is enough, without a feed */
    const feed2 = fakeFeed({}), engine2 = fakeEngine(ENGINE);
    feed2.setFolder(true);
    const h2 = harness(t, { style: 'toro', beemFlash: 'auto' }, null, { feed: feed2, engine: engine2 });
    h2.on.ready(); h2.condition('FAHREN'); h2.rpm(1500);
    await wait(300);
    assert.strictEqual(lastTick(engine2).allowed, false, 'BeeM-Flash\'s folder is there');
    /* a head unit that never had BeeM-Flash: asked from the first drive */
    const feed3 = fakeFeed({}), engine3 = fakeEngine(ENGINE);
    const h3 = harness(t, { style: 'toro', beemFlash: 'auto' }, null, { feed: feed3, engine: engine3 });
    h3.on.ready(); h3.condition('FAHREN'); h3.rpm(1500);
    await wait(300);
    assert.strictEqual(lastTick(engine3).allowed, true);
    /* "off" is the owner's word that BeeM-Flash is not to be used: asked, folder or no folder */
    const feed4 = fakeFeed({}), engine4 = fakeEngine(ENGINE);
    feed4.setFolder(true);
    const h4 = harness(t, { style: 'toro', beemFlash: 'off' }, null, { feed: feed4, engine: engine4, dataDir });
    h4.on.ready(); h4.condition('FAHREN'); h4.rpm(1500);
    await wait(300);
    assert.strictEqual(lastTick(engine4).allowed, true);
});

test('the car\'s own boost comes first; an M style asks for what its footer holds; a change of setting is taken at once', { timeout: 20000 }, async (t) => {
    const feed = fakeFeed(FEED), engine = fakeEngine(ENGINE);
    const h = harness(t, { style: 'toro', beemFlash: 'off' }, null, { feed, engine });
    h.on.ready(); h.condition('FAHREN'); h.rpm(1500);
    h.send(FES, 'statusSwitchDriveDynamicSport2', { displayBoostPressure: 120 });
    await wait(300);
    assert.strictEqual(lastTick(engine).needs.boost, false, 'the Sport Display sends boost: the engine unit is not asked for it');
    assert.strictEqual(h.svc.reader.raw(1000000).boostBar, 1.2, 'and the car\'s own is what shows');
    /* M Sport, its footer holding intake air and the battery */
    h.change({ style: 'track', mFootL: 'iat', mFootR: 'volts' });
    await wait(800);
    assert.deepStrictEqual(lastTick(engine).needs, { oil: false, iat: true, volts: true, boost: false });
    h.change({ mFootM: 'boost' });
    await wait(800);
    assert.strictEqual(lastTick(engine).needs.boost, false, 'boost in the footer, and the car still sends its own');
    /* M Sport as it comes: nothing of the engine unit's is shown, so nothing is asked for */
    h.change({ mFootL: 'time', mFootM: 'range', mFootR: 'outside' });
    await wait(800);
    assert.deepStrictEqual(lastTick(engine).needs, { oil: false, iat: false, volts: false, boost: false });
    /* turned on while driving: the feed starts, the engine unit is left alone */
    assert.strictEqual(feed.starts, 0);
    h.change({ beemFlash: 'on' });
    await wait(800);
    assert.strictEqual(feed.starts, 1);
    assert.strictEqual(lastTick(engine).allowed, false);
    /* and off again: the feed is stopped */
    h.change({ beemFlash: 'off' });
    await wait(800);
    assert.strictEqual(feed.stops, 1);
    /* an older switch-like value still means what it says */
    assert.deepStrictEqual([true, false, 'on', 'off', 'auto', 'sometimes', undefined].map((v) => Main.feedModeOf({ beemFlash: v })),
        ['on', 'off', 'on', 'off', 'auto', 'auto', 'auto']);
});

