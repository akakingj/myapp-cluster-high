'use strict';
/*
 * The rules in docs/CLUSTER-CONSTRAINTS.md, enforced.
 * Run: node --test test/theme.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const Panel = require('../src/geometry/panel.js');
const Theme = require('../src/theme/lambo.js');
const Text = require('../src/engine/text.js');
const State = require('../src/engine/state.js');
const Sim = require('../preview/sim.js');
const atlas = require('../assets/fonts/atlas.json');
const Palette = require('../src/theme/palette.js');
const core = require('../src/shaders/core.js');
const parts = require('../src/shaders/parts.js');
const dialShaders = require('../src/shaders/dial.js');
const Guide = require('../src/theme/guide.js');

const PROFILES = Object.keys(Panel.PROFILES);

test('no layer draws into the bottom strip', () => {
    for (const id of PROFILES) {
        for (const L of Theme.build(atlas, id, {}).layers) {
            assert.ok(L.y + L.h <= Panel.BOTTOM_CUT,
                `${id}/${L.id} reaches y=${L.y + L.h}, past the cut at ${Panel.BOTTOM_CUT}`);
        }
    }
});

test('below the cut: only the background and the plain covers, and never over the gear', () => {
    /*
     * What may run over BMW's bottom strip is the background (a trim, to
     * the row above the gear's window at most) and, with the strip
     * hidden, two plain covers - one each side of the gear. Never a
     * readout. test/strip.test.js holds every style to this for every
     * value the setting can have; this is Toro's own.
     */
    const hidden = Theme.build(atlas, 'carprofile', { bottomExtra: 'hide' });
    for (const L of hidden.layers) {
        if (L.belowCut) {
            assert.ok(['bg', 'stripL', 'stripR'].indexOf(L.id) >= 0, `${L.id} below the cut`);
            assert.ok(L.y + L.h <= Panel.PANEL_HEIGHT, 'and never off the panel');
            assert.strictEqual(L.still, true, `${L.id} must not shake: it stands beside the gear`);
        } else {
            assert.ok(L.y + L.h <= Panel.BOTTOM_CUT, `${L.id} past the cut`);
        }
    }
    const bgH = (v) => Theme.build(atlas, 'carprofile', { bottomExtra: v }).layers.find((L) => L.id === 'bg').h;
    assert.strictEqual(bgH('hide'), Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX);
    assert.strictEqual(bgH(12), Panel.BOTTOM_CUT + 12);
    /* the old "a little" (24 px, across the gear: what brought the black box) is now the largest trim */
    assert.strictEqual(bgH(24), Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX);
    /* never further across the whole width, whatever is asked for */
    assert.strictEqual(bgH(500), Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX);
    /* and off by default */
    assert.strictEqual(bgH(undefined), Panel.BOTTOM_CUT);
    assert.ok(Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX < Panel.GEAR_TRIGGER_WINDOW.y, 'the trim stops above the gear\'s window');
});

/*
 * The layout is drawn for the X3 M40i, which has neither the M boxes nor the
 * eDrive box. On those cars the KOMBI draws its own box over part of our
 * artwork. These are the overlaps we know about and accept until those
 * profiles get their own layout; the test fails if the list grows or shrinks.
 * See docs/CLUSTER-CONSTRAINTS.md section 3 and README "Known limitations".
 */
const KNOWN_OVERLAPS = new Set([
    'mCarS58/gearBig/M box (left)',
    /* at 0.9 (clear of the driver camera) the mode name's box reaches 10 px into the M box; its words end
       well before (CORSA ends at about x 720, the box starts at 793) */
    'mCarS58/corsa/M box (left)',
]);

test('no layer overlaps a factory keep-clear zone', () => {
    const seen = new Set();
    for (const id of PROFILES) {
        const zones = Panel.keepClear(id).filter(z => z.id !== 'bottomStrip');
        for (const L of Theme.build(atlas, id, {}).layers) {
            /* Full-field procedural layers span the dial by nature; what
               matters is that no readout hides under a factory box. */
            if (['bg', 'flash', 'stipple', 'dial', 'contour', 'arcNums', 'pctNums']
                .indexOf(L.id) >= 0) continue;
            for (const z of zones) {
                if (!(L.x < z.x + z.w && L.x + L.w > z.x &&
                      L.y < z.y + z.h && L.y + L.h > z.y)) continue;
                const key = `${id}/${L.id}/${z.name}`;
                seen.add(key);
                assert.ok(KNOWN_OVERLAPS.has(key), `new overlap: ${key}`);
            }
        }
    }
    for (const k of KNOWN_OVERLAPS) {
        assert.ok(seen.has(k), `${k} no longer overlaps - drop it from KNOWN_OVERLAPS`);
    }
});

test('every layer stays inside the panel', () => {
    for (const L of Theme.build(atlas, 'carprofile', {}).layers) {
        assert.ok(L.x >= 0 && L.y >= 0, `${L.id} starts off-panel`);
        assert.ok(L.x + L.w <= Panel.PANEL_WIDTH, `${L.id} runs past the right edge`);
    }
});

test('shaders keep inside the uniform-vector budget', () => {
    /* GLSL ES counts a vecN or a float as one vector; an array as its length. */
    const all = Object.assign({}, core, parts, dialShaders);
    for (const [id, src] of Object.entries(all)) {
        let vectors = 0;
        for (const m of src.matchAll(/uniform\s+(float|vec2|vec3|vec4|mat4)\s+(\w+)(\[(\d+)\])?/g)) {
            vectors += (m[1] === 'mat4' ? 4 : 1) * (m[4] ? Number(m[4]) : 1);
        }
        vectors += 3;  /* u_size, u_time, u_keep from the prelude */
        assert.ok(vectors <= 48, `${id} declares ${vectors} uniform vectors, over the 48 the unit allows`);
    }
});

