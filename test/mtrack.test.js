'use strict';
/*
 * M Track Mode (BMW M's track view, rebuilt from docs/ref/m-track-reference.jpg)
 * against the car's limits and its own geometry: the bottom strip, the
 * factory telltales, the shader budget, the left wing's window for a hosted
 * picture, the gauge rows, and that the rev counter's marks, its numerals
 * and its marker agree.
 *
 * How closely it matches the photograph is measured by tools/mt-compare.py
 * (it needs Python; these tests do not).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Panel = require('../src/geometry/panel.js');
const Units = require('../src/engine/units.js');
const Themes = require('../src/theme/index.js');
const MTrack = require('../src/theme/mtrack.js');
const Readings = require('../src/theme/readings.js');
const State = require('../src/engine/state.js');
const Sim = require('../preview/sim.js');
const Clock = require('../src/engine/clock.js');
const atlas = require('../assets/fonts/atlas.json');
const tShaders = require('../src/shaders/tcluster.js');
const allShaders = Object.assign({}, require('../src/shaders/core.js'), require('../src/shaders/parts.js'),
    require('../src/shaders/dial.js'), require('../src/shaders/mcluster.js'), tShaders);
const T = require('../src/theme/tgeom.js');
const spec = require('../app/app.base.json');

const PROFILE = Panel.profile('carprofile');
const build = (cfg) => Themes.build(atlas, (cfg && cfg.profile) || 'carprofile', Object.assign({ style: 'mtrack' }, cfg));
const layer = (t, id) => t.layers.find((L) => L.id === id);
const state = (t, raw, over) => Object.assign(State.present(raw || {}, t.profile, t.settings), over);
const RAW = { rpm: 3000, speedKmh: 120, gear: '4', driveMode: 'SPORT', fuelPct: 40, oilTempC: 100, coolantC: 92,
              boostBar: 0.8, iatC: 30, oilPressBar: 4.2, batteryV: 14.1, rangeKm: 402, ambientC: 21.0, clock: { h: 19, m: 2 } };
const OPEN = { mode: 'map', open: 1, maneuver: null };

/* ---- reading a text layer back: which characters, and where ---- */
const GLYPH_AT = new Map();
for (const [face, f] of Object.entries(atlas.faces)) {
    for (const [ch, g] of Object.entries(f.glyphs)) if (g.tw) GLYPH_AT.set(g.u + ',' + g.v, { face, ch });
}
const isText = (L) => L.shader === 'text';
function quads(L, u) {
    const out = [];
    for (let g = 0; g < u.u_count; g++) {
        const [x, y, w, h] = u.u_quad.slice(g * 4, g * 4 + 4);
        out.push({ x: L.x + x, y: L.y + y, w, h });
    }
    return out;
}
function glyphs(L, u) {
    const out = [];
    if (!u) return out;
    for (let g = 0; g < u.u_count; g++) {
        const hit = GLYPH_AT.get(Math.round(u.u_g[g * 4] * atlas.size) + ',' + Math.round(u.u_g[g * 4 + 1] * atlas.size));
        out.push(hit || { face: '?', ch: '?' });
    }
    return out;
}
const read = (L, u) => glyphs(L, u).map((g) => g.ch).join('');
const says = (t, id, st) => { const L = layer(t, id); return L ? read(L, L.uniforms(st, 0)) : null; };
const hits = (r, z) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y;
/* a glyph's ink, its cell less the padding the atlas bakes round it */
const inkOf = (L, u) => quads(L, u).map((q, i) => {
    const pad = MTrack.PADEM * (q.h / atlas.faces[glyphs(L, u)[i].face].glyphs[glyphs(L, u)[i].ch].h);
    return { x: q.x + pad, y: q.y + pad, w: q.w - 2 * pad, h: q.h - 2 * pad };
});
const toArt = (x, y) => [(x - T.ART.ox) / T.ART.s, (y - T.ART.oy) / T.ART.s];
const all = (t, base) => t.layers.filter((L) => L.id === base || L.id.indexOf(base + '_') === 0);
const saysAll = (t, base, st) => all(t, base).map((L) => read(L, L.uniforms(st, 0))).join('');

/* ------------------------------------------------------------ the registry */

test('M Track Mode is a style of its own, chosen by name', () => {
    const t = build();
    assert.deepStrictEqual([t.id, t.name, t.hasCentre], ['mtrack', 'M Track Mode', true]);
    assert.strictEqual(Themes.idOf({ style: 'mtrack' }), 'mtrack');
    assert.ok(spec.settings.find((s) => s.key === 'style').options.some((o) => o[0] === 'mtrack' && /M Track Mode/.test(o[1])));
    /* its own adjustments reach its builder under the names it reads */
    const own = Themes.forStyle({ style: 'mtrack', kCentre: 'map', kRow2: 'volts', kRowMark: 'fill', kFootL: 'rpm', mCentre: 'camera' });
    assert.deepStrictEqual([own.centre, own.row2, own.rowMark, own.footL], ['map', 'volts', 'fill', 'rpm']);
    const b = build({ kCentre: 'map', kRow2: 'volts', kRowMark: 'fill', mCentre: 'camera' });
    assert.deepStrictEqual([b.settings.centre, b.settings.rows[1], b.settings.rowMark], ['map', 'volts', 'fill']);
});

/* ---------------------------------------------------- the artboard's fit */

test('the reference frame is fitted uniformly, all of it on the panel and above the strip', () => {
    build();                              /* as the style comes: its gauges, where the frame has them */
    const A = T.ART;
    assert.deepStrictEqual([A.w, A.h], [1582, 579]);
    assert.deepStrictEqual([A.s, A.ox, A.oy], [T.PANEL_FIT.s, T.PANEL_FIT.ox, T.PANEL_FIT.oy]);
    /* everything drawn: from the wing's point to the outside temperature, the title to the footer's figures */
    assert.ok(T.px(110) >= 0 && T.px(1558) <= Panel.PANEL_WIDTH);
    assert.ok(T.py(56) >= 0 && T.py(543) <= Panel.BOTTOM_CUT, 'the footer ends above the car\'s own strip');
    /* the wing stands clear of the tyre-pressure telltale, the strips of the parking brake's */
    const tyre = Panel.TELLTALES[0], brake = Panel.TELLTALES[1];
    assert.ok(T.px(T.WING.v[4][0]) > tyre.x + tyre.w);
    assert.ok(T.px(T.slash(T.STRIP.fuel, T.STRIP.top) + 20) < brake.x);
    /* another fit carries the whole design, and the car's is put back */
    T.setFit({ s: 1, ox: 0, oy: 0 });
    try {
        const n = build({ mtFixture: true });
        assert.deepStrictEqual([n.art.s, n.art.ox, n.art.oy], [1, 0, 0]);
        const w = layer(n, 'wing');
        assert.ok(w.x >= 100 && w.x + w.w <= 700 && w.y >= 70, 'the wing at the frame\'s own coordinates');
    } finally { T.setFit(); }
    assert.deepStrictEqual([T.ART.s, T.ART.ox, T.ART.oy], [T.PANEL_FIT.s, T.PANEL_FIT.ox, T.PANEL_FIT.oy]);
});

/* -------------------------------------------------------------- the body */

function clockwiseConvex(v) {
    for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length], c = v[(i + 2) % v.length];
        if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <= 0) return false;
    }
    return true;
}
test('the body: a pointed wing and three plates, convex, on one lean, a black seam between each', () => {
    const shapes = { wing: T.WING, upper: T.PLATES.upper, lower: T.PLATES.lower, ribbon: T.PLATES.ribbon, band: T.BAND };
    for (const [name, P] of Object.entries(shapes)) {
        assert.ok(clockwiseConvex(P.v), name + ' is a clockwise convex outline');
        assert.strictEqual(P.r.length, P.v.length, name + ': a radius a corner');
        /* every edge is level or on the lean */
        P.v.forEach((a, i) => {
            const b = P.v[(i + 1) % P.v.length], dy = b[1] - a[1];
            if (Math.abs(dy) < 1e-6) return;
            assert.ok(Math.abs(Math.abs((b[0] - a[0]) / dy) - T.K) < 1e-6, `${name}: edge ${i} leans ${(b[0] - a[0]) / dy}`);
        });
    }
    /* the wing comes to a point on the left, half way down, and is the frame's height */
    const tip = T.WING.v[4];
    assert.ok(tip[0] < 115 && Math.abs(tip[1] - (T.BODY.top + T.BODY.bottom) / 2) < 30);
    assert.deepStrictEqual([T.WING.v[0][1], T.WING.v[2][1]], [T.BODY.top, T.BODY.bottom]);
    /* the seams: the wing ends 5 - 6 units before the plates start, the plates before the ribbon */
    for (const y of [120, 180, 320, 430]) {
        const s1 = T.slash(T.LINE.seam1, y) - T.slash(T.LINE.wingRight, y);
        const s2 = T.slash(T.LINE.ribbonLeft, y) - T.slash(T.LINE.seam2, y);
        assert.ok(s1 > 4.5 && s1 < 6 && s2 > 4.5 && s2 < 6, `seams at ${y}: ${s1}, ${s2}`);
        assert.ok(T.roundDist(T.WING.v, T.WING.r, T.slash(T.LINE.wingRight, y) + 2.5, y) > 0, 'the seam is outside the wing');
    }
    /* the black band the gear stands on lies between the two plates, and is no plate */
    assert.deepStrictEqual([T.BAND.v[0][1], T.BAND.v[2][1]], [T.BODY.bandTop, T.BODY.bandBottom]);
    assert.ok(T.BODY.bandBottom - T.BODY.bandTop > 100);
    /* the ribbon comes to its point on the right, above half way */
    const point = T.PLATES.ribbon.v[1];
    assert.ok(point[0] > 990 && point[1] > 250 && point[1] < 262);
    /* the three M bands lie side by side in the wing, each about 64 units across, the red last */
    const B = T.BANDS;
    assert.ok(B.light.u[1] === B.mid.u[0] && B.mid.u[1] === B.red.u[0]);
    for (const b of [B.light, B.mid, B.red]) assert.ok(Math.abs(b.u[1] - b.u[0] - 64) < 1.5);
    assert.ok(B.red.u[1] < T.LINE.wingRight, 'the bands end before the seam');
    /* every fine line is level or on the lean, and each layer's are named */
    for (const [id, L] of Object.entries(T.HAIRLINES)) {
        const dy = L[3] - L[1];
        if (Math.abs(dy) > 1e-6) assert.ok(Math.abs(Math.abs((L[2] - L[0]) / dy) - T.K) < 1e-6, id);
        assert.ok(L[4] > 0 && L[4] <= 0.25, id + ': a fine line is faint');
    }
    for (const list of Object.values(T.HAIR)) list.forEach((id) => assert.ok(T.HAIRLINES[id], id));
});

