'use strict';
/*
 * BETA, "lower and enlarge the cluster" (src/theme/strip.js): with BMW's
 * bottom strip hidden, the whole style drawn d px further down and larger
 * by (646 + d) / 646. Held here, for every style:
 *
 *   - off as it comes, and off it changes nothing at all;
 *   - on, it is the same picture scaled about the top of the screen's
 *     middle, by exactly the amount its foot goes lower;
 *   - nothing of ours is ever laid in the columns kept open for BMW's gear
 *     letter - not a layer, not one the limiter's shake has carried - and
 *     nothing leaves the screen;
 *   - a picture's window still lies inside the car's map slot;
 *   - what lies over the whole style (the limiter's flash, the start-up
 *     message's veil) is spread over the lowered one, round the gear.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/geometry/panel.js');
const Strip = require('../src/theme/strip.js');
const Palette = require('../src/theme/palette.js');
const Themes = require('../src/theme/index.js');
const Track = require('../src/theme/track.js');
const Toro = require('../src/theme/lambo.js');
const M = require('../src/theme/mgeom.js');
const T = require('../src/theme/tgeom.js');
const Guide = require('../src/theme/guide.js');
const State = require('../src/engine/state.js');
const Clock = require('../src/engine/clock.js');
const Cluster = require('../src/car/cluster.js');
const Sim = require('../preview/sim.js');
const atlas = require('../assets/fonts/atlas.json');
const spec = require('../app/app.base.json');
const shaders = Object.assign({}, require('../src/shaders/core.js'), require('../src/shaders/parts.js'),
    require('../src/shaders/dial.js'), require('../src/shaders/mcluster.js'), require('../src/shaders/tcluster.js'));

const STYLES = ['toro', 'track', 'mplus', 'mtrack'];
const MOST = { toro: 58, track: 74, mplus: 74, mtrack: 74 };
const AMOUNTS = [1, 7, 20, 33, 40, 58, 66, 74];
const SLOT = { x: 416, y: 120, w: 1088, h: 480 };
const P = Panel.profile('carprofile');
const build = (style, cfg) => Themes.build(atlas, (cfg && cfg.profile) || 'carprofile', Object.assign({ style }, cfg));
const rect = (L) => {
    const x = Math.floor(L.x), y = Math.floor(L.y);
    return { x, y, w: Math.ceil(L.x + L.w) - x, h: Math.ceil(L.y + L.h) - y };
};
const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const OPEN = { mode: 'map', open: 1, maneuver: null };
const RAW = { rpm: 3000, speedKmh: 120, gear: '4', driveMode: 'SPORT', fuelPct: 40, oilTempC: 100, coolantC: 92,
              boostBar: 0.8, iatC: 30, oilPressBar: 4.2, batteryV: 14.1, rangeKm: 402, ambientC: 21.0, clock: { h: 19, m: 2 } };
const state = (t, raw, over) => Object.assign(State.present(raw || RAW, t.profile, t.settings), over);
/* settings that put something in every corner a style has */
const VARIANTS = {
    toro: [{}, { units: 'metric', shake: 'hard' }, { background: 'modern', centre: 'waze', centreSize: 'most', gearPlace: 'right', gearFill: 'filled' },
           { background: 'revuelto', gearPlace: 'left', holiday: true, intro: true, shiftStyle: 'gt3', electric: 'hybrid' },
           { bottomExtra: 'hideWide', shake: 'hard', units: 'metric', showAuxLeft: false, engine: 'diesel' }],
    track: [{}, { centre: 'waze', centreSize: 'more', units: 'metric' }, { centre: 'turn', mPanel: 'mode', holiday: true, intro: true },
            { bottomExtra: 'hideWide', footL: 'rpm', footM: 'economy', footR: 'volts', mGear: 'rpm', speed2: 'off', engine: 'diesel' }],
    mplus: [{}, { centre: 'waze', centreSize: 'most' }, { centre: 'camera', centreSize: 'more', units: 'metric', holiday: true, intro: true },
            { bottomExtra: 'hideWide', footL: 'boost', footM: 'iat', footR: 'erange', electric: 'hybrid' }],
    mtrack: [{}, { centre: 'waze', units: 'metric' }, { rowMark: 'fill', row1: 'oilp', row2: 'volts', holiday: true, intro: true },
             { bottomExtra: 'hideWide', footL: 'economy', footM: 'coolant', footR: 'volts', electric: 'bev', engine: 'diesel' }]
};

