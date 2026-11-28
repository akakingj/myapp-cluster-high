'use strict';
/*
 * GENERAL > Car: B48, B58, S58, a plug-in hybrid (each with its own figures), or the Car profile's values, and
 * TORO > Gear: the gear with its programme (D1, S1, M1) or the figure alone.
 *   node --test test/car.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Panel = require('../src/geometry/panel.js');
const Palette = require('../src/theme/palette.js');
const Vehicle = require('../src/car/vehicle.js');
const spec = require('../app/app.base.json');

const item = (k) => spec.settings.find((s) => s.key === k);
function settingsClass(dir) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'kit', 'runtime', 'mgu.js'), 'utf8');
    const from = src.indexOf('class Settings {'), to = src.indexOf('\n}\n', from) + 2;
    // eslint-disable-next-line no-new-func
    return new Function('fs', 'path', 'DATA_DIR', 'log', src.slice(from, to) + '\nreturn Settings;')(fs, path, dir, { info() {}, warn() {}, error() {} });
}

test('no Car to choose: the figures (or the Car profile\'s) for every car; an M car and a plug-in hybrid by Engine', () => {
    assert.strictEqual(item('profile'), undefined, 'GENERAL > Car is gone');
    assert.deepStrictEqual(item('engine').options.map((o) => o[0]), ['auto', 'diesel', 'petrol', 'm', 'phev']);
    assert.strictEqual(item('electric'), undefined, 'Electric range went: Engine says it');
    /* every figure is offered whatever the car (the tach scale for a petrol engine, an M car's too) */
    for (const k of ['rpmRedline', 'rpmLimiter', 'shiftFrom', 'shiftAt', 'speedMax', 'boostMax']) assert.strictEqual(item(k).when, undefined, k);
    assert.deepStrictEqual(item('scaleMaxRpm').when, { engine: ['auto', 'petrol', 'm', 'phev'] });
    /* the kind of car: an M car (its M display's boxes), a plug-in hybrid (its eDrive box), a car */
    assert.strictEqual(Panel.kindOf({ engine: 'm', electric: 'off' }), 'mCarS58');
    assert.strictEqual(Panel.kindOf({ engine: 'petrol', electric: 'hybrid' }), 'hybrid');
    assert.strictEqual(Panel.kindOf({ engine: 'petrol', electric: 'off' }), 'carprofile');
    assert.strictEqual(Panel.kindOf({ engine: 'diesel' }), 'carprofile');
    assert.deepStrictEqual(Panel.PROFILES.mCarS58.extraZones.map((z) => z.id), ['mBoxA', 'mBoxB']);
    assert.deepStrictEqual(Panel.PROFILES.hybrid.extraZones.map((z) => z.id), ['edrive']);
    assert.deepStrictEqual(Panel.PROFILES.carprofile.extraZones, []);
});

test('the figures: GENERAL\'s, the kind of car\'s own where left to the car; the speedometer and boost gauge as set', () => {
    const fig = (id, cfg) => {
        const S = Palette.resolve(cfg || {}, Panel.profile(id));
        return [S.rpmLimiter, S.scaleMaxRpm, S.rpmRedline, S.shiftWarn ? S.shiftAtRpm : null, S.yellowRpm, S.speedMax];
    };
    assert.deepStrictEqual(fig('carprofile'), [7000, 8000, 6750, null, null, 260]);
    assert.deepStrictEqual(fig('carprofile', { rpmRedline: '6200', rpmLimiter: '6800', shiftAt: '6500', scaleMaxRpm: '7000', speedMax: '330' }),
        [6800, 7000, 6200, 6500, null, 330]);
    /* an M car: its own redline and limiter on From the car, the speedometer to 330 on Automatic */
    assert.deepStrictEqual(fig('mCarS58', { engine: 'm' }), [8000, 8000, 7000, null, null, 330]);
    assert.deepStrictEqual(fig('mCarS58', { engine: 'm', speedMax: '260' }).slice(5), [260]);
    assert.deepStrictEqual(fig('hybrid'), [6500, 8000, 6000, null, null, 260]);
    /* the boost gauge's top in psi and its bar (Automatic: the kind's own) */
    const p = Panel.profileFor('carprofile', { boostMax: '45' });
    assert.deepStrictEqual([p.tankLitres, p.boostBar, p.boostPsi, p.boostMaxPsi], [undefined, 3, 45, 45], 'the car\'s own 45 psi gauge: 3.0 bar');
    assert.deepStrictEqual(['15', '20', '30'].map((v) => Panel.profileFor('carprofile', { boostMax: v }).boostBar), [2, 2, 2], 'in bar 2.0');
    assert.strictEqual(Panel.profileFor('carprofile', { boostMax: '2.5' }).boostPsi, null, 'no gauge ends there: the kind\'s own');
    assert.deepStrictEqual(Panel.BOOST_BAR, { 15: 2, 20: 2, 30: 2, 45: 3 });
    const a = Panel.profileFor('mCarS58', { boostMax: 'auto' });
    assert.deepStrictEqual([a.boostBar, a.boostPsi, a.boostMaxPsi], [null, null, 26]);
    assert.strictEqual(item('speedMax').profile, 'speedMax');
    assert.strictEqual(item('boostMax').profile, 'boostMax');
    /* every boost top the Car profile gives is one of this app's */
    const own = item('boostMax').options.map((o) => o[0]);
    [15, 20, 30, 45].forEach((v) => assert.ok(own.indexOf(String(v)) >= 0, v + ' psi'));
});