test('shaders avoid what the head unit refuses', () => {
    const all = Object.assign({}, core, parts, dialShaders);
    const reserved = ['u_mvp', 'u_mv', 'u_m', 'u_v', 'u_p', 'u_normal'];
    for (const [id, src] of Object.entries(all)) {
        assert.ok(!/\bbreak\b/.test(src), `${id} uses break inside a loop`);
        for (const r of reserved) {
            assert.ok(!new RegExp(`uniform\\s+\\w+\\s+${r}\\b`).test(src),
                `${id} declares the reserved uniform ${r}`);
        }
    }
});

test('every layer produces valid uniforms across a drive', () => {
    const profile = Panel.profile('carprofile');
    const theme = Theme.build(atlas, 'carprofile', {});
    const sim = Sim.create(profile);
    for (let i = 0; i < 2000; i++) {
        sim.step(1 / 60);
        if (i % 97) continue;
        const st = State.present(sim.raw(), profile, {});
        for (const L of theme.layers) {
            const u = L.uniforms ? L.uniforms(st, i / 60) : null;
            if (u === null) continue;
            for (const [k, v] of Object.entries(u)) {
                const vals = typeof v === 'number' ? [v] : v;
                for (const n of vals) {
                    assert.ok(Number.isFinite(n), `${L.id}.${k} produced ${n}`);
                }
            }
        }
    }
});

test('missing signals fall back to dashes, never to a stale number', () => {
    const profile = Panel.profile('carprofile');
    const st = State.present({}, profile, {});
    assert.strictEqual(st.odoText, '--');
    assert.strictEqual(st.clockText, '--');
    assert.strictEqual(st.pods.coolant.text, '--');
    assert.strictEqual(st.speed, 0);
});

test('text layout never exceeds the shader glyph budget', () => {
    const L = Text.layout(atlas, 'ABCDEFGHIJKLMNOPQRST', { face: 'label', size: 20, x: 0, y: 0 });
    assert.ok(L.count <= Text.MAX_GLYPHS);
    assert.strictEqual(L.g.length, Text.MAX_GLYPHS * 4);
});

test('imperial and metric both present cleanly', () => {
    const profile = Panel.profile('carprofile');
    const raw = { speedKmh: 100, coolantC: 90, odoKm: 1000, rangeKm: 400,
                  ambientC: 20, boostBar: 1, clock: { h: 13, m: 5 }, rpm: 3000 };
    const imp = State.present(raw, profile, {});
    const met = State.present(raw, profile, { units: 'metric' });
    assert.strictEqual(Math.round(imp.speed), 62);
    assert.strictEqual(Math.round(met.speed), 100);
    assert.strictEqual(imp.pods.coolant.text, '194');
    assert.strictEqual(met.pods.coolant.text, '90');
    assert.ok(imp.boostPsi > 14 && imp.boostPsi < 15);
});


/* ------------------------------------------------- settings and scale */



test('rev limits stay ordered however they are set', () => {
    const p = Panel.profile('carprofile');
    const cases = [
        { rpmMax: 7000, rpmRedline: 9000, rpmLimiter: 9000 },
        { rpmRedline: 100, rpmLimiter: 50 },
        { rpmLimiter: 2000, rpmRedline: 6500 },
        { rpmMax: 'nonsense', rpmRedline: null }
    ];
    for (const c of cases) {
        const S = Palette.resolve(c, p);
        assert.ok(S.rpmRedline <= S.rpmMax, JSON.stringify(c));
        assert.ok(S.rpmLimiter <= S.rpmMax, JSON.stringify(c));
        assert.ok(S.rpmLimiter >= S.rpmRedline, JSON.stringify(c));
        assert.ok(S.flashFromRpm <= S.rpmLimiter, JSON.stringify(c));
    }
});

test('every colour scheme builds a complete theme', () => {
    for (const accent of Object.keys(Palette.SCHEMES)) {
        for (const litColour of Object.keys(Palette.LIT)) {
            const t = Theme.build(atlas, 'carprofile', { accent, litColour });
            assert.ok(t.layers.length > 30, accent);
            for (const c of [t.palette.accent, t.palette.lit, t.palette.second]) {
                assert.ok(Array.isArray(c) && c.length === 3, `${accent}/${litColour}`);
                for (const v of c) assert.ok(v >= 0 && v <= 1);
            }
        }
    }
});

test('the rev-limit flash can be turned off and shaped', () => {
    const has = (t, id) => t.layers.some(L => L.id === id);
    assert.ok(has(Theme.build(atlas, 'carprofile', { revFlash: 'both' }), 'flash'));
    assert.ok(has(Theme.build(atlas, 'carprofile', { revFlash: 'edges' }), 'flash'));
    assert.ok(!has(Theme.build(atlas, 'carprofile', { revFlash: 'band' }), 'flash'));
    assert.ok(!has(Theme.build(atlas, 'carprofile', { revFlash: 'off' }), 'flash'));
    /* band-only still flashes the dial itself */
    const band = Theme.build(atlas, 'carprofile', { revFlash: 'band' });
    const tach = band.layers.find(L => L.id === 'dial');
    const st = State.present({ rpm: 7000 }, Panel.profile('carprofile'), band.settings);
    assert.ok(tach.uniforms(st, 0).u_warn > 0.5, 'the band should be flashing');
    const off = Theme.build(atlas, 'carprofile', { revFlash: 'off' });
    assert.strictEqual(off.layers.find(L => L.id === 'dial')
        .uniforms(State.present({ rpm: 7000 }, Panel.profile('carprofile'), off.settings), 0).u_warn, 0);
});










test('every glyph lands inside its own layer', () => {
    /*
     * A text layer only draws what falls inside its quad. A glyph placed
     * outside it is silently clipped - which is how a label goes missing
     * without anything failing. Check every layer against a whole drive.
     */
    const profile = Panel.profile('carprofile');
    const bad = new Set();
    for (const units of ['imperial', 'metric']) {
        const theme = Theme.build(atlas, 'carprofile', { units });
        const sim = Sim.create(profile);
        for (let i = 0; i < 1500; i++) {
            sim.step(1 / 60);
            if (i % 113) continue;
            const st = State.present(sim.raw(), profile, theme.settings);
            for (const gear of ['P', 'R', 'N', '1', '8']) {
                const s2 = Object.assign({}, st, { gear });
                for (const L of theme.layers) {
                    if (L.shader !== 'text' && L.shader !== 'arcnum') continue;
                    const u = L.uniforms(s2, 0);
                    if (!u) continue;
                    for (let g = 0; g < u.u_count; g++) {
                        const [x, y, w, h] = u.u_quad.slice(g * 4, g * 4 + 4);
                        if (x >= -1 && y >= -1 && x + w <= L.w + 1 && y + h <= L.h + 1) continue;
                        bad.add(`${L.id}: glyph at ${Math.round(x)},${Math.round(y)} ` +
                            `${Math.round(w)}x${Math.round(h)} outside its ${L.w}x${L.h} layer`);
                    }
                }
            }
        }
    }
    assert.deepStrictEqual([...bad].sort(), [],
        'clipped text:\n  ' + [...bad].sort().join('\n  '));
});







