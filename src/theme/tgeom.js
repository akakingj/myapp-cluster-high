(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUTGeom = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /*
     * M Track Mode's geometry, traced off its reference frame
     * (docs/ref/m-track-reference.jpg, 1582 x 579) and kept in that frame's
     * coordinates - the "artboard" - after one correction: the photograph
     * is of a curved display taken off its axis, so it was levelled and
     * squared first (docs/ref/M-TRACK-MEASUREMENTS.md has the two fitted
     * maps and their residuals). Everything below is in that rectified
     * frame. One copy, read by the shaders (src/shaders/tcluster.js), the
     * layout (src/theme/mtrack.js) and the comparison tool
     * (tools/mt-compare.py).
     *
     * Rectified, every diagonal in the frame has one lean - the measured
     * slopes run 0.569 to 0.593, the three long lines of the rev counter
     * 0.5854 to 0.5861 - so each is set on that lean (K) through its own
     * measured middle: none moves 1.5 units at its far end.
     *
     *   a line leaning "/"   x = c - K y     (u = x + K y is constant on it)
     *   a line leaning "\"   x = c + K y     (w = x - K y is constant on it)
     */

    /* The artboard, and where it sits on the 1920 x 720 panel: fitted
       uniformly, the footer's figures ending just above the car's own
       bottom strip (y 646), and far enough right that the picture a map
       or a camera brings - which the car draws at 416,120 1088x480 and
       nowhere else - reaches the left wing from where its gauge rows
       begin (artboard x 282). */
    var PANEL_FIT = { s: 1.17, ox: 86, oy: 8 };
    var ART = { w: 1582, h: 579, s: PANEL_FIT.s, ox: PANEL_FIT.ox, oy: PANEL_FIT.oy };
    /* another fit, for tools: the comparison renders the artboard 1:1 (see mgeom.js) */
    var BASE_FIT = PANEL_FIT;
    function setFit(f) {
        BASE_FIT = f || PANEL_FIT;
        ART.s = BASE_FIT.s; ART.ox = BASE_FIT.ox; ART.oy = BASE_FIT.oy;
    }
    /* the fit in use, lowered (src/theme/strip.js, BETA): set by the layout at the start of
       every build - null for "off" - as mgeom.js's */
    /* (whole: the fit stands the whole wing inside the car's picture - wholeFit, below) */
    var WHOLE = false;
    function useFit(f, whole) {
        f = f || BASE_FIT;
        ART.s = f.s; ART.ox = f.ox; ART.oy = f.oy;
        WHOLE = !!whole;
    }
    function baseFit() { return { s: BASE_FIT.s, ox: BASE_FIT.ox, oy: BASE_FIT.oy }; }
    /* the car's map slot: where a hosted picture lies on the panel, and nowhere else */
    var SLOT = { x: 416, y: 120, w: 1088, h: 480 };
    function px(x) { return ART.ox + x * ART.s; }
    function py(y) { return ART.oy + y * ART.s; }
    function pd(d) { return d * ART.s; }
    function box(x0, y0, x1, y1) {
        var X0 = Math.floor(px(x0)), Y0 = Math.floor(py(y0));
        return { x: X0, y: Y0, w: Math.ceil(px(x1)) - X0, h: Math.ceil(py(y1)) - Y0 };
    }

    var K = 0.5855;                 /* the lean: x per unit down */
    var COS = 1 / Math.sqrt(1 + K * K);     /* level -> across a diagonal */
    function slash(c, y) { return c - K * y; }
    function back(c, y) { return c + K * y; }
    /* where a "/" line (u = c1) meets a "\" one (w = c2) */
    function meet(c1, c2) { var y = (c1 - c2) / (2 * K); return [c1 - K * y, y]; }

    /* ------------------------------------------------------------- the body */
    /*
     * The blue body: a pointed wing on the left, and right of a black seam
     * an upper plate, the black band the gear stands on, a lower plate, and
     * past a second seam a ribbon that comes to a point on the right. Each
     * is a convex polygon, clockwise, with a radius per corner (0: sharp).
     */
    var BODY = { top: 111.6, bottom: 444.5, bandTop: 194.4, bandBottom: 300.05 };
    /* the diagonals, by their constant (u for "/", w for "\") */
    var LINE = {
        wingUp: 289.06,             /* "/" the wing's upper left edge */
        wingLow: -68.8,             /* "\" its lower left edge */
        wingRight: 751.1,           /* "/" its right edge: the first seam's left side */
        seam1: 756.1,               /* "/" the plates' left edge: the first seam's right side */
        seam2: 1034.0,              /* "/" the plates' right edge */
        ribbonLeft: 1039.5,         /* "/" the ribbon's left edge: the second seam's right side */
        ribbonOut: 1145.96,         /* "/" the ribbon's outer edge below its point */
        chevron: 844.49             /* "\" the upper plate's and the ribbon's outer edge above it */
    };
    var T = BODY.top, B = BODY.bottom;
    var WING = {
        v: [[slash(LINE.wingUp, T), T], [slash(LINE.wingRight, T), T], [slash(LINE.wingRight, B), B],
            [back(LINE.wingLow, B), B], meet(LINE.wingUp, LINE.wingLow)],
        r: [0, 0, 0, 30, 19]
    };
    var PLATES = {
        upper: { v: [[slash(LINE.seam1, T), T], [back(LINE.chevron, T), T], meet(LINE.seam2, LINE.chevron),
                     [slash(LINE.seam2, BODY.bandTop), BODY.bandTop], [slash(LINE.seam1, BODY.bandTop), BODY.bandTop]],
                 r: [0, 0, 0, 0, 0] },
        lower: { v: [[slash(LINE.seam1, BODY.bandBottom), BODY.bandBottom], [slash(LINE.seam2, BODY.bandBottom), BODY.bandBottom],
                     [slash(LINE.seam2, B), B], [slash(LINE.seam1, B), B]],
                 r: [0, 0, 0, 0] },
        ribbon: { v: [meet(LINE.ribbonLeft, LINE.chevron), meet(LINE.ribbonOut, LINE.chevron),
                      [slash(LINE.ribbonOut, B), B], [slash(LINE.ribbonLeft, B), B]],
                  r: [0, 0, 26, 0] }
    };
    /* the black band between the plates, a shade lifted off the ground */
    var BAND = { v: [[slash(LINE.seam1, BODY.bandTop), BODY.bandTop], [slash(LINE.seam2, BODY.bandTop), BODY.bandTop],
                     [slash(LINE.seam2, BODY.bandBottom), BODY.bandBottom], [slash(LINE.seam1, BODY.bandBottom), BODY.bandBottom]],
                 r: [0, 0, 0, 0] };

    /*
     * A plate's light by height, the same for every plate (0..255, fitted
     * to the frame: bright at the top, darkest behind the gear, lighter
     * again towards the foot): [y, r, g, b]. The wing darkens to its left
     * as well (`wingShade` per unit left of `wingShadeFrom`), the ribbon a
     * little to its right.
     */
    var LIGHT = [[112, 46, 87, 190], [200, 38, 71, 146], [280, 33, 62, 126], [340, 35.5, 67.5, 139], [444, 45, 83, 178]];
    var SHADE = { wingFrom: 600, wing: 0.00081, ribbonFrom: 900, ribbon: 0.0007 };
    /*
     * The three M bands in the wing, each between two "/" lines (u), and
     * how strongly each shows by height ([y, strength] knots): the light
     * blue and the red fade out two thirds of the way down, as the frame
     * has them. `add` is what a band at full strength adds to the plate
     * (0..255); the middle one only deepens it (`mul`).
     */
    var BANDS = {
        light: { u: [482.2, 546.5], add: [15, 29, 72], s: [[112, 0.8], [215, 1.0], [280, 0.97], [330, 0.2], [360, 0]] },
        mid: { u: [546.5, 610.3], mul: [0.84, 0.90, 1.03], s: [[112, 1], [330, 1], [444, 0.5]] },
        red: { u: [610.3, 673.0], add: [100, -11, -30], s: [[112, 0.45], [175, 1.0], [215, 0.95], [274, 0.71], [331, 0.23], [375, 0]] }
    };
    /*
     * The fine lines: two long diagonals that run through the plates and
     * on across the black (A, U1), a level one (H, H2), and the short ones
     * that stop on them. Each is [x0, y0, x1, y1, strength on a plate]; a
     * layer draws the ones named for it, on its own plates only, and out
     * on the black a line is far fainter (the shaders' own figure).
     */
    var HAIRLINES = {
        A: [slash(620.1, 72), 72, slash(620.1, 548), 548, 0.13],            /* the long "/", from over the wing to under it */
        H: [494.5, 218.0, slash(LINE.wingRight, 218.0), 218.0, 0.14],       /* level, from B to the first seam */
        B: [back(366.1, 218.0), 218.0, back(366.1, 412.8), 412.8, 0.20],    /* "\" from H down across the seam to D */
        F: [back(133.6, 414), 414, back(133.6, 512), 512, 0.08],            /* "\" off A, out through the wing's foot */
        U1: [back(819.0, 112), 112, back(819.0, 545), 545, 0.20],           /* the long "\", from the upper plate's top */
        D: [slash(849.9, 300), 300, slash(849.9, 480), 480, 0.10],          /* "/" down the lower plate and out */
        R1: [slash(1077.3, 414), 414, slash(1077.3, 490), 490, 0.10],       /* "/" in the ribbon's foot */
        R2: [833.0, 414.0, 906.0, 414.0, 0.10],                             /* level, off R1 */
        H2: [back(819.0, 218.7), 218.7, 1392.0, 218.7, 0.12],               /* level, off U1, away to the right */
        T5: [back(1043.5, 246), 246, back(1043.5, 307), 307, 0.07]          /* a short "\" by the rev counter's 5 */
    };
    var HAIR = {
        wing: ['A', 'H', 'B', 'F'],
        plates: ['U1', 'B', 'D', 'R1', 'R2', 'H2'],
        /* out on the black: every line that leaves the plates */
        ground: ['A', 'F', 'D', 'U1', 'R1', 'H2', 'T5']
    };

    /* ------------------------------------------------------- the gauge rows */
    /*
     * Four rows in the wing, a pitch apart: three figures over a rail of
     * four pieces, a fine line under it, and a short stroke on to the
     * unit. The rail and the line start and end on the lean. dy is
     * measured down from a row's rail top (y0 + n * pitch); x is a row's
     * own at its rail top.
     */
    var ROWS = {
        n: 4, y0: 195.07, pitch: 56.88,
        railH: 4.1,
        lineDy: 6.0, lineH: 2.45,
        xs: 285.7, xe: 504.7,
        cuts: [340.95, 396.45, 451.2], cutW: 2.6,
        /* the stroke on to the unit */
        ext: { x0: 506.0, x1: 540.5, dy0: 1.0, dy1: 2.6 },
        /* the reading's mark: a block joining rail and line, this wide */
        markW: 6.2,
        /* the figures: their baseline above the rail top, their height, and where they stand -
           the first from its pen, the middle one's ink about a point, the last one's ending on one */
        labelDy: -4.57, labelH: 16.6, labelX: [279.85, 393.3, 504.5],
        /* the unit: its ink ending here, its baseline, its size (em) */
        unitX: 539.2, unitDy: -5.5, unitEm: 19.2, degEm: 18.3,
        /* the symbol: its ink centred here */
        iconX: 232.7, iconDy: -2.6
    };
    function rowTop(n) { return ROWS.y0 + n * ROWS.pitch; }
    /* a reading's place along a row's rail (0..1), as an artboard x at a height dy below the rail top */
    function rowX(t, dy) { return ROWS.xs + t * (ROWS.xe - ROWS.xs) - K * (dy || 0); }

    /* ---------------------------------------------------- the rev counter */
    /*
     * A straight, leaning scale: the fine contour on the left, the dark
     * face, a black strip that carries the ticks, and the bright rail on
     * the right, all under one level line - whose left end and the contour
     * are one stroke, turning into each other on a small radius; the
     * marker is a level white bar
     * right across, and under it the band is lit down to its foot, which
     * turns into a rail running back under the body.
     *
     * The scale is not even: the frame's ticks stand 45.95 apart up to 5
     * and 43.04 from there (measured 45.4 - 46.3 and 43.0 - 43.1), so a
     * value's height is found between the marks either side of it.
     */
    var TACH = {
        con: 1172.85, conW: 2.8,            /* "/" the contour's centre line */
        face: 1248.79,                      /* "/" the face's right edge */
        railL: 1278.01, railR: 1290.35,     /* "/" the rail's two edges */
        top: { y0: 78.5, y1: 81.2, x0: 1047.5, x1: 1243.0 },
        conTopR: 7.0,                       /* the contour hooks round into the top line's left end: the radius */
        faceTop: 2.6,                       /* the dark face starts this far under the top line */
        tick: { gap: 2.5, len: 21.0, h: 1.3 },      /* a tick ends this far short of the rail; its half height */
        mark: { h: 2.25, gap: 3.0 },        /* the marker's half height, and the dark kept either side of it */
        /* the red field: a fine strip beside the rail from the top mark down to the redline, the
           top mark's own tick joined to it (the two make the frame's "7" under its 8) */
        zone: { gap: 3.0, w: 2.5, tickH: 1.6 },
        /* the lit band's foot, its rounded corner, the toe into the rail, the rail */
        base: { foot: 480.2, r: 27.0, toeR: 19.0, railTop: 473.9, railBottom: 479.2, railLeft: 744.0 },
        /* the marks of a thousand, top of the frame's scale first measured: y at 0..8 */
        y5: 233.61, low: 45.95, high: 43.04
    };
    /* the height of each mark of a thousand: the frame's nine (0 - 8), or a
       diesel's seven (0 - 6) spread evenly over the same height */
    function revMarks(engine) {
        var out = [], k;
        if (engine === 'diesel') {
            var y0 = TACH.y5 + 5 * TACH.low, y8 = TACH.y5 - 3 * TACH.high;
            for (k = 0; k <= 6; k++) out.push(y0 + (y8 - y0) * k / 6);
            return out;
        }
        for (k = 0; k <= 8; k++) out.push(k <= 5 ? TACH.y5 + (5 - k) * TACH.low : TACH.y5 - (k - 5) * TACH.high);
        return out;
    }
    /* an engine speed as a height on the scale (marks: revMarks) */
    function revY(rpm, marks) {
        var n = marks.length - 1;
        var k = Math.max(0, Math.min(n, (rpm || 0) / 1000));
        var i = Math.min(n - 1, Math.floor(k));
        return marks[i] + (marks[i + 1] - marks[i]) * (k - i);
    }
    /* the rail's outer edge and the contour at a height */
    function railX(y) { return slash(TACH.railR, y); }
    function contourX(y) { return slash(TACH.con, y); }

    /* ---------------------------------------------------------- the strips */
    /*
     * Oil temperature and fuel, right of the rev counter: a ladder of four
     * leaning pieces lit from the foot, and a fine line beside it (the
     * oil's red where it is hot, blue where cold).
     */
    var STRIP = {
        top: 320.3, bottom: 463.0,
        cuts: [355.1, 391.0, 426.8], cutH: 1.0,
        ladderW: 12.75, gap: 1.85, lineW: 4.4,
        /* each ladder's left edge, as a "/" line */
        oil: 1263.4 + K * 322, fuel: 1376.35 + K * 322,
        hot: 338.0, cold: 446.0
    };

    /* ---------------------------------------------------------- the footer */
    var FOOT = {
        /* the four-pane panel: its top and foot, and each edge as x at the top and at the foot */
        panel: { top: 493.75, bottom: 541.4, left: [701.8, 674.5], right: [982.1, 955.8] },
        seps: [[744.5, 771.9], [838.1, 811.0], [920.1, 892.8]], sepW: 3.0,
        /*
         * The light along the panel's top: a fine bright edge (y0 - y1)
         * over a band of colour (y1 - y2), from `left` to `right`, its two
         * ends cut on the lean. Blue from the left, at full strength to
         * blue[0] and gone by blue[1]; red from the right, from nothing at
         * red[0] to full at red[1].
         */
        bar: { y0: 487.3, y1: 489.0, y2: 493.7, left: 619.0, right: 1009.0, blue: [648.0, 722.0], red: [824.0, 990.0] },
        /* ... and what each end throws on the glass under it, fading down to `bottom`:
           the blue patch from its leaning left edge to `blue` (gone), the red one
           between the panel's right edge and its own */
        glow: { bottom: 514.0, blue: 716.0 },
        /* the two cyan trims: a bracket above the wing, a hook under the body */
        bracket: { y: 81.3, x0: 567.5, x1: 606.0, foot: [555.3, 101.6], w: 3.2 },
        hook: { p0: [607.0, 453.0], y: 476.6, x1: 691.5, r: 18.0, w: 3.0, wLevel: 4.7 },
        /* the reference frame's speed limit sign */
        limit: { x: 560.0, y: 515.0, r: 24.5, ring: 30.5 }
    };

    /* ----------------------------------------------------- the wing's window */
    /*
     * Where a hosted picture (the phone's map, BMW's map, Turn View's
     * camera) shows when one is chosen: in the left wing and nowhere else,
     * as the style's guide has it - the gauge rows give way to it, and
     * everything right of the first seam stays as it is.
     *
     * The picture is the car's own map slot, under the panel at 416,120
     * 1088x480; it cannot be moved, so the window begins where the slot
     * does (`x0`, a few units in from the slot's edge at this fit) and
     * takes the wing from there to the seam. It comes in on a curve level
     * at both ends, over `featherL` from the left, `featherT` and
     * `featherB` from the wing's top and foot, and `featherR` in from the
     * seam's lean. The M bands and the fine lines stay over the picture at
     * a part of their strength (`keep`), so the wing still reads as the
     * wing.
     */
    var WINDOW = {
        x0: 285.0, featherL: 34.0,
        /* the wing's own two left edges, which the window keeps this far inside of (and comes in from
           over featherL): where the slot's edge is the nearer, as the style comes, they change nothing */
        insetL: 6.0,
        insetT: 2.0, featherT: 26.0,
        insetB: 2.0, featherB: 44.0,
        insetR: 3.0, featherR: 22.0,
        keep: 0.32
    };
    function smoother(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    /*
     * Where the window begins, at the fit in use. As the style comes that
     * is WINDOW.x0 (the slot's edge is at 282, the window 2.9 units inside
     * it). Lowered, the style is larger and the slot's edge lies further
     * into the wing: the window begins as far inside the edge as ever, so
     * the picture still comes in on its soft fade and never on its own
     * hard edge. The shaders take it as a uniform (u_winX).
     */
    var SLOT_IN = 2.9;
    /*
     * "The whole wing" (an option of the layout's): the picture cannot be
     * moved, so the style is - this far right, at its own size, that the
     * wing's point stands just left of the picture's edge. The whole wing
     * then lies over the picture, the window is the wing's own shape, soft
     * inside every edge of it, and there is no straight edge anywhere. What
     * it costs is the style's place: it stands some 190 px further right
     * than it comes, the right-hand footer place moved in to stay on the
     * screen.
     */
    var FAR_LEFT = -1000;
    function wingPoint() {                       /* the leftmost the wing's rounded point reaches */
        var v = WING.v[4], r = WING.r[4], half = Math.atan(1 / K);
        return v[0] + r / Math.sin(half) - r;
    }
    /* the leftmost the window itself reaches: where its two left edges, kept insetL inside the wing's, meet */
    function windowPoint() { return WING.v[4][0] + WINDOW.insetL / COS; }
    /* ... and that point is stood half a pixel inside the picture's left edge: nothing opens where
       there is no picture, and the wing's own rounded point is a few px outside it */
    function wholeFit(f) {
        f = f || BASE_FIT;
        return { s: f.s, ox: SLOT.x + 0.5 - f.s * windowPoint(), oy: f.oy };
    }
    function windowX0() { return WHOLE ? FAR_LEFT : Math.max(WINDOW.x0, (SLOT.x - ART.ox) / ART.s + SLOT_IN); }
    /* how far the wing has given way to the picture at an artboard point, the window wide open */
    function revealAt(x, y) {
        var W = WINDOW, x0 = windowX0();
        if (y < T || y > B || x < x0) return 0;
        var u = x + K * y;
        return smoother((x - x0) / W.featherL) *
               smoother(((u - LINE.wingUp) * COS - W.insetL) / W.featherL) *
               smoother(((x - K * y - LINE.wingLow) * COS - W.insetL) / W.featherL) *
               smoother((y - T - W.insetT) / W.featherT) *
               smoother((B - W.insetB - y) / W.featherB) *
               smoother((LINE.wingRight - W.insetR - u) * COS / W.featherR);
    }
    /* everything the window can reach */
    function windowBox() { return { x0: Math.max(windowX0(), wingPoint()), y0: T, x1: slash(LINE.wingRight, T), y1: B }; }

    /* the distance to a convex outline with rounded corners, negative inside
       (what the shaders' outline compiler computes; as mgeom.js's) */
    function roundDist(poly, radii, x, y) {
        var k = poly.length, d = -1e9, i, e = [];
        for (i = 0; i < k; i++) {
            var a = poly[i], b = poly[(i + 1) % k];
            var ex = b[0] - a[0], ey = b[1] - a[1], len = Math.sqrt(ex * ex + ey * ey);
            e.push({ a: a, t: [ex / len, ey / len], n: [ey / len, -ex / len] });
            d = Math.max(d, (x - a[0]) * e[i].n[0] + (y - a[1]) * e[i].n[1]);
        }
        for (i = 0; i < k; i++) {
            var r = radii && radii[i];
            if (!r) continue;
            var pe = e[(i + k - 1) % k], ce = e[i];
            var c = 1 + pe.n[0] * ce.n[0] + pe.n[1] * ce.n[1];
            var qx = x - (poly[i][0] - r * (pe.n[0] + ce.n[0]) / c);
            var qy = y - (poly[i][1] - r * (pe.n[1] + ce.n[1]) / c);
            if (qx * pe.t[0] + qy * pe.t[1] > 0 && qx * ce.t[0] + qy * ce.t[1] < 0) {
                d = Math.max(d, Math.sqrt(qx * qx + qy * qy) - r);
            }
        }
        return d;
    }

    return {
        ART: ART, PANEL_FIT: PANEL_FIT, setFit: setFit, useFit: useFit, baseFit: baseFit, SLOT: SLOT,
        px: px, py: py, pd: pd, box: box,
        K: K, COS: COS, slash: slash, back: back, meet: meet,
        BODY: BODY, LINE: LINE, WING: WING, PLATES: PLATES, BAND: BAND, LIGHT: LIGHT, SHADE: SHADE, BANDS: BANDS,
        HAIRLINES: HAIRLINES, HAIR: HAIR,
        ROWS: ROWS, rowTop: rowTop, rowX: rowX,
        TACH: TACH, revMarks: revMarks, revY: revY, railX: railX, contourX: contourX,
        STRIP: STRIP, FOOT: FOOT,
        WINDOW: WINDOW, windowX0: windowX0, wholeFit: wholeFit, wingPoint: wingPoint, windowPoint: windowPoint, smoother: smoother, revealAt: revealAt, windowBox: windowBox, roundDist: roundDist
    };
}));
