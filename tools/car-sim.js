#!/usr/bin/env node
'use strict';
/*
 * The car, simulated: the built app, run end to end in this container.
 *
 *   node tools/car-sim.js            run, report, write build/car-sim/
 *
 * It builds the real package with the kit's own builder, then stands in for
 * the three things only a head unit has - BMW's oap-sdk, its native SOME/IP
 * binding, and the cluster-render service's socket - and runs the built
 * app.js, unmodified, through a key-on, drive, limiter, key-off sequence.
 *
 * What it proves: the package builds; the kit runtime starts it; the real
 * signal path (kit/runtime/signals.js) feeds it; the real cluster-render
 * client puts layers on the wire; it stays off until the car is ready and
 * hands the cluster back at key-off; the middle opens over the map slot
 * when, and only when, it should; and every shader it sends compiles in
 * GLSL ES 1.00. It also captures exactly what the renderer was told, so
 * tools/car-sim-replay.js can draw the cluster the way the car would.
 *
 *   CAR_SIM_THEME=toro|track|mplus     the style (toro)
 *   CAR_SIM_CENTRE=waze|map|camera|turn|off   that style's centre (waze)
 *   CAR_SIM_BEEM=none|feeding|idle   BeeM-Flash on the head unit (none). The app has no setting for it
 *        (0.13.0): the engine unit is asked, read-only, whatever BeeM-Flash does.
 *        none     no BeeM-Flash on the head unit
 *        feeding  BeeM-Flash feeding throughout: its feed is not looked at
 *        idle     BeeM-Flash on the head unit (its folder is there) but not feeding
 *   CAR_SIM_BG=genuine|modern|revuelto Toro's background
 *   CAR_SIM_BOOST_TOP=200             the Sport Display's boost gauge end it sends (raw; 255: none)
 *   CAR_SIM_DIESEL=1                   a diesel: it pulls to 5,050 rpm and cruises at 2,200, its
 *        engine unit is a DDE (it answers the standard identifiers - and BMW's petrol ones with
 *        figures that are not readings, which must never be asked for), and "Engine" is set to diesel
 *   CAR_SIM_SETTINGS='{"holiday":true}'       any other setting
 *
 * What it cannot prove: anything about BMW's SDK or the KOMBI themselves.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'app.base.json'), 'utf8'));
const ID = spec.id;
const PKG = path.join(ROOT, 'dist', ID);
const SRC = path.join(PKG, 'source');
const OUT = path.join(ROOT, 'build', 'car-sim');
const SOCK_DIR = '/dev/shm/cluster-render';
const SOCK = path.join(SOCK_DIR, 'render.sock');

function sh(cmd, cwd) { cp.execSync(cmd, { cwd: cwd || ROOT, stdio: ['ignore', 'pipe', 'inherit'] }); }

/* ------------------------------------------------------------ build */
function build() {
    sh('node tools/stage-app.js');
    sh('python3 kit/tools/build.py --preview-only ' + ID, ROOT);
}

/* ------------------------------------------------- the head unit's parts */
function installHeadUnit(settings) {
    const nm = path.join(SRC, 'node_modules');
    const put = (rel, text) => {
        fs.mkdirSync(path.dirname(path.join(nm, rel)), { recursive: true });
        fs.writeFileSync(path.join(nm, rel), text);
    };
    /* BMW's SDK: an app with no screens, so the kit runs it in the background
       the way the platform's autostart does. */
    put('oap-sdk/package.json', '{"name":"oap-sdk","version":"0.0.0-sim","main":"index.js"}');
    put('oap-sdk/index.js', `'use strict';
const EventEmitter = require('events');
class OnlineApp extends EventEmitter {
  constructor() { super(); this.rhmiApplication = null; }
  start() { setTimeout(() => this.emit('appStatusProxyReady'), 5); return Promise.resolve(); }
  registerActive() { return Promise.resolve(); }
}
const say = (l) => (m) => process.stdout.write('[sdk ' + l + '] ' + m + '\\n');
module.exports = { OnlineApp, logging: { getSDKLogger: () => ({
  error: say('error'), warn: say('warn'), info: say('info'), debug() {} }) } };
`);
    /* The native SOME/IP binding: proxies that deliver the scenario's
       payloads to whoever subscribed. */
    put('someip/package.json', '{"name":"someip","version":"0.0.0-sim","main":"index.js"}');
    put('someip/index.js', `'use strict';
const fs = require('fs');
const scenario = require(process.env.CAR_SIM_SCENARIO);
const t0 = Date.now();
/* the head unit's diagnostic transport (InternalTasu), as kit/runtime/diag.js uses it: every
   request is written down for the simulator, and the scenario's engine unit answers */
const TASU = 'com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu';
function tasu() {
  let onResponse = null;
  return {
    init() { return Promise.resolve(); },
    isAvailable() { return true; },
    subscribeToAvailability(cb) { setImmediate(() => cb(true)); },
    subscribe(sub) { if (sub.name === 'sendTasuResponse') onResponse = sub.onReceive; return Promise.resolve(); },
    callMethod(method, params) {
      const t = Date.now() - t0, data = Array.prototype.slice.call(params.udsData || []);
      fs.appendFileSync(process.env.CAR_SIM_TASU_LOG, JSON.stringify({ t, method, source: params.sourceAddress,
        target: params.targetAddress, sid: params.serviceID, data }) + '\\n');
      const uds = scenario.diag(params.targetAddress, params.serviceID, data, t);
      /* a 9-byte header, the answering unit's address in [6], then its reply */
      if (uds && onResponse) setTimeout(() => onResponse({ errorCode: 'NO_ERROR',
        udsResponse: Buffer.from([0, 0, 0, 0, 0, 0, params.targetAddress, 0, 0].concat(uds)) }), 6);
      return Promise.resolve({ TasuErrorEnum: 'NO_ERROR' });
    },
    shutdown() { return Promise.resolve(); }
  };
}
exports.buildProxy = (cfg, instance) => cfg.interface === TASU ? Promise.resolve(tasu()) : Promise.resolve({
  init() { return Promise.resolve(); },
  isAvailable() { return true; },
  subscribeToAvailability(cb) { setImmediate(() => cb(true)); },
  getValue(field) {
    const v = scenario.value(cfg.interface, field, Date.now() - t0);
    return v === undefined ? Promise.reject(new Error('no value')) : Promise.resolve(v);
  },
  subscribe(sub) {
    setInterval(() => {
      const v = scenario.value(cfg.interface, sub.name, Date.now() - t0);
      if (v !== undefined) sub.onReceive(v);
    }, 40);
    return Promise.resolve();
  },
  shutdown() { return Promise.resolve(); }
});
`);
    /* Per-interface configs, as the head unit keeps them. */
    const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', ID, 'app.json'), 'utf8'));
    const dir = path.join(PKG, 'someipInterfaces');
    fs.mkdirSync(dir, { recursive: true });
    Object.keys(app.signals).forEach((iface) => {
        const fields = {};
        Object.keys(app.signals[iface]).filter((f) => f[0] !== '_')
            .forEach((f) => { fields[f] = { getter: true, notifier: true }; });
        fs.writeFileSync(path.join(dir, iface.replace(/\./g, '_') + '.json'),
            JSON.stringify({ interface: iface, fields }));
    });
    /* Settings, as the iDrive screen saves them: every one of them, whole (the kit writes them
       all when any is changed). */
    const data = path.join(PKG, 'data');
    fs.rmSync(data, { recursive: true, force: true });
    fs.mkdirSync(data, { recursive: true });
    const all = {};
    (app.settings || []).forEach((it) => { all[it.key] = it.default; });
    Object.assign(all, settings);
    fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify(all));
    return data;
}