/* ------------------------------------------------- the gear's two choices */

/* where a text layer's ink is, on the panel: its glyph cells less their own margin (about 0.045 of the size) */
function inkOf(L, u) {
    const size = u.u_sharp * atlas.emPx / (2 * atlas.spread), pad = 0.04 * size, out = [];
    for (let g = 0; g < u.u_count; g++) {
        const [x, y, w, h] = u.u_quad.slice(g * 4, g * 4 + 4);
        out.push({ x: L.x + x + pad, y: L.y + y + pad, w: w - 2 * pad, h: h - 2 * pad });
    }
    return out;
}
/* how far apart two boxes are: over 0, clear by that much; under, overlapping */
function gapOf(a, b) {
    return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
}
/* (and with the programme, TORO > Gear as it comes: the widest pairs and the narrowest) */
const GEARS = 'PRNDSM12345678'.split('').concat(['D1', 'D4', 'S8', 'M8', 'M1']);
const gearLayer = (t) => t.layers.find((L) => L.id === 'gearBig');
const gearState = (t, gear, raw) => Object.assign(
    State.present(Object.assign({ rpm: 3000, gear }, raw || {}), Panel.profile('carprofile'), t.settings), { gear, gearStaged: gear });

test('the gear as it comes: the tall hollow numeral in the middle of the dial', () => {
    const t = Theme.build(atlas, 'carprofile', {});
    assert.strictEqual(t.settings.gearFill, 'outline');
    assert.strictEqual(t.settings.gearPlace, 'centre');
    const L = gearLayer(t), r = Guide.grect(Guide.BOUNDS.gear);
    /* the same layer every release has had: the Toro pictures are held to it */
    assert.deepStrictEqual([L.x, L.y, L.w, L.h], [r.x - 90, r.y - 44, r.w + 180, r.h + 92]);
    const u = L.uniforms(gearState(t, '4'));
    assert.ok(Math.abs(u.u_outline - Guide.gs(3.6)) < 1e-9, 'hollow: an outline');
    assert.deepStrictEqual(u.u_outCol, Guide.COLOURS.corsaRed);
    assert.deepStrictEqual(L.uniforms(Object.assign(gearState(t, '4'), { limiter: 1 })).u_outCol, [1, 1, 1], 'white at the limiter');
    /* anything else that is asked for is the default */
    for (const bad of ['top', '', null, 3, 'LEFT']) {
        assert.strictEqual(Palette.resolve({ gearPlace: bad }, Panel.profile('carprofile')).gearPlace, 'centre');
    }
    for (const bad of ['yes', 1, null, 'outline', false]) {
        assert.strictEqual(Palette.resolve({ gearFill: bad }, Panel.profile('carprofile')).gearFill, 'outline');
    }
    assert.strictEqual(Palette.resolve({ gearFill: 'filled' }, Panel.profile('carprofile')).gearFill, 'filled');
    assert.strictEqual(Palette.resolve({ gearFill: true }, Panel.profile('carprofile')).gearFill, 'filled');
    assert.strictEqual(Palette.resolve({ gearFill: 'heavy' }, Panel.profile('carprofile')).gearFill, 'heavy');
    /* the three the page offers are the three the style knows */
    const offered = require('../app/app.base.json').settings.find((x) => x.key === 'gearFill');
    assert.deepStrictEqual(offered.options.map((o) => o[0]), ['outline', 'heavy', 'filled']);
    assert.strictEqual(offered.default, 'outline');
    const places = require('../app/app.base.json').settings.find((x) => x.key === 'gearPlace');
    assert.deepStrictEqual(places.options.map((o) => o[0]), ['centre', 'left', 'right']);
    assert.strictEqual(places.default, 'centre');
});