test('a car chosen under GENERAL > Car before it went keeps its figures: moved into GENERAL\'s own once', () => {
    const was = (car, extra) => Panel.figuresOfCar(Object.assign({ profile: car }, extra || {}));
    assert.deepStrictEqual(was('b58'), { rpmLimiter: '7500', rpmRedline: '6500', shiftAt: '7000', shiftFrom: 'auto', scaleMaxRpm: '8000',
        speedMax: '260', boostMax: '30' });
    assert.strictEqual(was('b48').boostMax, '20', 'the boost gauge\'s end as Toro drew it: 20 psi');
    assert.strictEqual(was('mCarS58').engine, 'm');
    assert.strictEqual(was('mCarS58', { engine: 'diesel' }).engine, undefined, 'a diesel stays one');
    assert.deepStrictEqual(was('hybrid'), { engine: 'phev' });
    assert.deepStrictEqual(was('hybrid', { engine: 'diesel' }), {});
    assert.deepStrictEqual(was('x3m40i'), was('b48'));
    assert.strictEqual(was('carprofile'), null);
    assert.strictEqual(was('custom'), null);
    assert.strictEqual(Panel.figuresOfCar({}), null);
    /* each one a value its setting has, and the old figures as they were: a B48's 7,000 limit on a dial to 7 */
    for (const car of ['b48', 'b58', 'mCarS58', 'hybrid']) {
        const f = was(car);
        Object.keys(f).forEach((k) => assert.ok(item(k).options.some((o) => o[0] === f[k]), car + ' ' + k + ' ' + f[k]));
    }
    const S = Palette.resolve(was('b48'), Panel.profile('carprofile'));
    assert.deepStrictEqual([S.rpmLimiter, S.scaleMaxRpm, S.rpmRedline, S.shiftAtRpm, S.speedMax], [7000, 7000, 6000, 6500, 260]);
    /* an old boost top in psi reads as the gauge at or over it (22 psi to 30); one a gauge ends at stays */
    assert.strictEqual(item('boostMax').aliases['22'], '30');
    assert.strictEqual(item('boostMax').aliases['40'], '45');
    assert.strictEqual(item('boostMax').aliases['20'], undefined);
});

test('the gear with its programme: D1, S1, M1 from MDrive.dataDisplayGearbox; P, R, N as they are', () => {
    const r = Vehicle.createReader({});
    const sel = (n) => r.receive('de.bmw.infrastructure.VehicleInformation', 'DataPowerTrain2', { statusGearSelectionDrive: n }, 1000);
    const prog = (v) => r.receive('de.bmw.infotainment.misc.MDrive', 'dataDisplayGearbox', { dataDisplayGearbox: v }, 1000);
    sel(5); assert.strictEqual(r.raw(1000, 59).gearStaged, 'D1');
    prog('S_MINUS_PROGRAMM'); sel(7); assert.strictEqual(r.raw(1000, 59).gearStaged, 'S3');
    prog(2); assert.strictEqual(r.raw(1000, 59).gearStaged, 'M3');
    prog(0); assert.strictEqual(r.raw(1000, 59).gearStaged, 'D3');
    sel(3); assert.strictEqual(r.raw(1000, 59).gearStaged, 'P');
    assert.strictEqual(r.raw(1000, 59).gear, 'P');
    assert.ok(Vehicle.SIGNALS['de.bmw.infotainment.misc.MDrive'].dataDisplayGearbox);
    assert.strictEqual(item('gearShows').default, 'staged');
});

