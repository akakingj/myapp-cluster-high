'use strict';
/*
 * The side gauges, the shift lights and shake, the holiday dressing, the
 * start-up message and its own words.
 * Run: node --test test/extras.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Panel = require('../src/geometry/panel.js');
const Themes = require('../src/theme/index.js');
const Toro = require('../src/theme/lambo.js');
const Palette = require('../src/theme/palette.js');
const Overlays = require('../src/theme/overlays.js');
const State = require('../src/engine/state.js');
const Driver = require('../src/car/cluster.js');
const Message = require('../src/car/message.js');
const Main = require('../src/car/main.js');
const atlas = require('../assets/fonts/atlas.json');

const P = Panel.profile('x3m40i');
const find = (th, id) => th.layers.find((L) => L.id === id);

function stateAt(rpm, extra) {
    return Object.assign(State.present({ rpm: rpm, speedKmh: 80, gear: '4', oilTempC: 100,
        coolantC: 90, fuelPct: 50 }, P, {}), extra || {});
}

/* ------------------------------------------------------------ gauges */

test('the side gauges are slanted bars, inside the screen and above the strip', () => {
    const th = Toro.build(atlas, 'x3m40i', {});
    for (const id of ['fuel', 'coolant', 'oilT', 'auxPress']) {
        const L = find(th, 'bar_' + id);
        assert.ok(L, id);
        assert.strictEqual(L.shader, 'hgauge');
        assert.ok(L.x >= 0 && L.x + L.w <= Panel.PANEL_WIDTH, id + ' inside the width');
        assert.ok(L.y + L.h <= Panel.BOTTOM_CUT, id + ' above the strip');
        const u = L.uniforms(stateAt(3000));
        assert.ok(u.u_frac >= 0 && u.u_frac <= 1);
        assert.strictEqual(u.u_on, 1);
    }
    /* left pair leans one way, right the other */
    assert.ok(find(th, 'bar_oilT').uniforms(stateAt(3000)).u_shear > 0);
    assert.ok(find(th, 'bar_fuel').uniforms(stateAt(3000)).u_shear < 0);
});

test('a gauge with no reading shows no needle', () => {
    const th = Toro.build(atlas, 'x3m40i', {});
    const st = State.present({ rpm: 900 }, P, {});
    assert.strictEqual(find(th, 'bar_oilT').uniforms(st).u_on, 0);
});

test('the scale numbers follow the units', () => {
    const glyphs = (th, id) => th.layers.filter((L) => L.id.indexOf(id) === 0).length;
    const imp = Toro.build(atlas, 'x3m40i', { units: 'imperial' });
    const met = Toro.build(atlas, 'x3m40i', { units: 'metric' });
    assert.ok(glyphs(imp, 'scale_oilT') >= 1 && glyphs(met, 'scale_oilT') >= 1);
    /* oil temperature 50..170 C is 122..338 F */
    const Text = require('../src/engine/text.js');
    assert.ok(Text.measure(atlas, 'label', '338', 20) > 0);
});

/* ----------------------------------------------------- shift lights */

test('shift light kinds: Toro by default, the old switch still turns them off', () => {
    assert.strictEqual(Palette.resolve({}, P).shiftStyle, 'toro');
    assert.strictEqual(Palette.resolve({ shiftLights: false }, P).shiftStyle, 'off');
    assert.strictEqual(Palette.resolve({ shiftStyle: 'nonsense' }, P).shiftStyle, 'toro');
    const th = Toro.build(atlas, 'x3m40i', {});
    const u = find(th, 'shift').uniforms(stateAt(7000));
    assert.strictEqual(u.u_style, 1);
    assert.strictEqual(u.u_burst, 1);
    assert.strictEqual(u.u_strobe, 1, 'at the limiter');
    const gt3 = Toro.build(atlas, 'x3m40i', { shiftStyle: 'gt3' });
    assert.strictEqual(find(gt3, 'shift').uniforms(stateAt(7000)).u_style, 0);
    assert.ok(!find(Toro.build(atlas, 'x3m40i', { shiftStyle: 'off' }), 'shift'));
});

test('shake keys: a jolt that dies away, resting between bursts', () => {
    const k = Toro.shakeKeys(6, true).split(' ');
    assert.strictEqual(k[0], '0:0.0,0.0,0');
    assert.strictEqual(k[k.length - 1], '900:0,0,0');
    for (const key of k) assert.strictEqual(key.split(':')[1].split(',').length, 3, 'translate: x, y, z');
    assert.ok(k.length <= 256);
    assert.strictEqual(Toro.build(atlas, 'x3m40i', { shake: 'off' }).shakeKeys, null);
});

