'use strict';
/*
 * This drive's figures (src/car/drive.js), as AK Cluster Layouts keeps them: the peaks, the 0-60 mph and 0-100 km/h
 * times from a stop, the last upshift; and through the reader into what a footer says.
 *   node --test test/drive.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Drive = require('../src/car/drive.js');
const Vehicle = require('../src/car/vehicle.js');
const State = require('../src/engine/state.js');
const Panel = require('../src/geometry/panel.js');

test('the peaks, the 0-60 and 0-100 times from a stop, and the last upshift at the highest rpm before it', () => {
    const d = Drive.create();
    let t = 1000;
    const at = (x, ms) => { t += ms || 20; return d.sample(t, Object.assign({ engineOn: true }, x)); };
    let f = at({ speedKmh: 0, gear: 1, rpm: 900 });
    assert.deepStrictEqual(f, { boostPeakBar: undefined, powerPeakKw: undefined, zero60S: undefined, zero100S: undefined, lastShift: undefined });
    at({ speedKmh: 5, gear: 1, rpm: 3000, boostBar: 0.6, powerKw: 80 }, 100);
    at({ speedKmh: 50, gear: 1, rpm: 6400, boostBar: 1.3, powerKw: 210 }, 1500);
    f = at({ speedKmh: 55, gear: 2, rpm: 4600, boostBar: 1.1, powerKw: 190 }, 200);
    assert.deepStrictEqual(f.lastShift, { from: 1, to: 2, rpm: 6400 });
    assert.ok(Math.abs(f.zero60S - 1.7) < 1e-9 && Math.abs(f.zero100S - 1.7) < 1e-9, 'both running');
    f = at({ speedKmh: 97, gear: 2, rpm: 6000 }, 2300);
    assert.ok(Math.abs(f.zero60S - 4.0) < 1e-9, '60 mph at 4.0 s: ' + f.zero60S);
    assert.ok(Math.abs(f.zero100S - 4.0) < 1e-9, '100 km/h still running');
    f = at({ speedKmh: 101, gear: 3, rpm: 4200 }, 300);
    assert.ok(Math.abs(f.zero100S - 4.3) < 1e-9 && Math.abs(f.zero60S - 4.0) < 1e-9);
    assert.deepStrictEqual([f.boostPeakBar, f.powerPeakKw], [1.3, 210]);
    assert.deepStrictEqual([f.lastShift.from, f.lastShift.to], [2, 3]);
    /* held after: a slower run that gives up at 30 s leaves them as they were */
    at({ speedKmh: 0 }, 1000); at({ speedKmh: 10 }, 20);
    f = at({ speedKmh: 40 }, 31000); f = at({ speedKmh: 41 }, 20);
    assert.ok(Math.abs(f.zero100S - 4.3) < 1e-9);
    /* a gear down or a shift under 2500 rpm: no upshift */
    at({ gear: 2, rpm: 2000 }, 400);
    f = at({ gear: 3, rpm: 2400 }, 100);
    assert.deepStrictEqual([f.lastShift.from, f.lastShift.to, f.lastShift.rpm], [2, 3, 6000]);
    /* the engine off: no boost peak from it */
    f = at({ boostBar: 2.0, engineOn: false });
    assert.strictEqual(f.boostPeakBar, 1.3);
});

test('through the reader: the engine\'s power from its torque and revs, into what a footer says', () => {
    const r = Vehicle.createReader({});
    let raw = r.raw(1000, 65);
    assert.strictEqual(raw.powerPeakKw, undefined);
    const info = State.present(Object.assign({}, raw, { powerPeakKw: 250, drivePeakBoostBar: 1.35, zero60S: 4.8, zero100S: 5.1,
        lastShift: { from: 2, to: 3, rpm: 6200 } }), Panel.profile('carprofile'), { units: 'metric' }).info;
    assert.deepStrictEqual([info.powerPeak, info.boostPeak, info.zero100, info.lastShift], ['335', '1.35', '5.1', '6200']);
    const imp = State.present({ zero60S: 4.8, zero100S: 5.1 }, Panel.profile('carprofile'), { units: 'imperial' }).info;
    assert.strictEqual(imp.zero100, '4.8', 'mph: the 0-60 time');
});
