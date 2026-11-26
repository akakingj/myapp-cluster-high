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
            lightRed: 6500, redline: 7000, rpmScale: 8000, lightStart: 4500, shiftAt: 6200, coldGuard: 'on', coldLimit: 4000, warmOil: 70 });
        const Settings = settingsClass(dir);
        const s = new Settings(appSpec.settings);
        const want = { speedUnit: 'mph', tempUnit: 'f', pressUnit: 'kpa', econUnit: 'mpg', clock12: '12', engine: 'phev', rpmRedline: '6500',
            rpmLimiter: '7000', scaleMaxRpm: '8000', shiftFrom: '4500', shiftAt: '6200', coldGuard: 'on', coldLimit: '4000', warmOil: '70' };
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
        profileOf(file, { speedUnit: 'mph', fuelUnit: 'app', lightRed: 6123, redline: 6123, coldGuard: 'app' });
        const t = new (settingsClass(dir))(appSpec.settings);
        assert.strictEqual(t.get('speedUnit'), 'mph');
        assert.ok(!t.held('econUnit'));
        assert.ok(!t.held('rpmRedline') && !t.held('rpmLimiter') && !t.held('clock12') && !t.held('coldGuard'));
        assert.strictEqual(t.get('rpmRedline'), 'auto');

        /* the profile's Auto (0): the red zone at its redline (the Limiter here), the Limiter and Shift now at Auto */
        profileOf(file, { lightRed: 0, redline: 0, shiftAt: 0 });
        const u = new (settingsClass(dir))(appSpec.settings);
        assert.deepStrictEqual(['rpmRedline', 'rpmLimiter', 'shiftAt'].map((k) => [u.get(k), u.held(k)]),
            [['limiter', true], ['auto', true], ['auto', true]]);
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
    /* mpg (UK): imperial gallons, 282.481 over L/100km; a car profile's every fuel use unit is one of Fuel economy unit's */
    assert.strictEqual(s({ speedUnit: 'kmh', econUnit: 'mpguk' }).info.economy, '35.3');
    const econ = require('../app/app.base.json').settings.find((x) => x.key === 'econUnit');
    assert.deepStrictEqual(econ.options.map((o) => o[0]), ['kml', 'l100', 'mpg', 'mpguk'], 'no Auto');
    for (const v of ['l100', 'kml', 'mpguk', 'mpgus']) assert.ok(econ.options.some((o) => o[0] === econ.profileMap[v]), v);
    /* a saved Auto (or none) becomes the unit it gave, once */
    const Panel = require('../src/geometry/panel.js');
    const store = (values) => ({ values, get: (k) => values[k], set(k, v) { values[k] = v; } });
    let st8 = store({ econUnit: 'auto', speedUnit: 'mph' });
    assert.strictEqual(Panel.moveEconAuto(st8), 'mpg');
    st8.values.econUnit = 'auto';
    assert.strictEqual(Panel.moveEconAuto(st8), null, 'once');
    assert.strictEqual(Panel.moveEconAuto(store({})), 'kml');
    assert.strictEqual(Panel.moveEconAuto(store({ econUnit: 'l100' })), null);
    /* every unit word the styles draw is in the atlas's faces they draw it in */
    const atlas = require('../assets/fonts/atlas.json');
    const has = (face, str) => [...str].every((c) => c === ' ' || (atlas.faces[face].glyphs[c] && atlas.faces[face].glyphs[c].tw >= 0));
    for (const o of [{ pressUnit: 'kpa', econUnit: 'kml' }, { pressUnit: 'bar', econUnit: 'l100' }, { pressUnit: 'psi', econUnit: 'mpg' }]) {
        const u = Units.of(Object.assign({ speedUnit: 'kmh', tempUnit: 'c' }, o));
        for (const w of [u.labels.press, u.labels.dist, u.labels.temp]) assert.ok(has('ms', w), 'ms: ' + w);
        for (const w of [u.labels.press, u.labels.dist, u.labels.speed]) assert.ok(has('label', w.toUpperCase()), 'label: ' + w);
    }
});

test('the driver camera: Toro\'s rev numbers stand clear of its cowl as it comes, and no shift light is under it or the turn arrows', () => {
    const Theme = require('../src/theme/index.js');
    const Panel = require('../src/geometry/panel.js');
    const atlas = require('../assets/fonts/atlas.json');
    const CAM = Panel.CAMERA;
    const meets = (r, z) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y;
    const under = (r) => meets(r, CAM);
    const t = Theme.build(atlas, 'carprofile', {});
    const G = t.guide, T = G.TACH;
    /* each numeral's cap height about its place on the arc (the numerals are 1 - 9 there) */
    for (let v = T.vMin; v < T.vMax; v++) {
        const at = G.point(v, T.rNumeral), h = G.gs(T.numeralHeight);
        const box = { x: at.x - h * 0.4, y: at.y - h * 0.5, w: h * 0.8, h: h };
        assert.ok(!under(box), 'the numeral ' + v + ' under the camera: ' + JSON.stringify(box));
    }
    for (const shiftStyle of ['toro', 'gt3', 'blade']) {
        const th = Theme.build(atlas, 'carprofile', { shiftStyle });
        const bars = th.layers.filter((L) => L.shader === 'shiftbar');
        assert.ok(bars.length >= 1, shiftStyle);
        for (const L of bars) {
            const u = L.uniforms({ rpm: 0, limiter: 0 }, 0);
            const gap = u.u_gap || 0, mid = L.x + L.w / 2;
            /* the lit part: the whole bar, or either side of its empty middle */
            const parts = gap ? [{ x: L.x, y: L.y, w: mid - gap - L.x, h: L.h }, { x: mid + gap, y: L.y, w: L.x + L.w - mid - gap, h: L.h }] : [L];
            parts.forEach((p) => assert.ok(!under(p), shiftStyle + ': ' + L.id + ' under the camera'));
            /* nor under the turn signal arrows beside it */
            parts.forEach((p) => Panel.TURN_ARROWS.forEach((z) => assert.ok(!meets(p, z), shiftStyle + ': ' + L.id + ' under ' + z.name)));
            /* and not in the glass's cut corners */
            assert.ok(!Panel.inCutCorner(L.x, L.y) && !Panel.inCutCorner(L.x + L.w, L.y), shiftStyle + ': ' + L.id + ' in a corner');
        }
    }
});