/* ------------------------------------------------------------ the setting */

test('the setting: px, 0 - 74, off as it comes; on, it hides the strip and keeps the gap the owner chose', () => {
    const r = (s) => Palette.resolve(s, P);
    assert.strictEqual(r({}).lower, 0);
    assert.strictEqual(r({ lower: '0' }).lower, 0);
    assert.strictEqual(r({ lower: 'off' }).lower, 0);
    assert.strictEqual(r({ lower: -12 }).lower, 0);
    assert.strictEqual(r({ lower: '40' }).lower, 40);
    assert.strictEqual(r({ lower: 39.6 }).lower, 40);
    assert.strictEqual(r({ lower: 900 }).lower, 74, 'never past the screen\'s foot');
    assert.strictEqual(Strip.LOWER_MOST, Panel.PANEL_HEIGHT - Panel.BOTTOM_CUT);
    /* off: the strip is as the owner set it */
    assert.strictEqual(r({}).stripHide, false);
    assert.strictEqual(r({ bottomExtra: '12' }).bottomExtra, 12);
    /* on: hidden, whatever the strip's own setting says - a style cannot stand in a strip that is showing */
    for (const strip of [undefined, '0', '6', '18', 'hide']) {
        const s = r({ lower: 20, bottomExtra: strip });
        assert.deepStrictEqual([s.stripHide, s.stripWide, s.bottomExtra], [true, false, Panel.STRIP_TRIM_MAX], String(strip));
    }
    const wide = r({ lower: 20, bottomExtra: 'hideWide' });
    assert.deepStrictEqual([wide.stripHide, wide.stripWide], [true, true], 'the wider gap beside the gear is kept');
    /* the scale is the amount, exactly */
    assert.strictEqual(Strip.lowerScale(0), 1);
    for (const d of AMOUNTS) assert.strictEqual(Strip.lowerScale(d), (646 + d) / 646);
    assert.strictEqual(Strip.foot(r({ lower: 58 })), 704);
    assert.strictEqual(Strip.foot(r({})), 646);
});

test('not in the app\'s settings (AK 0.19.1): every style at its own size on the car', () => {
    assert.ok(!spec.settings.some((s) => s.key === 'lower'), 'the setting is gone');
    /* the styles still say how far each could go (the previews and the tests below draw it) */
    for (const st of STYLES) assert.strictEqual(Themes.lowerMost(st), MOST[st], st);
});

/* ------------------------------------------------------------- off: as ever */

test('off, nothing is different: the same layers in the same places, drawing the same', () => {
    const shape = (t) => t.layers.map((L) => [L.id, L.shader, L.z, L.x, L.y, L.w, L.h, !!L.still, !!L.belowCut]);
    for (const style of STYLES) {
        for (const cfg of [{}, { bottomExtra: 'hide', centre: 'waze', holiday: true, intro: true }]) {
            const plain = build(style, cfg);
            for (const off of [0, '0', undefined, null, 'x']) {
                const t = build(style, Object.assign({ lower: off }, cfg));
                assert.deepStrictEqual(shape(t), shape(plain), `${style}, lower: ${off}`);
                assert.strictEqual(t.foot, Panel.BOTTOM_CUT);
                assert.strictEqual(t.settings.lower, 0);
                const a = state(plain, RAW, { centre: OPEN, limiter: 1, sinceOn: 2, now: 1000 });
                t.layers.forEach((L, i) => assert.deepStrictEqual(L.uniforms(a, 0), plain.layers[i].uniforms(a, 0), `${style}: ${L.id}`));
            }
            /* and nothing of the lowered kind is in it */
            assert.ok(!plain.layers.some((L) => L.shader === 'flashPart' || /^(flash|introVeil)[LR]$/.test(L.id)), style);
        }
    }
    /* a style built lowered leaves nothing behind for the next one built */
    build('track', { lower: 74 }); build('mtrack', { lower: 74 }); build('toro', { lower: 58 });
    build('track'); build('mtrack'); build('toro');
    assert.deepStrictEqual([M.ART.s, M.ART.ox, M.ART.oy], [M.PANEL_FIT.s, M.PANEL_FIT.ox, M.PANEL_FIT.oy]);
    assert.deepStrictEqual([T.ART.s, T.ART.ox, T.ART.oy], [T.PANEL_FIT.s, T.PANEL_FIT.ox, T.PANEL_FIT.oy]);
    assert.strictEqual(Guide.gy(704), Panel.BOTTOM_CUT, 'Toro\'s content ends on the cut again');
});

