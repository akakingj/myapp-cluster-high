'use strict';
/*
 * Everything that moves by itself - the snow, the tree's lights, the
 * limiter's flash, the shift lights' strobe, a gauge's alarm, the shake -
 * runs on the head unit's clock, sent as uniforms and places. Nothing is
 * left to the renderer's own clock or animations: on the car this is built
 * for they never ran (two photographs six minutes apart had the snow in the
 * same places).
 * Run: node --test test/clock.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');

const Clock = require('../src/engine/clock.js');
const Driver = require('../src/car/cluster.js');
const Main = require('../src/car/main.js');
const Themes = require('../src/theme/index.js');
const Overlays = require('../src/theme/overlays.js');
const State = require('../src/engine/state.js');
const Panel = require('../src/geometry/panel.js');
const Prelude = require('../src/shaders/prelude.js');
const parts = require('../src/shaders/parts.js');
const atlas = require('../assets/fonts/atlas.json');

const SHADERS = Main.shaders();
const P = Panel.profile('x3m40i');
const STYLES = ['toro', 'track', 'mplus'];

function fakeCR() {
    const calls = { effect: [], uniform: [], set: [], animate: [] };
    let ref = 0;
    return {
        calls,
        asset() { return ++ref; },
        effect(o) { calls.effect.push(o); return ++ref; },
        uniform(r, name, values, opts) { calls.uniform.push({ ref: r, name, values, opts }); },
        bind() {}, drop() {}, pixels() {},
        set(r, o) { calls.set.push({ ref: r, o }); },
        animate(r, o) { calls.animate.push({ ref: r, o }); return 1; },
        stop() {}
    };
}
function stateAt(rpm, now, extra) {
    return Object.assign(State.present({ rpm, speedKmh: 80, gear: '4', oilTempC: 100, coolantC: 90, fuelPct: 50 }, P, {}),
        { now }, extra || {});
}

test('every shader that reads u_time is on the clock\'s list, with the uniform that says it is animating', () => {
    const readers = Object.keys(SHADERS).filter((id) => /\bu_time\b/.test(SHADERS[id]));
    assert.deepStrictEqual(readers.sort(), Object.keys(Clock.GATES).sort(),
        'a shader that reads u_time and is not in src/engine/clock.js stands still on the car');
    Object.keys(Clock.GATES).forEach((id) => {
        const g = Clock.GATES[id];
        if (g.gate) assert.ok(new RegExp('uniform float ' + g.gate + ';').test(SHADERS[id]), `${id}: ${g.gate} is not one of its uniforms`);
    });
    /* the snow is not on it: where its flakes are is sent whole (u_fall) */
    assert.ok(!/\bu_time\b/.test(SHADERS.snow));
    assert.ok(/uniform vec4 u_fall;/.test(SHADERS.snow));
});

