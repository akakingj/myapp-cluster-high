#!/usr/bin/env node
/*
 * What one frame costs the head unit, measured on a source tree - this one, or another checkout
 * of it, so that one version can be held against another:
 *
 *   node --expose-gc tools/perf.js                  this tree
 *   node --expose-gc tools/perf.js ../some-checkout  that one (git worktree add ../some-checkout <commit>)
 *   ... --json out.json                             the figures, to keep
 *
 * For each style - driving, driving with a picture in its middle, parked:
 *
 *   layers, visible   how many the renderer is given, and how many it draws in an ordinary frame
 *   drawn             the pixels those cover, in screens (1920 x 720): what the renderer's GPU fills
 *   shaders, shaderKB the programs the style uses and the size of their text
 *   startKB           what start-up sends (the layers and their shaders; the glyph atlas apart)
 *   usPerFrame        the app's own frame: the readings smoothed, the state made, every layer's
 *                     uniforms worked out, what changed sent - microseconds, the median of nine runs
 *   msgsPerFrame, bytesPerFrame, kbPerSec   what goes over the renderer's socket, through its own client
 *
 * Times are this machine's, not the car's (whose processor is several times slower): they are for
 * holding one version against another, and they move a few per cent from run to run. Everything
 * else is exact, and test/budget.test.js holds it. docs/PERFORMANCE.md has what was measured.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { performance, PerformanceObserver } = require('perf_hooks');
const root = path.resolve(process.argv[2] && process.argv[2].indexOf('--') !== 0 ? process.argv[2] : path.join(__dirname, '..'));
const jsonOut = process.argv.indexOf('--json') > 0 ? process.argv[process.argv.indexOf('--json') + 1] : null;
const R = (p) => require(path.join(root, p));
const has = (p) => fs.existsSync(path.join(root, p));

const Panel = R('src/geometry/panel.js');
const Themes = R('src/theme/index.js');
const State = R('src/engine/state.js');
const Cluster = R('src/car/cluster.js');
const Smooth = R('src/car/smooth.js');
const Sim = R('preview/sim.js');
const Prelude = R('src/shaders/prelude.js');
const { ClusterRender } = R('src/car/cluster_render_client.js');
const atlas = R('assets/fonts/atlas.json');
const shaders = Object.assign({}, R('src/shaders/core.js'), R('src/shaders/parts.js'), R('src/shaders/dial.js'),
    R('src/shaders/mcluster.js'), has('src/shaders/tcluster.js') ? R('src/shaders/tcluster.js') : {});
const PROFILE = Panel.profile('x3m40i');
const FRAMES = 3120;                    /* two of the simulator's 26 s cycles at 60 Hz */
const RUNS = 9;

/* a drive, made once: the same readings for every style and version */
function drive(parked) {
    const sim = Sim.create(PROFILE), out = [];
    for (let i = 0; i < FRAMES; i++) {
        if (!parked) sim.step(1 / 60);
        const r = sim.raw();
        out.push(Object.assign({}, r, { iatC: 24 + Math.round(i / 400), batteryV: 14.1, rangeKm: 402, ambientC: 21.0, clock: { h: 19, m: 2 + Math.floor(i / 3600) } }));
    }
    return out;
}
const DRIVE = drive(false), PARKED = drive(true);

function client() {
    const cr = new ClusterRender('perf');
    const count = { bytes: 0, msgs: 0 };
    cr.sock = { write: (m) => { count.bytes += m.length; count.msgs++; return true; } };
    cr.connected = true; cr.ready = true; cr.closed = false;
    return { cr, count };
}

let gcMs = 0;
new PerformanceObserver((list) => { list.getEntries().forEach((e) => { gcMs += e.duration; }); }).observe({ entryTypes: ['gc'] });