test('the gear, heavy or bold: the same numeral with a thicker stroke or filled in, in any place, white at the limiter', () => {
    for (const gearPlace of ['centre', 'left', 'right']) {
        const hollow = Theme.build(atlas, 'carprofile', { gearPlace });
        const heavy = Theme.build(atlas, 'carprofile', { gearPlace, gearFill: 'heavy' });
        const bold = Theme.build(atlas, 'carprofile', { gearPlace, gearFill: 'filled' });
        const a = gearLayer(hollow), b = gearLayer(bold), h = gearLayer(heavy);
        /* same place, same size, same figure: only how it is drawn */
        assert.deepStrictEqual([b.x, b.y, b.w, b.h], [a.x, a.y, a.w, a.h]);
        assert.deepStrictEqual([h.x, h.y, h.w, h.h], [a.x, a.y, a.w, a.h]);
        const ua = a.uniforms(gearState(hollow, '4')), ub = b.uniforms(gearState(bold, '4')), uh = h.uniforms(gearState(heavy, '4'));
        assert.deepStrictEqual(ub.u_quad, ua.u_quad);
        assert.deepStrictEqual(uh.u_quad, ua.u_quad);
        assert.ok(ua.u_outline >= 0.5, 'hollow is an outline the shader draws as one');
        assert.strictEqual(ub.u_outline, 0, 'bold is the figure itself');
        /* heavy: a stroke well over half as thick again, still hollow, the outline's colours */
        assert.ok(uh.u_outline > 1.6 * ua.u_outline && uh.u_outline < 2.2 * ua.u_outline, `${gearPlace}: ${uh.u_outline} against ${ua.u_outline}`);
        assert.deepStrictEqual(uh.u_outCol, ua.u_outCol);
        /* a stroke is drawn in the figure's own cell (the shader samples nothing outside it): the cell's
           margin round the ink must hold it, or it would be cut square. 0.04 of the size is that margin */
        const size = uh.u_sharp * atlas.emPx / (2 * atlas.spread);
        assert.ok(uh.u_outline < 0.04 * size, `${gearPlace}: a ${uh.u_outline.toFixed(1)} px stroke in a ${(0.04 * size).toFixed(1)} px margin`);
        /* ... the pair's too (D4: the programme and the gear, smaller, the stroke with them) */
        const up = h.uniforms(gearState(heavy, 'D4')), psize = up.u_sharp * atlas.emPx / (2 * atlas.spread);
        assert.ok(psize < 0.7 * size && up.u_outline < 0.04 * psize, `${gearPlace}: the pair's ${up.u_outline.toFixed(1)} px stroke in a ${(0.04 * psize).toFixed(1)} px margin`);
        assert.strictEqual(uh.u_glow, 0, 'no glow: it would end on the cell as a box');
        assert.deepStrictEqual(ub.u_color.slice(0, 3), Guide.COLOURS.corsaRed);
        assert.strictEqual(ub.u_color[3], 1);
        const hot = b.uniforms(Object.assign(gearState(bold, '4'), { limiter: 1 }));
        assert.deepStrictEqual(hot.u_color.slice(0, 3), [1, 1, 1], 'white at the limiter, as the outline is');
        /* and it follows the accent when the colour is set to apply to everything */
        const full = Theme.build(atlas, 'carprofile', { gearPlace, gearFill: 'filled', accentScope: 'full', accent: 'verde' });
        assert.deepStrictEqual(gearLayer(full).uniforms(gearState(full, '4')).u_color.slice(0, 3), full.palette.accent);
    }
    /* the text shader: an outline under half a pixel is a filled figure */
    assert.ok(parts.text.includes('float fill = mix(cover, 0.0, step(0.5, u_outline));'));
});

test('the gear in a corner: half the height, above the boost gauge or above the speed, clear of everything', () => {
    const centre = gearLayer(Theme.build(atlas, 'carprofile', {}));
    const cap = (t) => { const u = gearLayer(t).uniforms(gearState(t, '8')); return u.u_sharp * atlas.emPx / (2 * atlas.spread) * 0.70; };
    const big = cap(Theme.build(atlas, 'carprofile', {}));
    let closest = Infinity;
    for (const zoom of [0.94, 0.97, 1, 1.03, 1.06]) {
        for (const shiftY of [0, -8, -16, -24]) {
            for (const units of ['imperial', 'metric']) {
                const sides = {};
                for (const gearPlace of ['left', 'right']) {
                    /* (the heavy stroke: the widest any of the three is drawn) */
                    const t = Theme.build(atlas, 'carprofile', { zoom, shiftY, units, gearPlace, gearFill: 'heavy' });
                    const L = gearLayer(t);
                    const what = `${gearPlace}, zoom ${zoom}, nudge ${shiftY}, ${units}`;
                    assert.ok(L.x >= 0 && L.y >= 0 && L.x + L.w <= Panel.PANEL_WIDTH && L.y + L.h <= Panel.BOTTOM_CUT, what + ': on the panel, above the strip');
                    [L.x, L.y, L.w, L.h].forEach((n) => assert.strictEqual(n, Math.round(n), what + ': on whole pixels'));
                    assert.ok(cap(t) > 0.42 * big && cap(t) < 0.56 * big, what + ': about half the numeral in the middle');
                    for (const gear of GEARS) {
                        /* parked, flat out, and in between: the speed and the boost at their widest and tallest */
                        for (const raw of [{ speedKmh: 0, boostBar: 0 }, { speedKmh: 322, boostBar: 1.6 }, { speedKmh: 100, boostBar: 0.8 }]) {
                            const st = gearState(t, gear, raw);
                            const u = L.uniforms(st);
                            assert.strictEqual(u.u_count, gear.length, 'one glyph a character');
                            const [qx, qy, qw, qh] = u.u_quad;
                            assert.ok(qx >= 0 && qy >= 0 && qx + qw <= L.w && qy + qh <= L.h, `${what}: "${gear}" is cut by its own layer`);
                            const i = inkOf(L, u)[0], o = u.u_outline;
                            const box = { x: i.x - o, y: i.y - o, w: i.w + 2 * o, h: i.h + 2 * o };
                            for (const other of t.layers) {
                                if (other === L) continue;
                                let boxes;
                                if (other.shader === 'text') { const ou = other.uniforms(st); if (!ou) continue; boxes = inkOf(other, ou); }
                                else if (/^(boostGauge|gforce|bar_|icon_)/.test(other.id)) boxes = [other];
                                else continue;
                                for (const b of boxes) {
                                    const g = gapOf(box, b);
                                    closest = Math.min(closest, g);
                                    assert.ok(g >= 10, `${what}: "${gear}" is ${g.toFixed(1)} px from ${other.id}`);
                                }
                            }
                            if (gear === '8' && raw.speedKmh === 0) sides[gearPlace] = { box, st };
                        }
                    }
                    /* out of the middle: the picture's opening has the dial's middle to itself */
                    const mid = { x: centre.x + 90, y: centre.y + 44, w: centre.w - 180, h: centre.h - 92 };
                    if (zoom === 1 && shiftY === 0) assert.ok(gapOf(sides[gearPlace].box, mid) > 0, what + ': clear of where the tall numeral stands');
                }
                /* the two places: the same height, the same distance either side of the dial's axis */
                const axis = Guide.gx(945), l = sides.left.box, r = sides.right.box;
                assert.ok(Math.abs(l.y - r.y) < 0.01 && Math.abs(l.h - r.h) < 0.01);
                /* (to the pixel or two a leaning figure's ink is off its own middle) */
                assert.ok(Math.abs((axis - (l.x + l.w / 2)) - ((r.x + r.w / 2) - axis)) < 2, 'mirrored about the axis');
                assert.ok(l.x + l.w < axis - 150 && r.x > axis + 150);
            }
        }
    }
    assert.ok(closest >= 10 && closest < 40, `the nearest anything comes is ${closest.toFixed(1)} px`);
    /* where they are, as it comes: left above the boost gauge, right above the speed */
    const at = (gearPlace) => {
        const t = Theme.build(atlas, 'carprofile', { gearPlace });
        const st = gearState(t, '8', { speedKmh: 90 });
        const ink = (id) => { const L = t.layers.find((x) => x.id === id); return L.shader === 'text' ? inkOf(L, L.uniforms(st))[0] : L; };
        return { gear: ink('gearBig'), speed: ink('speed'), gauge: ink('boostGauge'), corsa: ink('corsa') };
    };
    const lf = at('left'), rt = at('right');
    assert.ok(lf.gear.y + lf.gear.h < lf.gauge.y, 'above the boost gauge');
    assert.ok(lf.gear.x < lf.gauge.x + lf.gauge.w && lf.gear.x + lf.gear.w > lf.gauge.x - 40, '... and over it, not off to one side');
    assert.ok(lf.gear.y > lf.corsa.y + lf.corsa.h, 'under the mode\'s name');
    assert.ok(rt.gear.y + rt.gear.h < rt.speed.y, 'above the speed');
    assert.ok(rt.gear.x < rt.speed.x + rt.speed.w && rt.gear.x + rt.gear.w > rt.speed.x, '... and over its figures');
    /* no factory box of any car is under it (the tall one in the middle is over the M car's: KNOWN_OVERLAPS) */
    for (const id of PROFILES) {
        for (const gearPlace of ['left', 'right']) {
            const L = gearLayer(Theme.build(atlas, id, { gearPlace }));
            for (const z of Panel.keepClear(id)) {
                assert.ok(!(L.x < z.x + z.w && L.x + L.w > z.x && L.y < z.y + z.h && L.y + L.h > z.y), `${id}: the gear, ${gearPlace}, over ${z.name}`);
            }
        }
    }
});