test('the clock runs 0 to 9 s and round again, and every cycle the shaders make of it fits a whole number of times', () => {
    assert.strictEqual(Clock.PERIOD_MS, 9000);
    assert.strictEqual(Clock.seconds(0), 0);
    assert.strictEqual(Clock.seconds(9000), 0);
    assert.ok(Math.abs(Clock.seconds(1765000004500) - ((1765000004500 % 9000) / 1000)) < 1e-9);
    for (const t of [1, 8999, 123456789, 1765000000000]) {
        const s = Clock.seconds(t);
        assert.ok(s >= 0 && s < 9, 'small enough for any float');
    }
    /* stepped where slower will do */
    assert.strictEqual(Clock.seconds(1000 + 10, 15), Clock.seconds(1000, 15));
    assert.notStrictEqual(Clock.seconds(1000 + 70, 15), Clock.seconds(1000, 15));
    /*
     * every use of the time in the shaders, and how many whole cycles of
     * it the period holds. A new use has to be added here - and has to fit.
     */
    const P_S = Clock.PERIOD_MS / 1000;
    const uses = {
        'fract(u_time * 9.0)': 9,                       /* the strobe: 9 Hz */
        'fract(u_time / 0.9)': 1 / 0.9,                 /* the burst: every 0.9 s */
        'fract(u_time * u_rate)': 9,                    /* the flash: whole Hz (9 by default) */
        'sin(u_time * TAU * 6.0)': 6,                   /* Toro's dial at the limiter */
        'sin(u_time * TAU * 2.0)': 2,                   /* a gauge's alarm */
        'sin(u_time * TAU / 3.0 + fj * 1.7)': 1 / 3,    /* the tree's lights */
        'sin(u_time * TAU / 4.5)': 1 / 4.5              /* its star */
    };
    const found = new Set();
    Object.keys(SHADERS).forEach((id) => {
        const re = /(fract|sin)\(u_time[^)]*\)/g;
        let m;
        while ((m = re.exec(SHADERS[id]))) found.add(m[0]);
        /* and u_time nowhere else */
        const all = (SHADERS[id].match(/\bu_time\b/g) || []).length;
        const inUses = (SHADERS[id].match(/(fract|sin)\(u_time[^)]*\)/g) || []).length;
        assert.strictEqual(all, inUses, `${id} uses u_time in a way this test does not know`);
    });
    assert.deepStrictEqual([...found].sort(), Object.keys(uses).sort());
    Object.keys(uses).forEach((u) => {
        const cycles = uses[u] * P_S;
        assert.ok(Math.abs(cycles - Math.round(cycles)) < 1e-9, `${u}: ${cycles} cycles in the period - its turn-over would show`);
    });
    /* the flash's rate is whole Hz whatever is set */
    assert.ok(Number.isInteger(Themes.build(atlas, 'x3m40i', {}).settings.flashRate));
});