function fakeCR() {
    const calls = { animate: [], stop: [], effect: [], set: [] };
    let ref = 0;
    return {
        calls,
        asset() { return ++ref; },
        effect(o) { calls.effect.push(o); return ++ref; },
        uniform() {}, bind() {}, drop() {}, pixels() {},
        set(r, o) { calls.set.push({ ref: r, o }); },
        animate(r, o) { calls.animate.push({ ref: r, o }); return calls.animate.length; },
        stop(r, a) { calls.stop.push({ ref: r, a }); }
    };
}

test('the cluster shakes at the limiter, moved from here on our own clock, and settles after', () => {
    /* (it used to be an animation the renderer played: on the car that never ran) */
    const cr = fakeCR();
    const theme = Toro.build(atlas, 'x3m40i', { bottomExtra: 'hide' });
    const d = Driver.create({ cr, theme, shaders: Main.shaders(), atlas,
        atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
    d.ready();
    const at = (rpm, ms) => Object.assign(stateAt(rpm), { now: 1000000 + ms });
    const moves = () => cr.calls.set.filter((c) => c.o.x !== undefined);
    d.tick(at(3000, 0));
    assert.strictEqual(moves().length, 0);
    assert.strictEqual(cr.calls.animate.length, 0);
    d.tick(at(7000, 16));                           /* the limiter: the path starts at rest */
    assert.ok(d.isShaking());
    assert.strictEqual(moves().length, 0, 'the first key is no move');
    d.tick(at(7000, 16 + 45));                      /* the second key: every layer that may move, once */
    const still = theme.layers.filter((L) => L.still);
    assert.ok(still.length >= 4, 'the background, the flash and the covers by the gear stay put');
    assert.ok(['bg', 'flash', 'stripL', 'stripR'].every((id) => still.some((L) => L.id === id)));
    assert.strictEqual(moves().length, theme.layers.length - still.length);
    const refs = d.refs();
    const stillRefs = still.map((L) => refs[L.id]);
    assert.ok(moves().every((c) => stillRefs.indexOf(c.ref) < 0), 'a still layer was moved');
    /* each by the same whole pixels, from its own place */
    const byRef = {};
    theme.layers.forEach((L) => { byRef[refs[L.id]] = L; });
    const first = moves()[0], L0 = byRef[first.ref];
    const dx = first.o.x - Math.floor(L0.x), dy = first.o.y - Math.floor(L0.y);
    assert.ok(dx !== 0 && Number.isInteger(dx) && Number.isInteger(dy));
    assert.ok(Math.abs(dx) <= 6 && Math.abs(dy) <= 6, 'medium: within 6 px');
    moves().forEach((c) => {
        assert.strictEqual(c.o.x - Math.floor(byRef[c.ref].x), dx);
        assert.strictEqual(c.o.y - Math.floor(byRef[c.ref].y), dy);
    });
    /* the same key again: nothing more is sent */
    const n = moves().length;
    d.tick(at(7000, 16 + 60));
    assert.strictEqual(moves().length, n);
    /* nothing of it is left to the renderer */
    assert.strictEqual(cr.calls.animate.length, 0);
    /* the limiter lets go: it keeps going a moment, then every layer is back where it belongs */
    for (let i = 0; i < 11; i++) d.tick(at(3000, 100 + i * 16));
    assert.ok(d.isShaking(), 'it keeps going a moment');
    d.tick(at(3000, 100 + 11 * 16));
    assert.ok(!d.isShaking());
    const last = {};
    moves().forEach((c) => { last[c.ref] = c.o; });
    Object.keys(last).forEach((r) => {
        assert.strictEqual(last[r].x, Math.floor(byRef[r].x));
        assert.strictEqual(last[r].y, Math.floor(byRef[r].y));
    });
});

test('holiday: snow down both sides and a tree, behind the instruments', () => {
    for (const style of ['toro', 'track', 'mplus']) {
        const th = Themes.build(atlas, 'x3m40i', { style, holiday: true });
        const ids = th.layers.map((L) => L.id);
        assert.ok(ids.includes('snow0') && ids.includes('snow1') && ids.includes('tree'), style);
        for (const L of th.layers.filter((L) => /^snow|^tree/.test(L.id))) {
            assert.ok(L.z < 10, 'behind the readouts');
            assert.ok(L.x >= 0 && L.x + L.w <= Panel.PANEL_WIDTH && L.y + L.h <= Panel.BOTTOM_CUT);
        }
        assert.ok(!Themes.build(atlas, 'x3m40i', { style }).layers.some((L) => L.id === 'tree'));
    }
});

test('the start-up message: held, then faded into the cluster, then gone', () => {
    const th = Themes.build(atlas, 'x3m40i', { intro: true, introSeconds: '10' });
    const veil = find(th, 'introVeil');
    const text = th.layers.filter((L) => /^introText/.test(L.id));
    assert.ok(veil && text.length >= 3, 'the words take several 12-glyph layers');
    assert.ok(veil.z > 100 && text.every((L) => L.z > veil.z), 'over everything');
    const at = (t) => ({ sinceOn: t });
    assert.strictEqual(veil.uniforms(at(5)).u_a, 1);
    assert.ok(text[0].uniforms(at(5)).u_color[3] > 0.99);
    const fading = text[0].uniforms(at(11.5)).u_color[3];
    assert.ok(fading > 0 && fading < 1, 'fading at 11.5 s');
    assert.strictEqual(text[0].uniforms(at(14)), null, 'gone');
    assert.strictEqual(veil.uniforms(at(14)), null, 'gone');
    assert.strictEqual(veil.uniforms(at(-1)), null, 'not before the cluster is up');
    assert.ok(!Themes.build(atlas, 'x3m40i', {}).layers.some((L) => L.id === 'introVeil'));
});

test('the start-up message comes up on the dark, never over the cluster: the veil is whole until the words have begun to go', () => {
    for (const hold of [3, 10, 30]) {
        for (const style of ['toro', 'track', 'mplus', 'mtrack']) {
            const th = Themes.build(atlas, 'x3m40i', { style, intro: true, introSeconds: String(hold) });
            const veil = find(th, 'introVeil'), text = th.layers.filter((L) => /^introText/.test(L.id))[0];
            const va = (t) => { const u = veil.uniforms({ sinceOn: t }); return u ? u.u_a : 0; };
            const ta = (t) => { const u = text.uniforms({ sinceOn: t }); return u ? u.u_color[3] : 0; };
            let lastText = -1, lastVeil = 2;
            for (let t = 0; t <= hold + 5; t += 1 / 60) {
                const v = va(t), w = ta(t);
                /* from the first frame to the end of the hold nothing of the cluster shows: this is what
                   was wrong up to 0.9.6, where the veil fell clear at 0.6 s and closed again by 1.8 s */
                if (t <= hold) assert.strictEqual(v, 1, `${style}, held ${hold} s: the veil is ${v} at ${t.toFixed(2)} s`);
                /* the words only ever come up, hold, and go */
                if (t <= 1.2) assert.ok(w >= lastText - 1e-12, 'the words come up without a step back');
                if (t > hold) assert.ok(w <= lastText + 1e-12, 'and go without coming back');
                /* the veil only ever thins, and is never thinner than the words are faint:
                   the cluster does not stand behind words that are still bright */
                assert.ok(v <= lastVeil + 1e-12, `${style}: the veil closed again at ${t.toFixed(2)} s`);
                assert.ok(v >= w - 1e-9, `${style}: at ${t.toFixed(2)} s the words (${w.toFixed(2)}) are brighter than the veil is dark (${v.toFixed(2)})`);
                lastText = w; lastVeil = v;
            }
            assert.ok(ta(0.3) > 0.2 && ta(0.3) < 0.3 && ta(1.2) > 0.99, 'the words fade in over 1.2 s');
            assert.strictEqual(va(hold + 4.2), 0, 'and all of it is gone 4 s after the hold');
        }
    }
});

test('the message: the default words, uppercase, wrapped to fit', () => {
    const S = Palette.resolve({ intro: true }, P);
    assert.strictEqual(S.introText, 'MGU Styles an app by #tunedbywali', 'the app\'s own name and its maker\'s, as it comes');
    assert.strictEqual(Overlays.clean(atlas, S.introText), 'MGU STYLES AN APP BY #TUNEDBYWALI', 'the # is in the face');
    /* the dedication is still one of the choices, and so are the rest */
    assert.strictEqual(Palette.resolve({ introMessage: 'nicole' }, P).introText, 'For my beautiful wife, Nicole Wali, I love you');
    const words = require('../app/app.base.json').settings.find((x) => x.key === 'introMessage');
    assert.deepStrictEqual(words.options.map((o) => o[0]), ['mgu', 'nicole', 'welcome', 'drive', 'buongiorno', 'andiamo', 'custom']);
    assert.strictEqual(words.default, 'mgu');
    words.options.forEach((o) => { if (o[0] !== 'custom') assert.strictEqual(o[1], Palette.INTRO_WORDS[o[0]]); });
    /* (AK 0.11.2) off as the app comes, and off once on a car that had it on (reset): GENERAL > Start-up message turns it on */
    const intro = require('../app/app.base.json').settings.find((x) => x.key === 'intro');
    assert.strictEqual(intro.default, false);
    assert.strictEqual(intro.reset, 1);
    assert.strictEqual(Palette.resolve({}, P).intro, false);
    assert.strictEqual(Palette.resolve({ introMessage: 'welcome' }, P).introText, 'Welcome back');
    assert.strictEqual(Palette.resolve({ introMessage: 'custom', introText: 'Ciao bella' }, P).introText, 'Ciao bella');
    assert.strictEqual(Overlays.clean(atlas, 'Ciao  bella ~ <3'), 'CIAO BELLA 3');
    const F = Overlays.fit(atlas, Overlays.clean(atlas, S.introText));
    assert.ok(F.lines.length >= 1 && F.lines.length <= 3);
    assert.ok(F.size >= 30);
});

test('your own words: read from a USB stick and kept', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgu-msg-'));
    const stick = path.join(tmp, 'media', 'usb0');
    const data = path.join(tmp, 'data');
    fs.mkdirSync(stick, { recursive: true });
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(stick, Message.NAME), '﻿Happy anniversary,\n  my love\n');
    const roots = [path.join(tmp, 'media')];
    assert.strictEqual(Message.load({ dataDir: data, roots }), 'Happy anniversary, my love');
    fs.rmSync(stick, { recursive: true });
    assert.strictEqual(Message.load({ dataDir: data, roots }), 'Happy anniversary, my love', 'kept');
    assert.strictEqual(Message.load({ roots: [path.join(tmp, 'nowhere')] }), null);
    fs.rmSync(tmp, { recursive: true });
});

