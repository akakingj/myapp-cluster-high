'use strict';
/*
 * Settings > Display > Speed limit sign (0.22.0): off as it comes and then not there; on, each style gets one sign,
 * in its own place (src/theme/overlays.js SLI), clear of the style's readouts and small pieces, of the KOMBI's
 * lights and turn arrows, of the driver camera's cowl, of the car's strip and of the glass's edges, with every centre, size and lowering; its
 * figures '--' until the car's value is read.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/geometry/panel.js');
const Themes = require('../src/theme/index.js');
const Overlays = require('../src/theme/overlays.js');
const atlas = require('../assets/fonts/atlas.json');

const STYLES = ['toro', 'track', 'mplus', 'mtrack'];
const CASES = [{}, { centre: 'waze' }, { centre: 'camera', centreSize: 'full' }, { centre: 'map', centreSize: 'more' },
    { bottomExtra: 'hide' }, { lowerSet: true, lower: '74', bottomExtra: 'hide' }, { holiday: true, intro: true },
    /* (Toro's gear at a corner, Gear position: right sat on the sign, 0.23.4) */
    { gearPlace: 'right' }, { gearPlace: 'left' }, { gearPlace: 'right', centre: 'map', centreSize: 'most' },
    { gearPlace: 'right', lowerSet: true, lower: '74' }];
const PANEL = Panel.PANEL_WIDTH * Panel.PANEL_HEIGHT;
const meet = (a, b, gap) => a.x - gap < b.x + b.w && a.x + a.w + gap > b.x && a.y - gap < b.y + b.h && a.y + a.h + gap > b.y;

test('off as it comes: no sign', () => {
    for (const style of STYLES) {
        const t = Themes.build(atlas, 'carprofile', { style });
        assert.ok(!t.layers.some((L) => /^sli/.test(L.id)), style);
    }
});

test('on: one sign a style, clear of its readouts, the KOMBI\'s lights and the strip', () => {
    for (const style of STYLES) for (const c of CASES) {
        const what = style + ' ' + JSON.stringify(c);
        const t = Themes.build(atlas, 'carprofile', Object.assign({ style, sliSign: true }, c));
        const disc = t.layers.filter((L) => L.id === 'sliDisc'), num = t.layers.filter((L) => L.id === 'sliNum');
        assert.strictEqual(disc.length, 1, what);
        assert.strictEqual(num.length, 1, what);
        const d = disc[0];
        assert.ok(d.w === d.h && d.x >= 8 && d.y >= 8 && d.x + d.w <= Panel.PANEL_WIDTH - 8 && d.y + d.h <= Panel.BOTTOM_CUT + (t.settings.lower || 0) - 6, what + ': on the glass, above the strip (a lowered style\'s foot)');
        assert.ok(d.z > 100 && num[0].z > d.z, what + ': over the style');
        Panel.TURN_ARROWS.concat(Panel.TELLTALES, [Object.assign({ name: 'the driver camera\'s cowl' }, Panel.CAMERA)])
            .forEach((z) => assert.ok(!meet(d, z, 8), what + ': clear of ' + z.name));
        /* (and of the glass's slanted top corners) */
        assert.ok(d.y > 200 || (d.x > 340 && d.x + d.w < 1640), what + ': clear of the glass\'s corners');
        /* the style's readouts and small pieces (the backgrounds, plates and dials, a sixth of the screen or more, aside) */
        /* (M Sport's and M Sport Plus's rails: the dials' foot lines across the screen, their box down to y 580 - the
           sign stands under the lines, between the range and the footer's panel, as the owner marked it; checked by
           eye, tools/shot.js style=track&sliSign=on, with lower=74 too; a lowered style's black covers over BMW's hidden
           strip, stripL / stripR, are backgrounds; M Track's footer middle, footM, is a box to x 788 for text that
           ends by about x 680 at its longest - ODO 999,999 km - against the sign's left edge at 693) */
        t.layers.filter((L) => !/^(sli|intro|snow|tree|flash|rails$|strip[LR]?$|footM(Unit)?$)/.test(L.id) && L.w * L.h < PANEL / 6)
            .forEach((L) => assert.ok(!meet(d, L, 6), what + ': clear of ' + L.id + ' ' + [L.x, L.y, L.w, L.h].map(Math.round).join(',')));
        /* the warning signs (0.29.0): two places, in one line with the sign - across, the sign leftmost, or down, the
           sign at the foot - each as clear as the sign is (half its gap between them), hidden while there is none */
        const warn = t.layers.filter((L) => /^warn\d$/.test(L.id));
        assert.strictEqual(warn.length, 2, what + ': two warning signs\' places');
        const sx = d.x + d.w / 2, sy = d.y + d.h / 2;
        const across = warn.every((w) => Math.abs(w.y + w.h / 2 - sy) <= 1 && w.x > sx), down = warn.every((w) => Math.abs(w.x + w.w / 2 - sx) <= 1 && w.y < sy);
        assert.ok(across || down, what + ': in line with the sign');
        warn.forEach((w, i) => {
            assert.ok(w.shader === 'warnsign' && w.z >= d.z && w.h === Overlays.WARN.h && w.w === Overlays.WARN_W, what + ': warn' + i);
            assert.ok(w.x >= 8 && w.y >= 8 && w.x + w.w <= Panel.PANEL_WIDTH - 8 && w.y + w.h <= Panel.BOTTOM_CUT + (t.settings.lower || 0) - 4, what + ': warn' + i + ' on the glass');
            Panel.TURN_ARROWS.concat(Panel.TELLTALES, [Object.assign({ name: 'the driver camera\'s cowl' }, Panel.CAMERA)])
                .forEach((z) => assert.ok(!meet(w, z, 6), what + ': warn' + i + ' clear of ' + z.name));
            assert.ok(w.y > 200 || (w.x > 340 && w.x + w.w < 1640), what + ': warn' + i + ' clear of the glass\'s corners');
            t.layers.filter((L) => !/^(sli|warn|intro|snow|tree|flash|rails$|strip[LR]?$)/.test(L.id) && L.w * L.h < PANEL / 6)
                .forEach((L) => assert.ok(!meet(w, L, 6), what + ': warn' + i + ' clear of ' + L.id + ' ' + [L.x, L.y, L.w, L.h].map(Math.round).join(',')));
            assert.ok(!meet(w, d, 4) && (!i || !meet(w, warn[0], 4)), what + ': warn' + i + ' apart');
            assert.strictEqual(w.uniforms({}), null, what + ': hidden while none');
        });
        /* the shader drawn, its figures '--' until the car's value */
        assert.ok(d.uniforms({}) && d.shader === 'sign', what);
        const u = num[0].uniforms({});
        assert.ok(u && u.u_count === 2, what + ': two glyphs, "--"');
    }
});

