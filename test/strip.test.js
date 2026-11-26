'use strict';
/*
 * BMW's bottom strip: what we lay over it, in every style, for every value
 * the setting can hold - and that none of it ever reaches the gear.
 *
 * The rule's reason is in docs/CLUSTER-CONSTRAINTS.md section 2: cover the
 * gear's window in the strip and the KOMBI draws a black fallback box in the
 * rev dial, which stays until the cluster restarts. It did on the car, with
 * the old "cover a little" (24 px: to y 670, the window starting at 665).
 * Run: node --test test/strip.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');

const Panel = require('../src/geometry/panel.js');
const Strip = require('../src/theme/strip.js');
const Themes = require('../src/theme/index.js');
const Palette = require('../src/theme/palette.js');
const parts = require('../src/shaders/parts.js');
const atlas = require('../assets/fonts/atlas.json');
const spec = require('../app/app.base.json');

const STYLES = ['toro', 'track', 'mplus'];
/* what the setting offers, what earlier versions saved, and nonsense */
const offered = spec.settings.find((s) => s.key === 'bottomExtra').options.map((o) => o[0]);
const VALUES = offered.concat([0, 6, 12, 18, 24, 48, 74, 'hide', 'hideWide', true, '24', '48', '74', 19, 30, 39, 40, 1000, -5, 'x', null, undefined]);
/* the two ways to hide it, and the columns each leaves open for the gear */
const HIDES = [['hide', Panel.GEAR_KEEP], ['hideWide', Panel.GEAR_KEEP_WIDE]];

test('the setting: On (the trim at 18, above the gear) and Off ("hide")', () => {
    assert.deepStrictEqual(offered, ['18', 'hide']);
    assert.strictEqual(Panel.STRIP_TRIM_MAX, 18);
    for (const v of VALUES) {
        const r = Strip.resolve(v);
        assert.ok(r.trim >= 0 && r.trim <= Panel.STRIP_TRIM_MAX, `${v}: trim ${r.trim}`);
        assert.ok(Panel.BOTTOM_CUT + r.trim < Panel.GEAR_TRIGGER_WINDOW.y, `${v}: the trim reaches the gear's window`);
        assert.strictEqual(typeof r.hide, 'boolean');
        assert.strictEqual(typeof r.wide, 'boolean');
        assert.ok(r.hide || !r.wide, `${v}: a gap with nothing hidden`);
    }
    assert.deepStrictEqual(Strip.resolve('0'), { trim: 0, hide: false, wide: false });
    assert.deepStrictEqual(Strip.resolve('12'), { trim: 12, hide: false, wide: false });
    assert.deepStrictEqual(Strip.resolve('hide'), { trim: 18, hide: true, wide: false });
    assert.deepStrictEqual(Strip.resolve('hideWide'), { trim: 18, hide: true, wide: true });
    /* saved by earlier versions: "a little" is the largest trim, the rest hide */
    assert.deepStrictEqual(Strip.resolve('24'), { trim: 18, hide: false, wide: false });
    assert.deepStrictEqual(Strip.resolve('48'), { trim: 18, hide: true, wide: false });
    assert.deepStrictEqual(Strip.resolve('74'), { trim: 18, hide: true, wide: false });
    /* and the app's own settings carry them over when they are loaded: the trims to On, the ways to hide it to Off */
    const item = spec.settings.find((s) => s.key === 'bottomExtra');
    assert.deepStrictEqual(item.aliases, { 0: '18', 6: '18', 12: '18', 24: '18', 48: 'hide', 74: 'hide', hideWide: 'hide' });
    assert.deepStrictEqual(item.options.map((o) => o[1]), ['On', 'Off']);
});

test('no layer of any style, for any value, reaches into the gear\'s window', () => {
    const g = Panel.GEAR_TRIGGER_WINDOW;
    for (const style of STYLES) {
        for (const v of VALUES) {
            for (const extras of [{}, { holiday: true, intro: true }]) {
                const theme = Themes.build(atlas, 'carprofile', Object.assign({ style, bottomExtra: v }, extras));
                for (const L of theme.layers) {
                    const x0 = Math.floor(L.x), y0 = Math.floor(L.y), x1 = Math.ceil(L.x + L.w), y1 = Math.ceil(L.y + L.h);
                    assert.ok(!Strip.overGear({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }),
                        `${style} / bottomExtra ${String(v)}: layer ${L.id} (${x0},${y0} to ${x1},${y1}) is over the gear's window ` +
                        `(${g.x},${g.y} ${g.w}x${g.h})`);
                    assert.ok(y1 <= Panel.PANEL_HEIGHT && x1 <= Panel.PANEL_WIDTH && x0 >= 0 && y0 >= 0, `${L.id} off the panel`);
                }
            }
        }
    }
});