/* ------------------------------------------- how much of the picture shows */

const SLOT = { x: 416, y: 120, w: 1088, h: 480 };       /* where the cluster draws a hosted picture, under the panel */
const SIZES = ['standard', 'more', 'most'];
/* how much of the picture is seen clearly: the px where four fifths of what an opening can show comes through */
const openArea = (t) => {
    let a = 0;
    for (let y = 100; y < 620; y += 4) for (let x = 380; x < 1540; x += 4) if (Theme.openAt(t, x, y) >= 0.8 * t.settings.holeMax) a += 16;
    return a;
};

test('the opening as it comes is the lens every release has had', () => {
    const t = Theme.build(atlas, 'carprofile', {});
    assert.strictEqual(t.settings.centreSize, 'standard');
    assert.deepStrictEqual(t.settings.hole, [530, 206, 860, 310]);
    assert.deepStrictEqual([t.settings.holeFeather, t.settings.holeChamfer, t.settings.holeMax], [120, 170, 0.9]);
    assert.deepStrictEqual(t.holeDisc, [0, 0, 0, 0], 'no round limit: the hexagon alone');
    const bg = t.layers.find((L) => L.id === 'bg');
    const u = bg.uniforms({ centre: { mode: 'map', open: 1 } });
    assert.deepStrictEqual(u.u_hole, [530, 206, 860, 310]);
    assert.deepStrictEqual(u.u_holeOpen, [0.9, 120, 170]);
    assert.deepStrictEqual(u.u_holeDisc, [0, 0, 0, 0]);
    assert.strictEqual(bg.uniforms({}).u_holeOpen[0], 0, 'shut with nothing to show');
    /* anything unknown is the standard one; sizes given by hand still win */
    for (const bad of ['huge', '', null, 2]) assert.strictEqual(Palette.resolve({ centreSize: bad }, Panel.profile('carprofile')).centreSize, 'standard');
    assert.strictEqual(Palette.resolve({ centreSize: 'most', holeFeather: 10 }, Panel.profile('carprofile')).holeFeather, 10);
    assert.deepStrictEqual(Object.keys(Palette.HOLES), SIZES);
    /* the shader: the round limit is skipped unless one is given, so the lens is drawn by the sums it always was */
    assert.ok(core.bg.includes('float t = smoothstep(-u_holeOpen.y, 0.0, d);'));
    assert.ok(core.bg.includes('if (u_holeDisc.z > 0.5) {'));
    assert.ok(core.bg.includes('a = 1.0 - u_holeOpen.x * (1.0 - keep);'));
    /* what the tests below measure is what that shader works out */
    assert.ok(Math.abs(Theme.openAt(t, 960, 361) - 0.9) < 1e-9, 'the middle of the lens: all but the veil');
    assert.strictEqual(Theme.openAt(t, 960, 205), 0, 'nothing above its top edge');
    assert.ok(Math.abs(Theme.openAt(t, 960, 206 + 60) - 0.9 * (1 - 0.5)) < 1e-9, 'half-way through the fade');
});