/* -------------------------------------------------- on: the same, larger */

test('each style goes as far as it has room for: Toro 58 px, the M styles to the screen\'s edge', () => {
    for (const style of STYLES) {
        for (const d of AMOUNTS) {
            const t = build(style, { lower: d });
            assert.strictEqual(t.settings.lower, Math.min(d, MOST[style]), `${style} asked ${d}`);
            assert.strictEqual(t.foot, 646 + Math.min(d, MOST[style]));
        }
    }
});

test('the scale is the amount, about the top of the screen\'s middle: a point d rows lower at the foot, none at the top', () => {
    for (const d of AMOUNTS) {
        const k = (646 + d) / 646;
        /* the M styles: their artboard's fit */
        build('track', { lower: d });
        assert.ok(Math.abs(M.ART.s - M.PANEL_FIT.s * k) < 1e-12 && Math.abs(M.ART.oy - M.PANEL_FIT.oy * k) < 1e-12);
        assert.ok(Math.abs(M.px(M.AX) - 960) < 0.05, 'the dials\' axis stays on the screen\'s middle');
        /* what stood on the cut stands d rows lower; what stood on the top row stays */
        const yCut = (Panel.BOTTOM_CUT - M.PANEL_FIT.oy) / M.PANEL_FIT.s, yTop = -M.PANEL_FIT.oy / M.PANEL_FIT.s;
        assert.ok(Math.abs(M.py(yCut) - (646 + d)) < 1e-9 && Math.abs(M.py(yTop)) < 1e-9);
        build('mtrack', { lower: d });
        assert.ok(Math.abs(T.ART.s - T.PANEL_FIT.s * k) < 1e-12);
        assert.ok(Math.abs(T.py((646 - T.PANEL_FIT.oy) / T.PANEL_FIT.s) - (646 + d)) < 1e-9);
        assert.ok(Math.abs(T.px((960 - T.PANEL_FIT.ox) / T.PANEL_FIT.s) - 960) < 1e-9, 'the screen\'s middle column stays');
        /* Toro: the brief's grid; at 58 it is the brief's own size */
        if (d <= MOST.toro) {
            build('toro', { lower: d, zoom: 1 });
            assert.ok(Math.abs(Guide.gy(704) - (646 + d)) < 1e-9 && Math.abs(Guide.gy(0)) < 1e-9);
            assert.ok(Math.abs(Guide.gx(960) - 960) < 1e-9);
            assert.ok(Math.abs(Guide.gs(1) - (646 / 704) * k) < 1e-12);
        }
    }
    build('toro', { lower: 58, zoom: 1 });
    assert.ok(Math.abs(Guide.gs(1) - 1) < 1e-12, 'Toro at 58: one screen pixel a unit of the brief');
    /* "fill the screen" cannot add to it: there is no room left to grow into */
    build('toro', { lower: 58, zoom: 1.06 });
    assert.ok(Math.abs(Guide.gs(1) - 1) < 1e-12);
    build('toro', { lower: 20, zoom: 0.94 });
    assert.ok(Math.abs(Guide.gs(1) - (646 / 704) * (666 / 646) * 0.94) < 1e-12, 'smaller is still smaller');
    /* a layer of the style stands where the scale puts it (to the pixel its box is rounded to) */
    for (const [style, ids] of [['track', ['platesL', 'platesR', 'speedDial', 'revDial', 'rails', 'fuelStrip', 'oilStrip']],
                                ['mplus', ['platesL', 'platesC', 'platesR', 'speedDial', 'revDial']],
                                ['mtrack', ['wing', 'plates', 'revDial', 'rows', 'oilStrip', 'fuelStrip']],
                                ['toro', ['gforce', 'bar_fuel', 'bar_oilT', 'icon_fuel']]]) {
        const plain = build(style), ids2 = ids.filter((id) => plain.layers.some((L) => L.id === id));
        assert.ok(ids2.length >= 2, `${style}: ${ids2}`);
        const was = ids2.map((id) => rect(plain.layers.find((L) => L.id === id)));
        const d = MOST[style], t = build(style, { lower: d });
        ids2.forEach((id, i) => {
            const now = rect(t.layers.find((L) => L.id === id)), want = Strip.lowerRect([was[i].x, was[i].y, was[i].w, was[i].h], d);
            assert.ok(Math.abs(now.x - want[0]) <= 3 && Math.abs(now.w - want[2]) <= 4, `${style}.${id}: x ${now.x} w ${now.w}, wanted ${want[0].toFixed(1)} ${want[2].toFixed(1)}`);
            assert.ok(Math.abs(now.y - want[1]) <= 3, `${style}.${id}: y ${now.y}, wanted ${want[1].toFixed(1)}`);
        });
    }
    build('track'); build('mtrack'); build('toro');
});