/* ------------------------------------------------- fluid, G, boost */

const Smooth = require('../src/car/smooth.js');

test('readings glide between the car updates, the same at any frame rate', () => {
    const run = (stepMs) => {
        const sm = Smooth.create();
        sm.apply({ rpm: 1000 }, 0, 90);
        let out;
        const n = Math.round(90 / stepMs);
        for (let i = 1; i <= n; i++) out = sm.apply({ rpm: 4000 }, i * stepMs, 90);
        return out.rpm;
    };
    const at60 = run(15), at30 = run(30);
    assert.ok(at60 > 2800 && at60 < 3100, 'about 63% of the way after one glide time: ' + at60);
    assert.ok(Math.abs(at60 - at30) < 40, 'frame rate does not change the motion');
    const sm = Smooth.create();
    sm.apply({ rpm: 3000 }, 0, 90);
    assert.strictEqual(sm.apply({ rpm: undefined }, 16, 90).rpm, undefined, 'a lost reading is not faded out');
    assert.strictEqual(Smooth.create().apply({ rpm: 5000, gear: '3' }, 0, 0).rpm, 5000);
    const off = Smooth.create(); off.apply({ rpm: 1000 }, 0, 0);
    assert.strictEqual(off.apply({ rpm: 4000 }, 16, 0).rpm, 4000, 'off: straight to it');
});