/* ---------------------------------------------------------- the car's rules */

/* what the car lays over this style on an M car: listed, so the list cannot grow unseen */
const KNOWN_OVERLAPS = ['mCarS58/gear/M box (left)'];

test('nothing below the cut, nothing off the panel, and no reading under a factory box but the one listed', () => {
    const DECOR = /^(back|wing|plates|footPanel|flash|snow\d|tree|revDial|rows|oilStrip|fuelStrip)$/;
    const seen = new Set();
    for (const id of Object.keys(Panel.PROFILES)) for (const kCentre of ['off', 'map']) {
        const zones = Panel.keepClear(id).filter((z) => z.id !== 'bottomStrip');
        const t = build({ profile: id, mtFixture: true, holiday: true, kCentre, kFootL: 'boost', kFootR: 'iat' });
        const st = state(t, Object.assign({}, RAW, { speedKmh: 330, gear: 'M8', ambientC: -22.5, rangeKm: 999 }));
        for (const L of t.layers) {
            if (L.belowCut) assert.strictEqual(L.id, 'back', 'only the ground may be asked below the cut');
            else assert.ok(L.y + L.h <= Panel.BOTTOM_CUT, `${id}/${L.id} reaches ${L.y + L.h}`);
            assert.ok(L.x >= 0 && L.y >= 0 && L.x + L.w <= Panel.PANEL_WIDTH, `${id}/${L.id} off the panel`);
            assert.ok([L.x, L.y, L.w, L.h].every(Number.isInteger), `${id}/${L.id} on whole pixels`);
            if (DECOR.test(L.id)) continue;
            /* a text layer is judged by its glyphs' ink, anything else by its box */
            let ink = [L];
            if (isText(L)) { const u = L.uniforms(st, 0); ink = u ? inkOf(L, u) : []; }
            for (const z of zones) if (ink.some((r) => hits(r, z))) seen.add(`${id}/${L.id}/${z.name}`);
        }
    }
    assert.deepStrictEqual([...seen].sort(), KNOWN_OVERLAPS.slice().sort());
    /* the rev counter's numerals stand clear of the M car's right-hand box at every mark */
    const box = Panel.PROFILES.mCarS58.extraZones.find((b) => b.id === 'mBoxB');
    const t = build({ profile: 'mCarS58' });
    all(t, 'revScale').forEach((L) => assert.ok(!inkOf(L, L.uniforms(state(t, RAW), 0)).some((r) => hits(r, box)), L.id));
});

test('no glyph is hidden behind the cut corners of the glass, and none leaves its layer', () => {
    for (const units of ['imperial', 'metric']) for (const engine of ['petrol', 'diesel']) {
        const t = build({ units, engine, mtFixture: true, clock12: true, kFootM: 'economy', kFootR: 'boost' });
        const st = state(t, Object.assign({}, RAW, { speedKmh: 330, gear: 'M8', ambientC: -22.5, rangeKm: 999, avgL100: 9.6 }));
        for (const L of t.layers.filter(isText)) {
            const u = L.uniforms(st, 0);
            for (const q of (u ? quads(L, u) : [])) {
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]) {
                    assert.ok(!Panel.inCutCorner(x, y), `${L.id} (${units}) in a cut corner`);
                }
                assert.ok(q.x >= L.x - 0.5 && q.y >= L.y - 0.5 && q.x + q.w <= L.x + L.w + 0.5 && q.y + q.h <= L.y + L.h + 0.5,
                    `${L.id} (${units}, ${engine}): a glyph outside its layer: ${JSON.stringify(q)} in ${[L.x, L.y, L.w, L.h]}`);
            }
        }
    }
});

test('the car\'s own lamps are never imitated; the speed limit sign is the reference fixture\'s alone', () => {
    const live = build(), fix = build({ mtFixture: true });
    assert.ok(!live.layers.some((L) => /lamp|limit|belt|brake/i.test(L.id)));
    assert.deepStrictEqual(fix.layers.filter((L) => /limit/.test(L.id)).map((L) => L.id), ['limitSign', 'limitFig']);
    assert.ok(!fix.layers.some((L) => /lamp|belt|brake/i.test(L.id)), 'not even the fixture draws the lamps');
});

/* ----------------------------------------------------------- the shaders */

test('the track shaders fit the budget and avoid what the head unit refuses', () => {
    assert.deepStrictEqual(Object.keys(tShaders).sort(),
        ['mtback', 'mtfoot', 'mtgauge', 'mtgauge10', 'mtgauge6', 'mtgauge7', 'mtgauge9', 'mtplates', 'mtrows', 'mtstrip', 'mtwing']);
    for (const [id, src] of Object.entries(tShaders)) {
        let vectors = 3;                      /* u_size, u_time, u_keep from the prelude */
        for (const m of src.matchAll(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)(\[(\d+)\])?/g)) vectors += m[4] ? Number(m[4]) : 1;
        assert.ok(vectors <= 48, `${id}: ${vectors} vectors`);
        assert.ok(!/\bbreak\b/.test(src), `${id} uses break`);
        assert.ok(!/uniform\s+\w+\s+\w+\[/.test(src) || /uniform\s+vec4\s+\w+\[/.test(src), `${id}: an array of something other than vec4`);
        for (const r of ['u_mvp', 'u_mv', 'u_m', 'u_v', 'u_p', 'u_normal']) {
            assert.ok(!new RegExp(`uniform\\s+\\w+\\s+${r}\\b`).test(src), `${id} declares ${r}`);
        }
        /* the two that flash at the limiter read the clock, and are on its list with the uniform that says so */
        assert.strictEqual(/\bu_time\b/.test(src), /^mtgauge/.test(id), id);
    }
    assert.deepStrictEqual([Clock.GATES.mtgauge, Clock.GATES.mtgauge6], [{ gate: 'u_warn' }, { gate: 'u_warn' }]);
    /* the geometry is in the source as numbers: the lean, the frame's uneven marks, a diesel's even ones */
    assert.ok(tShaders.mtwing.indexOf('const float K = ' + T.K) >= 0);
    T.revMarks().forEach((y) => assert.ok(tShaders.mtgauge.indexOf('abs(p.y - ' + Math.round(y * 1000) / 1000) >= 0, 'mark at ' + y));
    assert.notStrictEqual(tShaders.mtgauge, tShaders.mtgauge6);
});

test('every layer is given exactly the uniforms its shader declares, in the shape it declares, all finite', () => {
    const BUILT_IN = ['u_size', 'u_time', 'u_keep', 'u_atlas', 'u_atlasSize'];
    const want = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
    for (const cfg of [{ mtFixture: true, revFlash: 'both' }, { units: 'metric', kRowMark: 'fill', clock12: true },
                       { engine: 'diesel', kRow1: 'oilp', kRow2: 'volts', kRow3: 'charge', kRow4: 'hvtemp', electric: 'hybrid' },
                       { electric: 'bev', kFootL: 'erange', kFootM: 'charge', kFootR: 'hvtemp' },
                       { kCentre: 'map', bottomExtra: 'hide', holiday: true, intro: true }]) {
        const t = build(cfg);
        const st = state(t, Object.assign({}, RAW, { rpm: 7100, evRangeKm: 43, socPct: 78, hvTempC: 26 }),
                         { centre: { mode: 'neutral', open: 0, maneuver: null }, sinceOn: 3, now: 5000 });
        for (const L of t.layers) {
            const src = allShaders[L.shader];
            assert.ok(src, `${L.id}: no shader called ${L.shader}`);
            const u = L.uniforms(st, 0);
            if (!u) continue;
            const declared = [...src.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1]).filter((k) => !BUILT_IN.includes(k)).sort();
            assert.deepStrictEqual(Object.keys(u).sort(), declared, `${L.id} (${L.shader})`);
            for (const [name, v] of Object.entries(u)) {
                const list = typeof v === 'number' ? [v] : Array.from(v);
                assert.ok(list.every((x) => typeof x === 'number' && isFinite(x)), `${L.id}.${name}: ${JSON.stringify(v)}`);
                const m = src.match(new RegExp('uniform\\s+(\\w+)\\s+' + name + '(?:\\[(\\d+)\\])?\\s*;'));
                assert.strictEqual(list.length, m[2] ? 4 * Number(m[2]) : want[m[1]], `${L.id}.${name}: ${list.length} numbers for ${m[0]}`);
            }
        }
    }
});