test('hide: the strip is covered each side of the gear, in black, by layers that never move', () => {
    const g = Panel.GEAR_TRIGGER_WINDOW;
    for (const [value, k] of HIDES) {
        /* the columns kept open hold the whole window, and are never over it */
        assert.ok(k.x < g.x && k.x + k.w >= g.x + g.w + 24, `${value}: the gear's window is inside what is kept open`);
        for (const style of STYLES) {
            const theme = Themes.build(atlas, 'carprofile', { style, bottomExtra: value });
            const covers = theme.layers.filter((L) => /^strip[LR]$/.test(L.id));
            assert.strictEqual(covers.length, 2, style);
            const [left, right] = covers;
            const top = Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX;
            assert.deepStrictEqual([left.x, left.y, left.w, left.y + left.h], [0, top, k.x, Panel.PANEL_HEIGHT]);
            assert.deepStrictEqual([right.x, right.y, right.x + right.w, right.y + right.h],
                [k.x + k.w, top, Panel.PANEL_WIDTH, Panel.PANEL_HEIGHT]);
            covers.forEach((L) => {
                assert.strictEqual(L.shader, 'cover');
                assert.strictEqual(L.still, true, 'the shake must not move a cover');
                assert.strictEqual(L.belowCut, true);
                assert.deepStrictEqual(L.uniforms({}), { u_col: [0, 0, 0] });
                /* whole pixels: a cover's edge is where it says, not a blend into the gear */
                [L.x, L.y, L.w, L.h].forEach((n) => assert.strictEqual(n, Math.round(n)));
            });
            /* the background stops on the row above the gear, and goes down to black there */
            const back = theme.layers.find((L) => L.id === 'bg' || L.id === 'back');
            assert.strictEqual(back.y + back.h, top);
            assert.strictEqual(back.still, true);
            assert.deepStrictEqual(back.uniforms({}).u_foot, [Panel.BOTTOM_CUT, Panel.STRIP_TRIM_MAX, 0], 'hidden: no notch, the trim right across');
            /* nothing else below the cut */
            theme.layers.forEach((L) => {
                if (L === back || covers.indexOf(L) >= 0) return;
                assert.ok(L.y + L.h <= Panel.BOTTOM_CUT, `${style}: ${L.id} past the cut`);
            });
            assert.strictEqual(theme.settings.stripHide, true);
            assert.strictEqual(theme.settings.stripWide, value === 'hideWide');
        }
    }
    assert.ok(parts.cover.includes('gl_FragColor = vec4(u_col, 1.0)'), 'the cover is one opaque colour');
});

test('hide covers the driving mode\'s name to its last letter; the wider gap is the one from before', () => {
    const g = Panel.GEAR_TRIGGER_WINDOW;
    /*
     * BMW writes the mode from x 1224 on this car, towards the gear (off two
     * photographs: "SPORT" is x 1224 - 1310, the gear letter from 1392). In
     * its lettering "COMFORT" and "ADAPTIVE" then end at about 1350 - 1362
     * and "SPORT PLUS" at 1382 - 1385, against the gear. With 1340 left open
     * the T of COMFORT showed, on the car.
     */
    const COMFORT_ENDS = 1362, LONGEST_ENDS = 1385;
    assert.ok(Panel.GEAR_KEEP_WIDE.x < COMFORT_ENDS, 'the old gap is what showed it');
    assert.ok(Panel.GEAR_KEEP.x > COMFORT_ENDS, 'COMFORT is covered');
    /* a column short of the window: what is left of the longest name is no wider than that */
    assert.strictEqual(Panel.GEAR_KEEP.x, g.x - 1);
    assert.ok(LONGEST_ENDS - Panel.GEAR_KEEP.x <= 1);
    /* the gap from before is exactly that: x 1340 - 1500, as driven on this car */
    assert.deepStrictEqual(Panel.GEAR_KEEP_WIDE, { x: 1340, w: 160 });
    assert.strictEqual(Panel.GEAR_KEEP.x + Panel.GEAR_KEEP.w, 1500, 'the right-hand cover has not moved');
    assert.strictEqual(Strip.keep({ stripWide: true }), Panel.GEAR_KEEP_WIDE);
    assert.strictEqual(Strip.keep({ stripWide: false }), Panel.GEAR_KEEP);
    assert.strictEqual(Strip.keep(null), Panel.GEAR_KEEP);
    /* no cover is over the window, and none touches it by a fraction of a pixel */
    for (const [value] of HIDES) {
        for (const L of Strip.layers(Palette.resolve({ bottomExtra: value }, Panel.profile('carprofile')), [0, 0, 0])) {
            assert.ok(!Strip.overGear(L), `${value}: ${L.id}`);
            assert.ok(L.x + L.w <= g.x || L.x >= g.x + g.w, `${value}: ${L.id} beside the window, not over it`);
        }
    }
    /* an install that saved "hide" gets the closer cover without choosing anything */
    assert.deepStrictEqual(Strip.resolve('hide'), { trim: 18, hide: true, wide: false });
});

