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

test('the five cars: B48, B58, S58, a plug-in hybrid, the Car profile\'s values; a B48 as it comes', () => {
    const car = item('profile');
    assert.deepStrictEqual(car.options.map((o) => o[0]), ['b48', 'b58', 'mCarS58', 'hybrid', 'carprofile']);
    assert.strictEqual(car.default, 'b48');
    car.options.forEach((o) => assert.strictEqual(Panel.profile(o[0]).id, o[0]));
    /* a saved X3 M40i reads as the B48, a saved My car as the Car profile's values */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-'));
    try {
        for (const [saved, now] of [['x3m40i', 'b48'], ['custom', 'carprofile']]) {
            fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ profile: saved }));
            assert.strictEqual(new (settingsClass(dir))(spec.settings).get('profile'), now);
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('each car\'s own figures: the most it revs, the red zone, the shift point, the yellow, the speedometer', () => {
    const fig = (id, cfg) => {
        const S = Palette.resolve(cfg || {}, Panel.profile(id));
        return [S.rpmLimiter, S.scaleMaxRpm, S.rpmRedline, S.shiftWarn ? S.shiftAtRpm : null, S.yellowRpm, S.speedMax];
    };
    /* (the tach to the thousand at or over the limiter: a B58's 7,500 on a dial to 8) */
    assert.deepStrictEqual(fig('b48'), [7000, 7000, 6000, 6500, null, 260]);
    assert.deepStrictEqual(fig('b58'), [7500, 8000, 6500, 7000, null, 260]);
    assert.deepStrictEqual(fig('mCarS58'), [8000, 8000, 7000, 7500, 6500, 330]);
    /* GENERAL's are not used for them, and are shown only for a plug-in hybrid and the Car profile's values (the boost
       gauge's top for the latter alone: a plug-in hybrid has no boost gauge) */
    assert.deepStrictEqual(fig('b48', { rpmRedline: '5000', scaleMaxRpm: '10000', shiftAt: 'off' }), fig('b48'));
    for (const k of ['rpmRedline', 'rpmLimiter', 'shiftFrom', 'shiftAt', 'scaleMaxRpm', 'speedMax', 'tankLitres']) {
        assert.deepStrictEqual(item(k).when.profile, ['hybrid', 'carprofile'], k);
    }
    assert.strictEqual(item('boostMax').when.profile, 'carprofile');
    /* a plug-in hybrid: as Cluster Layouts' Vehicle, GENERAL's (or the Car profile app's) figures; on Auto its own */
    assert.deepStrictEqual(fig('hybrid'), [6500, 8000, 6000, null, null, 260]);
    assert.deepStrictEqual(fig('hybrid', { rpmRedline: '6200', rpmLimiter: '6800', shiftAt: '6500', scaleMaxRpm: '7000', speedMax: '330' }),
        [6800, 7000, 6200, 6500, null, 330]);
    assert.strictEqual(Panel.profileFor('hybrid', { tankLitres: '40' }).tankLitres, 40);
    /* the Car profile's values: GENERAL's, as set there or by the Car profile app */
    assert.deepStrictEqual(fig('carprofile', { rpmRedline: '6200', rpmLimiter: '6800', shiftAt: '6500', scaleMaxRpm: '7000', speedMax: '330' }),
        [6800, 7000, 6200, 6500, null, 330]);
    const p = Panel.profileFor('carprofile', { tankLitres: '52', boostMax: '28' });
    assert.deepStrictEqual([p.tankLitres, p.boostMaxPsi], [52, 28]);
    assert.strictEqual(item('tankLitres').profile, 'tankLitres');
    /* the tanks: a B48's 59 L, a B58's 60 */
    assert.deepStrictEqual(['b48', 'b58', 'mCarS58'].map((id) => Panel.profile(id).tankLitres), [59, 60, 59]);
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