test('with everything switched on the style stays inside the layer budget, no two layers sharing a name', () => {
    for (const cfg of [{ mtFixture: true, holiday: true, revFlash: 'both', intro: true, clock12: true, bottomExtra: 'hide',
                         kFootL: 'boost', kFootM: 'range', kFootR: 'iat' },
                       { units: 'metric', holiday: true, intro: true, kFootL: 'economy', kFootM: 'coolant', kFootR: 'volts',
                         kRow1: 'charge', kRow2: 'hvtemp' }]) {
        const t = build(cfg);
        assert.ok(t.layers.length <= 64, `${t.layers.length} layers`);
        assert.strictEqual(new Set(t.layers.map((L) => L.id)).size, t.layers.length);
    }
    assert.ok(build().layers.length <= 40, 'as it comes: ' + build().layers.length);
});

test('a drive: every layer finite at every moment, its glyphs inside it, whatever the units', () => {
    for (const units of ['imperial', 'metric']) {
        const t = build({ units, clock12: units === 'imperial' });
        const sim = Sim.create(PROFILE);
        for (let i = 0; i < 1500; i++) {
            sim.step(1 / 60);
            if (i % 25) continue;
            const st = state(t, sim.raw(), { centre: i % 50 ? OPEN : { mode: 'neutral', open: 0, maneuver: null }, now: i * 16 });
            for (const L of t.layers) {
                const u = L.uniforms(st, 0);
                if (!u) continue;
                for (const [k, v] of Object.entries(u)) {
                    const list = typeof v === 'number' ? [v] : Array.from(v);
                    assert.ok(list.every((x) => typeof x === 'number' && isFinite(x)), `${L.id}.${k} at frame ${i}`);
                }
                if (isText(L)) quads(L, u).forEach((q) => assert.ok(q.x >= L.x - 0.5 && q.x + q.w <= L.x + L.w + 0.5 &&
                    q.y >= L.y - 0.5 && q.y + q.h <= L.y + L.h + 0.5, `${L.id} at frame ${i}: ${read(L, u)}`));
            }
        }
    }
});

/* ------------------------------------------------------ the rev counter */

test('the rev scale: the frame\'s marks, uneven as measured, and a value found between the two either side', () => {
    const m = T.revMarks();
    assert.strictEqual(m.length, 9);
    for (let k = 0; k < 8; k++) {
        const gap = m[k] - m[k + 1];
        assert.ok(Math.abs(gap - (k < 5 ? T.TACH.low : T.TACH.high)) < 1e-9, `between ${k} and ${k + 1}: ${gap}`);
    }
    assert.ok(T.TACH.low > T.TACH.high, 'the marks stand closer above 5,000');
    for (let k = 0; k <= 8; k++) assert.ok(Math.abs(T.revY(k * 1000, m) - m[k]) < 1e-9);
    assert.ok(Math.abs(T.revY(840, m) - 424.76) < 0.01, 'the frame\'s 840 rpm is where its marker is');
    assert.ok(Math.abs(T.revY(5500, m) - (m[5] + m[6]) / 2) < 1e-9);
    /* never off the scale */
    assert.deepStrictEqual([T.revY(-50, m), T.revY(12000, m), T.revY(undefined, m)], [m[0], m[8], m[0]]);
    let prev = Infinity;
    for (let rpm = 0; rpm <= 8000; rpm += 125) { const y = T.revY(rpm, m); assert.ok(y < prev); prev = y; }
    /* the scale stands between the level top line and the lit band's foot */
    assert.ok(m[8] > T.TACH.top.y1 + 15 && m[0] < T.TACH.base.foot - 10);
});

test('the marker and the lit band follow the revs; the red field runs from the top mark down to the redline', () => {
    const t = build({ rpmRedline: 7000 }), L = layer(t, 'revDial'), m = T.revMarks();
    assert.strictEqual(L.shader, 'mtgauge');
    for (const rpm of [0, 840, 3000, 5000, 6400, 7900]) {
        assert.ok(Math.abs(L.uniforms(state(t, { rpm }), 0).u_ym - T.revY(rpm, m)) < 1e-9, 'at ' + rpm);
    }
    assert.ok(Math.abs(L.uniforms(state(t, {}), 0).u_red - m[7]) < 1e-9);
    /* as the car's: Car profile values' own field starts at 6,750 */
    const own = build(), red = layer(own, 'revDial').uniforms(state(own, {}), 0).u_red;
    assert.ok(Math.abs(red - T.revY(PROFILE.rpmRedline, m)) < 1e-9 && red > m[7] && red < m[6]);
    /* the frame's own: about 7,600, a short stroke under its 8 */
    const fix = build({ mtFixture: true, rpmRedline: 7620 });
    const fr = layer(fix, 'revDial').uniforms(state(fix, {}), 0).u_red;
    assert.ok(fr - m[8] > 14 && fr - m[8] < 18, 'a field ' + (fr - m[8]) + ' units long');
    /* the dial's layer holds all of it: the top line, the rail, the foot and the rail under the body */
    const [x0, y0] = toArt(L.x, L.y), [x1, y1] = toArt(L.x + L.w, L.y + L.h);
    assert.ok(x0 <= T.TACH.base.railLeft && y0 <= T.TACH.top.y0 - 1 && x1 >= T.railX(T.TACH.top.y0) + 2 && y1 >= T.TACH.base.foot + 1);
});

test('the numerals: one a mark, level with it, right of the rail; the frame\'s nine where the frame has them', () => {
    const t = build({ mtFixture: true }), st = state(t, {}), m = T.revMarks();
    /* (three to a layer, each layer the size of its own three: the renderer fills a layer's every pixel) */
    const parts = all(t, 'revScale');
    assert.strictEqual(parts.length, 3);
    assert.strictEqual(saysAll(t, 'revScale', st), '876543210');
    let i = 0;
    parts.forEach((L) => {
        const u = L.uniforms(st, 0);
        assert.strictEqual(L.shader, 'text');
        assert.ok(glyphs(L, u).every((g) => g.face === 'mw'), 'the dials\' own figures');
        inkOf(L, u).forEach((q) => {
            const k = 8 - i++, [ax, ay] = toArt(q.x, q.y + q.h / 2);
            assert.ok(Math.abs(ay - m[k]) < 1.2, `${k} stands ${ay - m[k]} off its mark`);
            const off = ax - T.railX(m[k]);
            assert.ok(off > 14 && off < 22, `${k} starts ${off} from the rail`);
        });
        /* its box is its own glyphs' and no more */
        const qs = quads(L, u), x0 = Math.min(...qs.map((q) => q.x)), x1 = Math.max(...qs.map((q) => q.x + q.w));
        const y0 = Math.min(...qs.map((q) => q.y)), y1 = Math.max(...qs.map((q) => q.y + q.h));
        assert.ok(x0 - L.x >= 0 && x0 - L.x < 3 && L.x + L.w - x1 >= 0 && L.x + L.w - x1 < 3 && y0 - L.y < 3 && L.y + L.h - y1 < 3, L.id + ' is snug');
    });
    assert.strictEqual(i, 9);
    /* the title over it, and no numeral lights or grows: the frame's all stand alike */
    assert.strictEqual(says(t, 'revTitle', st), '1/minx1000');
});

test('a diesel: seven marks spread evenly over the same height, its own limits, the same dial otherwise', () => {
    const m = T.revMarks('diesel'), p = T.revMarks();
    assert.strictEqual(m.length, 7);
    assert.ok(Math.abs(m[0] - p[0]) < 1e-9 && Math.abs(m[6] - p[8]) < 1e-9, 'from the frame\'s 0 to its 8');
    for (let k = 0; k < 6; k++) assert.ok(Math.abs((m[k] - m[k + 1]) - (m[0] - m[6]) / 6) < 1e-9);
    const t = build({ engine: 'diesel' }), L = layer(t, 'revDial');
    assert.strictEqual(L.shader, 'mtgauge6');
    assert.strictEqual(saysAll(t, 'revScale', state(t, {})), '6543210');
    assert.ok(Math.abs(L.uniforms(state(t, { rpm: 3000 }), 0).u_ym - m[3]) < 1e-9, '3,000 is half way up a diesel\'s');
    assert.ok(Math.abs(L.uniforms(state(t, {}), 0).u_red - T.revY(4500, m)) < 1e-9, 'red from 4,500');
    assert.strictEqual(t.settings.rpmLimiter, 5000);
    all(t, 'revScale').reduce((acc, N) => acc.concat(inkOf(N, N.uniforms(state(t, {}), 0))), []).forEach((q, i) => {
        const k = 6 - i, [ax, ay] = toArt(q.x, q.y + q.h / 2);
        assert.ok(Math.abs(ay - m[k]) < 1.2 && ax - T.railX(m[k]) > 14 && ax - T.railX(m[k]) < 22, 'numeral ' + k);
    });
    /* and a petrol's dial is the frame's */
    assert.strictEqual(layer(build(), 'revDial').shader, 'mtgauge');
});

test('the limiter flashes the lit band and the edges only when asked, on the clock the car is sent', () => {
    for (const [revFlash, band, edges] of [['both', true, true], ['band', true, false], ['edges', false, true], ['off', false, false]]) {
        const t = build({ revFlash }), st = state(t, { rpm: 7100 });
        assert.ok(st.limiter > 0.5);
        const u = layer(t, 'revDial').uniforms(st, 0);
        assert.strictEqual(u.u_warn > 0, band, revFlash + ': the band');
        assert.strictEqual(Clock.running('mtgauge', u), band);
        assert.strictEqual(!!layer(t, 'flash'), edges, revFlash + ': the edges');
        assert.strictEqual(layer(t, 'revDial').uniforms(state(t, { rpm: 3000 }), 0).u_warn, 0);
    }
});

/* -------------------------------------------------------- the gauge rows */