/* ------------------------------------------- the renderer's socket */
/*
 * The one place on the panel nothing of ours may ever stand: the window
 * BMW's gear letter shows in (src/geometry/panel.js). A layer over any of
 * it and the KOMBI draws its black fallback box in the rev dial, which can
 * stay until the cluster restarts. Every rectangle the renderer is given -
 * a new layer, or one moved by the limiter's shake - is held against it.
 */
const GEAR_WINDOW = require(path.join(ROOT, 'src', 'geometry', 'panel.js')).GEAR_TRIGGER_WINDOW;
function overGear(m) {
    const g = GEAR_WINDOW;
    return m.x < g.x + g.w && m.x + m.w > g.x && m.y < g.y + g.h && m.y + m.h > g.y;
}

function renderer() {
    const state = { atlas: null, hello: null, layers: {}, assets: {}, refused: [], ops: {}, bytes: 0, frames: 0, moves: 0, time: 0,
                    /* how near anything came to the gear's window, and the rows below the cut that were covered */
                    gear: { over: 0, nearestLeft: Infinity, nearestRight: Infinity, nearestAbove: Infinity }, belowCut: {} };
    const watch = (ref, m) => {
        if (!(m.w > 0 && m.h > 0)) return;
        const g = GEAR_WINDOW;
        if (overGear(m)) {
            if (!state.gear.over++) state.refused.push('layer ' + ref + ' (' + [m.x, m.y, m.w, m.h].join(', ') + ') stands over the gear\'s window (' + [g.x, g.y, g.w, g.h].join(', ') + ')');
            return;
        }
        const rows = m.y < g.y + g.h && m.y + m.h > g.y, cols = m.x < g.x + g.w && m.x + m.w > g.x;
        if (rows && m.x + m.w <= g.x) state.gear.nearestLeft = Math.min(state.gear.nearestLeft, g.x - (m.x + m.w));
        if (rows && m.x >= g.x + g.w) state.gear.nearestRight = Math.min(state.gear.nearestRight, m.x - (g.x + g.w));
        if (cols && m.y + m.h <= g.y) state.gear.nearestAbove = Math.min(state.gear.nearestAbove, g.y - (m.y + m.h));
        if (m.y + m.h > 646) state.belowCut[[m.x, m.y, m.w, m.h].join(',')] = true;
    };
    fs.mkdirSync(SOCK_DIR, { recursive: true });
    try { fs.unlinkSync(SOCK); } catch (e) { /* none */ }
    const reply = (sock, obj) => {
        const b = Buffer.from(JSON.stringify(obj));
        const m = Buffer.alloc(5 + b.length);
        m.writeUInt32LE(b.length + 1, 0); m[4] = 0x4a; b.copy(m, 5);
        sock.write(m);
    };
    const server = net.createServer((sock) => {
        let buf = Buffer.alloc(0);
        sock.on('error', () => {});
        sock.on('data', (d) => {
            buf = Buffer.concat([buf, d]);
            while (buf.length >= 5) {
                const len = buf.readUInt32LE(0);
                if (buf.length < 4 + len) break;
                const type = buf[4], body = buf.slice(5, 4 + len);
                buf = buf.slice(4 + len);
                state.bytes += 4 + len;
                if (type === 0x46) {                       /* a frame: the atlas */
                    const ref = body.readUInt32LE(0), n = body.readUInt16LE(12);
                    state.assets[ref] = state.assets[ref] || {};
                    state.assets[ref].pixels = body.slice(14 + n * 8);
                    state.atlas = state.assets[ref].pixels;
                    state.frames++;
                    continue;
                }
                const m = JSON.parse(body.toString('utf8'));
                state.ops[m.op] = (state.ops[m.op] || 0) + 1;
                if (m.op === 'hello') {
                    state.hello = m;
                    reply(sock, { ev: 'hello', proto: 1, backend: 'id7',
                                  targets: 'map:1088x480,panel:1920x720,hud:800x480' });
                } else if (m.op === 'asset') {
                    state.assets[m.ref] = Object.assign(state.assets[m.ref] || {}, { meta: m });
                } else if (m.op === 'layer') {
                    state.layers[m.ref] = { msg: m, uniforms: {}, binds: {}, visible: m.visible !== 0,
                                            home: { x: m.x, y: m.y } };
                    watch(m.ref, m);
                    /* the renderer's own clock is not to be asked for: it does not run on the car */
                    if (m.time) state.refused.push('layer ' + m.ref + ' asks for the renderer\'s clock ("time")');
                } else if (m.op === 'uniform' && state.layers[m.ref]) {
                    state.layers[m.ref].uniforms[m.name] = m.v.split(' ').map(Number);
                    if (m.name === 'u_time') state.time++;
                } else if (m.op === 'bind' && state.layers[m.ref]) {
                    state.layers[m.ref].binds[m.sampler] = m.asset;
                } else if (m.op === 'set' && state.layers[m.ref]) {
                    const L = state.layers[m.ref];
                    if (m.visible !== undefined) L.visible = m.visible !== 0;
                    /* a layer moved: the shake at the limiter */
                    if (m.x !== undefined || m.y !== undefined) {
                        if (m.x !== undefined) L.msg.x = m.x;
                        if (m.y !== undefined) L.msg.y = m.y;
                        state.moves++;
                        watch(m.ref, L.msg);
                    }
                } else if (m.op === 'animate') {
                    state.refused.push('an animation was asked of the renderer: its clock does not run on the car');
                } else if (m.op === 'drop') {
                    delete state.layers[m.ref];
                    delete state.assets[m.ref];
                }
            }
        });
    });
    server.listen(SOCK);
    return { state, close: () => server.close() };
}