test('the figures: the car\'s, once read, else --', () => {
    assert.strictEqual(Overlays.sliText({}), '--');
    assert.strictEqual(Overlays.sliText({ speedLimit: 0 }), '--');
    assert.strictEqual(Overlays.sliText({ speedLimit: 79.6 }), '80');
    assert.strictEqual(Overlays.sliText({ speedLimit: 120 }), '120');
});

test('the car\'s limit reaches the sign: the reader\'s speedLimit through the state to the figures', () => {
    const State = require('../src/engine/state.js');
    const Sim = require('../preview/sim.js');
    const profile = Panel.profile('carprofile');
    const raw = Sim.create(profile).raw();
    assert.strictEqual(Overlays.sliText(State.present(Object.assign({}, raw, { speedLimit: undefined }), profile, {})), '--');
    assert.strictEqual(Overlays.sliText(State.present(Object.assign({}, raw, { speedLimit: 70 }), profile, {})), '70');
});

test('the warning signs\' pictures: the i-th the state\'s i-th, an unknown one the danger sign\'s', () => {
    const Signs = require('../src/theme/signs.js');
    assert.strictEqual(Signs.h, Overlays.WARN.h, 'tools/make-signs.py made for WARN.h');
    assert.deepStrictEqual(Overlays.warnUniforms({ roadSigns: ['wild_animal', 'no_passing'] }, 1).u_cell, Signs.cells.no_passing);
    assert.deepStrictEqual(Overlays.warnUniforms({ roadSigns: ['nothing_such'] }, 0).u_cell, Signs.cells.danger);
    assert.strictEqual(Overlays.warnUniforms({ roadSigns: ['wild_animal'] }, 1), null);
    for (const n of Object.keys(Signs.cells)) {
        const c = Signs.cells[n];
        assert.ok(c[3] === Signs.h && c[2] <= Overlays.WARN_W && c[0] + c[2] <= Signs.w && c[1] + c[3] <= Signs.ah, n);
    }
    const px = require('zlib').inflateSync(Buffer.from(Signs.z, 'base64'));
    assert.strictEqual(px.length, Signs.w * Signs.ah * 4);
});