/* ------------------------------------------------- the gear, and the screen */

test('nothing of ours in the gear\'s columns, lowered or shaken, and nothing off the screen: every style, every amount', () => {
    let checked = 0;
    for (const style of STYLES) {
        for (const d of AMOUNTS) {
            for (const cfg of VARIANTS[style]) {
                const t = build(style, Object.assign({ lower: d }, cfg)), S = t.settings;
                const keep = Strip.keep(S), trimFoot = Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX;
                const columns = { x: keep.x, y: trimFoot, w: keep.w, h: Panel.PANEL_HEIGHT - trimFoot };
                assert.ok(t.layers.length <= 64, `${style} ${d}: ${t.layers.length} layers`);
                assert.strictEqual(new Set(t.layers.map((L) => L.id)).size, t.layers.length, 'no id twice');
                for (const L of t.layers) {
                    const b = rect(L), what = `${style} lowered ${d} ${JSON.stringify(cfg)}: ${L.id} (${b.x},${b.y} ${b.w}x${b.h})`;
                    assert.ok(b.w > 0 && b.h > 0, what + ' is empty');
                    assert.ok(b.x >= 0 && b.x + b.w <= Panel.PANEL_WIDTH && b.y >= 0 && b.y + b.h <= Panel.PANEL_HEIGHT, what + ' leaves the screen');
                    assert.ok(!hits(b, columns), what + ' stands in the gear\'s columns');
                    assert.ok(!Strip.overGear(b), what + ' is over the gear\'s window');
                    assert.ok(b.y + b.h <= Math.max(t.foot, L.belowCut ? Panel.PANEL_HEIGHT : 0), what + ' runs past the style\'s foot');
                    /* the limiter's shake moves every layer not marked still: as far as it can go, each way */
                    if (t.shakeKeys && !L.still) {
                        const a = S.shakePx;
                        for (const [dx, dy] of [[a, 0], [-a, 0], [0, a / 2], [a, a / 2], [-a, a / 2], [a, -a / 2]]) {
                            const moved = { x: b.x + Math.round(dx), y: b.y + Math.round(dy), w: b.w, h: b.h };
                            assert.ok(!hits(moved, columns) && !Strip.overGear(moved), what + ` is carried into the gear's columns by a jolt of ${dx}, ${dy}`);
                        }
                        assert.ok(Strip.clearOfGear(b, S, a), what);
                    }
                    checked++;
                }
                /* the strip is hidden under it: the trim right across, a cover each side of the gear to the screen's foot */
                const back = t.layers.find((L) => L.id === 'back' || L.id === 'bg');
                assert.strictEqual(back.y + back.h, trimFoot);
                const cl = t.layers.find((L) => L.id === 'stripL'), cr = t.layers.find((L) => L.id === 'stripR');
                assert.deepStrictEqual([cl.x, cl.y, cl.x + cl.w, cl.y + cl.h], [0, trimFoot, keep.x, 720]);
                assert.deepStrictEqual([cr.x, cr.y, cr.x + cr.w, cr.y + cr.h], [keep.x + keep.w, trimFoot, 1920, 720]);
            }
        }
    }
    assert.ok(checked > 5000, checked + ' layers checked');
    build('track'); build('mtrack'); build('toro');
});