test('the fuel gauge as AK Cluster Layouts\': the engine unit\'s tank level only, its last answer held', () => {
    const r = Vehicle.createReader({});
    r.receive('de.bmw.infotainment.KombiIF', 'statusRangeTankStatus', { fluidLevelFuelTank: 20, range: 300 }, 1000);
    /* no answer from the engine unit yet: none ('--'), the car's litres not used */
    let x = r.raw(1000);
    assert.deepStrictEqual([x.fuelPct, x.fuelLitres, x.tankPct], [undefined, 20, undefined]);
    /* the engine unit's own level */
    r.setFeed('tankPct', 12.5, 1000);
    x = r.raw(1000);
    assert.deepStrictEqual([x.fuelPct, x.tankPct], [12.5, 12.5]);
    /* no longer fed (not asked, or silent): the last held */
    x = r.raw(500000);
    assert.deepStrictEqual([x.fuelPct, x.tankPct], [12.5, undefined]);
    /* no tank size, no Fuel % from (0.26.0) */
    assert.ok(!spec.settings.some((s) => s.key === 'tankLitres' || s.key === 'fuelFrom'));
});


test('the move happens once, through the kit\'s own settings: saved, and the next start leaves later choices alone', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-'));
    try {
        const S = settingsClass(dir), file = path.join(dir, 'settings.json');
        fs.writeFileSync(file, JSON.stringify({ profile: 'mCarS58', rpmRedline: 'auto', boostMax: '22' }));
        let s = new S(spec.settings);
        assert.strictEqual(s.get('boostMax'), '30', 'an old boost top in psi, read as the gauge over it');
        const moved = Panel.moveCarFigures(s);
        assert.strictEqual(moved.engine, 'm');
        assert.deepStrictEqual([s.get('engine'), s.get('rpmRedline'), s.get('rpmLimiter'), s.get('speedMax'), s.get('boostMax')], ['m', '7000', '8000', '330', '30']);
        /* the next start: saved as moved; a later choice of the owner's stays */
        s = new S(spec.settings);
        assert.deepStrictEqual([s.get('engine'), s.get('rpmRedline'), s.values._carMoved], ['m', '7000', 1]);
        s.set('rpmRedline', '6500');
        s = new S(spec.settings);
        assert.strictEqual(Panel.moveCarFigures(s), null);
        assert.strictEqual(s.get('rpmRedline'), '6500');
        /* a new install: nothing moved */
        fs.rmSync(file);
        s = new S(spec.settings);
        assert.strictEqual(Panel.moveCarFigures(s), null);
        assert.strictEqual(s.get('engine'), 'petrol');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a saved Electric range: Plug-in hybrid (before AK 0.19.1) is Engine: Plug-in hybrid, once', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-'));
    try {
        const S = settingsClass(dir), file = path.join(dir, 'settings.json');
        fs.writeFileSync(file, JSON.stringify({ electric: 'hybrid', engine: 'petrol' }));
        let s = new S(spec.settings);
        assert.strictEqual(Panel.moveElectric(s), true);
        assert.strictEqual(s.get('engine'), 'phev');
        s.set('engine', 'petrol');
        s = new S(spec.settings);
        assert.strictEqual(Panel.moveElectric(s), false, 'once: a later choice stays');
        assert.strictEqual(s.get('engine'), 'petrol');
        /* a diesel, or Electric range left on Automatic: as it is */
        for (const was of [{ electric: 'hybrid', engine: 'diesel' }, { electric: 'auto', engine: 'petrol' }]) {
            fs.writeFileSync(file, JSON.stringify(was));
            s = new S(spec.settings);
            assert.strictEqual(Panel.moveElectric(s), false, JSON.stringify(was));
            assert.strictEqual(s.get('engine'), was.engine);
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the Sport Display\'s boost and its gauge\'s end in the car\'s pressure unit; Boost gauge up to from the car (the Car profile\'s Auto)', () => {
    const FES = 'de.bmw.infotainment.drivingexcitement.FES', VEH = 'de.bmw.infotainment.vehicle.Vehicle';
    const r = Vehicle.createReader({});
    const sport = (b, m) => r.receive(FES, 'statusSwitchDriveDynamicSport2', { displayBoostPressure: b, displayMaximumValueBoostPressure: m }, 1000);
    sport(120, 200);
    let x = r.raw(1000, 59);
    assert.deepStrictEqual([+x.boostBar.toFixed(3), +x.boostMaxCar.toFixed(3)], [1.2, 2], 'hundredths of a bar');
    /* a car set to psi: tenths of a psi (20 psi, raw 200, is 1.38 bar - not 2.0) */
    r.receive(VEH, 'statusNewCurrentUnitsStatusExt', { unitOfMeasurementAirPressure: 3 }, 1000);
    sport(150, 200);
    x = r.raw(1000, 59);
    assert.deepStrictEqual([+(x.boostBar * 14.503774).toFixed(1), +(x.boostMaxCar * 14.503774).toFixed(1)], [15, 20]);
    assert.strictEqual(Panel.snapBoost(x.boostMaxCar), '20', 'the 20 psi gauge');
    /* a figure no gauge ends at is not taken */
    sport(150, 30);
    assert.strictEqual(+(r.raw(1000, 59).boostMaxCar * 14.503774).toFixed(1), 20);
    assert.ok(Vehicle.SIGNALS[VEH].statusNewCurrentUnitsStatusExt);
    /* the least gauge at or over it, within 5 % */
    assert.deepStrictEqual([1.16, 2.5, 3.9, undefined].map(Panel.snapBoost), ['20', '45', '45', null]);
    /* each gauge's numbers as the car's own */
    const ticks = (e, u) => Panel.boostTicks(e, u).map((t) => t.str).join(' ');
    assert.deepStrictEqual([15, 20, 30, 45].map((e) => ticks(e, 'psi')), ['0 5 10 15', '0 10 20', '0 10 20 30', '0 15 30 45']);
    assert.deepStrictEqual([2, 3].map((e) => ticks(e, 'bar')), ['0.0 1.0 2.0', '0.0 1.0 2.0 3.0']);
    assert.deepStrictEqual([200, 300].map((e) => ticks(e, 'kpa')), ['0 100 200', '0 100 200 300']);
    /* a car's own gauge ends in its unit: 200 kPa, 2.0 / 3.0 bar; 15 / 20 / 30 / 45 psi */
    assert.deepStrictEqual([2, 3, ...[15, 20, 30, 45].map((p) => p / 14.503774)].map(Panel.snapBoost), ['30', '45', '15', '20', '30', '45']);
    /* the setting: from the car as it comes, the Car profile's alone (not on GENERAL), its Auto as from the car */
    const it = item('boostMax');
    assert.deepStrictEqual([it.default, it.hidden, it.profileMap['0'], it.options[0][1]], ['auto', true, 'auto', 'From the car\'s Sport Display']);
});

test('the speed limit sign as the car\'s own: the last limit recognised, kept till another (AK Cluster Info\'s log of Nov 27 2026)', () => {
    const r = Vehicle.createReader({});
    const hud = (x, at) => r.receive('de.bmw.infotainment.displaydataserver.DisplayDataServer', 'functionalLibraryData', x, at);
    /* (a car without the sign event, its Speed Limit Assist on: the head-up display's figures the only ones, 0.30.1) */
    const row = (value, symbol, dist, takeover) => ({ xSpeedLimitAssist: { vSLISymbol: symbol, vSLIDistanceValues: dist, ldmAdditionalSign: takeover || 'NO_TAKEOVER_OFFER',
        vSLISpeedValue: value, statusVZA: 'STATUS_ACTIVE', countryCode: 'LDM_CCODE_ECE', vSLIAdditionalSign: 'LDM_VSLI_NO_SYMBOL' },
        activeCruiseControl: { symbolACC: 'LDM_CAR_OFF', barsColorACC: 'LDM_ACTIVE' }, statusLimiter: 'STATUS_INACTIVE', cruiseCtrlSpeedHUD: 65535 });
    const SL = 'LDM_VZA_VSLI_SPEED_LIMIT', NO = 'LDM_VZA_VSLI_NO_SYMBOL';
    const shown = (at) => r.raw(at).speedLimit;
    assert.strictEqual(shown(1000), undefined, 'none read yet');
    hud(row(16, SL, 'LDM_VSLI_DIST_600_M'), 1000);                          // 01:22, 45 km/h, the cruise control off
    assert.strictEqual(shown(1000), undefined, 'an 80 announced 600 m ahead: not yet, none before it: --');
    hud(row(16, SL, 'LDM_VSLI_DIST_250_M'), 2000);
    assert.strictEqual(shown(2000), undefined);
    hud(row(16, SL, 'LDM_VSLI_DIST_OFF'), 3000);                            // 01:33, reached
    assert.strictEqual(shown(3000), 80);
    hud(row(16, NO, 'LDM_VSLI_DIST_OFF'), 4000);
    assert.strictEqual(shown(4000), 80, 'the symbol gone: 80 kept');
    hud(row(20, SL, 'LDM_VSLI_DIST_1_P_3_KM'), 5000);                       // 03:55, a 100 announced 1.3 km ahead
    assert.strictEqual(shown(5000), 80, '80 still');
    hud(row(20, NO, 'LDM_VSLI_DIST_OFF'), 6000);                            // 04:26, reached
    assert.strictEqual(shown(6000), 100);
    hud(row(20, NO, 'LDM_VSLI_DIST_OFF', 'TAKEOVER_SET'), 7000);
    assert.strictEqual(shown(7000), 100, 'the takeover offered or not: the same');
    hud(row(0, NO, 'LDM_VSLI_DIST_OFF'), 8000);
    assert.strictEqual(shown(8000), 100, '0: the one shown kept');
    hud(row(30, NO, 'LDM_VSLI_DIST_OFF'), 9000);
    assert.strictEqual(shown(9000), 100, '30 (150, Nov 24): no road\'s, 100 kept');
    /* a curve's speed (16:35, Nov 27): 50 at 500 m on a 100 road, the cruise control at 102 - no limit */
    var CO = 'LDM_VZA_VSLI_COURSE';
    hud(row(10, CO, 'LDM_VSLI_DIST_500_M', 'TAKEOVER_SET'), 9200);
    assert.strictEqual(shown(9200), 100, 'a curve\'s speed: not a limit');
    hud(row(10, CO, 'LDM_VSLI_DIST_OFF', 'TAKEOVER_SET'), 9400);
    assert.strictEqual(shown(9400), 100, 'the curve reached: still not a limit');
    hud(row(10, NO, 'LDM_VSLI_DIST_OFF', 'TAKEOVER_SET'), 9600);
    assert.strictEqual(shown(9600), 100, 'the curve\'s figure left with no symbol: kept 100');
    hud(row(20, SL, 'LDM_VSLI_DIST_OFF', 'TAKEOVER_SET'), 9800);
    assert.strictEqual(shown(9800), 100, 'the 100 sign after it: 100');
    hud(row(12, NO, 'LDM_VSLI_DIST_OFF'), 10000);
    assert.strictEqual(shown(10000), 60, 'a new one with no announcement (the camera\'s): 60');
    assert.strictEqual(shown(20001), undefined, 'no head-up display data for 10 s: --');
    const raw = r.raw(10000);
    assert.deepStrictEqual([raw.sliRaw, raw.sliSymbol, raw.sliDist, raw.sliTakeover, raw.sliAgeS], [12, NO, 'LDM_VSLI_DIST_OFF', 'NO_TAKEOVER_OFFER', 0]);
    // the log: each change with its time and speed, the last 20; how often the data came
    for (let i = 0; i < 30; i++) hud(row(i % 2 ? 10 : 12, NO, 'LDM_VSLI_DIST_OFF'), 11000 + i * 100);
    const lines = r.sliLog(14000).split('\n');
    assert.strictEqual(lines[0], 'sign (TrafficSignRecognition): none yet');
    assert.ok(/^head-up display data: \d+ in the last 60 s, the last 0.1 s ago; shown: 50$/.test(lines[1]), lines[1]);
    assert.strictEqual(lines[2], 'warning signs (front camera): none yet; no passing off');
    const changes = lines.filter((l) => /^\d{4}-\d\d-\d\dT.* km\/h  shown /.test(l));
    assert.strictEqual(changes.length, 20, 'the last 20 changes');
    assert.strictEqual(lines[lines.length - 1], changes[19]);
    assert.ok(/ at \? km\/h  shown 50  \{"value":10/.test(changes[19]), changes[19]);
    /* (the sign services' fields: AK Cluster Info's Test log's, 0.29.3) */
    assert.ok(!lines.some((l) => /TrafficSignRecognition changes|head-up display fields/.test(l)));
    assert.ok(Vehicle.SIGNALS['de.bmw.infotainment.displaydataserver.DisplayDataServer'].functionalLibraryData);
});

test('the speed limit sign itself (0.28.0): TrafficSignRecognition\'s presentClassLimitSpeed x 5 over the head-up display\'s (AK Cluster Info\'s signal survey of Nov 27 2026)', () => {
    const r = Vehicle.createReader({});
    const hud = (value, at) => r.receive('de.bmw.infotainment.displaydataserver.DisplayDataServer', 'functionalLibraryData',
        { xSpeedLimitAssist: { vSLISpeedValue: value, vSLISymbol: 'LDM_VZA_VSLI_NO_SYMBOL', ldmAdditionalSign: 'TAKEOVER_SET' } }, at);
    const sign = (cls, at) => r.receive('de.bmw.dass.TrafficSignRecognition', 'TrafficSignRecognition',
        { presentWithdrawalLimitSpeed: 1, nextWithdrawalLimitSpeed: 0, presentClassLimitSpeed: cls, nextClassLimitSpeed: 254, countryCodingTrafficSign: 7 }, at);
    /* the head-up display stuck at 100 (the limiter's taken figure) the whole drive; the signs 40, 90, 110 */
    hud(20, 1000);
    assert.strictEqual(r.raw(1000).speedLimit, 100, 'no sign event yet, Speed Limit Assist not said off: the head-up display\'s');
    sign(8, 2000);
    assert.deepStrictEqual([r.raw(2000).speedLimit, r.raw(2000).sliSource, r.raw(2000).sliSign], [40, 'sign', 8]);
    hud(20, 2500);
    assert.strictEqual(r.raw(2500).speedLimit, 40, 'the sign over the head-up display');
    sign(18, 3000);
    assert.strictEqual(r.raw(3000).speedLimit, 90);
    sign(254, 3500);
    assert.strictEqual(r.raw(3500).speedLimit, 90, '254 (none): the last kept');
    sign(22, 4000);
    assert.strictEqual(r.raw(4000).speedLimit, 110);
    assert.ok(/^sign \(TrafficSignRecognition\): presentClassLimitSpeed 22, 0 s ago, shown 110$/.test(r.sliLog(4000).split('\n')[0]));
    /* (0.30.1, the owner's drive of Nov 28 2026: the head-up display 60, Speed Limit Assist STATUS_INACTIVE, on 50 roads) the
       sign silent: its last figure kept 60 s, then --; the head-up display's never on a car with the sign */
    r.receive('de.bmw.infotainment.displaydataserver.DisplayDataServer', 'functionalLibraryData',
        { xSpeedLimitAssist: { vSLISpeedValue: 12, vSLISymbol: 'LDM_VZA_VSLI_NO_SYMBOL', vSLIDistanceValues: 'LDM_VSLI_DIST_OFF', statusVZA: 'STATUS_INACTIVE' } }, 12000);
    assert.deepStrictEqual([r.raw(14001).speedLimit, r.raw(14001).sliSource], [110, 'sign (kept)'], 'the sign silent 10 s: its 110 kept, not the head-up display\'s');
    assert.strictEqual(r.raw(63000).speedLimit, 110, 'still at 59 s');
    r.receive('de.bmw.infotainment.displaydataserver.DisplayDataServer', 'functionalLibraryData',
        { xSpeedLimitAssist: { vSLISpeedValue: 12, vSLISymbol: 'LDM_VZA_VSLI_NO_SYMBOL', vSLIDistanceValues: 'LDM_VSLI_DIST_OFF', statusVZA: 'STATUS_ACTIVE' } }, 64000);
    assert.deepStrictEqual([r.raw(64001).speedLimit, r.raw(64001).sliSource], [undefined, 'none'], 'over 60 s: --');
    assert.deepStrictEqual([Vehicle.tsrStep(undefined, { presentClassLimitSpeed: 0 }), Vehicle.tsrStep(60, {}), Vehicle.tsrStep(undefined, { presentClassLimitSpeed: 29 })],
        [undefined, 60, undefined]);
    /* declared optional, its one broadcast: a unit without it builds the app without it (kit build.py fit_to_unit) */
    const d = Vehicle.SIGNALS['de.bmw.dass.TrafficSignRecognition'];
    assert.deepStrictEqual(d._broadcasts, ['TrafficSignRecognition']);
    assert.ok(d._optional);
});