test('the camera\'s signs reach the state: a warning 10 s, a new one in its place; no passing till its zone ends (0.29.1)', () => {
    const RS = require('../src/car/road_signs.js');
    const V = require('../src/car/vehicle.js');
    const State = require('../src/engine/state.js');
    const r = V.createReader();
    const ev = (...t) => ({ trafficSignRecognition: { numberSigns: t.length }, trafficSign: t.map((type) => ({ type, value: 0 })) });
    const t0 = 1000000;
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('DS_ANIMAL_CROSSING', 'SPEED_LIMIT'), t0);
    assert.deepStrictEqual(r.raw(t0 + 100).roadSigns, ['wild_animal']);
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('GIVE_WAY'), t0 + 200);
    assert.deepStrictEqual(r.raw(t0 + 300).roadSigns, ['give_way'], 'give way: shown as on the head-up display (0.29.6), in its place');
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('MANDATORY_PASSING_RIGHT', 'SPEED_LIMIT'), t0 + 350);
    assert.deepStrictEqual(r.raw(t0 + 360).roadSigns, ['give_way'], 'an instruction sign or the speed limit: not shown, nothing replaced');
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('DS_SPLIPPERY_ROAD'), t0 + 400);
    assert.deepStrictEqual(r.raw(t0 + 500).roadSigns, ['slippery'], 'a new one in its place');
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('DS_TRAFFIC_JAM', 'DS_ANIMAL_CROSSING'), t0 + 600);
    assert.deepStrictEqual(r.raw(t0 + 700).roadSigns, ['traffic_jam', 'wild_animal'], 'one event\'s two');
    assert.deepStrictEqual(r.raw(t0 + 10600).roadSigns, [], '10 s on: gone');
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('NO_PASSING_SIGN'), t0 + 20000);
    assert.deepStrictEqual(r.raw(t0 + 80000).roadSigns, ['no_passing'], 'a minute on: still on');
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('DS_ANIMAL_CROSSING'), t0 + 81000);
    assert.deepStrictEqual(r.raw(t0 + 81100).roadSigns, ['no_passing', 'wild_animal']);
    assert.ok(/^warning signs \(front camera\): DS_ANIMAL_CROSSING, [\d.]+ s ago; seen .*; no passing on, 0\.00 km since its sign$/.test(r.sliLog(t0 + 81200).split('\n')[2]), r.sliLog(t0 + 81200).split('\n')[2]);
    r.receive(RS.CAM_IFACE, RS.CAM_EVENT, ev('NO_PASSING_END'), t0 + 82000);
    assert.deepStrictEqual(r.raw(t0 + 82100).roadSigns, ['wild_animal'], 'its end sign');
    /* (the sign services' fields: AK Cluster Info's Test log's, 0.29.3) */
    assert.ok(!/TrafficSignRecognition changes|head-up display fields|no passing changes/.test(r.sliLog(t0 + 84000)));
    const profile = Panel.profile('carprofile');
    const Sim = require('../preview/sim.js');
    const st = State.present(Object.assign({}, Sim.create(profile).raw(), { roadSigns: ['slippery'] }), profile, {});
    assert.deepStrictEqual(st.roadSigns, ['slippery']);
    assert.strictEqual(RS.artOf('DS_SPLIPPERY_ROAD'), 'slippery');
    assert.strictEqual(RS.artOf('DS_NEW_ONE'), 'danger');
    assert.deepStrictEqual(RS.parseSigns(JSON.stringify(ev('DS_TRAFFIC_JAM'))), ['DS_TRAFFIC_JAM']);
});

test('no passing\'s zone: from its sign till its end sign, or 3 km driven since the sign', () => {
    const RS = require('../src/car/road_signs.js');
    ['NO_PASSING_SIGN', 'NO_OVERTAKING'].forEach((t) => assert.ok(RS.npStart(t) && !RS.npEnd(t), t));
    /* the car's catalog (G20, 2026-11-28): an empty place of the event's 20 is SIGNAL_UNFILLED, never a sign; BMW's
       DS_BYCICLE_CROSSING is a bicycle */
    assert.deepStrictEqual(RS.parseSigns({ trafficSignRecognition: { numberSigns: 20 }, trafficSign: [{ type: 'DS_CHILDREN' }, { type: 'SIGNAL_UNFILLED' }] }), ['DS_CHILDREN']);
    assert.deepStrictEqual(['DS_BYCICLE_CROSSING', 'DS_TRAFFIC_LIGHT', 'DS_GIVE_WAY_ROUNDABOUT'].map(RS.artOf), ['bicycle', 'traffic_lights', 'roundabout']);
    ['WITHDRAWAL_NO_PASSING_SIGN', 'GENERAL_WITHDRAWAL', 'NO_PASSING_END', 'END_OF_NO_PASSING', 'END_OF_ALL_RESTRICTIONS', 'NO_OVERTAKING_CANCEL'].forEach((t) => assert.ok(RS.npEnd(t) && !RS.npStart(t), t));
    const z = RS.makeZone(3);
    z.add(['NO_PASSING_SIGN']);
    for (let t = 0; t <= 170000; t += 1000) z.step(t, 60);
    assert.ok(z.on());
    for (let t = 171000; t <= 200000; t += 1000) z.step(t, 60);
    assert.ok(!z.on(), '3 km driven: gone');
});

test('the car\'s 79 sign types (0.29.6): each one shown has its picture in the atlas; the instruction signs and the limits hidden', () => {
    const RS = require('../src/car/road_signs.js'), S = require('../src/theme/signs.js');
    assert.strictEqual(Object.keys(RS.KNOWN).length, 79);
    Object.keys(RS.KNOWN).filter(RS.warning).forEach((n) => assert.ok(S.cells[RS.artOf(n)], n + ': ' + RS.artOf(n)));
    assert.deepStrictEqual(['GIVE_WAY', 'STOP_SIGN', 'NO_ENTRY', 'VEHICLES_PROHIBITED', 'NO_STANDING_ANYTIME', 'DS_ONE_BUMP'].map(RS.artOf),
        ['give_way', 'stop', 'no_entry', 'no_cars', 'no_stopping', 'speed_hump']);
    ['SPEED_LIMIT', 'NO_PASSING_SIGN', 'MANDATORY_PASSING_RIGHT', 'SIGNAL_UNFILLED', 'ALL_VEHICLES_PROHIBITED'].forEach((n) => assert.ok(!RS.warning(n), n));
});