test('refresh rate and smoothing settings', () => {
    assert.strictEqual(Palette.resolve({}, P).refreshHz, 60);
    assert.strictEqual(Palette.resolve({ refreshHz: '30' }, P).refreshHz, 30);
    assert.strictEqual(Palette.resolve({ refreshHz: '500' }, P).refreshHz, 60);
    assert.strictEqual(Palette.resolve({ smoothing: 'nope' }, P).smoothing, 'smooth');
});

test('the G meter: a right-hand turn reads to the right, braking down', () => {
    /* the bus is ISO: lateral positive to the left */
    const right = State.present({ rpm: 2000, gLat: -0.5, gLon: -0.3 }, P, {});
    assert.ok(right.gX > 0.49 && right.gY < -0.29);
    const th = Toro.build(atlas, 'x3m40i', {});
    const L = (id) => find(th, id).uniforms(Object.assign(right, { now: 0 }));
    assert.strictEqual(L('gR').u_count > 0, true);
    assert.deepStrictEqual(find(th, 'gforce').uniforms(Object.assign({}, right, { now: 0 })).u_g, [right.gX, right.gY]);
});

test('the G peak is held a few seconds as a line, then fades away', () => {
    const th = Toro.build(atlas, 'x3m40i', {});
    const g = find(th, 'gforce');
    const st = (lat, now) => Object.assign(State.present({ rpm: 2000, gLat: lat, gLon: 0 }, P, {}), { now });
    let u = g.uniforms(st(-0.9, 1000));
    assert.ok(Math.abs(u.u_peak[0] - 0.9) < 1e-9 && u.u_peakA === 1);
    u = g.uniforms(st(-0.2, 3500));
    assert.ok(Math.abs(u.u_peak[0] - 0.9) < 1e-9 && u.u_peakA === 1, 'held');
    u = g.uniforms(st(-0.2, 4750));
    assert.ok(u.u_peakA > 0.3 && u.u_peakA < 0.7, 'fading: ' + u.u_peakA);
    u = g.uniforms(st(-0.2, 7000));
    assert.ok(Math.abs(u.u_peak[0] - 0.2) < 1e-9, 'a new, smaller peak once the old one is gone');
    const smaller = g.uniforms(st(-1.1, 7100));
    assert.ok(Math.abs(smaller.u_peak[0] - 1.1) < 1e-9, 'a harder one replaces it at once');
});