test('the larger openings: the inside of the dial - never under its band, never under the white readouts below it', () => {
    const area = {};
    for (const zoom of [0.94, 1, 1.06]) {
        for (const shiftY of [0, -24]) {
            for (const centreSize of SIZES) {
                const t = Theme.build(atlas, 'carprofile', { zoom, shiftY, centreSize, centre: 'map' });
                const what = `${centreSize}, zoom ${zoom}, nudge ${shiftY}`;
                assert.strictEqual(t.settings.centreSize, centreSize);
                const h = t.settings.hole, T = Guide.TACH;
                /* the hexagon is inside the picture's own slot, and nothing shows outside the hexagon */
                assert.ok(h[0] >= SLOT.x && h[1] >= SLOT.y && h[0] + h[2] <= SLOT.x + SLOT.w && h[1] + h[3] <= SLOT.y + SLOT.h, what);
                assert.deepStrictEqual(t.window, { x: h[0], y: h[1], w: h[2], h: h[3] });
                const dc = { x: Guide.gx(T.cx), y: Guide.gy(T.cy) }, inner = Guide.gs(T.rRecess);
                if (centreSize !== 'standard') {
                    /* its round limit is the dial's own circle, a little inside the band's inner contour */
                    assert.ok(Math.abs(t.holeDisc[0] - dc.x) < 1e-9 && Math.abs(t.holeDisc[1] - dc.y) < 1e-9, what);
                    assert.ok(t.holeDisc[2] < inner && t.holeDisc[2] > inner - 10 && t.holeDisc[3] >= 30, what);
                    assert.deepStrictEqual(t.layers.find((L) => L.id === 'bg').uniforms({}).u_holeDisc, t.holeDisc);
                }
                let most = 0;
                for (let y = 0; y < Panel.BOTTOM_CUT; y += 3) {
                    for (let x = 0; x < Panel.PANEL_WIDTH; x += 3) {
                        const o = Theme.openAt(t, x, y);
                        most = Math.max(most, o);
                        if (o <= 0) continue;
                        assert.ok(x > h[0] && x < h[0] + h[2] && y > h[1] && y < h[1] + h[3], `${what}: the picture shows at ${x}, ${y}, outside its opening`);
                        /* the band, its numerals and its contour: from the inner contour out, the dark they are drawn on */
                        if (centreSize !== 'standard') {
                            assert.ok(Math.hypot(x - dc.x, y - dc.y) < inner, `${what}: the picture shows under the dial's band at ${x}, ${y}`);
                        }
                    }
                }
                assert.ok(Math.abs(most - 0.9) < 0.005, what + ': wide open somewhere, all but the veil');
                /* the white readouts under the dial: the speed, the boost, the G meter and its four figures */
                for (const raw of [{ speedKmh: 0, boostBar: 0 }, { speedKmh: 322, boostBar: 1.6 }]) {
                    const st = State.present(Object.assign({ rpm: 3000, gear: '4', gLat: 0.6, gLon: 0.8 }, raw), Panel.profile('carprofile'), t.settings);
                    for (const L of t.layers) {
                        if (!/^(speed|speedUnit|boostNum|boostUnit|boostGauge|gforce|g[UDLR])$/.test(L.id)) continue;
                        const boxes = L.shader === 'text' ? (L.uniforms(st) ? inkOf(L, L.uniforms(st)) : []) : [L];
                        for (const b of boxes) {
                            for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w / 2, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
                                assert.ok(Theme.openAt(t, x, y) <= 0.1, `${what}: ${L.id} stands on the picture (${Theme.openAt(t, x, y).toFixed(2)} of it) at ${Math.round(x)}, ${Math.round(y)}`);
                            }
                        }
                    }
                }
                if (zoom === 1 && shiftY === 0) area[centreSize] = openArea(t);
            }
        }
    }
    /* what a larger one is for: far more of the picture */
    assert.ok(area.more > 1.6 * area.standard, `more: ${Math.round(area.more)} against ${Math.round(area.standard)}`);
    assert.ok(area.most > 1.2 * area.more, `most: ${Math.round(area.most)} against ${Math.round(area.more)}`);
    assert.ok(area.most > 2 * area.standard, `most: ${Math.round(area.most)} against ${Math.round(area.standard)}`);
    /* and none runs lower than the standard one: the white readouts are under it */
    for (const centreSize of SIZES) {
        const hh = Palette.HOLES[centreSize].hole;
        assert.ok(hh[1] + hh[3] <= 516, centreSize);
    }
});

/* --------------------------------------------- the CORSA reconstruction */

test('the dial follows the brief\'s circle and angle function', () => {
    const T = Guide.TACH;
    /* thetaDegrees(v) = -178 + 17.2 v, and the crown falls just past 5. */
    assert.strictEqual(Guide.thetaDeg(1), -160.8);
    assert.ok(Math.abs(Guide.thetaDeg(10) - -6) < 1e-9);
    let crown = 1, best = Infinity;
    for (let v = 1; v <= 10; v += 0.01) {
        const y = Guide.point(v, T.rOuter).y;
        if (y < best) { best = y; crown = v; }
    }
    assert.ok(crown > 5 && crown < 5.3, `crown at v=${crown.toFixed(2)}`);

    /* Every labelled point is the same distance from the centre: a circle. */
    const c = { x: Guide.gx(T.cx), y: Guide.gy(T.cy) };
    for (let v = 1; v <= 10; v++) {
        const p = Guide.point(v, T.rOuter);
        const r = Math.hypot(p.x - c.x, p.y - c.y);
        assert.ok(Math.abs(r - Guide.gs(T.rOuter)) < 0.01, `v=${v} r=${r}`);
    }
});

test('the brief\'s grid is fitted, not stretched, into the drawable area', () => {
    /* One scale for both axes, and nothing reaches the car's bottom strip. */
    Guide.setFit(1, 0);
    assert.ok(Guide.fit() > 0.8 && Guide.fit() < 1);
    assert.ok(Math.abs(Guide.gy(Guide.GRID.contentBottom) - Panel.BOTTOM_CUT) < 0.01);
    assert.ok(Guide.gs(100) / 100 === Guide.fit(), 'lengths scale by the same factor');
    /* zoomed in, the grid still ends exactly on the cut, never past it */
    Guide.setFit(1.1, 0);
    assert.ok(Math.abs(Guide.gy(Guide.GRID.contentBottom) - Panel.BOTTOM_CUT) < 0.01);
    /* a nudge only ever moves it up, so the strip stays the car's */
    Guide.setFit(1, 20);
    assert.ok(Guide.gy(Guide.GRID.contentBottom) <= Panel.BOTTOM_CUT + 0.01);
    Guide.setFit(1, -20);
    assert.ok(Math.abs(Guide.gy(Guide.GRID.contentBottom) - (Panel.BOTTOM_CUT - 20)) < 0.01);
    Guide.setFit(1, 0);
    assert.ok(Guide.gx(0) > 0 && Guide.gx(Guide.GRID.w) < Panel.PANEL_WIDTH,
        'the composition is letterboxed, not cropped');
});

