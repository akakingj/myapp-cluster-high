'use strict';
/*
 * What a frame may cost, held as a budget.
 *
 * The cluster is smooth on the car because a frame asks little of the head
 * unit: a few dozen layers the renderer draws by itself, and a handful of
 * small messages for what changed. Every figure below was measured on the
 * first public release (0.9.1) with tools/perf.js and is the most the
 * style may ask now, as it comes: the same number of layers, no more of
 * the screen covered, no more sent a frame. A feature that needs more has
 * to be an option that is off as it comes - and says what it costs.
 * docs/PERFORMANCE.md has the measurements.
 *
 * (Times are not held here: they are a machine's, and a test must pass on
 * any. tools/perf.js measures them, one version against another.)
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/geometry/panel.js');
const Themes = require('../src/theme/index.js');
const State = require('../src/engine/state.js');
const Cluster = require('../src/car/cluster.js');
const Smooth = require('../src/car/smooth.js');
const Sim = require('../preview/sim.js');
const Prelude = require('../src/shaders/prelude.js');
const { ClusterRender } = require('../src/car/cluster_render_client.js');
const atlas = require('../assets/fonts/atlas.json');
const shaders = Object.assign({}, require('../src/shaders/core.js'), require('../src/shaders/parts.js'),
    require('../src/shaders/dial.js'), require('../src/shaders/mcluster.js'), require('../src/shaders/tcluster.js'));

const PROFILE = Panel.profile('carprofile');
const FRAMES = 3120;                 /* two of the simulator's 26 s cycles, at 60 Hz */
const NEUTRAL = { mode: 'neutral', open: 0, maneuver: null };
const PANEL = Panel.PANEL_WIDTH * Panel.PANEL_HEIGHT;

/* the drive every budget is measured over: the simulator's own, with the readings it does not make */
function drive(parked) {
    const sim = Sim.create(PROFILE), out = [];
    for (let i = 0; i < FRAMES; i++) {
        if (!parked) sim.step(1 / 60);
        out.push(Object.assign({}, sim.raw(), { iatC: 24 + Math.round(i / 400), batteryV: 14.1, rangeKm: 402,
                                                ambientC: 21.0, clock: { h: 19, m: 2 + Math.floor(i / 3600) } }));
    }
    return out;
}
const DRIVE = drive(false), PARKED = drive(true);