test('boost: level with the speed, a step bigger each psi, its gauge sweeping right to left', () => {
    const th = Toro.build(atlas, 'x3m40i', {});
    const num = find(th, 'boostNum'), gauge = find(th, 'boostGauge'), speed = find(th, 'speed');
    const at = (psi) => Object.assign(stateAt(4000), { boostPsi: psi });
    const height = (psi) => num.uniforms(at(psi)).u_quad[3];
    assert.ok(height(10) > height(5) && height(20) > height(10));
    assert.strictEqual(height(10.2), height(10.9), 'steps, not a creep');
    assert.strictEqual(num.uniforms(at(-6)).u_count, 1, 'vacuum reads 0');
    /* the same baseline as the speed: the bottoms of their figures line up */
    const bottom = (L, st) => { const q = L.uniforms(st).u_quad; return L.y + q[1] + q[3]; };
    assert.ok(Math.abs(bottom(num, at(16)) - bottom(speed, at(16))) < 8, 'level with the speed');
    const u = gauge.uniforms(at(15));
    assert.strictEqual(u.u_dir, -1);
    assert.ok(u.u_alpha < 0.6, 'faint');
    assert.ok(gauge.x > num.x + num.w - 40, 'right of the figure');
});

test('holiday: the snow keeps off the side gauges', () => {
    const th = Themes.build(atlas, 'x3m40i', { holiday: true });
    for (const id of ['snow0', 'snow1']) {
        const L = find(th, id);
        const clear = L.uniforms().u_clear;
        assert.strictEqual(clear.length, 16, 'four boxes');
        const boxes = [];
        for (let i = 0; i < 16; i += 4) if (clear[i + 2] > 0) boxes.push(clear.slice(i, i + 4));
        assert.ok(boxes.length >= 1, id + ' clears something');
        /* every gauge on this side lies inside a cleared box */
        for (const g of th.layers.filter((x) => /^bar_/.test(x.id) && x.x < L.x + L.w && x.x + x.w > L.x)) {
            const gx = g.x - L.x, gy = g.y - L.y;
            assert.ok(boxes.some((b) => gx >= b[0] - 0.5 && gy >= b[1] - 0.5 &&
                gx + g.w <= b[0] + b[2] + 0.5 && gy + g.h <= b[1] + b[3] + 0.5), g.id + ' cleared');
        }
    }
});

/* ------------------------------------------------------------ electric range */

test('electric range: off as it comes, and then nothing of a battery is shown or changed', () => {
    const Vehicle = require('../src/car/vehicle.js');
    const spec = require('../app/app.base.json');
    const item = spec.settings.find((x) => x.key === 'electric');
    assert.deepStrictEqual(item.options.map((o) => o[0]), ['off', 'hybrid', 'bev']);
    assert.strictEqual(item.default, 'off');
    assert.strictEqual(Palette.resolve({}, P).electric, 'off');
    assert.strictEqual(Palette.resolve({ electric: 'yes' }, P).electric, 'off');
    const raw = { rangeKm: 400, fuelPct: 50, evRangeKm: 43, socPct: 78 };
    const off = State.present(raw, P, {});
    assert.strictEqual(off.rangeText, '249');
    assert.strictEqual(off.info.erange, '--');
    assert.strictEqual(off.pods.battery.text, '--');
    assert.strictEqual(off.pods.fuel.text, '50');
    const t = Themes.build(atlas, 'x3m40i', { style: 'toro' });
    assert.strictEqual(t.electricGauge, null);
    assert.ok(!t.layers.some((L) => /battery/.test(L.id)));
    /* the signals are optional: a head unit without them installs and runs */
    assert.ok(Vehicle.SIGNALS['de.bmw.infotainment.drivingexcitement.Efficiencytainment2']._optional);
    assert.strictEqual(Vehicle.SIGNALS['de.bmw.infotainment.KombiIF'].displayRangeElectricVehicle, 'rs');
});