test('the four rows as they come are the frame\'s: boost, coolant, oil, intake air, each on the frame\'s own scale', () => {
    const t = build({ units: 'metric' }), st = state(t, RAW);
    assert.deepStrictEqual(t.rows, ['boost', 'coolant', 'oil', 'iat']);
    assert.strictEqual(saysAll(t, 'rowLabels', st), ['0.0', '0.9', '1.9', '70', '100', '130', '50', '100', '150', '-20', '15', '50'].join(''));
    assert.strictEqual(saysAll(t, 'rowUnits', st), 'bar°C°C°C');
    assert.strictEqual(saysAll(t, 'rowIcons', st), 'uwoa');
    assert.ok(all(t, 'rowIcons').every((L) => glyphs(L, L.uniforms(st, 0)).every((g) => g.face === 'mt')));
    /* in miles: psi and Fahrenheit, round figures at the same three places */
    const i = build({ units: 'imperial' });
    assert.strictEqual(saysAll(i, 'rowLabels', state(i, RAW)), ['0', '14', '28', '160', '210', '260', '120', '210', '300', '0', '60', '120'].join(''));
    assert.strictEqual(saysAll(i, 'rowUnits', state(i, RAW)), 'psi°F°F°F');
    /* the rows are a pitch apart; each row's figures stand over its own rail, its symbol before it */
    const R = T.ROWS, L = all(t, 'rowLabels')[0], ink = inkOf(L, L.uniforms(st, 0));
    const first = toArt(ink[0].x, ink[0].y + ink[0].h);
    assert.ok(Math.abs(first[1] - (T.rowTop(0) + R.labelDy)) < 1 && Math.abs(first[0] - 281) < 2.5, 'the first figure: ' + first);
    const icons = all(t, 'rowIcons')[0], iq = inkOf(icons, icons.uniforms(st, 0));
    iq.forEach((q, n) => {
        const [cx, cy] = toArt(q.x + q.w / 2, q.y + q.h / 2);
        assert.ok(Math.abs(cx - R.iconX) < 0.6 && Math.abs(cy - (T.rowTop(n) + R.iconDy)) < 0.6, `symbol ${n}: ${cx}, ${cy}`);
        assert.ok(q.x + q.w < T.px(R.xs) - 20, 'left of its rail');
    });
});

test('a row\'s mark stands at its reading, clamped to the rail, and is not there with nothing to read', () => {
    const t = build({ units: 'metric' }), L = layer(t, 'rows');
    const at = (raw) => L.uniforms(state(t, raw), 0).u_val;
    const v = at({ boostBar: 0.95, coolantC: 100, oilTempC: 75, iatC: 15 });
    [0.5, 0.5, 0.25, 0.5].forEach((want, i) => assert.ok(Math.abs(v[i] - want) < 1e-9, `row ${i + 1}: ${v[i]}`));
    assert.deepStrictEqual(at({ boostBar: -0.4, coolantC: 20, oilTempC: 190, iatC: 80 }), [0, 0, 1, 1], 'off the scale: at its end');
    assert.deepStrictEqual(at({}), [-1, -1, -1, -1], 'no reading: no mark');
    assert.deepStrictEqual(at({ coolantC: 85 }).map((x) => x >= 0), [false, true, false, false]);
    /* the same readings on the imperial scales: 14 psi is the middle, 210 F is the middle */
    const i = build({ units: 'imperial' }), vi = layer(i, 'rows').uniforms(state(i, { boostBar: 14 / 14.503774, coolantC: (210 - 32) / 1.8 }), 0).u_val;
    assert.ok(Math.abs(vi[0] - 0.5) < 1e-6 && Math.abs(vi[1] - 0.5) < 1e-6);
    /* where a line is coloured: the frame's coolant turns red for its last eighth, its oil is blue at first and red at last */
    const u = L.uniforms(state(t, RAW), 0);
    assert.deepStrictEqual([u.u_cold[0], u.u_cold[1], u.u_cold[3]], [0, 0, 0]);
    assert.ok(u.u_hot[0] > 1 && u.u_hot[3] > 1, 'boost and intake air: one colour');
    assert.ok(Math.abs(u.u_hot[1] - 0.867) < 0.01 && Math.abs(u.u_cold[2] - 0.16) < 0.01 && Math.abs(u.u_hot[2] - 0.845) < 0.01);
    assert.deepStrictEqual(u.u_on, [1, 1, 1, 1]);
    /* as the frame has it the rail stays whole; the other way the rail past the mark stands back */
    assert.strictEqual(u.u_fill, 0);
    assert.strictEqual(layer(build({ kRowMark: 'fill' }), 'rows').uniforms(state(t, RAW), 0).u_fill, 1);
    /* the mark at 0 starts at the rail's own start, as the frame's does on its boost row */
    assert.ok(tShaders.mtrows.indexOf('clamp(' + T.ROWS.xs) >= 0);
});

test('each row can be given any reading, or left out: its figures, unit, symbol and mark follow', () => {
    const scales = MTrack.rowScales(Units.of({ units: 'metric' }));
    assert.deepStrictEqual(Object.keys(scales).concat(['off']), MTrack.ROW_KINDS);
    for (const [kind, sc] of Object.entries(scales)) {
        assert.strictEqual(sc.marks.length, 3, kind);
        /* a symbol, or (the gearbox oil) a word in the footer's capitals in its place */
        assert.ok(sc.icon ? atlas.faces.mt.glyphs[sc.icon] : sc.tag.split('').every((ch) => atlas.faces.mb.glyphs[ch]), kind + ': its symbol is in the atlas');
        const face = atlas.faces[sc.unitFace || 'ms'];
        assert.ok(sc.unit.split('').every((ch) => face.glyphs[ch]), kind + ': its unit can be written');
        assert.ok(sc.marks.join('').split('').every((ch) => atlas.faces.mn.glyphs[ch]), kind + ': its figures can be written');
        /* the figures are the scale's own ends */
        assert.ok(Math.abs(Number(sc.marks[0]) - sc.lo) < 1e-9 && Math.abs(Number(sc.marks[2]) - sc.hi) < 1e-9, kind);
        const imp = MTrack.rowScales(Units.of({ units: 'imperial' }))[kind];
        assert.ok(Math.abs(Number(imp.marks[0]) - imp.lo) < 1e-9 && Math.abs(Number(imp.marks[2]) - imp.hi) < 1e-9, kind + ' (imperial)');
    }
    const t = build({ units: 'metric', kRow1: 'oilp', kRow2: 'volts', kRow3: 'off', kRow4: 'charge', electric: 'hybrid' });
    const st = state(t, Object.assign({}, RAW, { socPct: 78 }));
    assert.deepStrictEqual(t.rows, ['oilp', 'volts', 'off', 'charge']);
    assert.strictEqual(saysAll(t, 'rowLabels', st), ['0', '5', '10', '10', '13', '16', '0', '50', '100'].join(''));
    assert.strictEqual(saysAll(t, 'rowUnits', st) + saysAll(t, 'rowUnitsX', st), 'barv%');
    assert.strictEqual(saysAll(t, 'rowIcons', st), 'pvc');
    const u = layer(t, 'rows').uniforms(st, 0);
    assert.deepStrictEqual(u.u_on, [1, 1, 0, 1]);
    assert.ok(Math.abs(u.u_val[0] - 0.42) < 1e-9 && Math.abs(u.u_val[1] - (14.1 - 10) / 6) < 1e-9 && u.u_val[2] === -1 &&
        Math.abs(u.u_val[3] - 0.78) < 1e-9);
    /* the engine unit is asked only for what a row or the footer shows */
    assert.deepStrictEqual(t.shows, { oil: true, boost: false, iat: false, volts: true });
    assert.deepStrictEqual(build().shows, { oil: false, boost: true, iat: true, volts: false });
    assert.deepStrictEqual(build({ kRow1: 'off', kRow4: 'off', kFootR: 'iat' }).shows, { oil: false, boost: false, iat: true, volts: false });
    /* all four left out: no rows at all */
    const none = build({ kRow1: 'off', kRow2: 'off', kRow3: 'off', kRow4: 'off' });
    assert.ok(!none.layers.some((L) => /^row/.test(L.id)));
    /* an electric car, as it comes: its battery's charge and temperature in place of an engine's readings */
    assert.deepStrictEqual(build({ electric: 'bev' }).rows, ['charge', 'hvtemp', 'off', 'off']);
    assert.deepStrictEqual(build({ electric: 'bev', kRow3: 'volts' }).rows, ['charge', 'hvtemp', 'volts', 'off']);
});

test('the reference fixture: the frame\'s own state - a mark in the boost row alone, every rail whole', () => {
    const t = build({ mtFixture: true, units: 'metric', rpmRedline: 7620 });
    const st = state(t, { rpm: 840, speedKmh: 0, gear: 'D', fuelPct: 54.7, oilTempC: 75.2, boostBar: 0,
                          rangeKm: 402, ambientC: 21.0, clock: { h: 19, m: 2 } });
    const u = layer(t, 'rows').uniforms(st, 0);
    assert.deepStrictEqual(u.u_val, [0, -1, -1, -1]);
    assert.strictEqual(u.u_fill, 0);
    assert.strictEqual(says(t, 'gear', st), 'D');
    assert.strictEqual(says(t, 'speed', st), '0');
    assert.strictEqual(says(t, 'footL', st), '19:02');
    assert.strictEqual(says(t, 'footM', st) + says(t, 'footMUnit', st), '402km');
    assert.strictEqual(says(t, 'footR', st) + says(t, 'footRUnit', st), '+21.0°C');
    assert.strictEqual(says(t, 'limitFig', st), '70');
    /* and a live build marks every row that has a reading */
    const live = build({ units: 'metric' });
    assert.ok(layer(live, 'rows').uniforms(state(live, RAW), 0).u_val.every((v) => v >= 0));
});