test('Toro\'s speed stands beside BMW\'s gear letter: it and its unit are set clear of it, in either unit', () => {
    for (const units of ['imperial', 'metric']) {
        for (const shake of ['off', 'medium', 'hard']) {
            const t = build('toro', { lower: 58, units, shake }), S = t.settings;
            const guard = Strip.gearGuard(S, S.shakePx);
            const unit = t.layers.find((L) => L.id === 'speedUnit'), speed = t.layers.find((L) => L.id === 'speed');
            assert.ok(unit.x + unit.w <= guard.x && speed.x + speed.w <= guard.x, `${units}, shake ${shake}`);
            /* its words are inside its box (the box was not simply cut across them) */
            const u = unit.uniforms(state(t), 0);
            for (let g = 0; g < u.u_count; g++) {
                const q = u.u_quad.slice(g * 4, g * 4 + 4);
                assert.ok(q[0] >= -0.5 && q[0] + q[2] <= unit.w + 14, `${units}: the unit's glyph ${g} (${q[0].toFixed(1)} + ${q[2].toFixed(1)} in ${unit.w.toFixed(1)})`);
            }
            const s3 = speed.uniforms(state(t, Object.assign({}, RAW, { speedKmh: 288 })), 0);
            for (let g = 0; g < s3.u_count; g++) {
                const q = s3.u_quad.slice(g * 4, g * 4 + 4);
                assert.ok(q[0] >= 0 && q[0] + q[2] <= speed.w + 0.5 && q[1] + q[3] <= speed.h + 0.5, `${units}: three figures fit (${q.map((v) => v.toFixed(0))} in ${speed.w.toFixed(0)}x${speed.h.toFixed(0)})`);
            }
        }
    }
    /* as it comes the speed is where it always was */
    const plain = build('toro'), low0 = build('toro', { lower: 0 });
    assert.deepStrictEqual(rect(low0.layers.find((L) => L.id === 'speed')), rect(plain.layers.find((L) => L.id === 'speed')));
});

test('a drive, lowered: every layer finite at every moment and every figure on the screen', () => {
    for (const style of STYLES) {
        for (const units of ['imperial', 'metric']) {
            const t = build(style, { lower: 74, units, centre: 'waze', shake: 'hard' });
            const sim = Sim.create(P);
            for (let i = 0; i < 1200; i++) {
                sim.step(1 / 60);
                if (i % 30) continue;
                const st = state(t, sim.raw(), { centre: i % 60 ? OPEN : { mode: 'neutral', open: 0, maneuver: null }, now: i * 16, sinceOn: 30 });
                for (const L of t.layers) {
                    const u = L.uniforms(st, 0);
                    if (!u) continue;
                    for (const [k, v] of Object.entries(u)) {
                        const list = typeof v === 'number' ? [v] : Array.from(v);
                        assert.ok(list.every((x) => typeof x === 'number' && isFinite(x)), `${style}: ${L.id}.${k} at frame ${i}`);
                    }
                    if (L.shader !== 'text') continue;
                    for (let g = 0; g < u.u_count; g++) {
                        const q = u.u_quad.slice(g * 4, g * 4 + 4);
                        /* a glyph's cell is its ink and a little padding: the ink itself is well inside this */
                        assert.ok(L.x + q[0] >= -8 && L.x + q[0] + q[2] <= Panel.PANEL_WIDTH + 8 && L.y + q[1] + q[3] <= Panel.PANEL_HEIGHT + 8,
                            `${style} (${units}): a figure of ${L.id} leaves the screen at frame ${i}`);
                    }
                }
            }
        }
    }
    build('track'); build('mtrack'); build('toro');
});