test('electric range: read off the bus, none and nonsense refused', () => {
    const Vehicle = require('../src/car/vehicle.js');
    const KI = 'de.bmw.infotainment.KombiIF', E2 = 'de.bmw.infotainment.drivingexcitement.Efficiencytainment2';
    const r = Vehicle.createReader();
    r.receive(KI, 'displayRangeElectricVehicle', { displayRangeElectricVehicle: 65535 }, 1000);
    r.receive(E2, 'statusChargeOfBatteryHybrid', { displayChargingConditionHighVoltageStorage: 255 }, 1000);
    assert.strictEqual(r.raw(1000).evRangeKm, undefined, '65535 is none');
    assert.strictEqual(r.raw(1000).socPct, undefined, 'over 100 is none');
    r.receive(KI, 'displayRangeElectricVehicle', { displayRangeElectricVehicle: 43 }, 2000);
    r.receive(E2, 'statusChargeOfBatteryHybrid', { displayChargingConditionHighVoltageStorage: 78 }, 2000);
    r.receive(KI, 'displayRangeElectricVehicle', null, 2500);
    r.receive(E2, 'statusChargeOfBatteryHybrid', 'x', 2500);
    assert.deepStrictEqual([r.raw(9000).evRangeKm, r.raw(9000).socPct], [43, 78], 'held between the slow polls');
});

test('electric range: a plug-in hybrid has it beside the fuel\'s, an electric car in place of it', () => {
    const raw = { rangeKm: 400, fuelPct: 50, evRangeKm: 43, socPct: 78 };
    const hy = State.present(raw, P, { electric: 'hybrid' });
    assert.deepStrictEqual([hy.rangeText, hy.info.erange, hy.info.charge, hy.pods.fuel.text], ['249', '27', '78', '50']);
    assert.strictEqual(hy.pods.battery.text, '27', 'the figure is the range, in miles');
    assert.ok(Math.abs(hy.pods.battery.frac - 0.78) < 1e-9, 'the bar is the charge');
    assert.strictEqual(State.present(raw, P, { electric: 'hybrid', units: 'metric' }).info.erange, '43');
    const ev = State.present({ rangeKm: 4095, evRangeKm: 310, socPct: 64 }, P, { electric: 'bev' });
    assert.strictEqual(ev.rangeText, '193', 'the range is the electric one');
    assert.strictEqual(ev.pods.fuel.text, '64', 'and the level is the battery\'s');
    /* nothing reported: dashes, never the fuel's figure under an electric name */
    const none = State.present({ rangeKm: 400, fuelPct: 50 }, P, { electric: 'bev' });
    assert.deepStrictEqual([none.rangeText, none.info.erange, none.pods.battery.text, none.pods.fuel.text], ['--', '--', '--', '--']);
    /* a range with no charge reported: the bar is the range against a full battery's */
    const noSoc = State.present({ evRangeKm: 40 }, P, { electric: 'hybrid' });
    assert.ok(noSoc.pods.battery.frac > 0.4 && noSoc.pods.battery.frac < 0.6);
    /* low: it warns */
    assert.ok(State.present({ evRangeKm: 5, socPct: 8 }, P, { electric: 'bev' }).pods.battery.alarm);
});

test('electric range in Toro takes one gauge\'s place, and only that one', () => {
    const ids = (cfg) => Themes.build(atlas, 'x3m40i', Object.assign({ style: 'toro' }, cfg)).layers.map((L) => L.id);
    const bars = (cfg) => ids(cfg).filter((id) => /^bar_/.test(id)).sort();
    assert.deepStrictEqual(bars({}), ['bar_auxPress', 'bar_coolant', 'bar_fuel', 'bar_oilT']);
    assert.deepStrictEqual(bars({ electric: 'hybrid' }), ['bar_battery', 'bar_coolant', 'bar_fuel', 'bar_oilT'], 'hybrid: oil pressure makes way');
    assert.deepStrictEqual(bars({ electric: 'bev' }), ['bar_auxPress', 'bar_battery', 'bar_batteryT', 'bar_coolant'],
        'electric car: the fuel gauge is the range, the oil temperature gauge the battery\'s temperature');
    assert.deepStrictEqual(bars({ electric: 'hybrid', showAuxLeft: false }), ['bar_battery', 'bar_fuel'], 'left pair hidden: coolant');
    for (const [g, gone] of [['oilP', 'bar_auxPress'], ['oilT', 'bar_oilT'], ['coolant', 'bar_coolant'], ['fuel', 'bar_fuel']]) {
        const b = bars({ electric: 'hybrid', electricGauge: g });
        assert.ok(b.indexOf('bar_battery') >= 0 && b.indexOf(gone) < 0 && b.length === 4, g);
    }
    assert.strictEqual(new Set(ids({ electric: 'bev' })).size, ids({ electric: 'bev' }).length, 'no two layers share a name');
    /* it stands exactly where the gauge it replaced stood, and shows the range and the charge */
    const a = Themes.build(atlas, 'x3m40i', { style: 'toro' }), b = Themes.build(atlas, 'x3m40i', { style: 'toro', electric: 'bev' });
    const A = a.layers.find((L) => L.id === 'bar_fuel'), B = b.layers.find((L) => L.id === 'bar_battery');
    assert.deepStrictEqual([B.x, B.y, B.w, B.h], [A.x, A.y, A.w, A.h]);
    const st = State.present({ evRangeKm: 310, socPct: 64 }, P, b.settings);
    assert.ok(Math.abs(B.uniforms(st).u_frac - 0.64) < 1e-9);
    assert.strictEqual(B.uniforms(st).u_on, 1);
    assert.strictEqual(B.uniforms(State.present({}, P, b.settings)).u_on, 0, 'dark with nothing reported');
    assert.ok(b.layers.length <= 64);
    /* with oil pressure's gauge gone, nobody is asked for oil pressure */
    assert.strictEqual(Themes.build(atlas, 'x3m40i', { style: 'toro', electric: 'hybrid' }).shows.oil, false);
    assert.strictEqual(a.shows.oil, true);
});