test('the renderer is asked for no clock and no animation; the time goes as a uniform to what is animating', () => {
    for (const style of STYLES) {
        const cr = fakeCR();
        const theme = Themes.build(atlas, 'x3m40i', { style, holiday: true });
        const d = Driver.create({ cr, theme, shaders: SHADERS, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
        d.ready();
        cr.calls.effect.forEach((e) => {
            assert.strictEqual(e.time, undefined, 'no "time": the renderer\'s clock never ran on the car');
            assert.strictEqual(e.time_fps, undefined);
        });
        const refs = d.refs();
        const byRef = {};
        theme.layers.forEach((L) => { byRef[refs[L.id]] = L; });
        const timeFor = () => cr.calls.uniform.filter((u) => u.name === 'u_time').map((u) => byRef[u.ref].shader);

        /* cruising: only the tree is animating */
        d.tick(stateAt(3000, 1000000));
        assert.deepStrictEqual([...new Set(timeFor())], ['xtree'], style);
        /* at the limiter the flashing layers get the time too, and nothing else does */
        cr.calls.uniform.length = 0;
        d.tick(stateAt(7200, 1000100));
        const lit = new Set(timeFor());
        assert.ok(lit.has('flash'), style + ': the limiter\'s flash');
        assert.ok(lit.has(style === 'toro' ? 'dial' : 'mgauge'), style + ': the dial at the limiter');
        lit.forEach((sh) => assert.ok(Clock.GATES[sh], sh));
        cr.calls.uniform.filter((u) => u.name === 'u_time').forEach((u) => {
            assert.strictEqual(u.values.length, 1);
            assert.ok(u.values[0] >= 0 && u.values[0] < 9);
        });
        assert.strictEqual(cr.calls.animate.length, 0, 'nothing is left to the renderer to play');
    }
});

test('a parked, quiet cluster with no extras still sends nothing', () => {
    for (const style of STYLES) {
        const cr = fakeCR();
        const theme = Themes.build(atlas, 'x3m40i', { style });
        const d = Driver.create({ cr, theme, shaders: SHADERS, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
        d.ready();
        d.tick(stateAt(800, 5000000));
        assert.strictEqual(d.tick(stateAt(800, 5000016)), 0, style);
        assert.strictEqual(d.tick(stateAt(800, 5009000)), 0, style + ', nine seconds on');
    }
});

test('the snow falls: each depth further down as time passes, slowly, with no jump where its figure starts again', () => {
    const G = parts.SNOW;
    assert.deepStrictEqual(G, { cell: [56, 92, 128], rows: 32 });
    const at = (ms) => Overlays.snowFall(ms);
    const t0 = 1765000000000;
    const a = at(t0), b = at(t0 + 1000);
    for (let i = 0; i < 3; i++) {
        const span = G.cell[i] * G.rows;
        const moved = ((b[i] - a[i]) % span + span) % span;
        assert.ok(Math.abs(moved - Overlays.SNOW_SPEED[i]) < 0.6, `depth ${i}: ${moved} px in a second`);
        assert.ok(Overlays.SNOW_SPEED[i] >= 6 && Overlays.SNOW_SPEED[i] <= 30, 'slowly');
        assert.ok(a[i] >= 0 && a[i] < span, 'kept within the shader\'s own repeat');
        assert.ok(span <= 4096, 'a small figure, whatever float the cluster has');
        /* the shader takes whole cells off it: where a flake is drawn runs on through the wrap */
        const cellOf = (v) => Math.floor(v / G.cell[i]), inCell = (v) => v - cellOf(v) * G.cell[i];
        assert.ok(inCell(a[i]) >= 0 && inCell(a[i]) < G.cell[i]);
    }
    assert.ok(Overlays.SNOW_SPEED[0] < Overlays.SNOW_SPEED[1] && Overlays.SNOW_SPEED[1] < Overlays.SNOW_SPEED[2], 'the far flakes fall slowest');
    assert.ok(a[3] >= 0 && a[3] < 2 * Math.PI + 1e-9, 'the sway is a phase');
    /* thirty steps a second: under a pixel a step */
    assert.deepStrictEqual(at(t0 + 5), at(t0 + 10));
    const steps = new Set();
    for (let ms = 0; ms < 1000; ms += 4) steps.add(at(t0 + ms).join());
    assert.ok(steps.size >= 29 && steps.size <= 31, steps.size + ' steps a second');
    assert.ok(Overlays.SNOW_SPEED[2] / 30 < 1, 'under a pixel a step');
    /* over a long time it never leaves its range and never stands still */
    let prev = at(t0), moves = 0;
    for (let s = 1; s <= 4000; s += 7) {
        const v = at(t0 + s * 1000);
        if (v[0] !== prev[0]) moves++;
        v.slice(0, 3).forEach((x, i) => assert.ok(x >= 0 && x < G.cell[i] * G.rows));
        prev = v;
    }
    assert.ok(moves > 560);
});

test('the snow layers send their fall with every frame it changes; the flakes are plain soft dots', () => {
    const cr = fakeCR();
    const theme = Themes.build(atlas, 'x3m40i', { style: 'track', holiday: true });
    const snow = theme.layers.filter((L) => L.shader === 'snow');
    assert.strictEqual(snow.length, 2);
    const u0 = snow[0].uniforms({ now: 1000000 }), u1 = snow[0].uniforms({ now: 1000500 });
    assert.strictEqual(u0.u_fall.length, 4);
    assert.notDeepStrictEqual(u0.u_fall, u1.u_fall);
    const d = Driver.create({ cr, theme, shaders: SHADERS, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
    d.ready();
    d.tick(stateAt(800, 2000000));
    cr.calls.uniform.length = 0;
    d.tick(stateAt(800, 2000040));
    const falls = cr.calls.uniform.filter((u) => u.name === 'u_fall');
    assert.strictEqual(falls.length, 2, 'both sides');
    falls.forEach((u) => assert.strictEqual(u.values.length, 4, 'one vec4: a depth is never drawn with half a step'));
    /* no ring and no glint in the shader: what the car showed read as bubbles */
    const src = SHADERS.snow;
    assert.ok(!/rim|halo|hl\b/.test(src), 'a flake is a plain dot');
    assert.ok(/1\.0 - smoothstep\(r \* \(0\.45 - fi \* 0\.12\), r, d\)/.test(src));
    /* a hash with no sin(): the same flakes on any GPU */
    assert.ok(!/sin\(dot/.test(src));
    /* and the whole of it compiles to the limits of an effect layer */
    const full = Prelude.compose(src);
    assert.ok(!/\bbreak\b/.test(full));
});
