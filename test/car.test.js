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
    for (const k of ['rpmRedline', 'rpmLimiter', 'shiftFrom', 'shiftAt', 'speedMax', 'boostMax', 'tankLitres']) assert.strictEqual(item(k).when, undefined, k);
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
    /* the boost gauge's top in psi and its bar (Automatic: the kind's own), the tank */
    const p = Panel.profileFor('carprofile', { tankLitres: '52', boostMax: '45' });
    assert.deepStrictEqual([p.tankLitres, p.boostBar, p.boostPsi, p.boostMaxPsi], [52, 3, 45, 45], 'the car\'s own 45 psi gauge: 3.0 bar');
    assert.deepStrictEqual(['15', '20', '30'].map((v) => Panel.profileFor('carprofile', { boostMax: v }).boostBar), [2, 2, 2], 'in bar 2.0');
    assert.strictEqual(Panel.profileFor('carprofile', { boostMax: '2.5' }).boostPsi, null, 'no gauge ends there: the kind\'s own');
    assert.deepStrictEqual(Panel.BOOST_BAR, { 15: 2, 20: 2, 30: 2, 45: 3 });
    const a = Panel.profileFor('mCarS58', { boostMax: 'auto' });
    assert.deepStrictEqual([a.boostBar, a.boostPsi, a.boostMaxPsi], [null, null, 26]);
    assert.strictEqual(item('tankLitres').profile, 'tankLitres');
    assert.strictEqual(item('speedMax').profile, 'speedMax');
    assert.strictEqual(item('boostMax').profile, 'boostMax');
    /* every boost top the Car profile gives is one of this app's */
    const own = item('boostMax').options.map((o) => o[0]);
    [15, 20, 30, 45].forEach((v) => assert.ok(own.indexOf(String(v)) >= 0, v + ' psi'));
});

test('a car chosen under GENERAL > Car before it went keeps its figures: moved into GENERAL\'s own once', () => {
    const was = (car, extra) => Panel.figuresOfCar(Object.assign({ profile: car }, extra || {}));
    assert.deepStrictEqual(was('b58'), { rpmLimiter: '7500', rpmRedline: '6500', shiftAt: '7000', shiftFrom: 'auto', scaleMaxRpm: '8000',
        speedMax: '260', boostMax: '30', tankLitres: '60' });
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

test('the fuel gauge as AK Cluster Layouts\': the engine unit\'s tank level while it answers, else litres over the tank', () => {
    const r = Vehicle.createReader({});
    r.receive('de.bmw.infotainment.KombiIF', 'statusRangeTankStatus', { fluidLevelFuelTank: 20, range: 300 }, 1000);
    /* no answer from the engine unit: the car's litres over the tank's size */
    let x = r.raw(1000, 59, 'engine');
    assert.ok(Math.abs(x.fuelPct - 20 / 59 * 100) < 1e-9);
    assert.deepStrictEqual([x.fuelPctFrom, x.fuelLitres, x.tankPct], ['litres', 20, undefined]);
    /* the engine unit's own level, while fresh */
    r.setFeed('tankPct', 12.5, 1000);
    x = r.raw(1000, 59, 'engine');
    assert.deepStrictEqual([x.fuelPct, x.fuelPctFrom, x.tankPct], [12.5, 'engine', 12.5]);
    /* GENERAL: Fuel % from: Litres / tank size keeps to the litres */
    x = r.raw(1000, 59, 'litres');
    assert.ok(Math.abs(x.fuelPct - 20 / 59 * 100) < 1e-9);
    assert.strictEqual(x.fuelPctFrom, 'litres');
    /* no longer fed (the engine reader keeps it a minute): back to the litres */
    x = r.raw(5000, 59, 'engine');
    assert.strictEqual(x.fuelPctFrom, 'litres');
    /* the setting, as Layouts' */
    const it = item('fuelFrom');
    assert.deepStrictEqual([it.label, it.default, it.options.map((o) => o[0])], ['Fuel % from', 'engine', ['engine', 'litres']]);
});

test('the Car profile\'s fuel settings land: every tank size it can give, and Fuel % from', () => {
    /* (the Car profile app's steps for Fuel tank size, akakingj/myapp-id7 apps/car_profile/app.json) */
    const CAR_PROFILE_TANKS = [40, 42, 46, 50, 52, 55, 57, 59, 60, 63, 65, 66, 68, 69, 70, 74, 80, 83, 85, 90];
    const own = item('tankLitres').options.map((o) => o[0]);
    assert.deepStrictEqual(CAR_PROFILE_TANKS.map(String).filter((v) => own.indexOf(v) < 0), []);
    assert.strictEqual(item('fuelFrom').profile, 'fuelFrom');
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

test('the speed limit as the head-up display gets it: steps of 5, the last one kept, none at 0', () => {
    const r = Vehicle.createReader({});
    const hud = (x, at) => r.receive('de.bmw.infotainment.displaydataserver.DisplayDataServer', 'functionalLibraryData',
        { xSpeedLimitAssist: Object.assign({ statusVZA: 'STATUS_INACTIVE', countryCode: 'LDM_CCODE_ECE' }, x), cruiseCtrlSpeedHUD: 65535 }, at);
    assert.strictEqual(r.raw(1000, 59).speedLimit, undefined, 'none read yet');
    hud({ vSLISymbol: 'LDM_VZA_VSLI_SPEED_LIMIT', vSLISpeedValue: 14 }, 1000);
    assert.strictEqual(r.raw(1000, 59).speedLimit, 70, 'AK Cluster Info\'s log: 14 on a road of 70');
    hud({ vSLISymbol: 'LDM_VZA_VSLI_NO_SYMBOL', vSLISpeedValue: 8 }, 3000);
    assert.strictEqual(r.raw(3000, 59).speedLimit, 40, 'the value after the pop-up too');
    assert.strictEqual(r.raw(603000, 59).speedLimit, 40, 'kept while nothing new comes (10 min)');
    hud({ vSLISpeedValue: 0 }, 14000);
    assert.strictEqual(r.raw(14000, 59).speedLimit, undefined, '0: none');
    assert.ok(Vehicle.SIGNALS['de.bmw.infotainment.displaydataserver.DisplayDataServer'].functionalLibraryData);
});
