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
    { bottomExtra: 'hide' }, { lowerSet: true, lower: '74', bottomExtra: 'hide' }, { holiday: true, intro: true }];
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
