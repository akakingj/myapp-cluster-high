'use strict';
/*
 * GENERAL > Car: B48, B58, an M car, a plug-in hybrid, or My car (its own figures under GENERAL > My car), and
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

test('the cars offered, each a profile, a B48 as it comes; a saved X3 M40i reads as the B48', () => {
    const car = item('profile');
    assert.deepStrictEqual(car.options.map((o) => o[0]), ['b48', 'b58', 'mCarS58', 'hybrid', 'custom']);
    assert.deepStrictEqual(car.options.slice(0, 2).map((o) => o[1]), ['B48', 'B58']);
    assert.strictEqual(car.default, 'b48');
    car.options.forEach((o) => assert.strictEqual(Panel.profile(o[0]).id, o[0]));
    assert.strictEqual(Panel.DEFAULT_PROFILE, 'b48');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-'));
    try {
        fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ profile: 'x3m40i' }));
        const s = new (settingsClass(dir))(spec.settings);
        assert.strictEqual(s.get('profile'), 'b48');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    /* a B48: red from 6,500, the limit at 7,000, a 59 L tank (a G20's) */
    const b48 = Panel.profile('b48');
    assert.deepStrictEqual([b48.rpmRedline, b48.rpmLimiter, b48.tankLitres], [6500, 7000, 59]);
});

test('My car: its own red zone, limiter, boost gauge and tank, the rows shown only for it', () => {
    ['myRedline', 'myLimiter', 'myBoostPsi', 'myTankLitres'].forEach((k) => {
        assert.deepStrictEqual(item(k).when, { profile: 'custom' }, k);
        assert.ok(item(k).options.some((o) => o[0] === item(k).default), k + ': its default is one of its values');
    });
    const p = Panel.profileFor('custom', { myRedline: '6200', myLimiter: '6600', myBoostPsi: '28', myTankLitres: '52' });
    assert.deepStrictEqual([p.rpmRedline, p.rpmLimiter, p.boostMaxPsi, p.tankLitres], [6200, 6600, 28, 52]);
    /* (a limiter under the red zone is taken up to it; another car ignores them) */
    assert.strictEqual(Panel.profileFor('custom', { myRedline: '7000', myLimiter: '6500' }).rpmLimiter, 7000);
    assert.strictEqual(Panel.profileFor('b58', { myRedline: '6200' }).rpmRedline, Panel.profile('b58').rpmRedline);
    /* Redline and Limiter on "From the car" are My car's */
    const S = Palette.resolve({ rpmRedline: 'auto', rpmLimiter: 'auto' }, p);
    assert.deepStrictEqual([S.rpmRedline, S.rpmLimiter], [6200, 6600]);
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