/* ------------------------------------------------------ the picture's window */

test('a picture\'s window stays inside the car\'s map slot, however far the style is lowered', () => {
    const inSlot = (x, y) => x >= SLOT.x && x < SLOT.x + SLOT.w && y >= SLOT.y && y < SLOT.y + SLOT.h;
    for (const d of [0, 20, 40, 58, 74]) {
        /* the M styles: the picture's strength at a panel point, wide open */
        for (const [style, size] of [['track', 'standard'], ['track', 'more'], ['mplus', 'standard'], ['mplus', 'more'], ['mplus', 'most']]) {
            const t = build(style, { lower: d, centre: 'waze', centreSize: size });
            const reveal = Track.revealOf(t);
            let worst = 0, inside = 0;
            for (let y = 60; y < 700; y += 3) for (let x = 360; x < 1560; x += 3) {
                const r = reveal((x - M.ART.ox) / M.ART.s, (y - M.ART.oy) / M.ART.s);
                if (inSlot(x, y)) inside = Math.max(inside, r); else worst = Math.max(worst, r);
            }
            assert.ok(worst < 0.012, `${style} ${size} lowered ${d}: ${worst.toFixed(3)} of the picture's window outside the slot`);
            assert.ok(inside > 0.95, `${style} ${size} lowered ${d}: the window still opens (${inside.toFixed(2)})`);
            const w = t.window;
            if (d > 0) assert.ok(w.x >= SLOT.x && w.y >= SLOT.y && w.x + w.w <= SLOT.x + SLOT.w && w.y + w.h <= SLOT.y + SLOT.h, `${style} ${size} ${d}: ${JSON.stringify(w)}`);
        }
        /* M Track Mode: its wing's window begins where the slot does, on its soft fade */
        const mt = build('mtrack', { lower: d, centre: 'waze', wing: 'slot' });
        const slotLeft = (SLOT.x - T.ART.ox) / T.ART.s;
        assert.ok(T.windowX0() >= slotLeft + 2.5, `lowered ${d}: the window begins ${(T.windowX0() - slotLeft).toFixed(2)} units inside the slot`);
        for (let y = 60; y < 700; y += 3) for (let x = 120; x < 1000; x += 3) {
            if (!inSlot(x, y)) assert.strictEqual(T.revealAt((x - T.ART.ox) / T.ART.s, (y - T.ART.oy) / T.ART.s), 0, `M Track lowered ${d}: open at ${x}, ${y}`);
        }
        const st = state(mt, RAW, { centre: OPEN });
        for (const id of ['back', 'wing']) assert.strictEqual(mt.layers.find((L) => L.id === id).uniforms(st, 0).u_winX, T.windowX0(), id);
        assert.ok(mt.window.x >= SLOT.x && mt.window.x + mt.window.w <= SLOT.x + SLOT.w && mt.window.y + mt.window.h <= SLOT.y + SLOT.h);
        /* Toro's opening is the slot's own, on the panel: it does not move with the instrument */
        const toro = build('toro', { lower: d, centre: 'waze', centreSize: 'most' });
        assert.deepStrictEqual(toro.settings.hole, build('toro', { centre: 'waze', centreSize: 'most' }).settings.hole);
        for (let y = 0; y < 720; y += 6) for (let x = 0; x < 1920; x += 6) {
            if (!inSlot(x, y)) assert.ok(Toro.openAt(toro, x, y) < 0.012, `Toro lowered ${d}: open at ${x}, ${y}`);
        }
    }
    /* M Sport Plus's glass is held to the slot by its shader, and as the style comes that hold is far away */
    for (const id of ['mpback', 'mpbackWide', 'mpbackMost']) {
        assert.ok(/uniform vec4 u_slot;/.test(shaders[id]) && /\* inSlot\(p\)/.test(shaders[id]), id);
    }
    const far = build('mplus', { centre: 'waze', centreSize: 'most' });
    assert.deepStrictEqual(far.layers.find((L) => L.id === 'back').uniforms(state(far, RAW, { centre: OPEN }), 0).u_slot, [-8000, -8000, 8000, 8000]);
    assert.strictEqual(far.slot, null);
    const held = build('mplus', { centre: 'waze', centreSize: 'most', lower: 74 });
    const sl = held.layers.find((L) => L.id === 'back').uniforms(state(held, RAW, { centre: OPEN }), 0).u_slot;
    assert.ok(Math.abs(M.px(sl[0]) - SLOT.x) < 1e-6 && Math.abs(M.py(sl[1]) - SLOT.y) < 1e-6 &&
              Math.abs(M.px(sl[2]) - (SLOT.x + SLOT.w)) < 1e-6 && Math.abs(M.py(sl[3]) - (SLOT.y + SLOT.h)) < 1e-6);
    /* M Sport's own glass has no such hold, and needs none (above): its shaders are as they were */
    assert.ok(!/u_slot/.test(shaders.mback) && !/u_slot/.test(shaders.mbackWide));
    build('track'); build('mtrack'); build('toro');
});