test('a fully electric car: battery temperature where oil temperature was, in Toro and on the M styles\' strip', () => {
    const Vehicle = require('../src/car/vehicle.js');
    const E2 = 'de.bmw.infotainment.drivingexcitement.Efficiencytainment2';
    const r = Vehicle.createReader();
    r.receive(E2, 'statusBatteryTemperature', { actualValueTemperatureHighVoltageStorage: 255 }, 1000);
    assert.strictEqual(r.raw(1000).hvTempC, undefined, '255 is none');
    r.receive(E2, 'statusBatteryTemperature', { actualValueTemperatureHighVoltageStorage: 76 }, 2000);
    assert.strictEqual(r.raw(9000).hvTempC, 26, 'raw less 50, in C');
    /* off, or a hybrid: nothing of it replaces anything */
    const raw = { evRangeKm: 310, socPct: 64, hvTempC: 26, oilTempC: 100 };
    assert.strictEqual(State.present(raw, P, {}).pods.batteryTemp.text, '--');
    assert.strictEqual(State.present(raw, P, {}).hvTempFrac, null);
    const ev = State.present(raw, P, { electric: 'bev' });
    assert.strictEqual(ev.pods.batteryTemp.text, '79', '26 C in F');
    assert.ok(Math.abs(ev.hvTempFrac - 36 / 70) < 1e-9, 'on its own scale, -10 to 60 C');
    assert.strictEqual(State.present(raw, P, { electric: 'bev', units: 'metric' }).info.hvtemp, '26');
    assert.ok(State.present({ hvTempC: 52 }, P, { electric: 'bev' }).pods.batteryTemp.alarm, 'hot: it warns');
    /* Toro: the gauge stands where the oil temperature's stood */
    const a = Themes.build(atlas, 'x3m40i', { style: 'toro' }), b = Themes.build(atlas, 'x3m40i', { style: 'toro', electric: 'bev' });
    const A = a.layers.find((L) => L.id === 'bar_oilT'), B = b.layers.find((L) => L.id === 'bar_batteryT');
    assert.deepStrictEqual([B.x, B.y, B.w, B.h], [A.x, A.y, A.w, A.h]);
    assert.ok(Math.abs(B.uniforms(State.present(raw, P, b.settings)).u_frac - 36 / 70) < 1e-9);
    assert.ok(!Themes.build(atlas, 'x3m40i', { style: 'toro', electric: 'hybrid' }).layers.some((L) => L.id === 'bar_batteryT'), 'a hybrid keeps its oil temperature');
    assert.ok(Themes.build(atlas, 'x3m40i', { style: 'toro', electric: 'bev', electricGauge: 'oilT' }).layers.some((L) => L.id === 'bar_battery'), 'asked to, the range takes that gauge instead');
    /* M styles: the oil strip is the battery's temperature, the fuel strip its charge; neither keeps an engine's symbol */
    for (const style of ['track', 'mplus']) {
        const off = Themes.build(atlas, 'x3m40i', { style }), m = Themes.build(atlas, 'x3m40i', { style, electric: 'bev' });
        const lay = (t, id) => t.layers.find((L) => L.id === id);
        assert.ok(lay(off, 'fuelIcon') && lay(off, 'oilIcon'));
        assert.ok(!lay(m, 'fuelIcon') && !lay(m, 'oilIcon'), style);
        const st = State.present(raw, P, m.settings);
        assert.ok(Math.abs(lay(m, 'oilStrip').uniforms(st).u_level - 36 / 70) < 1e-9);
        assert.ok(Math.abs(lay(m, 'fuelStrip').uniforms(st).u_level - 0.64) < 1e-9);
        assert.strictEqual(lay(m, 'oilStrip').uniforms(State.present({ oilTempC: 100 }, P, m.settings)).u_on, 0, 'no battery reading: dark, never the oil\'s');
        /* and with the setting off, the oil strip is the oil's as ever */
        assert.ok(Math.abs(lay(off, 'oilStrip').uniforms(State.present(raw, P, off.settings)).u_level - (100 * 1.8 + 32 - 120) / 180) < 1e-9);
    }
});

