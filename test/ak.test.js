'use strict';
/*
 * MGU Styles AK: the Car profile (the kit's Settings, cut from kit/runtime/mgu.js as hu-stub.js runs it), the
 * figures held as the car's own cluster holds them, and Shift lights from.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const State = require('../src/engine/state.js');
const Palette = require('../src/theme/palette.js');
const appSpec = require('../app/app.base.json');

/* the kit's Settings class on its own, with its data and the Car profile in a folder of the test's */
function settingsClass(dir) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'kit', 'runtime', 'mgu.js'), 'utf8');
    const from = src.indexOf('class Settings {'), to = src.indexOf('\n}\n', from) + 2;
    const log = { info() {}, warn() {}, error() {} };
    // eslint-disable-next-line no-new-func
    return new Function('fs', 'path', 'DATA_DIR', 'log', src.slice(from, to) + '\nreturn Settings;')(fs, path, dir, log);
}
const profileOf = (file, values) => fs.writeFileSync(file, JSON.stringify({ v: 1, app: 'car_profile', version: '1.7.1', values }));

test('the Car profile sets the units, clock, engine, rev limits and shift lights, and the page cannot change them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ak-'));
    const file = path.join(dir, 'car-profile.json');
    process.env.MGU_CAR_PROFILE = file;
    try {
        profileOf(file, { speedUnit: 'kmh', clock: '12', engine: 'phev', lightRed: 6500, redline: 7000, rpmScale: 8000, lightStart: 4500 });
        const Settings = settingsClass(dir);
        const s = new Settings(appSpec.settings);
        const want = { units: 'metric', clock12: '12', engine: 'petrol', electric: 'hybrid', rpmRedline: '6500',
            rpmLimiter: '7000', scaleMaxRpm: '8000', shiftFrom: '4500' };
        for (const k of Object.keys(want)) {
            assert.strictEqual(s.get(k), want[k], k);
            assert.ok(s.held(k), k + ' held');
        }
        s.set('units', 'imperial');
        s.cycle('rpmRedline');
        assert.strictEqual(s.get('units'), 'metric');
        assert.strictEqual(s.get('rpmRedline'), '6500');
        assert.ok(!s.held('style'), 'a setting the profile does not name is the page\'s');

        /* a value the setting can't take, or left to each app: the one set here */
        profileOf(file, { speedUnit: 'mph', lightRed: 0, redline: 6123 });
        const t = new (settingsClass(dir))(appSpec.settings);
        assert.strictEqual(t.get('units'), 'imperial');
        assert.ok(!t.held('rpmRedline') && !t.held('rpmLimiter') && !t.held('clock12'));
        assert.strictEqual(t.get('rpmRedline'), 'auto');
    } finally {
        delete process.env.MGU_CAR_PROFILE;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('the speed\'s digits hold until the reading is 0.75 past them, the engine speed\'s until 15 rpm past', () => {
    const P = { rpmRedline: 6500, rpmLimiter: 7000 };
    const at = (kmh, rpm) => State.present({ speedKmh: kmh, rpm: rpm }, P, { units: 'metric' });
    assert.strictEqual(at(79.4, 3000).speedText, '79');
    assert.strictEqual(at(79.6, 3000).speedText, '79', 'not yet 0.75 past');
    assert.strictEqual(at(80.2, 3000).speedText, '80');
    assert.strictEqual(at(79.6, 3000).speedText, '80', 'back down 0.6: held');
    assert.strictEqual(at(79.2, 3000).speedText, '79');
    assert.strictEqual(at(79.2, 3008).info.rpm, '3000');
    assert.strictEqual(at(79.2, 3014).info.rpm, '3000');
    assert.strictEqual(at(79.2, 3016).info.rpm, '3020');
    /* another unit: afresh */
    assert.strictEqual(State.present({ speedKmh: 100 }, P, { units: 'imperial' }).speedText, '62');
});

test('Shift lights from moves where Toro\'s shift lights begin, below the limiter', () => {
    const P = { rpmRedline: 6500, rpmLimiter: 7000 };
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000' }, P).shiftFromRpm, 6500 - 1800);
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000', shiftFrom: '4500' }, P).shiftFromRpm, 4500);
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000', shiftFrom: '7500' }, P).shiftFromRpm, 6500 - 1800);
});