/* -------------------------------------------- what lies over the whole style */

test('the limiter\'s flash and the start-up veil cover the lowered style, in three pieces round the gear', () => {
    for (const style of STYLES) {
        for (const wide of [false, true]) {
            const d = MOST[style];
            const t = build(style, { lower: d, revFlash: 'both', intro: true, bottomExtra: wide ? 'hideWide' : 'hide' }), S = t.settings;
            const keep = Strip.keep(S), trimFoot = Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX;
            for (const [name, shader] of [['flash', 'flashPart'], ['introVeil', 'veil']]) {
                const parts = ['', 'L', 'R'].map((sfx) => t.layers.find((L) => L.id === name + sfx));
                assert.ok(parts.every(Boolean), `${style}: ${name} in three`);
                parts.forEach((L) => { assert.strictEqual(L.shader, shader); assert.strictEqual(L.still, true, 'beside the gear: never shaken'); });
                assert.deepStrictEqual(parts.map((L) => [L.x, L.y, L.x + L.w, L.y + L.h]),
                    [[0, 0, 1920, trimFoot], [0, trimFoot, keep.x, t.foot], [keep.x + keep.w, trimFoot, 1920, t.foot]]);
            }
            /* each piece of the flash draws its share of one shape: the style's own rectangle */
            const st = state(t, RAW, { limiter: 1, now: 500, sinceOn: 1 });
            ['flash', 'flashL', 'flashR'].forEach((id) => {
                const L = t.layers.find((x) => x.id === id), u = L.uniforms(st, 0);
                assert.deepStrictEqual(u.u_frame, [L.x, L.y, 1920, t.foot], id);
                assert.strictEqual(u.u_on, 1);
                assert.ok(Clock.timeFor(L.shader, u, 500) !== null, 'it is given the clock');
            });
            /* the veil's two side pieces are the veil alone: its line is far off them */
            assert.ok(t.layers.find((L) => L.id === 'introVeil').uniforms(st, 0).u_lineY > 0);
            assert.ok(t.layers.find((L) => L.id === 'introVeilL').uniforms(st, 0).u_lineY < -5000);
        }
        /* lowered less than the trim, one piece is all there is room for */
        const few = build(style, { lower: 12, revFlash: 'both', intro: true });
        assert.ok(few.layers.find((L) => L.id === 'flash') && !few.layers.find((L) => L.id === 'flashL'));
        assert.strictEqual(few.layers.find((L) => L.id === 'flash').h, 646 + 12);
    }
    /* the piece's shader is the flash's own, but for where it measures from */
    const a = shaders.flash.split('\n'), b = shaders.flashPart.split('\n');
    assert.deepStrictEqual(b.filter((l) => a.indexOf(l) < 0), ['uniform vec4 u_frame;', '  vec2 p = (px() + u_frame.xy) / u_frame.zw;']);
    assert.deepStrictEqual(a.filter((l) => b.indexOf(l) < 0), ['  vec2 p = px() / u_size;']);
    assert.deepStrictEqual(Clock.GATES.flashPart, Clock.GATES.flash);
    build('track'); build('mtrack'); build('toro');
});