test('the state carries each reading as a number, in the car\'s own units - for the style that asks, and no other', () => {
    const N = { numbers: true };
    const st = State.present(RAW, PROFILE, N);
    assert.deepStrictEqual(st.num, { boostBar: 0.8, coolantC: 92, oilC: 100, iatC: 30, oilBar: 4.2, volts: 14.1, socPct: null, hvC: null, gearboxC: null });
    assert.deepStrictEqual(State.present({}, PROFILE, N).num,
        { boostBar: null, coolantC: null, oilC: null, iatC: null, oilBar: null, volts: null, socPct: null, hvC: null, gearboxC: null });
    const ev = State.present({ socPct: 64, hvTempC: 26 }, PROFILE, { electric: 'bev', numbers: true }).num;
    assert.deepStrictEqual([ev.socPct, ev.hvC], [64, 26]);
    assert.deepStrictEqual(State.present({ socPct: 64, hvTempC: 26 }, PROFILE, N).num.socPct, null, 'not unless electric range is on');
    /* M Track Mode asks; the other styles are made nothing they do not read */
    assert.strictEqual(build().settings.numbers, true);
    assert.ok(state(build(), RAW).num);
    for (const style of ['toro', 'track', 'mplus']) {
        const t = Themes.build(atlas, 'carprofile', { style });
        assert.strictEqual(State.present(RAW, t.profile, t.settings).num, null, style);
    }
    /* and a car that is not electric shares one empty gauge for its battery's two, frame after frame */
    const a = State.present(RAW, PROFILE, {}), b = State.present(RAW, PROFILE, {});
    assert.strictEqual(a.pods.battery, b.pods.battery);
    assert.strictEqual(a.pods.battery, a.pods.batteryTemp);
    assert.deepStrictEqual(a.pods.battery, { frac: 0, warn: 2, alarm: 0, text: '--', col: [0.878, 0.945, 1.0] });
    assert.notStrictEqual(State.present({ socPct: 50 }, PROFILE, { electric: 'hybrid' }).pods.battery, a.pods.battery);
});

/* ------------------------------------------------------ the wing's window */

test('the window is in the left wing and nowhere else, soft at every edge', () => {
    build({ kCentre: 'waze', kWing: 'slot' });      /* the style kept where it is: the picture begins where the car's does */
    const W = T.WINDOW;
    /* nothing outside the wing: over it, under it, left of where the picture begins, past the seam */
    for (const [x, y] of [[400, T.BODY.top - 1], [400, T.BODY.bottom + 1], [W.x0 - 1, 280], [150, 300],
                          [T.slash(T.LINE.wingRight, 200) + 0.5, 200], [700, 150], [800, 250], [800, 350], [960, 300]]) {
        assert.strictEqual(T.revealAt(x, y), 0, `at ${x}, ${y}`);
    }
    /* all of it in the middle */
    for (const [x, y] of [[360, 280], [450, 200], [420, 350], [560, 180]]) assert.strictEqual(T.revealAt(x, y), 1, `at ${x}, ${y}`);
    /* it rises without a step from each edge: never more than a unit's worth a unit */
    for (const y of [150, 280, 400]) {
        let prev = 0;
        for (let x = W.x0 - 2; x < T.slash(T.LINE.wingRight, y) + 2; x += 0.5) {
            const r = T.revealAt(x, y);
            assert.ok(Math.abs(r - prev) < 0.06, `a step at ${x}, ${y}`);
            prev = r;
        }
        assert.strictEqual(prev, 0);
    }
    for (const x of [340, 450]) {
        let prev = 0;
        for (let y = T.BODY.top - 2; y < T.BODY.bottom + 2; y += 0.5) {
            const r = T.revealAt(x, y);
            assert.ok(Math.abs(r - prev) < 0.06, `a step at ${x}, ${y}`);
            prev = r;
        }
    }
    /* inside the wing's own outline everywhere it shows at all */
    for (let y = 100; y < 460; y += 6) for (let x = 100; x < 760; x += 6) {
        if (T.revealAt(x, y) > 0) assert.ok(T.roundDist(T.WING.v, T.WING.r, x, y) < 0, `outside the wing at ${x}, ${y}`);
    }
    /* the shaders work from the same figures */
    for (const id of ['mtback', 'mtwing']) {
        for (const v of [W.featherL, W.featherT, W.featherB, W.featherR]) {
            assert.ok(tShaders[id].indexOf(String(v) + (Number.isInteger(v) ? '.0' : '')) >= 0, `${id}: ${v}`);
        }
        assert.ok(/uniform float u_open;/.test(tShaders[id]));
        /* where the window begins is the layout's to say (it moves when the style is lowered): a uniform */
        assert.ok(/uniform float u_winX;/.test(tShaders[id]) && tShaders[id].includes('(p.x - u_winX) / ' + W.featherL + '.0'), id);
        const kept = build({ kCentre: 'waze', kWing: 'slot' });
        assert.strictEqual(layer(kept, id === 'mtback' ? 'back' : 'wing').uniforms(state(kept, RAW, { centre: OPEN })).u_winX, W.x0,
            'the style kept where it is: where the car\'s picture begins');
    }
    assert.strictEqual(T.windowX0(), W.x0);
    assert.ok(!/u_open/.test(tShaders.mtplates) && !/u_open/.test(tShaders.mtgauge), 'nothing right of the seam opens');
});

test('on the panel the window is inside BMW\'s map slot, where the phone\'s map and the camera land', () => {
    const SLOT = { x: 416, y: 120, w: 1088, h: 480 };
    const t = build({ kCentre: 'waze', kWing: 'slot' }), w = t.window;
    assert.strictEqual(t.wingWhole, false);
    assert.ok(w.x >= SLOT.x && w.y >= SLOT.y && w.x + w.w <= SLOT.x + SLOT.w && w.y + w.h <= SLOT.y + SLOT.h, JSON.stringify(w));
    /* point by point: wherever the picture shows at all, the slot is under it */
    for (let y = 0; y < Panel.BOTTOM_CUT; y += 4) for (let x = 0; x < Panel.PANEL_WIDTH; x += 4) {
        const [ax, ay] = toArt(x, y);
        if (T.revealAt(ax, ay) > 0) assert.ok(x >= SLOT.x && x < SLOT.x + SLOT.w && y >= SLOT.y && y < SLOT.y + SLOT.h, `${x}, ${y}`);
    }
    /* the picture begins where the gauge rows do: at this fit the slot's edge is at the rows' first figures */
    assert.ok(Math.abs(toArt(SLOT.x, 0)[0] - T.ROWS.labelX[0]) < 4);
    assert.ok(T.WINDOW.x0 >= toArt(SLOT.x, 0)[0]);
});