/* one style through the car's own driver and the renderer's own client, the socket counted */
function run(style, cfg, raws, centre) {
    const theme = Themes.build(atlas, 'carprofile', Object.assign({ style }, cfg));
    const cr = new ClusterRender('budget');
    const count = { bytes: 0, msgs: 0 };
    cr.sock = { write: (m) => { count.bytes += m.length; count.msgs++; return true; } };
    cr.connected = true; cr.ready = true; cr.closed = false;
    const c = Cluster.create({ cr, theme, shaders, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
    c.ready();
    const start = count.bytes - atlas.size * atlas.size;
    const smoother = Smooth.create();
    let st = null;
    const one = (i) => {
        const raw = smoother.apply(raws[i], i * (1000 / 60), 90, theme.glide);
        st = State.present(raw, theme.profile, theme.settings);
        st.now = 1e6 + i * (1000 / 60); st.centre = centre || NEUTRAL; st.sinceOn = 100 + i / 60;
        c.tick(st);
    };
    for (let i = 0; i < 60; i++) one(i);           /* the first frames send everything once */
    const b0 = count.bytes, m0 = count.msgs;
    for (let i = 60; i < FRAMES; i++) one(i);
    const drawn = theme.layers.filter((L) => L.uniforms(st, 0) !== null);
    const used = Array.from(new Set(theme.layers.map((L) => L.shader)));
    return {
        layers: theme.layers.length,
        drawn: drawn.reduce((n, L) => n + L.w * L.h, 0) / PANEL,
        shaders: used.length,
        shaderKB: used.reduce((n, id) => n + Prelude.compose(shaders[id]).length, 0) / 1024,
        startKB: start / 1024,
        msgs: (count.msgs - m0) / (FRAMES - 60),
        bytes: (count.bytes - b0) / (FRAMES - 60)
    };
}

/*
 * The most a style may ask, as it comes: layers, how many screens' worth
 * of pixels they cover when drawn in an ordinary frame, messages and bytes
 * a frame over the drive above, kilobytes sent at start-up (the layers and
 * their shaders' text).
 *
 * WAS is the first public release, 0.9.1, measured the same way. On the
 * wire and in layers the three styles it had are what they were, to the
 * byte. In pixels they are less: the limiter's flash lay over the whole
 * style and was drawn every frame, lit or not - a quarter to a third of
 * everything the renderer filled; it is now not drawn unless the limiter
 * is near. M Track Mode's figures are its own first release's.
 */
const WAS = {
    toro: { layers: 43, drawn: 4.016, msgs: 7.056, bytes: 629.2, startKB: 172.8 },
    track: { layers: 39, drawn: 2.859, msgs: 4.977, bytes: 472.3, startKB: 160.0 },
    mplus: { layers: 39, drawn: 2.843, msgs: 4.977, bytes: 472.3, startKB: 159.4 }
};
const BUDGET = {
    toro: { layers: 43, drawn: 3.119, msgs: 7.058, bytes: 629.4, startKB: 172.8 },
    track: { layers: 39, drawn: 1.962, msgs: 4.980, bytes: 472.5, startKB: 160.0 },
    mplus: { layers: 39, drawn: 1.946, msgs: 4.980, bytes: 472.5, startKB: 159.5 },
    mtrack: { layers: 35, drawn: 1.829, msgs: 1.653, bytes: 159.5, startKB: 140.3 }
};
const ROOM = 1.03;

test('as each style comes, a frame asks no more of the head unit than it did in the first public release', () => {
    for (const style of Object.keys(BUDGET)) {
        const b = BUDGET[style], r = run(style, {}, DRIVE);
        assert.ok(r.layers <= b.layers, `${style}: ${r.layers} layers (budget ${b.layers})`);
        assert.ok(r.drawn <= b.drawn * 1.005, `${style}: its layers cover ${r.drawn.toFixed(2)} screens (budget ${b.drawn})`);
        assert.ok(r.msgs <= b.msgs * ROOM, `${style}: ${r.msgs.toFixed(2)} messages a frame (budget ${b.msgs})`);
        assert.ok(r.bytes <= b.bytes * ROOM, `${style}: ${r.bytes.toFixed(0)} bytes a frame (budget ${b.bytes})`);
        assert.ok(r.startKB <= b.startKB * ROOM, `${style}: ${r.startKB.toFixed(1)} KB sent at start-up (budget ${b.startKB})`);
        /* and far inside what the renderer's socket is given: 5,500 KB/s for the whole head unit */
        assert.ok(r.bytes * 60 / 1024 < 60, `${style}: ${(r.bytes * 60 / 1024).toFixed(1)} KB/s`);
        /* never more than the first public release asked, in anything */
        const w = WAS[style];
        if (w) {
            assert.ok(b.layers <= w.layers && b.drawn < w.drawn && b.startKB <= w.startKB * 1.001, style);
            assert.ok(b.msgs <= w.msgs * 1.001 && b.bytes <= w.bytes * 1.001, `${style}: on the wire as it was`);
        }
    }
});

test('the limiter\'s flash is drawn only while there is something to flash', () => {
    const idle = { limiter: 0, rpm: 3000, speed: 60, gear: '3', pods: {}, info: {}, num: {} };
    for (const style of Object.keys(BUDGET)) {
        for (const lower of [0, 74]) {
            const t = Themes.build(atlas, 'carprofile', { style, revFlash: 'both', lower });
            const pieces = t.layers.filter((L) => /^flash[LR]?$/.test(L.id));
            assert.ok(pieces.length >= 1, style);
            pieces.forEach((L) => {
                assert.strictEqual(L.uniforms(Object.assign({}, idle), 0), null, `${style}: ${L.id} is not drawn below the limiter`);
                const u = L.uniforms(Object.assign({}, idle, { limiter: 0.4 }), 0);
                assert.ok(u && u.u_on === 0.4, `${style}: ${L.id} is there as the limiter nears`);
            });
        }
    }
});

test('parked, a style sends nothing: a quiet cluster costs the socket nothing at all', () => {
    for (const style of Object.keys(BUDGET)) {
        const r = run(style, {}, PARKED);
        /* (M Track Mode's intake air mark glides for a second when the figure moves a degree) */
        assert.ok(r.msgs <= (style === 'mtrack' ? 0.2 : 0), `${style}: ${r.msgs.toFixed(3)} messages a frame, parked`);
    }
});

test('an option that costs more is off as it comes, and what it costs is bounded', () => {
    /* lowered (BETA): the same layers and a few more, each larger by the scale, squared - and no more on the wire */
    for (const [style, most] of [['toro', 58], ['track', 74], ['mplus', 74], ['mtrack', 74]]) {
        const plain = run(style, { bottomExtra: 'hide' }, DRIVE), low = run(style, { lower: most }, DRIVE);
        const k = (646 + most) / 646;
        assert.ok(low.layers <= plain.layers + 2, `${style} lowered: ${low.layers} layers against ${plain.layers}`);
        assert.ok(low.drawn <= plain.drawn * k * k * 1.02, `${style} lowered covers ${low.drawn.toFixed(2)} screens against ${plain.drawn.toFixed(2)}`);
        assert.ok(low.msgs <= plain.msgs * ROOM + 0.05 && low.bytes <= plain.bytes * 1.06, `${style} lowered: ${low.msgs.toFixed(2)} messages, ${low.bytes.toFixed(0)} bytes a frame`);
        assert.ok(low.layers <= 64);
    }
    /*
     * The M styles' widest picture: the same layers as any other window and no more on the wire - and,
     * with the picture open, less to draw than the standard window: the plates (and M Sport's two
     * lines) are not drawn at all.
     */
    const OPEN = { mode: 'map', open: 1, maneuver: null };
    for (const style of ['track', 'mplus']) {
        const std = run(style, { centre: 'waze' }, DRIVE, OPEN), wide = run(style, { centre: 'waze', centreSize: 'full' }, DRIVE, OPEN);
        assert.strictEqual(wide.layers, std.layers, style);
        assert.ok(wide.drawn < std.drawn * 0.9, `${style}, widest: its layers cover ${wide.drawn.toFixed(2)} screens against ${std.drawn.toFixed(2)}`);
        assert.ok(wide.msgs <= std.msgs * ROOM && wide.bytes <= std.bytes * ROOM, `${style}, widest: ${wide.msgs.toFixed(2)} messages, ${wide.bytes.toFixed(0)} bytes a frame`);
        assert.ok(wide.startKB <= std.startKB * 1.01, `${style}, widest: ${wide.startKB.toFixed(1)} KB at start-up against ${std.startKB.toFixed(1)}`);
        /* shut, it asks exactly what the style asks as it comes (the glass is told the field and its pads, once) */
        const shut = run(style, { centreSize: 'full' }, DRIVE), plain = run(style, {}, DRIVE);
        assert.deepStrictEqual([shut.layers, shut.drawn, shut.msgs], [plain.layers, plain.drawn, plain.msgs], style);
        assert.ok(shut.bytes <= plain.bytes * 1.001);
    }
    /* M Track Mode with a picture filling its wing: the style stands elsewhere and asks the same */
    const wing = run('mtrack', { centre: 'waze' }, DRIVE, OPEN), slot = run('mtrack', { centre: 'waze', wing: 'slot' }, DRIVE, OPEN);
    assert.strictEqual(wing.layers, slot.layers);
    assert.ok(wing.drawn <= slot.drawn * 1.02 && wing.msgs <= slot.msgs * ROOM && wing.bytes <= slot.bytes * ROOM && wing.startKB <= slot.startKB * 1.01,
        `the whole wing: ${wing.drawn.toFixed(2)} screens, ${wing.bytes.toFixed(0)} bytes a frame against ${slot.drawn.toFixed(2)}, ${slot.bytes.toFixed(0)}`);
    /* everything on at once still fits the renderer's limit of layers */
    for (const style of Object.keys(BUDGET)) {
        const all = run(style, { holiday: true, intro: true, centre: 'waze', centreSize: 'full', revFlash: 'both', lower: 74, shake: 'hard' }, DRIVE);
        assert.ok(all.layers <= 64, `${style}: ${all.layers} layers with everything on`);
    }
});