test('the stepped contour generator matches the brief\'s table', () => {
    /* 0.00 and 0.12 recessed, 0.22-0.68 plateau, back down by 0.80. */
    const T = Guide.TACH;
    const radius = (f) => {
        const up = Math.max(0, Math.min(1, (f - 0.12) / 0.10));
        const dn = Math.max(0, Math.min(1, (f - 0.68) / 0.12));
        return T.rRecess + (T.rPlateau - T.rRecess) * (up - dn);
    };
    for (const [f, want] of T.step) {
        assert.ok(Math.abs(radius(f) - want) < 1e-9,
            `fraction ${f} should sit at ${want}, got ${radius(f)}`);
    }
});





test('the far-left region and our own additions can be turned off', () => {
    const has = (t, id) => t.layers.some(L => L.id === id);
    assert.ok(has(Theme.build(atlas, 'carprofile', {}), 'bar_oilT'));
    assert.ok(!has(Theme.build(atlas, 'carprofile', { showAuxLeft: false }), 'bar_oilT'));
    assert.ok(!has(Theme.build(atlas, 'carprofile', { showBoost: false }), 'boost'));
    assert.ok(!has(Theme.build(atlas, 'carprofile', { shiftLights: false }), 'shift'));
});


/* --------------------------------------------- scale, pop, fill, look */

function arcVals(theme, rpm) {
    const nums = theme.layers.find(L => L.id === 'arcNums');
    const u = nums.uniforms(State.present({ rpm }, Panel.profile('carprofile'), theme.settings), 0);
    const vals = [];
    for (let i = 0; i < u.u_cfg[0]; i++) vals.push(u.u_gt[i * 4]);
    return { u, vals };
}