test('the whole wing: with a picture chosen the style stands inside the car\'s picture, and the window is the wing\'s own shape, to its point', () => {
    const SLOT = T.SLOT, W = T.WINDOW;
    /* as it comes, with a picture chosen: stood right until the wing's point is just left of the picture's edge - nothing else moved */
    const t = build({ kCentre: 'waze' });
    assert.strictEqual(t.wingWhole, true);
    assert.strictEqual(t.settings.wing, 'whole');
    assert.deepStrictEqual([T.ART.s, T.ART.oy], [T.PANEL_FIT.s, T.PANEL_FIT.oy], 'the same size, the same height');
    /* the window's own point (its two left edges, kept W.insetL inside the wing's, where they meet) stands on the picture's edge */
    assert.ok(Math.abs(T.px(T.windowPoint()) - (SLOT.x + 0.5)) < 1e-9);
    const out = SLOT.x - T.px(T.wingPoint());
    assert.ok(out > 0 && out < 8, 'the wing\'s rounded point is ' + out.toFixed(1) + ' px left of the picture, where nothing opens');
    assert.ok(T.ART.ox - T.PANEL_FIT.ox > 180 && T.ART.ox - T.PANEL_FIT.ox < 200, 'some 190 px further right');
    /* the window: nowhere outside the wing's own outline, nowhere outside the picture, whole in the wing's middle - its left third included */
    let most = 0;
    for (let y = 0; y < Panel.BOTTOM_CUT; y += 3) for (let x = 0; x < Panel.PANEL_WIDTH; x += 3) {
        const [ax, ay] = toArt(x, y), r = T.revealAt(ax, ay);
        if (!(r > 0)) continue;
        most = Math.max(most, r);
        assert.ok(x >= SLOT.x && x < SLOT.x + SLOT.w && y >= SLOT.y && y < SLOT.y + SLOT.h, `open outside the picture at ${x}, ${y}`);
        assert.ok(T.roundDist(T.WING.v, T.WING.r, ax, ay) < 0, `open outside the wing at ${x}, ${y}`);
    }
    assert.strictEqual(most, 1);
    for (const [x, y] of [[200, 300], [240, 200], [240, 390], [300, 150], [330, 390], [450, 280], [560, 200]]) {
        assert.strictEqual(T.revealAt(x, y), 1, `whole at ${x}, ${y}`);
    }
    /* no straight edge: its left side is the wing's two edges, kept W.insetL inside them and in over W.featherL */
    const up = (d, y) => T.slash(T.LINE.wingUp, y) + d / T.COS, low = (d, y) => T.back(T.LINE.wingLow, y) + d / T.COS;
    for (const y of [140, 180, 220]) {
        assert.strictEqual(T.revealAt(up(W.insetL - 0.5, y), y), 0, 'shut at the edge');
        const half = T.revealAt(up(W.insetL + W.featherL / 2, y), y);
        assert.ok(Math.abs(half - 0.5) < 0.02, `half way in at the half of its fade (${half})`);
        assert.strictEqual(T.revealAt(up(W.insetL + W.featherL + 0.5, y), y), 1);
    }
    for (const y of [340, 360, 385]) {                  /* (above where the foot's own fade begins) */
        assert.strictEqual(T.revealAt(low(W.insetL - 0.5, y), y), 0);
        assert.ok(Math.abs(T.revealAt(low(W.insetL + W.featherL / 2, y), y) - 0.5) < 0.02);
        assert.strictEqual(T.revealAt(low(W.insetL + W.featherL + 0.5, y), y), 1);
    }
    /* the layout tells the shaders there is no upright edge, and they carry the wing's two */
    const open = state(t, RAW, { centre: OPEN });
    for (const id of ['back', 'wing']) assert.ok(layer(t, id).uniforms(open, 0).u_winX < -500, id);
    for (const id of ['mtback', 'mtwing']) {
        assert.ok(tShaders[id].includes('(u - ' + T.LINE.wingUp + ') * COSK - ' + W.insetL + '.0) / ' + W.featherL + '.0'), id);
        assert.ok(tShaders[id].includes('(p.x - K * p.y - ' + T.LINE.wingLow + ') * COSK - ' + W.insetL + '.0) / ' + W.featherL + '.0'), id);
    }
    /* everything is still on the screen: the right-hand footer place moved in, the fuel strip inside the edge */
    const far = state(t, Object.assign({}, RAW, { ambientC: -22.5, speedKmh: 330, gear: 'M8' }), { centre: OPEN });
    for (const L of t.layers) {
        assert.ok(L.x >= 0 && L.x + L.w <= Panel.PANEL_WIDTH && L.w > 0, `${L.id}: ${L.x}..${L.x + L.w}`);
        if (!isText(L)) continue;
        const u = L.uniforms(far, 0);
        if (u) quads(L, u).forEach((q) => assert.ok(q.x >= L.x - 0.5 && q.x + q.w <= L.x + L.w + 0.5, `${L.id}: ${read(L, u)}`));
    }
    const ST = T.STRIP, fuelEnd = T.px(T.slash(ST.fuel, ST.top) + ST.ladderW + ST.gap + ST.lineW);
    assert.ok(fuelEnd <= Panel.PANEL_WIDTH - 5, 'the fuel strip ends ' + (Panel.PANEL_WIDTH - fuelEnd).toFixed(1) + ' px inside the screen');
    assert.ok(t.window.x >= SLOT.x && t.window.x + t.window.w <= SLOT.x + SLOT.w);
    /* the holiday dressing: snow in the wider room on the left, and no tree (there is no room on the right) */
    const h = build({ kCentre: 'waze', holiday: true });
    assert.deepStrictEqual(h.layers.filter((L) => /^snow/.test(L.id)).map((L) => [L.x, L.x + L.w > 380]), [[0, true]]);
    assert.ok(!layer(h, 'tree'));

    /* only where it can be: not without a picture, not lowered, not on a car whose own boxes would land on the gear */
    assert.strictEqual(build().wingWhole, false);
    assert.deepStrictEqual([T.ART.s, T.ART.ox, T.ART.oy], [T.PANEL_FIT.s, T.PANEL_FIT.ox, T.PANEL_FIT.oy], 'with its gauges the style is where the frame has it');
    assert.strictEqual(build({ kCentre: 'waze', kWing: 'slot' }).wingWhole, false);
    assert.strictEqual(T.ART.ox, T.PANEL_FIT.ox);
    assert.strictEqual(build({ kCentre: 'waze', lower: 40 }).wingWhole, false);
    assert.strictEqual(build({ kCentre: 'waze', profile: 'mCarS58' }).wingWhole, false);
    for (const id of ['carprofile', 'b58', 'hybrid']) {
        const zones = Panel.keepClear(id).filter((z) => z.id !== 'bottomStrip');
        const w = build({ kCentre: 'map', profile: id, kFootL: 'boost', kFootR: 'iat' });
        assert.strictEqual(w.wingWhole, true, id);
        const st = state(w, Object.assign({}, RAW, { speedKmh: 330, gear: 'M8', ambientC: -22.5, rangeKm: 999 }));
        for (const L of w.layers.filter((q) => isText(q))) {
            const u = L.uniforms(st, 0);
            if (u) for (const z of zones) assert.ok(!inkOf(L, u).some((r) => hits(r, z)), `${id}: ${L.id} under ${z.name}`);
        }
    }
    build();
});

test('with a picture chosen the wing opens for it and the gauge rows give way; chosen or not, the rest never changes', () => {
    const closed = { mode: 'neutral', open: 0, maneuver: null };
    for (const kCentre of ['waze', 'map', 'camera']) {
        const t = build({ kCentre });
        assert.strictEqual(t.settings.centre, kCentre);
        const shut = state(t, RAW, { centre: closed }), open = state(t, RAW, { centre: { mode: kCentre === 'camera' ? 'camera' : 'map', open: 1 } });
        const half = state(t, RAW, { centre: { mode: 'map', open: 0.5 } });
        for (const id of ['back', 'wing']) {
            assert.deepStrictEqual([shut, half, open].map((s) => layer(t, id).uniforms(s, 0).u_open), [0, 0.5, 1], id);
        }
        /* the phone's map chosen but not on the cluster: the gauges, whole */
        assert.strictEqual(layer(t, 'rows').uniforms(shut, 0).u_fade, 1);
        assert.strictEqual(saysAll(t, 'rowIcons', shut), 'uwoa');
        /* open: no rail, no figure, no unit, no symbol - nothing of a row is drawn on the picture */
        assert.strictEqual(layer(t, 'rows').uniforms(open, 0), null);
        for (const L of t.layers.filter((q) => /^row/.test(q.id))) assert.strictEqual(L.uniforms(open, 0), null, L.id);
        /* half way: both, each at half strength */
        assert.strictEqual(layer(t, 'rows').uniforms(half, 0).u_fade, 0.5);
        all(t, 'rowLabels').forEach((L) => assert.strictEqual(L.uniforms(half, 0).u_color[3], 0.5));
        /* everything else is the same layer giving the same uniforms, open or shut */
        for (const L of t.layers.filter((q) => !/^(row|back$|wing$)/.test(q.id))) {
            assert.deepStrictEqual(L.uniforms(open, 0), L.uniforms(shut, 0), L.id + ' changed with the window');
        }
    }
    /* as it comes the wing holds the gauges: nothing opens, whatever the centre says */
    const t = build();
    assert.strictEqual(t.settings.centre, 'off');
    /* (the service only opens a window for a style that asks for a picture: src/car/main.js) */
    assert.strictEqual(spec.settings.find((s) => s.key === 'kCentre').default, 'off');
    /* a turn card is the M View styles': here it is not a choice */
    assert.strictEqual(build({ kCentre: 'turn' }).settings.centre, 'off');
});

test('no reading stands where the picture shows', () => {
    for (const cfg of [{ kCentre: 'map' }, { kCentre: 'camera', units: 'metric', kFootL: 'boost', kFootM: 'economy', kFootR: 'iat' },
                       { kCentre: 'waze', engine: 'diesel' }]) {
        const t = build(cfg);
        const st = state(t, Object.assign({}, RAW, { speedKmh: 330, gear: 'M8', avgL100: 9.6 }), { centre: OPEN });
        for (const L of t.layers.filter(isText)) {
            const u = L.uniforms(st, 0);
            for (const q of (u ? inkOf(L, u) : [])) {
                for (const [x, y] of [[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h], [q.x + q.w / 2, q.y + q.h / 2]]) {
                    const [ax, ay] = toArt(x, y);
                    assert.ok(T.revealAt(ax, ay) < 0.02, `${L.id} (${read(L, u)}) on the picture at ${ax.toFixed(0)}, ${ay.toFixed(0)}`);
                }
            }
        }
        /* nor a strip, nor the rev counter: their layers lie right of the seam */
        for (const id of ['revDial', 'oilStrip', 'fuelStrip', 'plates']) {
            const L = layer(t, id);
            for (const [x, y] of [[L.x, L.y], [L.x, L.y + L.h], [L.x + L.w, L.y + L.h / 2]]) {
                if (id === 'plates') continue;
                const [ax, ay] = toArt(x, y);
                assert.strictEqual(T.revealAt(ax, ay), 0, id);
            }
        }
    }
});

/* --------------------------------------------------- gear, speed, strips */

