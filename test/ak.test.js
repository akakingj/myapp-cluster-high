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
        profileOf(file, { speedUnit: 'mph', tempUnit: 'f', pressUnit: 'kpa', fuelUnit: 'mpgus', clock: '12', engine: 'phev',
            lightRed: 6500, redline: 7000, rpmScale: 8000, lightStart: 4500 });
        const Settings = settingsClass(dir);
        const s = new Settings(appSpec.settings);
        const want = { speedUnit: 'mph', tempUnit: 'f', pressUnit: 'kpa', econUnit: 'mpg', clock12: '12', engine: 'petrol', electric: 'hybrid', rpmRedline: '6500',
            rpmLimiter: '7000', scaleMaxRpm: '8000', shiftFrom: '4500' };
        for (const k of Object.keys(want)) {
            assert.strictEqual(s.get(k), want[k], k);
            assert.ok(s.held(k), k + ' held');
        }
        s.set('speedUnit', 'kmh');
        s.cycle('rpmRedline');
        assert.strictEqual(s.get('speedUnit'), 'mph');
        assert.strictEqual(s.get('rpmRedline'), '6500');
        assert.ok(!s.held('style'), 'a setting the profile does not name is the page\'s');

        /* a value the setting can't take, or left to each app: the one set here */
        profileOf(file, { speedUnit: 'mph', fuelUnit: 'app', lightRed: 0, redline: 6123 });
        const t = new (settingsClass(dir))(appSpec.settings);
        assert.strictEqual(t.get('speedUnit'), 'mph');
        assert.ok(!t.held('econUnit'));
        assert.ok(!t.held('rpmRedline') && !t.held('rpmLimiter') && !t.held('clock12'));
        assert.strictEqual(t.get('rpmRedline'), 'auto');
    } finally {
        delete process.env.MGU_CAR_PROFILE;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('the speed\'s digits hold until the reading is 0.75 past them, the engine speed\'s until 15 rpm past', () => {
    const P = { rpmRedline: 6500, rpmLimiter: 7000 };
    const at = (kmh, rpm) => State.present({ speedKmh: kmh, rpm: rpm }, P, { speedUnit: 'kmh' });
    assert.strictEqual(at(79.4, 3000).speedText, '79');
    assert.strictEqual(at(79.6, 3000).speedText, '79', 'not yet 0.75 past');
    assert.strictEqual(at(80.2, 3000).speedText, '80');
    assert.strictEqual(at(79.6, 3000).speedText, '80', 'back down 0.6: held');
    assert.strictEqual(at(79.2, 3000).speedText, '79');
    assert.strictEqual(at(79.2, 3008).info.rpm, '3000');
    assert.strictEqual(at(79.2, 3014).info.rpm, '3000');
    assert.strictEqual(at(79.2, 3016).info.rpm, '3020');
    /* another unit: afresh */
    assert.strictEqual(State.present({ speedKmh: 100 }, P, { speedUnit: 'mph' }).speedText, '62');
});

test('Shift lights from moves where Toro\'s shift lights begin, below the limiter', () => {
    const P = { rpmRedline: 6500, rpmLimiter: 7000 };
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000' }, P).shiftFromRpm, 6500 - 1800);
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000', shiftFrom: '4500' }, P).shiftFromRpm, 4500);
    assert.strictEqual(Palette.resolve({ rpmRedline: '6500', rpmLimiter: '7000', shiftFrom: '7500' }, P).shiftFromRpm, 6500 - 1800);
});

test('the units as AK Cluster Layouts sets them: each on its own, Auto pressure and economy with the speed unit', () => {
    const Units = require('../src/engine/units.js');
    const raw = { speedKmh: 100, boostBar: 1.2, oilTempC: 100, coolantC: 90, avgL100: 8, rangeKm: 400, ambientC: 20.5, oilPressBar: 4 };
    const P = { rpmRedline: 6500, rpmLimiter: 7000 };
    const s = (o) => State.present(raw, P, o);
    let st = s({ speedUnit: 'kmh', tempUnit: 'f', pressUnit: 'kpa', econUnit: 'kml' });
    assert.deepStrictEqual([st.speedText, st.info.oil, st.info.boost, st.info.economy, st.rangeText, st.ambientText],
        ['100', '212', '120', '12.5', '400', '69']);
    st = s({ speedUnit: 'mph', tempUnit: 'c', pressUnit: 'auto', econUnit: 'auto' });
    assert.deepStrictEqual([st.speedText, st.info.oil, st.info.boost, st.info.economy, st.rangeText, st.ambientText],
        ['62', '100', '17.4', '29.4', '249', '20.5']);
    const auto = Units.of({ speedUnit: 'kmh', pressUnit: 'auto', econUnit: 'auto' });
    assert.deepStrictEqual([auto.press, auto.econ, auto.labels.speed, auto.labels.dist], ['bar', 'kml', 'km/h', 'km']);
    /* every unit word the styles draw is in the atlas's faces they draw it in */
    const atlas = require('../assets/fonts/atlas.json');
    const has = (face, str) => [...str].every((c) => c === ' ' || (atlas.faces[face].glyphs[c] && atlas.faces[face].glyphs[c].tw >= 0));
    for (const o of [{ pressUnit: 'kpa', econUnit: 'kml' }, { pressUnit: 'bar', econUnit: 'l100' }, { pressUnit: 'psi', econUnit: 'mpg' }]) {
        const u = Units.of(Object.assign({ speedUnit: 'kmh', tempUnit: 'c' }, o));
        for (const w of [u.labels.press, u.labels.dist, u.labels.temp]) assert.ok(has('ms', w), 'ms: ' + w);
        for (const w of [u.labels.press, u.labels.dist, u.labels.speed]) assert.ok(has('label', w.toUpperCase()), 'label: ' + w);
    }
});