test('on the car: a lowered style\'s layers are sent whole, none cut at the old line; as it comes the cut is where it was', () => {
    function sent(theme) {
        const out = {}, byRef = {};
        let ref = 1;
        const cr = {
            asset: () => 999, pixels: () => {}, bind: () => {}, set: () => {}, drop: () => {},
            effect: (o) => { byRef[ref] = o; return ref++; },
            uniform: (r, name, v) => { if (name === 'u_keep') out[r] = v[0]; }
        };
        const c = Cluster.create({ cr, theme, shaders, atlas, atlasPixels: Buffer.alloc(4) });
        c.ready();
        return { keep: out, layers: byRef };
    }
    for (const style of STYLES) {
        const low = build(style, { lower: MOST[style] });
        const a = sent(low);
        assert.strictEqual(Object.keys(a.layers).length, low.layers.length, 'every layer was accepted');
        Object.keys(a.keep).forEach((r) => assert.strictEqual(a.keep[r], 0, `${style}: a lowered layer cut (${JSON.stringify(a.layers[r])})`));
        /* whole pixels, on the screen, and never over the gear's window */
        Object.values(a.layers).forEach((o) => {
            assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y) && Number.isInteger(o.w) && Number.isInteger(o.h));
            assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= 1920 && o.y + o.h <= 720, `${style}: ${JSON.stringify([o.x, o.y, o.w, o.h])}`);
            assert.ok(!Strip.overGear(o));
        });
        const plain = sent(build(style, { bottomExtra: 'hide' }));
        Object.keys(plain.keep).forEach((r) => assert.strictEqual(plain.keep[r], 0));
    }
    /* the safeguard itself still stands: a layer that strayed past the cut of a style as it comes would be cut there */
    const t = build('track');
    t.layers.push({ id: 'stray', z: 50, shader: 'cover', x: 100, y: 600, w: 50, h: 92, uniforms: () => ({ u_col: [1, 0, 0] }) });
    const s = sent(t), strayRef = Object.keys(s.layers).find((r) => s.layers[r].y === 600 && s.layers[r].h === 92);
    assert.ok(Math.abs(s.keep[strayRef] - 0.5) < 1e-9, 'cut at 646: half of it kept');
    build('track'); build('mtrack'); build('toro');
});

test('the holiday dressing and M Track Mode\'s right footer place keep to the screen when the style is lowered', () => {
    for (const style of STYLES) {
        for (const d of [20, MOST[style]]) {
            const t = build(style, { lower: d, holiday: true });
            const tree = t.layers.find((L) => L.id === 'tree');
            if (tree) assert.ok(tree.x >= 0 && tree.x + tree.w <= 1920 && tree.y + tree.h <= t.foot, `${style} ${d}: the tree`);
            t.layers.filter((L) => /^snow/.test(L.id)).forEach((L) => assert.ok(L.x >= 0 && L.w > 0 && L.x + L.w <= 1920, `${style} ${d}: ${L.id}`));
        }
    }
    for (const d of [0, 20, 40, 58, 74]) {
        for (const kind of ['outside', 'volts', 'economy', 'erange', 'rpm']) {
            const t = build('mtrack', { lower: d, footR: kind, units: 'metric', electric: 'hybrid' });
            const st = state(t, Object.assign({}, RAW, { evRangeKm: 38, avgL100: 9.4 }));
            t.layers.filter((L) => /^footR/.test(L.id)).forEach((L) => {
                const u = L.uniforms(st, 0);
                if (!u) return;
                for (let g = 0; g < u.u_count; g++) {
                    const q = u.u_quad.slice(g * 4, g * 4 + 4);
                    assert.ok(L.x + q[0] >= 0 && L.x + q[0] + q[2] <= 1920 && q[0] >= -0.5 && q[0] + q[2] <= L.w + 0.5, `lowered ${d}, ${kind}: ${L.id}`);
                }
            });
        }
    }
    build('mtrack');
});