test('the gear: a letter in the frame\'s own hand, a number in the dials\', its right side where the frame\'s D ends', () => {
    const t = build(), L = layer(t, 'gear');
    for (const [gear, faces] of [['D', ['mg']], ['P', ['mg']], ['R', ['mg']], ['N', ['mg']], ['4', ['mw']], ['M3', ['mg', 'mw']], ['S8', ['mg', 'mw']]]) {
        const u = L.uniforms(state(t, { gear }), 0);
        assert.strictEqual(read(L, u), gear);
        assert.deepStrictEqual(glyphs(L, u).map((g) => g.face), faces, gear);
        const ink = inkOf(L, u), last = ink[ink.length - 1];
        assert.ok(Math.abs(toArt(last.x + last.w, 0)[0] - 854.6) < 0.6, `${gear} ends at ${toArt(last.x + last.w, 0)[0]}`);
        /* one character is the frame's 80 units tall; a stage and its gear together are set smaller */
        const tall = gear.length > 1 ? 80 * 0.84 : 80;
        ink.forEach((q) => {
            const [x0, y0] = toArt(q.x, q.y), [x1, y1] = toArt(q.x + q.w, q.y + q.h);
            assert.ok(Math.abs(y1 - 286.9) < 1 && Math.abs((y1 - y0) - tall) < 1.5, `${gear}: ${tall} units tall, on the frame's line`);
            /* on the black band, between the two seams, at every height it has */
            assert.ok(y0 > T.BODY.bandTop + 8 && y1 < T.BODY.bandBottom - 8);
            assert.ok(x0 > T.slash(T.LINE.seam1, y0) + 2 && x1 < T.slash(T.LINE.seam2, y0) - 2, `${gear} inside the band`);
        });
    }
    assert.strictEqual(read(L, L.uniforms(state(t, {}), 0)), 'P', 'no gear known: P');
    /* the frame's D is its own shape: an upright lighter than its bowl */
    assert.deepStrictEqual(Object.keys(atlas.faces.mg.glyphs).sort(), ['D', 'M', 'N', 'P', 'R', 'S']);
    const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mglyphs.py'), 'utf8');
    const g = /GEAR = dict\(W=([\d.]+), sl=([\d.]+), sr=([\d.]+)/.exec(src);
    assert.ok(g && Number(g[2]) < Number(g[3]) * 0.8 && Math.abs(Number(g[1]) - 1.196) < 1e-9);
});

test('the speed: one figure in the units chosen, flush right before its unit, on the lower plate', () => {
    for (const [units, kmh, want, unit] of [['metric', 0, '0', 'km/h'], ['metric', 248.6, '249', 'km/h'], ['imperial', 100, '62', 'mph']]) {
        const t = build({ units }), st = state(t, { speedKmh: kmh });
        const L = layer(t, 'speed'), u = L.uniforms(st, 0);
        assert.strictEqual(read(L, u), want);
        assert.strictEqual(says(t, 'speedUnit', st), unit);
        const ink = inkOf(L, u), last = ink[ink.length - 1];
        assert.ok(Math.abs(toArt(last.x + last.w, 0)[0] - 831.8) < 0.6);
        assert.ok(Math.abs(toArt(0, last.y + last.h)[1] - 365.2) < 1);
        const first = toArt(ink[0].x, ink[0].y);
        assert.ok(first[1] > T.BODY.bandBottom + 20 && first[0] > T.slash(T.LINE.seam1, first[1]) + 20, 'on the lower plate, clear of the seam');
        const U = layer(t, 'speedUnit'), uq = inkOf(U, U.uniforms(st, 0))[0];
        assert.ok(uq.x > last.x + last.w + 4, 'the unit after the figure');
    }
    assert.ok(!build().layers.some((L) => /speed2/.test(L.id)), 'one speed: the frame has one');
});

test('oil and fuel: ladders lit from the foot to the reading, dark with none; an electric car\'s own in their place', () => {
    const t = build({ units: 'metric' });
    const oil = (raw) => layer(t, 'oilStrip').uniforms(state(t, raw), 0), fuel = (raw) => layer(t, 'fuelStrip').uniforms(state(t, raw), 0);
    assert.deepStrictEqual([oil({}).u_on, fuel({}).u_on], [0, 0]);
    assert.ok(Math.abs(oil({ oilTempC: 75 }).u_level - 0.25) < 1e-9 && oil({ oilTempC: 75 }).u_on === 1);
    assert.deepStrictEqual([oil({ oilTempC: 20 }).u_level, oil({ oilTempC: 200 }).u_level], [0, 1]);
    assert.ok(Math.abs(fuel({ fuelPct: 54.7 }).u_level - 0.547) < 1e-9);
    assert.deepStrictEqual([oil({}).u_kind, fuel({}).u_kind], [1, 0]);
    assert.ok(oil({}).u_at < fuel({}).u_at, 'oil left of fuel');
    assert.strictEqual(saysAll(t, 'stripLabels', state(t, {})), '15010050' + '11/20');
    assert.strictEqual(says(t, 'oilUnit', state(t, {})), '°C');
    const i = build({ units: 'imperial' });
    assert.strictEqual(saysAll(i, 'stripLabels', state(i, {})), '300210120' + '11/20');
    assert.ok(Math.abs(layer(i, 'oilStrip').uniforms(state(i, { oilTempC: 100 }), 0).u_level - (212 - 120) / 180) < 1e-9, '212 F on 120 - 300');
    /* each strip's layer holds its ladder and its line from top to foot */
    for (const id of ['oilStrip', 'fuelStrip']) {
        const L = layer(t, id), at = id === 'oilStrip' ? T.STRIP.oil : T.STRIP.fuel;
        const [x0, y0] = toArt(L.x, L.y), [x1, y1] = toArt(L.x + L.w, L.y + L.h);
        assert.ok(x0 <= T.slash(at, T.STRIP.bottom) && x1 >= T.slash(at, T.STRIP.top) + T.STRIP.ladderW + T.STRIP.gap + T.STRIP.lineW);
        assert.ok(y0 <= T.STRIP.top && y1 >= T.STRIP.bottom);
    }
    /* an electric car: the battery's charge on the fuel ladder, its temperature on the oil's, and no pump or oil can */
    const ev = build({ electric: 'bev', units: 'metric' }), st = state(ev, { socPct: 64, hvTempC: 25 });
    assert.ok(Math.abs(layer(ev, 'fuelStrip').uniforms(st, 0).u_level - 0.64) < 1e-9);
    assert.ok(Math.abs(layer(ev, 'oilStrip').uniforms(st, 0).u_level - 0.5) < 1e-9);
    assert.strictEqual(saysAll(ev, 'stripLabels', st), '6025-10' + '11/20');
    assert.ok(!layer(ev, 'oilIcon') && !layer(ev, 'fuelIcon') && layer(t, 'oilIcon') && layer(t, 'fuelIcon'));
});

/* ------------------------------------------------------------ the footer */

test('the footer: the time, the range and the outside temperature as the frame has them, on one line', () => {
    const t = build({ units: 'metric' }), st = state(t, RAW);
    assert.strictEqual(says(t, 'footL', st), '19:02');
    assert.strictEqual(says(t, 'footMIcon', st) + says(t, 'footM', st) + says(t, 'footMUnit', st), 'r402km');
    assert.strictEqual(says(t, 'footR', st) + says(t, 'footRUnit', st), '+21.0°C');
    assert.strictEqual(says(t, 'mMark', st), 'm');
    assert.strictEqual(glyphs(layer(t, 'mMark'), layer(t, 'mMark').uniforms(st, 0))[0].face, 'mt', 'the frame\'s own M mark');
    /* one baseline, above the strip */
    /* (each one's last figure: a sign before the figures does not stand on the line) */
    const feet = ['footL', 'footM', 'footR'].map((id) => { const L = layer(t, id), q = inkOf(L, L.uniforms(st, 0)).pop(); return q.y + q.h; });
    assert.ok(Math.max(...feet) - Math.min(...feet) < 0.6 && Math.max(...feet) < Panel.BOTTOM_CUT, feet.join(' '));
    /* the left one starts where the frame's does, the right one ends where the frame's does */
    const l = layer(t, 'footL'), r = layer(t, 'footR');
    assert.ok(Math.abs(toArt(inkOf(l, l.uniforms(st, 0))[0].x, 0)[0] - 124.7) < 0.6);
    const rq = inkOf(r, r.uniforms(st, 0));
    assert.ok(Math.abs(toArt(rq[rq.length - 1].x + rq[rq.length - 1].w, 0)[0] - 1526.0) < 0.6);
    /* nothing known: nothing shown */
    const dark = state(t, {});
    for (const id of ['footL', 'footM', 'footMIcon', 'footMUnit', 'footR', 'footRUnit']) assert.strictEqual(says(t, id, dark), '', id);
    /* 12-hour: am / pm after the figures; miles: mi and Fahrenheit */
    const i = build({ units: 'imperial', clock12: true }), si = state(i, RAW);
    assert.strictEqual(says(i, 'footL', si) + says(i, 'footLUnit', si), '7:02pm');
    assert.strictEqual(says(i, 'footM', si) + says(i, 'footMUnit', si), '250mi');
    assert.strictEqual(says(i, 'footR', si) + says(i, 'footRUnit', si), '+70°F');
});

test('the footer\'s three places: each can hold any reading the M styles\' footers can, or nothing', () => {
    assert.deepStrictEqual(spec.settings.find((s) => s.key === 'kFootL').options.map((o) => o[0]), Readings.KINDS);
    const raw = Object.assign({}, RAW, { avgL100: 9.6, evRangeKm: 43, socPct: 78, hvTempC: 26, gearboxC: 70, torqueNm: 300, tripKm: 123.4, tripMin: 95, odoKm: 12345 });
    const want = { time: '19:02', range: 'r402km', economy: '9.6l/100km', outside: '+21.0°C', iat: 'IAT30°C', rpm: '3000rpm',
                   oil: 'OIL100°C', coolant: 'WATER92°C', boost: 'BOOST0.80bar', volts: 'BATT14.1v',
                   erange: 'EV43km', charge: 'CHARGE78', hvtemp: 'BATT26°C',
                   gearbox: 'TRANS70°C', torque: 'TQ31kgm', power: 'PWR126hp', trip: 'TRIP123.4km', tripTime: 'TIME1:35h', odo: 'ODO12345km' };
    for (const place of ['L', 'M', 'R']) for (const kind of Readings.KINDS) {
        const t = build({ units: 'metric', electric: 'hybrid', ['kFoot' + place]: kind });
        const st = state(t, raw), n = 'foot' + place;
        const got = ['Icon', 'Tag', '', 'Unit'].map((x) => says(t, n + x, st) || '').join('');
        assert.strictEqual(got, kind === 'off' ? '' : want[kind], `${kind} on the ${place}`);
        /* each part inside its layer and the panel, no part on another */
        const parts = t.layers.filter((L) => L.id.indexOf(n) === 0).map((L) => ({ L, u: L.uniforms(st, 0) })).filter((p) => p.u);
        const ink = [].concat(...parts.map((p) => inkOf(p.L, p.u)));
        ink.forEach((a, i) => ink.forEach((b, j) => { if (i < j) assert.ok(!hits(a, b), `${kind} on the ${place}: two glyphs overlap`); }));
        ink.forEach((q) => assert.ok(q.x >= 0 && q.x + q.w <= Panel.PANEL_WIDTH && q.y + q.h <= Panel.BOTTOM_CUT));
        /* the places keep to themselves */
        const others = ['L', 'M', 'R'].filter((p) => p !== place).map((p) => 'foot' + p);
        const theirs = [].concat(...t.layers.filter((L) => others.some((o) => L.id.indexOf(o) === 0))
            .map((L) => ({ L, u: L.uniforms(st, 0) })).filter((p) => p.u).map((p) => inkOf(p.L, p.u)));
        ink.forEach((a) => theirs.forEach((b) => assert.ok(!hits(a, b), `${kind} on the ${place} runs into another place`)));
    }
    /* a named reading with no value shows dashes; the frame's own three go dark */
    const t = build({ kFootL: 'iat', kFootM: 'boost' }), dark = state(t, {});
    assert.strictEqual(says(t, 'footLTag', dark) + says(t, 'footL', dark), 'IAT--');
    assert.strictEqual(says(t, 'footMTag', dark) + says(t, 'footM', dark), 'BOOST--');
});

/* --------------------------------------------------------- the dressing */

test('the holiday dressing keeps off the instruments', () => {
    const t = build({ holiday: true, kFootR: 'outside' });
    const snow = t.layers.filter((L) => /^snow/.test(L.id)), tree = layer(t, 'tree');
    assert.strictEqual(snow.length, 2);
    const st = state(t, RAW, { now: 5000 });
    /* the snow falls left of the wing and right of the strips; the tree stands right of the fuel */
    const wing = layer(t, 'wing'), fuel = layer(t, 'fuelStrip');
    assert.ok(snow[0].x + snow[0].w <= T.px(T.WING.v[4][0]) && snow[1].x >= fuel.x + fuel.w);
    assert.ok(tree.x >= fuel.x + fuel.w && tree.y + tree.h <= Panel.BOTTOM_CUT);
    assert.ok(wing.x >= snow[0].x + snow[0].w - 8);
    /* and no reading is under the tree */
    for (const L of t.layers.filter(isText)) {
        const u = L.uniforms(st, 0);
        (u ? inkOf(L, u) : []).forEach((q) => assert.ok(!hits(q, tree), L.id + ' under the tree'));
    }
});

/* ------------------------------------------------------------ the glyphs */

test('the atlas: the track style\'s symbols, gear letters and signs are in it, after everything that was there', () => {
    assert.deepStrictEqual(Object.keys(atlas.faces.mt.glyphs).sort(), 'acehmopuvw'.replace('e', '').split('').sort());
    assert.deepStrictEqual(Object.keys(atlas.faces.mx.glyphs).sort(), ['%', 'V']);
    /* packed under every face that was there before: none of those moved to make room */
    const added = ['mt', 'mg', 'mx'];
    let lowestOld = 0, highestNew = Infinity;
    for (const [face, f] of Object.entries(atlas.faces)) {
        for (const g of Object.values(f.glyphs)) {
            if (!g.tw) continue;
            if (added.indexOf(face) >= 0) highestNew = Math.min(highestNew, g.v);
            else lowestOld = Math.max(lowestOld, g.v + g.th);
            assert.ok(g.u + g.tw <= atlas.size && g.v + g.th <= atlas.size, face + ': a glyph off the atlas');
        }
    }
    assert.ok(highestNew >= lowestOld, `the new faces start at row ${highestNew}, the old end at ${lowestOld}`);
    /* the symbols a row or a strip draws are all there */
    for (const sc of Object.values(MTrack.rowScales(Units.of({ units: 'metric' })))) assert.ok(sc.icon ? atlas.faces.mt.glyphs[sc.icon].tw > 0 : !!sc.tag);
});

/* ------------------------------------------------- a mark that slides */

test('a row\'s slow readings glide for this style alone: a mark on a rail slides, it does not jump', () => {
    const Smooth = require('../src/car/smooth.js');
    /* as it comes the fourth row is intake air: the one reading of the frame's four the car side does not glide already */
    assert.deepStrictEqual(build().glide, ['iatC']);
    assert.deepStrictEqual(build({ row1: 'volts', row2: 'charge', row3: 'hvtemp', row4: 'iat', electric: 'hybrid' }).glide,
        ['batteryV', 'socPct', 'hvTempC', 'iatC']);
    assert.deepStrictEqual(build({ row4: 'oilp' }).glide, [], 'boost, coolant, oil and oil pressure glide for every style');
    /* every name is one the car side knows, and one the state reads */
    const stateSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'state.js'), 'utf8');
    for (const k of Object.keys(Smooth.MORE)) {
        assert.ok(Smooth.KEYS.indexOf(k) < 0, k + ' is not glided twice');
        assert.ok(stateSrc.includes('raw.' + k), k + ' is a reading the state takes');
    }
    for (const cfg of [{ row1: 'iat', row2: 'volts', row3: 'charge', row4: 'hvtemp', electric: 'bev' }, {}]) {
        build(cfg).glide.forEach((k) => assert.ok(k in Smooth.MORE, k));
    }
    /* the other styles ask for nothing: their figures are passed on exactly as they arrive */
    for (const style of ['toro', 'track', 'mplus']) assert.strictEqual(Themes.build(atlas, 'carprofile', { style }).glide, undefined, style);
    const plain = Smooth.create();
    plain.apply({ iatC: 20, batteryV: 13.8 }, 0, 90);
    assert.deepStrictEqual(plain.apply({ iatC: 30, batteryV: 14.4 }, 16, 90), { iatC: 30, batteryV: 14.4 });
    /* asked for: part of the way after one frame, there within a few glide times, never past it */
    const sm = Smooth.create();
    sm.apply({ iatC: 20 }, 0, 90, ['iatC']);
    const one = sm.apply({ iatC: 30 }, 16, 90, ['iatC']).iatC;
    assert.ok(one > 20 && one < 21, 'one frame on: ' + one);
    let out;
    for (let t = 32; t <= 3000; t += 16) out = sm.apply({ iatC: 30 }, t, 90, ['iatC']);
    assert.ok(out.iatC <= 30 && out.iatC > 29.99, 'settled: ' + out.iatC);
    /* a reading that goes is gone at once; one no longer asked for is forgotten, not resumed from where it was */
    assert.strictEqual(sm.apply({ iatC: undefined }, 3016, 90, ['iatC']).iatC, undefined);
    const again = Smooth.create();
    again.apply({ iatC: 20 }, 0, 90, ['iatC']);
    again.apply({ iatC: 20 }, 16, 90);
    assert.strictEqual(again.apply({ iatC: 40 }, 32, 90, ['iatC']).iatC, 40, 'starts from the reading itself');
    /* the mark itself: where the glided figure is, on the row\'s own scale */
    const t = build({ units: 'metric' });
    const u = layer(t, 'rows').uniforms(state(t, Object.assign({}, RAW, { iatC: one })));
    assert.ok(Math.abs(u.u_val[3] - (one + 20) / 70) < 1e-9, 'row 4 at ' + u.u_val[3]);
});