/* ------------------------------------------------------- scenario */
function writeScenario(file) {
    fs.writeFileSync(file, `'use strict';
/* key-on at 2.5 s, drive readiness at 4 s, a pull to the limiter, key-off at ${KEY_OFF / 1000} s */
const CDS = 'de.bmw.infotainment.vehicle.CDS', V2 = 'de.bmw.infotainment.vehicle.Vehicle2';
const VI = 'de.bmw.infrastructure.VehicleInformation', VC = 'de.bmw.infrastructure.VehicleCondition';
const FES = 'de.bmw.infotainment.drivingexcitement.FES', CDS2 = 'de.bmw.infotainment.vehicle.CDS2';
const E2 = 'de.bmw.infotainment.drivingexcitement.Efficiencytainment2';
const KI = 'de.bmw.infotainment.KombiIF', ENV = 'de.bmw.infrastructure.EnvironmentalInformation';
function drive(t) {
  if (t < 4000) return { rpm: 0, kmh: 0, gear: 3 };
  if (t < 5000) return { rpm: 760, kmh: 0, gear: 3 };
  const u = Math.min(1, (t - 5000) / 1800);
  const rpm = t < 7600 ? 1600 + u * ${DIESEL ? 3450 : 5450} : ${DIESEL ? 2200 : 5200};           /* to ${DIESEL ? 5050 : 7050} (on the limiter) by 6.8 s, held to 7.6 s */
  return { rpm, kmh: 35 + u * 55, gear: 5 + Math.min(3, Math.floor((t - 5000) / 900)) };
}
exports.value = (iface, field, t) => {
  const d = drive(t);
  if (iface === VC) return { statusConditionVehicle: t < 2500 ? 'WOHNEN' : t < 4000 ? 'FAHRBEREITSCHAFT_HERSTELLEN'
                                                    : t < ${KEY_OFF} ? 'FAHREN' : 'FAHRBEREITSCHAFT_BEENDEN' };
  if (iface === CDS && field === 'statusEngineSpeed2') return t < ${KEY_OFF} ? { actualValueRPMEngineCrankshaft: Math.round(d.rpm * 4) } : undefined;
  if (iface === CDS && field === 'statusEngineTemperature') return { temperatureEngineDrive: 48 + 92, temperatureEngineOilDrive: 48 + 104 };
  if (iface === V2) return { speedVehicleCentreOfGravity: Math.round(d.kmh * 64) };
  if (iface === VI && field === 'DataPowerTrain2') return { statusGearSelectionDrive: d.gear };
  /* (CAR_SIM_NO_BUS_BOOST=1: a car whose Sport Display sends no boost - 255 is "no value") */
  if (iface === FES && field === 'statusSwitchDriveDynamicSport2') return { displayBoostPressure: ${process.env.CAR_SIM_NO_BUS_BOOST ? '255' : 't > 5000 && t < 7600 ? 108 : 0'}, displayMaximumValueBoostPressure: ${process.env.CAR_SIM_BOOST_TOP || 255}, actualValueModeDrivingExperience: 'SPORT_EXPERT' };
  if (iface === FES) return { actualValueModeDrivingExperience: 'SPORT_EXPERT' };
  if (iface === CDS2 && field === 'statusLateralAccelerationMassCenter') return { lateralAccelerationCentreOfGravity: Math.round((65 + 0.4 * 9.80665 * Math.sin(t / 700)) / 0.002) };
  if (iface === CDS2) return { longitudinalAccelerationCentreOfGravity: Math.round((65 + 0.3 * 9.80665) / 0.002) };
  /* the cluster's own clock: the car's time of day, which the head unit (on UTC) does not have */
  if (iface === KI && field === 'statusShowTimeDate') return { displayHour: 12, displayMinute: 4, displaySecond: 0, statusDisplayClockTimeDate: 1 };
  /* the trip computer's average: 9.6 l/100 km, in tenths, the unit litres per 100 km */
  if (iface === KI && field === 'statusBordcomputerAverage') return { consumptionAverage1BC1: 96, statusUnitOfMeasurementConsumptionBC: 1 };
  if (iface === KI && field === 'displayRangeElectricVehicle') return ${process.env.CAR_SIM_EV ? '{ displayRangeElectricVehicle: 43 }' : '{ displayRangeElectricVehicle: 65535 }'};
  if (iface === E2 && field === 'statusBatteryTemperature') return ${process.env.CAR_SIM_EV ? '{ actualValueTemperatureHighVoltageStorage: 76 }' : '{ actualValueTemperatureHighVoltageStorage: 255 }'};
  if (iface === E2) return ${process.env.CAR_SIM_EV ? '{ displayChargingConditionHighVoltageStorage: 78 }' : '{ displayChargingConditionHighVoltageStorage: 255 }'};
  if (iface === KI) return { range: 412, fluidLevelFuelTank: 41, mileageKilometre: 18420 };
  if (iface === ENV) return { temperatureExterior: Math.round((21.5 + 40) / 0.5) };
  return undefined;
};
/*
 * The engine unit (0x12) on the diagnostic link, read-only identifiers as the open projects
 * publish them (docs/ENGINE-READINGS.md): oil pressure absolute 4436 (hPa) and ambient 4201,
 * intake air 580F, battery 5853, boost 580B, the barometer F433 and the tank's level F42F (40 %,
 * where the car's 41 L over 59 L would make 69 %). Anything else is refused
 * (NRC 31), any other unit does not answer, and nothing but a read is answered at all.
 */
const be2 = (n) => [(n >> 8) & 255, n & 255];
exports.diag = (target, sid, data, t) => {
  if (target !== 0x12) return null;
  if (sid !== 0x22) return [0x7F, sid, 0x11];
  const did = (data[0] << 8) | data[1], d = drive(t);
  const reply = (bytes) => [0x62, data[0], data[1]].concat(bytes);
${DIESEL ? `  /*
   * A diesel's engine unit (a DDE). The standard identifiers - the OBD PIDs through UDS - mean
   * what they mean everywhere: intake air F40F, the unit's voltage F442, boost F470, the barometer
   * F433. BMW's petrol identifiers it ANSWERS TOO, with figures that are something else on a DDE
   * but would pass for readings (9 bar of oil, 87 C of intake air, 11 V): they are the trap, and
   * the app must never ask for one.
   */
  if (did === 0xF40F) return reply([76]);                                         /* 36 C */
  if (did === 0xF442) return reply(be2(14130));                                   /* 14.13 V */
  if (did === 0xF470) return reply([1, 0, 0].concat(be2(Math.round(150 / 0.03125))));   /* 150 kPa absolute */
  if (did === 0xF433) return reply([100]);
  if (did === 0xF42F) return reply([102]);                                        /* 40 % */
  if (did === 0x4436 || did === 0x586F) return reply(be2(10014));
  if (did === 0x4201) return reply(be2(Math.round(1014 / 0.0390625)));
  if (did === 0x580F) return reply([180]);
  if (did === 0x5853) return reply(be2(11000));
  if (did === 0x580B) return reply(be2(Math.round(250 / 0.00390625)));
  return [0x7F, 0x22, 0x31];` : ''}
  if (did === 0x4436) return reply(be2(Math.round(1014 + 1200 + d.rpm * 0.55)));   /* about 4 bar at 5200 */
  if (did === 0x4201) return reply(be2(Math.round(1014 / 0.0390625)));
  if (did === 0x580F) return reply([112]);                                        /* 36 C */
  if (did === 0x5853) return reply(be2(14130));                                   /* 14.13 V */
  if (did === 0x580B) return reply(be2(Math.round(150 / 0.00390625)));            /* 150 kPa absolute */
  if (did === 0xF433) return reply([100]);
  if (did === 0xF42F) return reply([102]);                                        /* 40 % */
  return [0x7F, 0x22, 0x31];
};
`);
}