test('the speed limit sign\'s edge in BMW\'s strip can be covered: a small patch, off as it comes, never near the gear', () => {
    const Strip = require('../src/theme/strip.js');
    const p = Panel.SIGN_PATCH, g = Panel.GEAR_TRIGGER_WINDOW;
    assert.strictEqual(require('../app/app.base.json').settings.find((x) => x.key === 'signCover').default, false);
    /* where the sign's arc was seen (x 471 - 499, y 669 - 675), with room; above the strip's own figures; far from the gear */
    assert.ok(p.x <= 461 && p.x + p.w >= 509 && p.y === Panel.BOTTOM_CUT && p.y + p.h >= 676 && p.y + p.h <= 677);
    assert.ok(p.x + p.w < g.x - 800);
    for (const style of ['toro', 'track', 'mplus']) {
        const ids = (cfg) => Themes.build(atlas, 'x3m40i', Object.assign({ style }, cfg)).layers.filter((L) => /^strip/.test(L.id));
        assert.deepStrictEqual(ids({}), [], 'off: nothing');
        for (const bottomExtra of ['0', '6', '18']) {
            const c = ids({ signCover: true, bottomExtra });
            assert.strictEqual(c.length, 1);
            const L = c[0];
            assert.deepStrictEqual([L.id, L.x, L.y, L.w, L.h, L.shader, L.still, L.belowCut], ['stripSign', p.x, p.y, p.w, p.h, 'cover', true, true]);
            assert.ok(!Strip.overGear(L));
            assert.deepStrictEqual(L.uniforms({}), { u_col: [0, 0, 0] });
        }
        /* with the strip hidden it is covered already: the two covers, and no third */
        assert.deepStrictEqual(ids({ signCover: true, bottomExtra: 'hide' }).map((L) => L.id), ['stripL', 'stripR']);
        const t = Themes.build(atlas, 'x3m40i', { style, signCover: true, holiday: true, intro: true, electric: 'bev' });
        assert.ok(t.layers.length <= 64, style + ': ' + t.layers.length + ' layers');
    }
});

test('one speed or two in the M styles, each style its own; a new install trims 18 px of BMW\'s strip', () => {
    const spec = require('../app/app.base.json');
    for (const [style, key] of [['track', 'mSpeed2'], ['mplus', 'pSpeed2']]) {
        const item = spec.settings.find((x) => x.key === key);
        assert.deepStrictEqual([item.default, item.options.map((o) => o[0])], ['on', ['on', 'off']]);
        assert.strictEqual(Themes.keyFor(style, 'speed2'), key);
        const has = (cfg, id) => Themes.build(atlas, 'x3m40i', Object.assign({ style }, cfg)).layers.some((L) => L.id === id);
        assert.ok(has({}, 'speed2') && has({}, 'speed2Unit'), 'both, as the M View has them');
        assert.ok(has({ [key]: 'on' }, 'speed2'));
        for (const units of ['imperial', 'metric']) {
            assert.ok(!has({ [key]: 'off', units }, 'speed2') && !has({ [key]: 'off', units }, 'speed2Unit'), 'one speed only');
            assert.ok(has({ [key]: 'off', units }, 'speed') && has({ [key]: 'off', units }, 'speedUnit'), 'the main speed stays');
        }
        /* the other style's setting does not reach this one */
        const other = key === 'mSpeed2' ? 'pSpeed2' : 'mSpeed2';
        assert.ok(has({ [other]: 'off' }, 'speed2'));
    }
    /* the strip: 18 px for an install from here on; a style built bare, and a saved choice, are untouched */
    const strip = spec.settings.find((x) => x.key === 'bottomExtra');
    assert.strictEqual(strip.default, '18');
    assert.ok(strip.options.some((o) => o[0] === '18'));
    assert.strictEqual(Palette.resolve({}, P).bottomExtra, 0);
    assert.strictEqual(Palette.resolve({ bottomExtra: '18' }, P).bottomExtra, 18);
    assert.strictEqual(Palette.resolve({ bottomExtra: '0' }, P).bottomExtra, 0, 'someone who chose to show all of it keeps it');
});