test('the dial is marked in thousands up to the chosen scale', () => {
    /* 8000 by default for a BMW six; each numeral carries its own value, so
       "10" works as two glyphs. */
    assert.deepStrictEqual(arcVals(Theme.build(atlas, 'carprofile', {}), 0).vals,
        [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepStrictEqual(arcVals(Theme.build(atlas, 'carprofile', { scaleMaxRpm: 10000 }), 0).vals,
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
    assert.deepStrictEqual(arcVals(Theme.build(atlas, 'carprofile',
        { scaleMaxRpm: 10000, showZeroNumeral: true }), 0).vals,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
    /* whole thousands only, within 6000..10000 */
    for (const [ask, got] of [[7400, 7000], [5000, 6000], [12000, 10000], ['x', 8000]]) {
        assert.strictEqual(Palette.resolve({ scaleMaxRpm: ask }, Panel.profile('carprofile')).scaleMaxRpm, got);
    }
});

test('whatever the scale, the sweep stays where the brief puts it', () => {
    /* 0 sits at the brief's v=1 end, the top of the scale at its v=10 end. */
    for (const n of [6, 8, 10]) {
        assert.strictEqual(Theme.briefV(0, n), Guide.TACH.vMin);
        assert.strictEqual(Theme.briefV(n, n), Guide.TACH.vMax);
    }
});

test('the red zone follows the redline, and the limits stay separate', () => {
    const S = Palette.resolve({}, Panel.profile('carprofile'));
    assert.strictEqual(S.scaleMaxRpm, 8000);
    assert.strictEqual(S.rpmRedline, 6750);
    assert.strictEqual(S.rpmLimiter, 7000);
    const theme = Theme.build(atlas, 'carprofile', {});
    assert.strictEqual(theme.dial.redV, 6.75);
    const { u, vals } = arcVals(theme, 0);
    for (let i = 0; i < vals.length; i++) {
        assert.strictEqual(u.u_gt[i * 4 + 1], vals[i] >= 6.75 ? 1 : 0, `numeral ${vals[i]}`);
    }
    /* a raised limiter is honoured up to the end of the scale */
    const T = Palette.resolve({ rpmRedline: 7200, rpmLimiter: 7600 }, Panel.profile('carprofile'));
    assert.strictEqual(T.rpmRedline, 7200);
    assert.strictEqual(T.rpmLimiter, 7600);
    assert.strictEqual(Palette.resolve({ rpmLimiter: 9500 }, Panel.profile('carprofile')).rpmLimiter, 8000);
});

test('the numerals and the band follow the revs', () => {
    const theme = Theme.build(atlas, 'carprofile', {});
    /* the numeral shader is told where the revs are, in scale units */
    assert.strictEqual(arcVals(theme, 5500).u.u_cfg[2], 5.5);
    assert.ok(arcVals(theme, 5500).u.u_colPop, 'numerals change colour as they pop');
    /* and so is the band, with the needle */
    const band = theme.layers.find(L => L.id === 'stipple');
    const at = (rpm) => band.uniforms(State.present({ rpm }, Panel.profile('carprofile'), theme.settings), 0);
    assert.strictEqual(at(3000).u_rev[0], 3);
    assert.ok(at(6000).u_rev[0] > at(3000).u_rev[0]);
    assert.strictEqual(at(3000).u_rev[1], 1, 'the fill is on by default');
    const off = Theme.build(atlas, 'carprofile', { dialFill: 0 }).layers.find(L => L.id === 'stipple');
    assert.strictEqual(off.uniforms(State.present({ rpm: 3000 }, Panel.profile('carprofile'), {}), 0).u_rev[1], 0);
    /* past the end of the scale it pins rather than wrapping */
    assert.strictEqual(at(12000).u_rev[0], 8);
});

test('genuine and modern backgrounds', () => {
    const bgOf = (o) => Theme.build(atlas, 'carprofile', o).layers.find(L => L.id === 'bg').uniforms({}, 0);
    const g = bgOf({});
    assert.strictEqual(g.u_hex, 0, 'genuine: no honeycomb');
    assert.strictEqual(g.u_facets, 1);
    const m = bgOf({ background: 'modern' });
    assert.strictEqual(m.u_hex, 1, 'modern: the honeycomb');
    assert.strictEqual(m.u_facets, 0);
    /* in modern the dial's band is smoked so the honeycomb recedes under it */
    const smoke = (o) => Theme.build(atlas, 'carprofile', o).layers.find(L => L.id === 'stipple')
        .uniforms(State.present({ rpm: 0 }, Panel.profile('carprofile'), {}), 0).u_smoke[3];
    assert.strictEqual(smoke({}), 0);
    assert.ok(smoke({ background: 'modern' }) > 0.5);
    /* an explicit setting still wins over the preset */
    assert.strictEqual(bgOf({ background: 'modern', hexagons: 0.4 }).u_hex, 0.4);
    assert.strictEqual(Palette.resolve({ background: 'nonsense' }, Panel.profile('carprofile')).background, 'genuine');
});

test('the boost gauge stays clear of the G widget and its readings', () => {
    const theme = Theme.build(atlas, 'carprofile', {});
    const boost = theme.layers.filter(L => /^boost/.test(L.id));
    const g = theme.layers.filter(L => L.id === 'gforce' || /^g[LRUD]$/.test(L.id));
    assert.ok(boost.length >= 3 && g.length === 5);
    const gap = 12;
    for (const b of boost) for (const w of g) {
        const apart = b.x + b.w + gap <= w.x || w.x + w.w + gap <= b.x ||
                      b.y + b.h + gap <= w.y || w.y + w.h + gap <= b.y;
        assert.ok(apart, `${b.id} is within ${gap}px of ${w.id}`);
    }
});

test('each of the four side gauges can be given a reading or nothing; auto keeps the style\'s own', () => {
    const profile = Panel.profile('carprofile');
    const ids = (t) => t.layers.filter((L) => /^bar_/.test(L.id)).map((L) => L.id).sort();
    assert.deepStrictEqual(ids(Theme.build(atlas, 'carprofile', {})), ['bar_auxPress', 'bar_coolant', 'bar_fuel', 'bar_oilT']);
    /* (no ESC block: the mode's name stands once, under the gear's left) */
    assert.ok(!Theme.build(atlas, 'carprofile', {}).layers.some((L) => /^esc/.test(L.id)));
    const set = { units: 'metric', gaugeL1: 'gearbox', gaugeL2: 'iat', gaugeR1: 'volts', gaugeR2: 'off' };
    const t = Theme.build(atlas, 'carprofile', set);
    assert.deepStrictEqual(ids(t), ['bar_gL1', 'bar_gL2', 'bar_gR1']);
    /* (the fuel gauge given another reading: the tank's level is not asked for) */
    const NONE = { boostTarget: false, hpfp: false, lpfp: false, tank: false };
    assert.deepStrictEqual(t.shows, Object.assign({ oil: false, boost: true, iat: true, volts: true, pedal: false, throttle: false, timing: false }, NONE));
    assert.deepStrictEqual(Theme.build(atlas, 'carprofile', { gaugeR1: 'oilp', gaugeR2: 'volts', showAuxLeft: false, showBoost: false }).shows,
        Object.assign({ oil: true, boost: false, iat: false, volts: true, pedal: false, throttle: false, timing: false }, NONE));
    /* the fuel gauge in its own place, or given to another: asked for */
    assert.strictEqual(Theme.build(atlas, 'carprofile', {}).shows.tank, true);
    assert.strictEqual(Theme.build(atlas, 'carprofile', { gaugeR1: 'volts', gaugeL1: 'fuel' }).shows.tank, true);
    /* an electric car's fuel gauge is its battery: not asked for */
    assert.strictEqual(Theme.build(atlas, 'carprofile', { electric: 'bev' }).shows.tank, false);
    /* M Sport's fuel strip: asked for; an electric car's strip is its battery's */
    assert.strictEqual(Theme.build(atlas, 'carprofile', { style: 'track' }).shows.tank, true);
    assert.strictEqual(Theme.build(atlas, 'carprofile', { style: 'track', electric: 'bev' }).shows.tank, false);
    /* (the same readings as Cluster Layouts' gauges: the engine's power and torque, the fuel pressures, the drive battery) */
    const more = Theme.build(atlas, 'carprofile', { units: 'metric', electric: 'hybrid', gaugeL1: 'power', gaugeL2: 'hpfp', gaugeR1: 'charge', gaugeR2: 'torque' });
    assert.deepStrictEqual(ids(more), ['bar_gL1', 'bar_gL2', 'bar_gR1', 'bar_gR2']);
    assert.strictEqual(more.shows.hpfp, true);
    const mst = State.present({ rpm: 4000, torqueNm: 400, hpfpBar: 175, socPct: 8 }, profile, more.settings);
    const mu = (id) => more.layers.find((L) => L.id === id).uniforms(mst, 0);
    assert.ok(Math.abs(mu('bar_gL1').u_frac - 400 * 4000 / 9549 * 1.341022 / 400) < 1e-6, 'the power, hp on 0 - 400');
    assert.ok(Math.abs(mu('bar_gL2').u_frac - 0.5) < 1e-9, 'the rail: 175 on 0 - 350 bar');
    assert.strictEqual(mu('bar_gR1').u_alarm, 1, 'the charge low');
    assert.ok(Math.abs(mu('bar_gR2').u_frac - 400 * 0.101972 / 60) < 1e-6, 'the torque, kgm on 0 - 60');
    const st = State.present({ gearboxC: 85, iatC: 20, batteryV: 11.5 }, profile, t.settings);
    const u = (id) => t.layers.find((L) => L.id === id).uniforms(st, 0);
    assert.ok(Math.abs(u('bar_gL1').u_frac - 0.5) < 1e-9, 'the gearbox oil: 85 on 40 - 130');
    assert.ok(Math.abs(u('bar_gL2').u_frac - 0.5) < 1e-9, 'the intake air: 20 on -20 - 60');
    assert.strictEqual(u('bar_gR1').u_alarm, 1, 'the battery low');
    /* nothing known: the bar goes dark, as the style's own do */
    assert.strictEqual(t.layers.find((L) => L.id === 'bar_gL1').uniforms(State.present({}, profile, t.settings), 0).u_on, 0);
    /* the electric range leaves a place the owner gave something else */
    assert.strictEqual(Theme.build(atlas, 'carprofile', { electric: 'hybrid', gaugeL2: 'boost' }).electricGauge, null);
});