/* ------------------------------ the centre's two neighbours, faked */
/*
 * Maps on cluster as it is now (0.11): a status file written twice a second
 * and a control socket that belongs to its own app - anyone else is told
 * "busy" and closed. MGU Styles only reads the file, so whatever reaches
 * the socket is recorded, and there must be nothing. The phone's map is
 * there from MAP_FROM to MAP_TO: a phone that connects once the car is on
 * and is unplugged before it is off.
 *
 * Turn View's tool: pushes its state on connect, takes
 * {"op":"set","settings":{"enabled":..}} and answers with the new state.
 * Its camera decodes a moment after it is switched on. A route with a left
 * turn coming, throughout.
 */
const KEY_OFF = 12500;
/* CAR_SIM_DIESEL=1: the car is a diesel (its rev range, its engine unit) and the app is told so */
const DIESEL = !!process.env.CAR_SIM_DIESEL;
const PEAK_RPM = DIESEL ? 5050 : 7050;      /* what the pull goes to (the scenario's drive()) */
const MAP_FROM = 5200, MAP_TO = 9800;
function neighbours(start) {
    const dir = path.join(OUT, 'neighbours');
    fs.mkdirSync(dir, { recursive: true });
    const waze = { state: 'idle', connects: 0, cmds: [] };
    const statusFile = path.join(dir, 'waze-status.json');
    const writeStatus = () => {
        const t = Date.now() - start;
        waze.state = t >= MAP_FROM && t < MAP_TO ? 'showing' : 'idle';
        const line = { ev: 'status', state: waze.state, target: 'map',
                       page: waze.state === 'showing' ? 'map — 30 frames/s (hardware)' : 'hardware', reason: '',
                       upload_cap_kb_per_s: 0, upload_reason: '', hide_bmw_guidance: 0, guide_disabled: 0,
                       cluster: 1, hud: 0, hud_state: 'off', hud_width_pct: 0, hud_x: 0, hud_y: 0, hud_keep_shown: 0 };
        /* by rename, as the service does: a reader never sees half a file */
        fs.writeFileSync(statusFile + '.tmp', JSON.stringify(line) + '\n');
        fs.renameSync(statusFile + '.tmp', statusFile);
    };
    writeStatus();
    const tick = setInterval(writeStatus, 500);
    const wazeSock = path.join(dir, 'waze-ctl.sock');
    const ws = net.createServer((c) => {
        waze.connects++;
        c.setEncoding('utf8'); c.on('error', () => {});
        c.on('data', (d) => d.split('\n').filter(Boolean).forEach((l) => waze.cmds.push({ t: Date.now() - start, line: l })));
        c.end('{"ev":"status","state":"error","target":null,"page":null,"reason":"busy"}\n');
    }).listen(wazeSock);

    /* heldMs: the longest any one connection stayed open. The real tool starts its app (the part
       that asks the camera for a picture) only while nobody is connected, so none may be held. */
    const tv = { connects: 0, open: 0, heldMs: 0, enabled: false, since: 0, sets: [] };
    const camera = () => !tv.enabled ? 'off' : Date.now() - tv.since < 400 ? 'waiting' : 'decoding';
    const tvState = () => JSON.stringify({ state: { settings: { enabled: tv.enabled }, status: { camera: camera(), route: 'active',
        maneuver: { kind: 'intersection', angle: 90, side: -1, exit: 0, text: '0.3 mi' } } } }) + '\n';
    const tvSock = path.join(dir, 'tv-ctl.sock');
    const ts = net.createServer((c) => {
        const came = Date.now();
        tv.connects++; tv.open++;
        c.setEncoding('utf8');
        c.on('close', () => { tv.open--; tv.heldMs = Math.max(tv.heldMs, Date.now() - came); }); c.on('error', () => {});
        c.on('data', (d) => d.split('\n').filter(Boolean).forEach((l) => {
            let m; try { m = JSON.parse(l); } catch (e) { return; }
            if (m && m.op === 'set' && m.settings && typeof m.settings.enabled === 'boolean') {
                if (m.settings.enabled !== tv.enabled) { tv.enabled = m.settings.enabled; tv.since = Date.now(); }
                tv.sets.push({ t: Date.now() - start, on: tv.enabled });
                c.write(tvState());
            }
        }));
        c.write(tvState());
    }).listen(tvSock);
    return {
        waze, tv,
        /* what holds the cluster's one map slot now: the camera when it shows,
           else the phone's map when there is one, else BMW's own */
        slot: () => camera() === 'decoding' ? 'camera' : waze.state === 'showing' ? 'phone' : 'bmw',
        env: { WAZE_STATUS: statusFile, WAZE_CTL: wazeSock, TURNVIEW_CTL: tvSock },
        close: () => { clearInterval(tick); ws.close(); ts.close(); }
    };
}

/* ------------------------------------------------------------ run */
function snapshot(state, t) {
    const layers = Object.keys(state.layers).map((r) => {
        const l = state.layers[r];
        return JSON.parse(JSON.stringify({ ref: Number(r), msg: l.msg, uniforms: l.uniforms, binds: l.binds, visible: l.visible }));
    });
    return { t, layers, ops: Object.assign({}, state.ops), bytes: state.bytes };
}

/*
 * BeeM-Flash on this head unit: whether the engine unit may be asked (engine), and whose figures the cluster
 * must show (shows: 'engine', 'beem', or null for neither). The app has no BeeM-Flash setting (0.13.0): the
 * engine unit is asked on every head unit, BeeM-Flash's feed not looked at.
 */
const BEEM_RUNS = {
    none: { feeding: false, engine: true, shows: 'engine', what: 'none on this head unit' },
    feeding: { feeding: true, engine: true, shows: 'engine', what: 'feeding throughout, its feed not looked at' },
    idle: { feeding: false, folder: true, engine: true, shows: 'engine', what: 'on this head unit but not feeding' }
};

/* what each text layer on the wire says: its glyphs, looked up in the atlas the app sent */
const ATLAS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'atlas.json'), 'utf8'));
const GLYPH_AT = {};
Object.keys(ATLAS.faces).forEach((face) => {
    const g = ATLAS.faces[face].glyphs;
    Object.keys(g).forEach((ch) => { if (g[ch].tw) GLYPH_AT[g[ch].u + ',' + g[ch].v] = ch; });
});
function textsOf(state) {
    const out = [];
    Object.keys(state.layers).forEach((ref) => {
        const L = state.layers[ref], u = L.uniforms;
        if (!L.visible || !u.u_g) return;
        const n = u.u_count ? u.u_count[0] : u.u_cfg ? u.u_cfg[0] : 0;
        let str = '';
        for (let g = 0; g < n; g++) str += GLYPH_AT[Math.round(u.u_g[g * 4] * ATLAS.size) + ',' + Math.round(u.u_g[g * 4 + 1] * ATLAS.size)] || '?';
        if (str) out.push(str);
    });
    return out;
}