function measure(style, cfg, raws, centre) {
    const settings = Object.assign({ style }, cfg);
    const t0 = performance.now();
    const theme = Themes.build(atlas, 'x3m40i', settings);
    const buildMs = performance.now() - t0;
    /* what the renderer is asked to draw */
    const layers = theme.layers.length;
    const area = theme.layers.reduce((n, L) => n + Math.max(0, L.w) * Math.max(0, L.h), 0) / (1920 * 720);
    const used = Array.from(new Set(theme.layers.map((L) => L.shader)));
    const shaderChars = used.reduce((n, id) => n + (shaders[id] ? Prelude.compose(shaders[id]).length : 0), 0);

    const runs = [];
    let startBytes = 0, perFrame = null, visible = 0;
    for (let run = 0; run < RUNS; run++) {
        const { cr, count } = client();
        const c = Cluster.create({ cr, theme, shaders, atlas, atlasPixels: Buffer.alloc(atlas.size * atlas.size) });
        c.ready();
        startBytes = count.bytes - atlas.size * atlas.size;
        const smoother = Smooth.create();
        /* settle: the first frames send everything once */
        const one = (i) => {
            const raw = smoother.apply(raws[i], i * (1000 / 60), 90, theme.glide);
            const st = State.present(raw, theme.profile, theme.settings);
            st.now = 1e6 + i * (1000 / 60); st.centre = centre; st.sinceOn = 100 + i / 60;
            return c.tick(st);
        };
        for (let i = 0; i < 60; i++) one(i);
        if (global.gc) global.gc();
        const b0 = count.bytes, m0 = count.msgs, g0 = gcMs;
        const t = process.hrtime.bigint();
        for (let i = 60; i < FRAMES; i++) one(i);
        const ns = Number(process.hrtime.bigint() - t);
        runs.push({ us: ns / 1000 / (FRAMES - 60), gc: 0 });
        perFrame = { bytes: (count.bytes - b0) / (FRAMES - 60), msgs: (count.msgs - m0) / (FRAMES - 60) };
        runs[runs.length - 1].gc = gcMs - g0;
        /* how many layers are drawn in an ordinary frame */
        const st = State.present(raws[2000], theme.profile, theme.settings);
        st.now = 1e6; st.centre = centre; st.sinceOn = 100;
        visible = theme.layers.filter((L) => L.uniforms(st, 0) !== null).length;
        const drawn = theme.layers.filter((L) => L.uniforms(st, 0) !== null).reduce((n, L) => n + L.w * L.h, 0) / (1920 * 720);
        perFrame.drawn = drawn;
        c.stop();
    }
    runs.sort((a, b) => a.us - b.us);
    const med = runs[Math.floor(RUNS / 2)];
    return { style, cfg, layers, visible, coverage: +area.toFixed(2), drawn: +perFrame.drawn.toFixed(2), shaders: used.length, shaderKB: +(shaderChars / 1024).toFixed(1),
             buildMs: +buildMs.toFixed(1), startKB: +(startBytes / 1024).toFixed(1),
             usPerFrame: +med.us.toFixed(1), usBest: +runs[0].us.toFixed(1), msgsPerFrame: +perFrame.msgs.toFixed(1), bytesPerFrame: Math.round(perFrame.bytes),
             kbPerSec: +(perFrame.bytes * 60 / 1024).toFixed(1) };
}

const NEUTRAL = { mode: 'neutral', open: 0, maneuver: null }, OPEN = { mode: 'map', open: 1, maneuver: null };
const styles = ['toro', 'track', 'mplus'].concat(Themes.THEMES.mtrack ? ['mtrack'] : []);
const extra = process.env.PERF_EXTRA ? JSON.parse(process.env.PERF_EXTRA) : {};
const out = [];
/* warm the JIT on everything once */
styles.forEach((s) => measure(s, extra, DRIVE.slice(0, 400).concat(DRIVE.slice(0, FRAMES - 400)), NEUTRAL));
for (const style of styles) {
    out.push(Object.assign({ what: 'driving' }, measure(style, Object.assign({}, extra), DRIVE, NEUTRAL)));
    out.push(Object.assign({ what: 'driving, map open' }, measure(style, Object.assign({ centre: 'waze' }, extra), DRIVE, OPEN)));
    out.push(Object.assign({ what: 'parked' }, measure(style, Object.assign({}, extra), PARKED, NEUTRAL)));
}
const cols = ['style', 'what', 'layers', 'visible', 'drawn', 'shaders', 'shaderKB', 'startKB', 'buildMs', 'usPerFrame', 'msgsPerFrame', 'bytesPerFrame', 'kbPerSec'];
console.log(cols.join('\t'));
out.forEach((r) => console.log(cols.map((c) => r[c]).join('\t')));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