test('show and trim: no covers, the background alone, as far as asked', () => {
    for (const style of STYLES) {
        for (const v of ['0', '6', '12', '18']) {
            const theme = Themes.build(atlas, 'carprofile', { style, bottomExtra: v });
            assert.strictEqual(theme.layers.filter((L) => /^strip/.test(L.id)).length, 0);
            const back = theme.layers.find((L) => L.id === 'bg' || L.id === 'back');
            assert.strictEqual(back.h, Panel.BOTTOM_CUT + Number(v), `${style} ${v}`);
            assert.strictEqual(theme.settings.bottomExtra, Number(v));
            assert.strictEqual(theme.settings.stripHide, false);
        }
    }
    assert.strictEqual(Palette.resolve({ bottomExtra: 'hide' }, Panel.profile('carprofile')).stripHide, true);
    assert.strictEqual(Palette.resolve({ bottomExtra: 'hide' }, Panel.profile('carprofile')).stripWide, false);
    assert.strictEqual(Palette.resolve({ bottomExtra: 'hideWide' }, Panel.profile('carprofile')).stripWide, true);
    assert.strictEqual(Palette.resolve({ bottomExtra: '18' }, Panel.profile('carprofile')).stripWide, false);
});

test('with the strip in view the background stops short over the driving mode, as Cluster Layouts\' band', () => {
    /* a two-line mode ("ECO PRO" over "INDIVIDUAL") has its first line's tops at about y 660: the trim to 664 cut them
       (a photo of the car, 2026-11-26); Layouts' band stops at 658 over x 1196 - 1424 */
    const N = Panel.STRIP_NOTCH;
    assert.deepStrictEqual([N.x, N.x + N.w, N.y], [1196, 1424, 658]);
    assert.ok(N.y < 660 && N.y > Panel.BOTTOM_CUT);
    assert.ok(N.x + N.w > Panel.GEAR_TRIGGER_WINDOW.x, 'right up to the gear');
    for (const style of STYLES.concat(['mtrack'])) {
        const on = Themes.build(atlas, 'carprofile', { style, bottomExtra: '18' });
        const back = on.layers.find((L) => L.id === 'bg' || L.id === 'back');
        assert.deepStrictEqual(back.uniforms({}).u_foot, [Panel.BOTTOM_CUT, Panel.STRIP_TRIM_MAX, 1], style);
        const off = Themes.build(atlas, 'carprofile', { style, bottomExtra: 'hide' });
        assert.strictEqual(off.layers.find((L) => L.id === 'bg' || L.id === 'back').uniforms({}).u_foot[2], 0, style);
    }
    /* every background that runs past the cut leaves the notch open, at the panel's own numbers */
    const all = Object.assign({}, require('../src/shaders/core.js'), require('../src/shaders/mcluster.js'), require('../src/shaders/tcluster.js'));
    const feet = Object.keys(all).filter((k) => typeof all[k] === 'string' && /u_foot/.test(all[k]));
    assert.deepStrictEqual(feet.sort(), ['bg', 'mback', 'mbackFull', 'mbackWide', 'mpback', 'mpbackMost', 'mpbackWide', 'mtback']);
    const f = (v) => v.toFixed(1);
    for (const k of feet) {
        const src = all[k];
        assert.match(src, /uniform vec3 u_foot;/, k);
        const line = src.split('\n').find((l) => /u_foot\.z > 0\.5/.test(l));
        assert.ok(line, k + ' has the notch');
        for (const v of [N.y, N.x, N.x + N.w]) assert.ok(line.includes(f(v)), k + ': ' + v);
        assert.match(line, /col = vec3\(0\.0\); a = 0\.0;/, k + ': clear there, whichever way it is blended');
        /* and it is the last word before the colour goes out */
        const lines = src.split('\n'), i = lines.indexOf(line);
        assert.match(lines[i + 1], /gl_FragColor/, k);
    }
});

test('the fallback box this car draws is on record, and is what the old setting covered', () => {
    /* measured off a photograph of the cluster laid over our render */
    const b = Panel.FALLBACK_GEAR_BOX;
    assert.deepStrictEqual([b.x, b.y, b.w, b.h], [1407, 337, 188, 82]);
    /* it is not a keep-clear zone: with the gear left alone it is not there */
    assert.ok(Panel.keepClear('carprofile').every((z) => z.id !== b.id));
    /* the old "a little" ran across the gear's window; nothing offered now does */
    assert.ok(Strip.overGear({ x: 0, y: 0, w: Panel.PANEL_WIDTH, h: Panel.BOTTOM_CUT + 24 }));
    assert.ok(!Strip.overGear({ x: 0, y: 0, w: Panel.PANEL_WIDTH, h: Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX }));
});