/* a style's own setting for its centre (src/theme/index.js OWN) */
const CENTRE_KEY = { toro: 'tCentre', track: 'mCentre', mplus: 'pCentre', mtrack: 'kCentre' };
const CENTRES = { toro: ['waze', 'map', 'camera', 'off'], track: ['waze', 'map', 'camera', 'turn', 'off'],
                  mplus: ['waze', 'map', 'camera', 'turn', 'off'], mtrack: ['waze', 'map', 'camera', 'off'] };
/* the letter a style's own settings start with (its footer's places, M Track Mode's rows) */
const OWN_PREFIX = { track: 'm', mplus: 'p', mtrack: 'k' };

async function main() {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    process.stdout.write('building the package with the kit\'s builder... ');
    build();
    console.log('done');

    const THEME = process.env.CAR_SIM_THEME || 'toro';
    const CENTRE = process.env.CAR_SIM_CENTRE || 'waze';
    if (!CENTRES[THEME]) throw new Error('CAR_SIM_THEME: toro, track, mplus or mtrack');
    if (CENTRES[THEME].indexOf(CENTRE) < 0) throw new Error('CAR_SIM_CENTRE for ' + THEME + ': ' + CENTRES[THEME].join(', '));
    const BEEM = process.env.CAR_SIM_BEEM || 'none';
    if (!BEEM_RUNS[BEEM]) throw new Error('CAR_SIM_BEEM: ' + Object.keys(BEEM_RUNS).join(', '));
    const extra = process.env.CAR_SIM_SETTINGS ? JSON.parse(process.env.CAR_SIM_SETTINGS) : {};
    /* (the start-up message, which a new install shows for its first ten seconds, is off here so that
       what is read off the cluster is the cluster: CAR_SIM_SETTINGS='{"intro":true}' runs with it) */
    const settings = { enabled: 'on', style: THEME, background: process.env.CAR_SIM_BG || 'genuine', intro: false };
    if (DIESEL) settings.engine = 'diesel';
    settings[CENTRE_KEY[THEME]] = CENTRE;
    const data = installHeadUnit(Object.assign(settings, extra));
    const scenarioFile = path.join(OUT, 'scenario.js');
    writeScenario(scenarioFile);
    const r = renderer();

    const log = [];
    const start = Date.now();
    const nb = neighbours(start);
    /* BeeM-Flash: its feed file, written the way it writes it - or no such file anywhere */
    const feedFile = path.join(OUT, 'beem-flash', 'cluster.json');
    const tasuLog = path.join(OUT, 'tasu.jsonl');
    fs.writeFileSync(tasuLog, '');
    let feeder = null;
    if (BEEM_RUNS[BEEM].folder) fs.mkdirSync(path.dirname(feedFile), { recursive: true });
    if (BEEM_RUNS[BEEM].feeding) {
        fs.mkdirSync(path.dirname(feedFile), { recursive: true });
        const write = () => {
            fs.writeFileSync(feedFile + '.tmp', JSON.stringify({ t: Date.now(), units: 'metric', channels: [
                { key: 'oilPressure', value: 6.5, unit: 'bar' }, { key: 'iat', value: 50, unit: 'C' },
                { key: 'battery', value: 12.6, unit: 'V' }] }));
            fs.renameSync(feedFile + '.tmp', feedFile);
        };
        write();
        feeder = setInterval(write, 150);
    }
    const app = cp.spawn(process.execPath, [path.join(SRC, 'javascript', 'app.js')], {
        cwd: data, env: Object.assign({}, process.env, nb.env, { CAR_SIM_SCENARIO: scenarioFile,
            CAR_SIM_TASU_LOG: tasuLog, BEEM_FEED: feedFile })
    });
    app.stdout.on('data', (d) => log.push(String(d)));
    app.stderr.on('data', (d) => log.push('ERR ' + String(d)));
    let exited = null;
    app.on('exit', (code) => { exited = code; });

    const marks = [[2000, 'parked', 'parked, ignition off'], [3500, 'starting', 'drive readiness starting'],
                   /* (up 1.2 s after the car is on: SHOW_SETTLE_MS) */ [5700, 'on', 'on, no map from the phone yet'], [6200, 'pull', 'pulling through ' + (DIESEL ? '3,900' : '5,000') + ' rpm'],
                   [7300, 'limiter', 'on the limiter'], [9400, 'cruise', 'cruising, the phone\'s map on'],
                   [11700, 'gone', 'cruising, the phone unplugged'], [KEY_OFF + 2600, 'off', 'switched off']];
    const shots = [];
    /* what the app's own process has cost so far: its CPU time (user + system) by the kernel's count, in
       seconds - null where there is no /proc to ask. Read at each mark, so start-up and driving can be told apart. */
    const cpuNow = () => {
        try {
            const f = fs.readFileSync('/proc/' + app.pid + '/stat', 'utf8').split(') ')[1].split(' ');
            return (Number(f[11]) + Number(f[12])) / 100;
        } catch (e) { return null; }
    };
    for (const [at, id, what] of marks) {
        await new Promise((res) => setTimeout(res, Math.max(0, at - (Date.now() - start))));
        const s = snapshot(r.state, at);
        s.cpu = id === 'off' ? null : cpuNow();
        s.wire = { bytes: r.state.bytes, ops: Object.assign({}, r.state.ops) };
        s.id = id;
        s.what = what;
        s.slot = nb.slot();
        /* how far the middle has opened over the map slot: Toro's background
           (u_holeOpen), the M styles' window (their back glass's u_open) */
        s.open = 0;
        /* how far any layer stands from where it was put: the limiter's shake */
        s.moved = 0;
        Object.keys(r.state.layers).forEach((ref) => {
            const L = r.state.layers[ref];
            const u = L.uniforms.u_holeOpen || L.uniforms.u_open;
            if (u) s.open = Math.max(s.open, u[0]);
            s.moved = Math.max(s.moved, Math.abs(L.msg.x - L.home.x), Math.abs(L.msg.y - L.home.y));
        });
        s.moves = r.state.moves;
        s.theme = THEME;
        s.centre = CENTRE;
        s.texts = textsOf(r.state);
        shots.push(s);
    }
    app.kill('SIGTERM');
    await new Promise((res) => setTimeout(res, 600));
    r.close();
    nb.close();
    if (feeder) clearInterval(feeder);
    /* every diagnostic request the app sent, as the head unit's service got it */
    const asked = fs.readFileSync(tasuLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

    /* the atlas as the renderer received it */
    fs.writeFileSync(path.join(OUT, 'snapshots.json'), JSON.stringify(shots));
    if (r.state.atlas) fs.writeFileSync(path.join(OUT, 'atlas.r8'), r.state.atlas);
    fs.writeFileSync(path.join(OUT, 'app.log'), log.join(''));
    const fileLog = path.join(data, ID + '.log');
    if (fs.existsSync(fileLog)) fs.copyFileSync(fileLog, path.join(OUT, 'app-file.log'));

    /* ------------------------------------------------ report */
    console.log('\n' + THEME + ', centre ' + CENTRE + ': the app ' + (exited === null || exited === 0 || exited === 143 ? 'ran' : 'EXITED ' + exited) +
        '; renderer said hello to "' + (r.state.hello && r.state.hello.app) + '"');
    shots.forEach((s) => {
        const vis = s.layers.filter((l) => l.visible).length;
        console.log('  ' + (s.t / 1000).toFixed(1).padStart(4) + ' s  ' + s.what.padEnd(32) + String(vis).padStart(2) + ' layers, the middle open ' +
            s.open.toFixed(2) + (s.moved ? ', shaken ' + s.moved + ' px' : '') + ', in the slot: ' + s.slot);
    });
    console.log('  wire: ' + Object.keys(r.state.ops).map((k) => k + ' ' + r.state.ops[k]).join(', ') +
        '; ' + Math.round(r.state.bytes / 1024) + ' KB in ' + ((Date.now() - start) / 1000).toFixed(1) + ' s');
    console.log('  our own clock: u_time sent ' + r.state.time + ' times; layers moved ' + r.state.moves + ' times');
    /* the cost of it: the app's process from the moment the cluster came up to the last mark with the car on */
    const cOn = shots.filter((x) => x.id === 'on')[0], cEnd = shots.filter((x) => x.id === 'gone')[0];
    if (cOn && cEnd && cOn.cpu !== null && cEnd.cpu !== null) {
        const secs = (cEnd.t - cOn.t) / 1000, cpu = cEnd.cpu - cOn.cpu;
        const sent = (cEnd.wire.bytes - cOn.wire.bytes) / 1024, msgs = (cEnd.wire.ops.uniform || 0) - (cOn.wire.ops.uniform || 0);
        console.log('  cost: starting up took ' + cOn.cpu.toFixed(2) + ' s of the processor; then ' + secs.toFixed(1) + ' s of driving took ' +
            cpu.toFixed(2) + ' s (' + (100 * cpu / secs).toFixed(1) + ' % of one core of this machine) and sent ' +
            sent.toFixed(0) + ' KB in ' + msgs + ' uniform messages (' + (sent / secs).toFixed(1) + ' KB/s)');
    }
    /* BMW's strip: what was laid over it, and how near anything came to its gear letter's window */
    const gw = r.state.gear, near = (n) => (n === Infinity ? 'nothing' : n + ' px');
    const rects = Object.keys(r.state.belowCut).map((k) => k.split(',').map(Number));
    /* what is meant to be there (the background's trim, the covers) starts on the panel's edge or runs to its foot;
       the rest is a layer the limiter's shake carried a few rows past the cut for a frame */
    /* (and the patch over the speed limit sign's edge, which stands by itself right of the strip's clock) */
    const SIGN = require(path.join(ROOT, 'src', 'geometry', 'panel.js')).SIGN_PATCH;
    /*
     * BETA, "lower": the style itself stands in the strip's rows, so every layer may. What holds then is
     * the rule the covers have always kept: nothing in the columns left open for the gear, from the
     * trim's foot down - checked for every rectangle the renderer was ever given, shaken ones included.
     */
    const StripRules = require(path.join(ROOT, 'src', 'theme', 'strip.js'));
    const PanelFacts = require(path.join(ROOT, 'src', 'geometry', 'panel.js'));
    const LOWERED = Math.min(StripRules.lowerPx(settings.lower),
        require(path.join(ROOT, 'src', 'theme', 'index.js')).lowerMost(THEME));
    const keepCols = settings.bottomExtra === 'hideWide' ? PanelFacts.GEAR_KEEP_WIDE : PanelFacts.GEAR_KEEP;
    const trimFoot = PanelFacts.BOTTOM_CUT + PanelFacts.STRIP_TRIM_MAX;
    const inKeep = rects.filter((b) => b[0] < keepCols.x + keepCols.w && b[0] + b[2] > keepCols.x && b[1] + b[3] > trimFoot);
    const lowest = rects.reduce((n, b) => Math.max(n, b[1] + b[3]), 0);
    const meant = LOWERED ? rects : rects.filter((b) => b[0] === 0 || b[1] + b[3] === 720 ||
        (b[0] === SIGN.x && b[1] === SIGN.y && b[2] === SIGN.w && b[3] === SIGN.h));
    const shaken = rects.filter((b) => meant.indexOf(b) < 0).reduce((n, b) => Math.max(n, b[1] + b[3]), 0);
    const below = LOWERED
        ? 'the style lowered ' + LOWERED + ' px: ' + rects.length + ' rectangles of ours below the cut, the lowest row ' + lowest +
          ', ' + (inKeep.length ? inKeep.length + ' IN THE GEAR\'S COLUMNS' : 'none in the gear\'s columns (x ' + keepCols.x + '-' +
          (keepCols.x + keepCols.w) + ' from y ' + trimFoot + ')')
        : meant.map((b) => 'x ' + b[0] + '-' + (b[0] + b[2]) + ' to y ' + (b[1] + b[3])).join('; ');
    console.log('  BMW\'s strip: ' + (LOWERED ? below : below ? 'covered ' + below : 'nothing of ours on it') +
        (shaken ? ' (the shake carried a layer to y ' + shaken + ')' : '') + '; the gear\'s window: ' +
        (gw.over ? 'COVERED ' + gw.over + ' times' : 'never covered (nearest: ' + near(gw.nearestAbove) + ' above, ' +
        near(gw.nearestLeft) + ' to its left, ' + near(gw.nearestRight) + ' to its right)'));
    const warns = log.join('').split('\n').filter((l) => /WARN|ERR|FATAL|error/i.test(l) &&
        !/someip native|no SOME\/IP config/.test(l));
    if (warns.length) { console.log('\nwarnings from the app:'); warns.slice(0, 15).forEach((w) => console.log('  ' + w)); }
    console.log('\nwrote ' + path.relative(ROOT, OUT) + '/ (snapshots, atlas, logs)');

    /* what must hold on the car */
    const at = (id) => shots.filter((x) => x.id === id)[0];
    const on = (id) => at(id).layers.filter((l) => l.visible).length;
    const problems = [];
    if (shaken >= GEAR_WINDOW.y - 4) problems.push('the shake carried a layer to y ' + shaken + ', against the gear\'s window');
    if (inKeep.length) problems.push(inKeep.length + ' rectangle(s) of ours stood in the gear\'s columns below the trim: ' +
        inKeep.slice(0, 3).map((b) => b.join(',')).join(' | '));
    if (lowest > PanelFacts.PANEL_HEIGHT) problems.push('a layer ran off the foot of the screen (to y ' + lowest + ')');
    if (LOWERED && lowest !== PanelFacts.PANEL_HEIGHT) problems.push('lowered, the covers did not reach the screen\'s foot');
    if (exited !== null && exited !== 0) problems.push('the app exited (' + exited + ')');
    if (!r.state.hello) problems.push('the app never said hello to cluster-render');
    if (on('parked') || on('starting')) problems.push('it drew before the car was on');
    ['on', 'pull', 'limiter', 'cruise', 'gone'].forEach((id) => { if (!on(id)) problems.push('it did not draw while driving (' + id + ')'); });
    if (at('off').layers.length) problems.push('it did not hand the cluster back at key-off');
    if (!r.state.atlas) problems.push('the glyph atlas never arrived');
    r.state.refused.forEach((x) => problems.push(x));

    /* the middle: open over the map slot when there is a picture to show, whole when there is not.
       Fully open is 1 in the M styles and 0.9 in Toro, which keeps a veil of its artwork (holeMax). */
    const open = (id) => at(id).open;
    const FULL = THEME === 'toro' ? 0.89 : 0.99;
    /* shut is what the shaders take for shut (u_open > 0.001 opens): the driver
       sends a uniform only when it has changed by 0.0005, so the last step to 0 may not go */
    const SHUT = 0.001;
    if (CENTRE === 'waze') {
        if (open('on') > SHUT) problems.push('the middle opened with no map from the phone');
        if (!(open('limiter') > FULL) || !(open('cruise') > FULL)) problems.push('the middle did not open over the phone\'s map');
        if (open('gone') > SHUT) problems.push('the middle stayed open after the phone\'s map had gone');
    } else if (CENTRE === 'map') {
        ['pull', 'limiter', 'cruise', 'gone'].forEach((id) => { if (!(open(id) > FULL)) problems.push('the middle was not open for BMW\'s map (' + id + ')'); });
    } else if (CENTRE === 'camera') {
        const first = nb.tv.sets.filter((x) => x.on)[0];
        console.log('  turn view: ' + (nb.tv.sets.map((x) => (x.t / 1000).toFixed(1) + ' s switched ' + (x.on ? 'on' : 'off')).join(', ') || 'never switched'));
        if (!first) problems.push('Turn View\'s camera was never switched on');
        else if (first.t < 4000) problems.push('Turn View\'s camera was switched on before the car was');
        if (!(open('limiter') > FULL) || !(open('cruise') > FULL)) problems.push('the middle did not open over the camera');
        if (nb.tv.enabled) problems.push('Turn View\'s camera was left on at key-off');
    } else {
        shots.forEach((x) => { if (x.open > SHUT) problems.push('the middle opened with the centre "' + CENTRE + '" (' + x.id + ')'); });
    }
    if (CENTRE !== 'camera' && nb.tv.sets.length) problems.push('Turn View was switched without being asked for');
    /* Maps on cluster is only ever read */
    console.log('  maps on cluster: ' + (nb.waze.connects ? nb.waze.connects + ' connections, ' + nb.waze.cmds.length + ' commands' : 'only read, nothing sent'));
    if (nb.waze.connects || nb.waze.cmds.length) problems.push('something was sent to Maps on cluster (' + nb.waze.cmds.map((c) => c.line).join(' ') + ')');
    console.log('  turn view: ' + nb.tv.connects + ' connections, the longest open for ' + nb.tv.heldMs + ' ms');
    if (nb.tv.heldMs > 500 || nb.tv.open > 0) problems.push('a Turn View connection was held open');
    if (CENTRE === 'off' && nb.tv.connects) problems.push('Turn View was polled with the centre off');

    /* ---- the readings the bus does not carry: the engine unit's, read-only */
    const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');
    const ids = {};
    asked.forEach((q) => { const k = hex(q.sid) + ' ' + q.data.map(hex).join(''); ids[k] = (ids[k] || 0) + 1; });
    console.log('  BeeM-Flash: ' + BEEM_RUNS[BEEM].what);
    console.log('  the engine unit was asked ' + asked.length + ' times' + (asked.length
        ? ', ' + (asked[0].t / 1000).toFixed(1) + ' - ' + (asked[asked.length - 1].t / 1000).toFixed(1) + ' s: ' +
          Object.keys(ids).map((k) => k + ' x' + ids[k]).join(', ') : ''));
    asked.forEach((q) => {
        if (q.method !== 'sendTasuRequest') problems.push('an unexpected call on the diagnostic service: ' + q.method);
        if (q.sid !== 0x22 && q.sid !== 0x01) problems.push('a diagnostic request that is not a read: service ' + hex(q.sid));
        if (q.target !== 0x12) problems.push('a diagnostic request to a unit other than the engine\'s: ' + hex(q.target));
        /* the engine runs from 4.0 s to key-off: not a request outside that (the app's own clock starts a little late) */
        if (q.t < 3800) problems.push('the engine unit was asked before the engine ran (' + q.t + ' ms)');
        if (q.t > KEY_OFF + 400) problems.push('the engine unit was asked after key-off (' + q.t + ' ms)');
    });
    const cruise = at('cruise').texts.join(' | ');
    const shown = (re) => at('cruise').texts.some((x) => re.test(x));
    console.log('  on the cluster while cruising: ' + at('cruise').texts.filter((x) => /OLIO|TURBO|IAT|BATT|BOOST/.test(x) || /^[\d.]+$/.test(x)).join('  '));
    /* what the style on the cluster shows that only the engine unit (or BeeM-Flash) can supply:
       Toro's left gauges want oil pressure; an M style's footer whatever its places hold; boost
       only where the car's Sport Display sends none */
    const mFoot = THEME === 'toro' ? [] : ['FootL', 'FootM', 'FootR'].map((k) => settings[OWN_PREFIX[THEME] + k]);
    /* M Track Mode's four gauge rows: as they come, the frame's - boost, coolant, oil, intake air */
    const ROW_HOME = ['boost', 'coolant', 'oil', 'iat'];
    const rows = THEME !== 'mtrack' ? [] : [1, 2, 3, 4].map((n) => {
        const v = settings['kRow' + n];
        return v && v !== 'auto' ? v : ROW_HOME[n - 1];
    });
    /* (Toro's electric range takes the oil pressure gauge's place on a hybrid, unless told another: then nobody wants oil pressure) */
    const evOnOil = THEME === 'toro' && (settings.electric === 'hybrid' || settings.electric === 'bev') &&
        (settings.electricGauge === 'oilP' || ((settings.electricGauge || 'auto') === 'auto' && settings.electric === 'hybrid'));
    const oilGauge = settings.showAuxLeft !== false && !evOnOil;
    /* (Engine: diesel - its engine unit is asked only the standard identifiers, and there is none for oil pressure) */
    const dieselSet = settings.engine === 'diesel';
    const held = mFoot.concat(rows);
    /* (the fuel gauge, in every style as it comes: the engine unit's tank level) */
    const tankWanted = settings.electric !== 'bev';
    const wanted = tankWanted || (THEME === 'toro' ? (oilGauge && !dieselSet) || (!!process.env.CAR_SIM_NO_BUS_BOOST && settings.showBoost !== false)
        : held.indexOf('iat') >= 0 || held.indexOf('volts') >= 0 || (rows.indexOf('oilp') >= 0 && !dieselSet) ||
          (!!process.env.CAR_SIM_NO_BUS_BOOST && held.indexOf('boost') >= 0));
    if (dieselSet) {
        const petrolOnly = Object.keys(ids).filter((k) => /^22 (4436|586F|4201|580F|5853|580B)$/.test(k));
        if (petrolOnly.length) problems.push('a diesel\'s engine unit was asked a petrol unit\'s identifier: ' + petrolOnly.join(', '));
        const notStandard = Object.keys(ids).filter((k) => !/^(22 F4[0-9A-F]{2}|01 [0-9A-F]{2})$/.test(k));
        if (notStandard.length) problems.push('a diesel\'s engine unit was asked something that is not a standard identifier: ' + notStandard.join(', '));
        console.log('  a diesel: asked the standard identifiers only (' + (Object.keys(ids).join(', ') || 'nothing') + ')');
    }
    if (BEEM_RUNS[BEEM].engine && wanted) {
        if (!asked.length) problems.push('the engine unit was never asked for the readings the cluster shows');
        const perSec = asked.length / ((KEY_OFF - 4000) / 1000);
        if (perSec > 9) problems.push('the engine unit was asked ' + perSec.toFixed(1) + ' times a second');
    } else if (asked.length) {
        problems.push('the engine unit was asked ' + asked.length + ' times with ' +
            (BEEM_RUNS[BEEM].engine ? 'nothing on the cluster that needs it' : 'BeeM-Flash ' + BEEM_RUNS[BEEM].what));
    }
    /* what a style shows of them, read back off the wire */
    const want = BEEM_RUNS[BEEM].shows;
    if (evOnOil && !shown(/ELETTRICO/)) problems.push('Toro shows no electric range gauge');
    if (THEME === 'toro' && oilGauge) {
        /* (a diesel's engine unit is not asked for oil pressure: only BeeM-Flash can supply it there) */
        const oil = want === 'beem' || (want === 'engine' && !dieselSet);
        if (oil && !shown(/PRESS\.OLIO/)) problems.push('Toro\'s left gauge is not oil pressure (' + cruise.slice(0, 200) + ')');
        if (!oil && !shown(/PRESS\.TURBO/)) problems.push('Toro\'s left gauge shows oil pressure with nothing to read it from');
    }
    if (THEME === 'mtrack') {
        /*
         * Its gauge rows, off the wire: one layer, a mark a row (u_val: 0..1 along the rail, -1 for no
         * reading). With a picture in the wing the rows are gone - no layer of theirs is shown - and
         * with none they are there, the intake air's mark at the figure whoever supplies it gives:
         * 36 C from the engine unit is 97 F, 0.81 of the way along 0 - 120; BeeM-Flash's 50 C is past
         * its end; nobody's is no mark.
         */
        const rowLayer = (id) => at(id).layers.filter((l) => l.uniforms.u_val && l.uniforms.u_fade)[0];
        /* the rows' own symbols on the wire: glyphs of the face "mt" other than the M mark, in a layer that is shown */
        const MT = ATLAS.faces.mt.glyphs, ROW_GLYPH = {};
        Object.keys(MT).forEach((ch) => { if (ch !== 'm') ROW_GLYPH[MT[ch].u + ',' + MT[ch].v] = ch; });
        const rowText = (id) => at(id).layers.filter((l) => l.visible && l.uniforms.u_g && l.uniforms.u_count &&
            ROW_GLYPH[Math.round(l.uniforms.u_g[0] * ATLAS.size) + ',' + Math.round(l.uniforms.u_g[1] * ATLAS.size)]);
        const pictureAt = (id) => at(id).open > 0.99;
        ['on', 'pull', 'limiter', 'cruise', 'gone'].forEach((id) => {
            const L = rowLayer(id), seen = L && L.visible;
            if (pictureAt(id) && (seen || rowText(id).length)) problems.push('the gauge rows stayed over the picture in the wing (' + id + ')');
            if (at(id).open < SHUT && (!seen || !rowText(id).length)) problems.push('the gauge rows were not there with no picture in the wing (' + id + ')');
        });
        const last = ['gone', 'cruise'].filter((id) => rowLayer(id) && rowLayer(id).visible)[0];
        const iatRow = rows.indexOf('iat');
        if (last && iatRow >= 0 && !dieselSet) {
            const v = rowLayer(last).uniforms.u_val[iatRow];
            const fig = want === 'beem' ? 1 : want === 'engine' ? 97 / 120 : -1;
            console.log('  the gauge rows (' + last + '): marks at ' + rowLayer(last).uniforms.u_val.map((x) => x.toFixed(2)).join(', '));
            if (Math.abs(v - fig) > 0.02) problems.push('the intake air row\'s mark is at ' + v.toFixed(2) + ', not ' + fig.toFixed(2));
        }
    }
    if (THEME !== 'toro') {
        const foot = ['FootL', 'FootM', 'FootR'].map((k) => settings[OWN_PREFIX[THEME] + k]);
        /* 36 C from the engine unit is 97 F; BeeM-Flash's 50 C is 122 F; its 12.6 V against the engine unit's 14.1 */
        if (foot.indexOf('iat') >= 0) {
            const fig = want === 'beem' ? '122' : want === 'engine' ? '97' : '--';
            if (!shown(new RegExp('^' + fig + '$'))) problems.push('the footer\'s intake air does not read ' + fig + ' (' + cruise.slice(0, 240) + ')');
        }
        if (foot.indexOf('volts') >= 0) {
            const fig = want === 'beem' ? '12\\.6' : want === 'engine' ? '14\\.1' : '--';
            if (!shown(new RegExp('^' + fig + '$'))) problems.push('the footer\'s battery does not read ' + fig.replace(/\\\\/g, '') + ' (' + cruise.slice(0, 240) + ')');
        }
    }

    /*
     * The limiter: Toro shakes, by layers we move ourselves; nothing is left off its place.
     * Where the limit is comes from the settings in use, worked out as the app works it out
     * (a diesel's own, or whatever Redline and Limiter were set to): the pull here goes to
     * its peak, so a limit set above that is - rightly - never reached.
     */
    const limits = require(path.join(ROOT, 'src', 'theme', 'palette.js'))
        .resolve(settings, require(path.join(ROOT, 'src', 'geometry', 'panel.js')).profile(require(path.join(ROOT, 'src', 'geometry', 'panel.js')).kindOf(settings)));
    const reached = PEAK_RPM >= limits.flashFromRpm;
    console.log('  the limiter: set at ' + limits.rpmLimiter + ' rpm (warning from ' + limits.flashFromRpm + '); the pull goes to ' + PEAK_RPM +
        (reached ? '' : ': not reached, so nothing may flash or shake'));
    if (THEME === 'toro' && settings.shake !== 'off') {
        if (reached && !(at('limiter').moves > at('pull').moves)) problems.push('nothing shook at the limiter');
        if (!reached && at('limiter').moves > at('pull').moves) problems.push('the cluster shook at ' + PEAK_RPM + ' rpm, below the limiter set (' + limits.rpmLimiter + ')');
    }
    ['on', 'cruise', 'gone'].forEach((id) => { if (at(id).moved) problems.push('a layer was left ' + at(id).moved + ' px off its place (' + id + ')'); });
    /* and what moves by the clock got one: the limiter's flash at the least */
    if (reached && !r.state.time) problems.push('no u_time was ever sent: nothing animated');

    if (problems.length) { console.log('\nFAILED: ' + problems.join('; ')); process.exit(1); }
    console.log('car behaviour: as expected');
}

main().catch((e) => { console.error(e); process.exit(1); });