/* ----------------------------------------------------- the control points */

test('the comparison\'s control points: over a hundred, every one from the geometry and on the frame', () => {
    const out = require('child_process').execFileSync('node', [path.join(__dirname, '..', 'tools', 'mt-points.js'), '--json'], { encoding: 'utf8' });
    const pts = JSON.parse(out);
    assert.ok(pts.filter((p) => p.kind !== 'anchor').length >= 100, pts.length + ' points');
    assert.strictEqual(new Set(pts.map((p) => p.id)).size, pts.length, 'no id twice');
    pts.forEach((p) => {
        assert.ok(p.x >= 0 && p.x <= T.ART.w && p.y >= 0 && p.y <= T.ART.h, p.id + ' off the frame');
        assert.ok(['edge', 'line', 'anchor'].indexOf(p.kind) >= 0 && p.what, p.id);
    });
    /* the reference and its rectifying maps are where the tool looks for them */
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'docs', 'ref', 'm-track-reference.jpg')));
    const tool = fs.readFileSync(path.join(__dirname, '..', 'tools', 'mt-compare.py'), 'utf8');
    assert.ok(/fixture=mt/.test(tool) && /art=native/.test(tool));
});

test('the two strips can show any reading a row can, the fuel, or nothing: its figures, unit and symbol follow', () => {
    const t = build({ units: 'metric', stripL: 'gearbox', stripR: 'coolant' });
    const st = state(t, Object.assign({}, RAW, { gearboxC: 85 }));
    assert.deepStrictEqual(t.layers.filter((L) => /Strip$/.test(L.id)).map((L) => L.id), ['oilStrip', 'fuelStrip']);
    assert.ok(Math.abs(layer(t, 'oilStrip').uniforms(st, 0).u_level - 0.5) < 1e-9, 'the gearbox oil: 85 on 40 - 130');
    assert.strictEqual(layer(t, 'oilStrip').uniforms(st, 0).u_kind, 1, 'a temperature: red where hot, blue where cold');
    assert.strictEqual(saysAll(t, 'stripLabels', st), '1308540' + '13010070');
    assert.strictEqual(says(t, 'oilUnit', st) + says(t, 'fuelUnit', st), '°C°C');
    assert.strictEqual(says(t, 'oilIcon', st), 'TRANS');
    /* a reading that is not a temperature is plain, and the fuel moves to wherever it is asked for */
    const b = build({ units: 'metric', stripL: 'fuel', stripR: 'boost' }), sb = state(b, RAW);
    assert.deepStrictEqual([layer(b, 'oilStrip').uniforms(sb, 0).u_kind, layer(b, 'fuelStrip').uniforms(sb, 0).u_kind], [0, 2]);
    /* nothing: the strip, its figures, unit and symbol all left out */
    const n = build({ stripL: 'off', stripR: 'off' });
    assert.ok(!n.layers.some((L) => /^(oil|fuel)(Strip|Unit|Icon)$|^stripLabels/.test(L.id)));
    /* the fuel's last piece in the warning colour only once it is all that is left */
    const src = require('../src/shaders/tcluster.js').mtstrip;
    assert.ok(/u_kind < 0\.5 && u_level < 0\.26/.test(src));
});
