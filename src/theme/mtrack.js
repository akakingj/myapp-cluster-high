(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../geometry/panel.js'),
                                 require('../engine/text.js'),
                                 require('./palette.js'),
                                 require('./textlayers.js'),
                                 require('./tgeom.js'),
                                 require('./strip.js'),
                                 require('./readings.js'));
    } else {
        root.MGUMTrack = factory(root.MGUPanel, root.MGUText, root.MGUPalette, root.MGUTextLayers, root.MGUTGeom,
                                 root.MGUStrip, root.MGUReadings);
    }
}(typeof self !== 'undefined' ? self : this, function (Panel, Text, Palette, TextLayers, T, Strip, Readings) {
    'use strict';

    /*
     * "M Track Mode" - the track view of BMW M's cluster, rebuilt on the
     * iDrive 7 panel from one reference frame (docs/ref/m-track-reference.jpg)
     * and its guide (docs/ref/M-TRACK-SPEC.md): the pointed blue wing with
     * the three M bands and four gauge rows in it, the gear on a black band
     * between two blue plates with the speed under it, the leaning red rev
     * counter with oil temperature and fuel as ladders beside it, and the
     * footer.
     *
     * Everything is placed in the frame's own coordinates, rectified
     * (src/theme/tgeom.js), and carried to the panel by one uniform fit.
     * Every figure and symbol is drawn from data: the frame is one state
     * of it (`mtFixture`, the preview and the comparison tool), not a
     * picture laid on.
     *
     * The left wing holds the four gauges as it comes. Chosen in the
     * style's settings, it holds the phone's map, BMW's own or Turn View's
     * camera instead - there and nowhere else, as the guide has it: the
     * rows give way, the wing's bands and lines stay over the picture, and
     * everything right of the first seam is untouched.
     *
     * The frame also shows lamps (parking sensors, side lights, dipped
     * beam) and a speed limit sign. Those are the car's own, which the
     * instrument cluster keeps drawing itself: nothing here imitates the
     * lamps, and the sign appears only in the reference fixture.
     *
     * Not affiliated with BMW AG; a reference-matched reconstruction for
     * the owner's own car.
     */

    var A = T.ART;
    var CAP = 0.70;               /* a figure's height, in em (the drawn faces) */
    var PADEM = 12 / 256;         /* a glyph's cell is this much wider than its ink, each side (tools/bake-atlas.py) */
    var ICON_EM = 32;             /* a symbol is drawn at this many frame units an em (tools/mglyphs.py) */
    function X(x) { return T.px(x); }
    function Y(y) { return T.py(y); }
    /* Lowered (src/theme/strip.js) the style is wider than the screen at its ends: a box that would
       run past the screen's side ends on it. SIDE is the screen's width for a lowered build and no
       limit for any other (a tool may fit the artboard to a target wider than the panel). Set at
       the start of every build. */
    var SIDE = Infinity;
    function box(x0, y0, x1, y1) {
        var b = T.box(x0, y0, x1, y1);
        if (SIDE < Infinity) {
            if (b.x < 0) { b.w += b.x; b.x = 0; }
            if (b.x + b.w > SIDE) b.w = SIDE - b.x;
        }
        return b;
    }
    function artOf(b) { return [(b.x - A.ox) / A.s, (b.y - A.oy) / A.s, A.s]; }
    function fig(h) { return h * A.s / CAP; }
    function words(em) { return em * A.s; }

    function c(r, g, b) { return [r / 255, g / 255, b / 255]; }
    /* sampled off the reference frame (docs/ref/M-TRACK-MEASUREMENTS.md) */
    var K = {
        white: c(253, 254, 254),
        label: c(244, 252, 254),          /* the rows' and the strips' figures */
        soft: c(238, 243, 250),           /* the footer's figures */
        unit: c(214, 220, 236), speedUnit: c(190, 210, 246), title: c(214, 198, 206),
        icon: c(236, 246, 251), stripIcon: c(224, 229, 240),
        revNum: c(244, 221, 233),
        bg: c(3, 4, 7), hairOut: c(205, 205, 222), hair: c(235, 238, 250), edge: c(15, 22, 30), band: c(11, 13, 23),
        cyan: c(150, 208, 238), hook: c(98, 170, 217),
        rail: c(248, 251, 254), railDim: c(118, 130, 160), line: c(232, 238, 246),
        cold: c(160, 210, 232), hot: c(214, 150, 158),
        R: { line: c(226, 160, 170), top: c(224, 128, 146), chan: c(64, 29, 39), chanMid: c(74, 33, 47),
             rail: c(230, 68, 82), tick: c(214, 74, 88), zone: c(246, 204, 210),
             fill: c(232, 64, 72), fillEdge: c(242, 128, 134) },
        segLit: c(236, 239, 244), segDim: c(123, 131, 154), segLow: c(161, 168, 190), stripInk: c(222, 231, 245),
        stripHot: c(206, 82, 96), stripCold: c(62, 142, 232),
        pane: c(24, 46, 102), paneFoot: c(47, 76, 146), footBlue: c(56, 112, 228), footRed: c(222, 62, 72),
        limitDisc: c(250, 250, 250), limitRing: c(218, 52, 72), limitInk: c(24, 24, 28),
        shiftRed: c(240, 62, 70)          /* the speed and the gear blinking at the shift point */
    };

    function centreOf(s) { return s.centre || { mode: 'neutral', open: 0, maneuver: null }; }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function num(s, key) {
        var v = s.num ? s.num[key] : null;
        return typeof v === 'number' && isFinite(v) ? v : null;
    }
    function c2f(v) { return v * 1.8 + 32; }
    var PSI_PER_BAR = 14.503774;

    /* a row's reading -> the car reading to glide for it (the others glide for every style already) */
    var ROW_GLIDE = { iat: 'iatC', volts: 'batteryV', charge: 'socPct', hvtemp: 'hvTempC' };

    /*
     * What a gauge row can show. Each reading has its symbol, the three
     * figures over its rail (the scale's start, middle and end), its unit,
     * and where its line is coloured: "cold" up to a value, "hot" from one
     * (in the car's own units, as the reading is). The first four are the
     * frame's, with the frame's own scales; the rest are in the same hand.
     */
    var ROW_KINDS = ['boost', 'coolant', 'oil', 'iat', 'oilp', 'volts', 'charge', 'hvtemp', 'off'];
    /* the four as they come: the frame's - or, in an electric car, what it has instead */
    var ROW_HOME = { frame: ['boost', 'coolant', 'oil', 'iat'], bev: ['charge', 'hvtemp', 'off', 'off'] };
    /* u: the units shown (units.js) */
    function rowScales(u) {
        var celsius = u.temp === 'c';
        function temp(key, icon, lo, hi, marksC, marksF, loF, hiF, cold, hot) {
            return { key: key, icon: icon, unit: u.labels.temp, marks: celsius ? marksC : marksF,
                     lo: celsius ? lo : loF, hi: celsius ? hi : hiF,
                     show: function (v) { return celsius ? v : c2f(v); }, cold: cold, hot: hot };
        }
        /* (kPa: the bar's scale a hundredfold) */
        function press(key, icon, hiBar, marksBar, hiPsi, marksPsi) {
            var p = u.press;
            return { key: key, icon: icon, unit: u.labels.press,
                     marks: p === 'psi' ? marksPsi : p === 'kpa' ? marksBar.map(function (m) { return String(Math.round(Number(m) * 100)); }) : marksBar,
                     lo: 0, hi: p === 'psi' ? hiPsi : p === 'kpa' ? hiBar * 100 : hiBar,
                     show: function (v) { return p === 'psi' ? v * PSI_PER_BAR : p === 'kpa' ? v * 100 : v; } };
        }
        return {
            boost: press('boostBar', 'u', 1.9, ['0.0', '0.9', '1.9'], 28, ['0', '14', '28']),
            /* the frame's line turns red for the last eighth: from about 122 C */
            coolant: temp('coolantC', 'w', 70, 130, ['70', '100', '130'], ['160', '210', '260'], 160, 260, null, 122),
            /* ... and the oil's is blue up to about 66 C and red from about 134 C */
            oil: temp('oilC', 'o', 50, 150, ['50', '100', '150'], ['120', '210', '300'], 120, 300, 66, 134.5),
            iat: temp('iatC', 'a', -20, 50, ['-20', '15', '50'], ['0', '60', '120'], 0, 120, null, null),
            oilp: press('oilBar', 'p', 10, ['0', '5', '10'], 140, ['0', '70', '140']),
            volts: { key: 'volts', icon: 'v', unit: 'v', marks: ['10', '13', '16'], lo: 10, hi: 16,
                     show: function (v) { return v; }, cold: 11.8, hot: 15.2 },
            charge: { key: 'socPct', icon: 'c', unit: '%', unitFace: 'mx', marks: ['0', '50', '100'], lo: 0, hi: 100,
                      show: function (v) { return v; }, cold: 10, hot: null },
            hvtemp: temp('hvC', 'h', -10, 60, ['-10', '25', '60'], ['14', '77', '140'], 14, 140, 5, 50)
        };
    }

    /* where a string's ink starts and ends, from the pen (px): the glyphs' own boxes less their padding */
    function inkSpan(atlas, face, str, size) {
        var g = atlas.faces[face].glyphs, x = 0, l = null, r = 0, i, m;
        for (i = 0; i < str.length; i++) {
            m = g[str.charAt(i)];
            if (!m) continue;
            if (m.tw) {
                if (l === null) l = x + (m.bx + PADEM) * size;
                r = x + (m.bx + m.w - PADEM) * size;
            }
            x += m.adv * size;
        }
        return { l: l === null ? 0 : l, r: r, adv: x };
    }
    /* the pen that puts a string's ink against a panel x: its left edge ('l'), its right ('r') or its middle ('c') */
    function penFor(atlas, face, str, size, at, how) {
        var k = inkSpan(atlas, face, str, size);
        return how === 'r' ? at - k.r : how === 'c' ? at - (k.l + k.r) / 2 : at - k.l;
    }
    /* a symbol's pen, its ink's middle given (panel px) */
    function iconPen(atlas, face, ch, size, cx, cy) {
        var m = atlas.faces[face].glyphs[ch];
        return { x: cx - (m.bx + m.w / 2) * size, y: cy - (m.by + m.h / 2) * size,
                 /* the glyph's whole cell, which is what a layer has to hold */
                 cell: { x: cx - m.w * size / 2, y: cy - m.h * size / 2, w: m.w * size, h: m.h * size } };
    }

    function build(atlas, profileId, settings) {
        var P = Panel.profile(profileId);
        var S = Palette.resolve(settings, P);
        /* BETA: the whole style lowered into the rows a hidden strip leaves, and larger by as much
           (src/theme/strip.js). Before anything is measured: every place below asks the fit. */
        /* what the left wing holds: the gauges ('off'), or a hosted picture */
        S.centre = ['waze', 'map', 'camera', 'off'].indexOf(settings && settings.centre) >= 0 ? settings.centre : 'off';
        /*
         * How much of the wing a picture takes. The car draws its picture
         * from x 416 and nothing can move it, so there are two ways:
         *   'whole' (as it comes)  the style is stood far enough right that
         *            the whole wing lies over the picture, and the window is
         *            the wing's own shape, soft inside every edge, to its
         *            point (T.wholeFit). The style then stands some 190 px
         *            further right than it does with its gauges.
         *   'slot'   the style stays where it is, and the picture begins
         *            where the car's does: a straight edge part of the way
         *            along the wing.
         * 'whole' needs a picture chosen; room to move into, which a lowered
         * style has not; and the gear and the speed clear, where it would
         * stand them, of the boxes some cars draw over a style (an M car's:
         * there the style stays where it is).
         */
        S.wing = settings && settings.wing === 'slot' ? 'slot' : 'whole';
        var wholeAt = T.wholeFit(T.baseFit());
        var boxed = (P.extraZones || []).some(function (z) {
            return [[630, 200, 866, 294], [644, 322, 896, 374]].some(function (b) {
                return wholeAt.ox + b[0] * wholeAt.s < z.x + z.w && wholeAt.ox + b[2] * wholeAt.s > z.x &&
                       wholeAt.oy + b[1] * wholeAt.s < z.y + z.h && wholeAt.oy + b[3] * wholeAt.s > z.y;
            });
        });
        var whole = S.wing === 'whole' && S.centre !== 'off' && !(S.lower > 0) && !boxed;
        var baseOx = T.baseFit().ox;
        T.useFit(S.lower > 0 ? Strip.lowerFit(T.baseFit(), S.lower) : whole ? wholeAt : null, whole);
        SIDE = S.lower > 0 || whole ? Panel.PANEL_WIDTH : Infinity;
        var SC = A.s;
        var WIN_X = T.windowX0();     /* where the wing's window begins, at this fit */
        S.modeLabel = 'bmw';
        S.mode = '';
        S.centreSize = 'standard';
        var fixture = !!(settings && settings.mtFixture);
        /* the units shown (S.u, units.js): the speed's, and the temperatures' */
        var kmh = S.u.speed === 'kmh', celsius = S.u.temp === 'c';
        var bev = S.electric === 'bev';
        /* the four rows: each the reading asked for, or the frame's own */
        var home = bev ? ROW_HOME.bev : ROW_HOME.frame;
        S.rows = [0, 1, 2, 3].map(function (i) {
            var v = settings && settings['row' + (i + 1)];
            return ROW_KINDS.indexOf(v) >= 0 ? v : home[i];
        });
        /* how a row shows its reading: a mark on the rail (the frame's), or the rail past it standing back as well */
        S.rowMark = settings && settings.rowMark === 'fill' ? 'fill' : 'mark';
        /* the rows set readings on scales of their own: the state is asked for them as numbers */
        S.numbers = true;
        /* the footer's three places */
        S.footL = Readings.kind(settings && settings.footL, 'time');
        S.footM = Readings.kind(settings && settings.footM, 'range');
        S.footR = Readings.kind(settings && settings.footR, 'outside');
        function footShows(kind) { return S.footL === kind || S.footM === kind || S.footR === kind; }
        function rowShows(kind) { return S.rows.indexOf(kind) >= 0; }

        var layers = [];
        var TL = TextLayers.create(atlas, layers, { text: K.white, muted: K.soft });
        var txt = TL.txt, statics = TL.statics;
        var flashRail = S.revFlash === 'band' || S.revFlash === 'both';
        var flashEdges = S.revFlash === 'edges' || S.revFlash === 'both';

        /* a layer drawn by one of the track shaders (src/shaders/tcluster.js) */
        function shape(id, z, shader, b, fn, extra) {
            var art = artOf(b);
            var L = { id: id, z: z, shader: shader, x: b.x, y: b.y, w: b.w, h: b.h,
                      uniforms: function (s) {
                          var u = fn ? fn(s) : {};
                          if (u === null) return null;
                          u.u_art = art;
                          return u;
                      } };
            if (extra) Object.keys(extra).forEach(function (k) { L[k] = extra[k]; });
            layers.push(L);
            return L;
        }
        /* a text layer whose words and place follow the state:
           fn(state) -> { str, face, size, x, y, ink: 'l' | 'r' | 'c', color } or null. x is where the ink
           stands (its left edge, its right or its middle), y its baseline; all panel px. */
        function dyn(id, z, b, fn) {
            layers.push({
                id: id, z: z, shader: 'text', x: b.x, y: b.y, w: b.w, h: b.h,
                uniforms: function (s) {
                    var o = fn(s);
                    if (!o || o.str === null || o.str === undefined || o.str === '') return null;
                    var str = String(o.str);
                    var L = Text.layout(atlas, str, { face: o.face, size: o.size,
                        x: penFor(atlas, o.face, str, o.size, o.x, o.ink || 'l') - b.x, y: o.y - b.y, align: 'left' });
                    if (!L) return null;
                    var col = o.color || K.white;
                    return { u_g: L.g, u_quad: L.p, u_count: L.count, u_sharp: L.sharp,
                             u_color: [col[0], col[1], col[2], o.alpha === undefined ? 1 : o.alpha],
                             u_glowCol: col, u_glow: 0, u_outline: 0, u_outCol: col };
                }
            });
        }
        /* fixed words, each with its ink set against a point: items [{ str, x, y, ink }] in frame units */
        function fixed(id, z, b, base, items) {
            statics(id, z, b, base, items.map(function (it) {
                var face = it.face || base.face, size = it.size || base.size;
                return { str: it.str, face: it.face, size: it.size, y: Y(it.y),
                         x: penFor(atlas, face, it.str, size, X(it.x), it.ink || 'l') };
            }));
        }
        /*
         * Fixed words in a box no larger than the words. The renderer fills
         * every pixel of a layer, and the text shader looks at each of the
         * layer's glyphs for every one of them: a few figures in a box the
         * size of all four gauge rows cost as much to draw as the wing does.
         * So words that never move are given the rectangle their own glyphs
         * take, a pixel to spare. mapped: items already in panel px.
         */
        function snugPx(id, z, base, mapped) {
            var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            mapped.forEach(function (it) {
                var L = Text.place(atlas, [it], base), i;
                if (!L) return;
                for (i = 0; i < L.count; i++) {
                    x0 = Math.min(x0, L.p[i * 4]); y0 = Math.min(y0, L.p[i * 4 + 1]);
                    x1 = Math.max(x1, L.p[i * 4] + L.p[i * 4 + 2]); y1 = Math.max(y1, L.p[i * 4 + 1] + L.p[i * 4 + 3]);
                }
            });
            if (!(x1 > x0)) return;
            var b = { x: Math.max(0, Math.floor(x0) - 1), y: Math.max(0, Math.floor(y0) - 1) };
            b.w = Math.min(SIDE, Math.ceil(x1) + 1) - b.x; b.h = Math.ceil(y1) + 1 - b.y;
            statics(id, z, b, base, mapped);
        }
        /* ... items in frame units, each with its ink set against a point (as fixed's) */
        function snug(id, z, base, items) {
            snugPx(id, z, base, items.map(function (it) {
                var face = it.face || base.face, size = it.size || base.size;
                return { str: it.str, face: it.face, size: it.size, y: Y(it.y),
                         x: it.pen ? X(it.x) : penFor(atlas, face, it.str, size, X(it.x), it.ink || 'l') };
            }));
        }
        /* a symbol, its ink's middle at a frame point, drawn `scale` times its own size */
        function icon(id, z, face, ch, cx, cy, scale, color, show, alpha) {
            var size = ICON_EM * scale * SC;
            var p = iconPen(atlas, face, ch, size, X(cx), Y(cy));
            var b = { x: Math.floor(p.cell.x) - 1, y: Math.floor(p.cell.y) - 1 };
            b.w = Math.ceil(p.cell.x + p.cell.w) + 1 - b.x;
            b.h = Math.ceil(p.cell.y + p.cell.h) + 1 - b.y;
            statics(id, z, b, { face: face, size: size, align: 'left', color: color, show: show, alpha: alpha },
                [{ str: ch, x: p.x, y: p.y }]);
            return b;
        }

        /* --------------------------------------------- the ground and the body */
        function openOf(s) {
            var ce = centreOf(s);
            return ce.mode === 'map' || ce.mode === 'camera' ? ce.open : 0;
        }
        /* what the picture in the wing leaves of the gauge rows */
        function rowsShown(s) { return 1 - openOf(s); }
        shape('back', 1, 'mtback',
            { x: 0, y: 0, w: Panel.PANEL_WIDTH, h: Panel.BOTTOM_CUT + S.bottomExtra },
            function (s) {
                return { u_open: openOf(s), u_winX: WIN_X, u_bg: K.bg, u_hair: K.hairOut, u_foot: [Panel.BOTTOM_CUT, S.bottomExtra] };
            },
            { belowCut: true, still: true });
        /* BMW's bottom strip hidden: plain covers either side of its gear */
        Strip.layers(S, [0, 0, 0]).forEach(function (L) { layers.push(L); });

        /* the wing (with the bracket over it), and the plates right of the seam */
        shape('wing', 2, 'mtwing', box(106, 74, 692, 450), function (s) {
            return { u_open: openOf(s), u_winX: WIN_X, u_hair: K.hair, u_edge: K.edge, u_cyan: K.cyan };
        });
        shape('plates', 2, 'mtplates', box(488, 108, 1000, 448), function () {
            return { u_hair: K.hair, u_edge: K.edge, u_band: K.band };
        });
        /* the footer's panel, the light along its top, the hook */
        shape('footPanel', 2, 'mtfoot', box(598, 448, 1024, 544), function () {
            return { u_pane: K.pane, u_paneFoot: K.paneFoot, u_blue: K.footBlue, u_red: K.footRed, u_cyan: K.hook, u_panel: 1 };
        });

        /* ------------------------------------------------------- the gauge rows */
        var R = T.ROWS, SCALES = rowScales(S.u);
        var rowOf = S.rows.map(function (kind) { return kind === 'off' ? null : SCALES[kind]; });
        /* a reading along its row's rail: 0..1, or -1 with nothing to show */
        function rowValue(sc, s, i) {
            if (!sc) return -1;
            /* the frame itself has a mark in its first row only */
            if (fixture && i > 0) return -1;
            var v = num(s, sc.key);
            return v === null ? -1 : clamp01((sc.show(v) - sc.lo) / (sc.hi - sc.lo));
        }
        function zoneAt(sc, v, none) {
            return !sc || v === null || v === undefined ? none : (sc.show(v) - sc.lo) / (sc.hi - sc.lo);
        }
        var rowCold = rowOf.map(function (sc) { return Math.max(0, zoneAt(sc, sc && sc.cold, 0)); });
        var rowHot = rowOf.map(function (sc) { return zoneAt(sc, sc && sc.hot, 2); });
        var rowOn = rowOf.map(function (sc) { return sc ? 1 : 0; });
        if (rowOn.some(function (v) { return v; })) {
            shape('rows', 12, 'mtrows', box(276, R.y0 - 3, 546, T.rowTop(R.n - 1) + 12), function (s) {
                var fade = rowsShown(s);
                if (!(fade > 0.004)) return null;
                return { u_val: rowOf.map(function (sc, i) { return rowValue(sc, s, i); }),
                         u_cold: rowCold, u_hot: rowHot, u_on: rowOn, u_fade: fade,
                         u_fill: S.rowMark === 'fill' ? 1 : 0,
                         u_lit: K.rail, u_dim: K.railDim, u_ink: K.line, u_coldCol: K.cold, u_hotCol: K.hot };
            });
            var units = [], unitsX = [], icons = [], shown = 0;
            var fading = { color: K.label, alpha: rowsShown };
            rowOf.forEach(function (sc, i) {
                if (!sc) return;
                var top = T.rowTop(i), base = top + R.labelDy;
                /* a row's three figures, a layer of their own just their size (snug, above): the first by
                   its pen (as the frame sets them), the others by their ink */
                snug(shown ? 'rowLabels_' + shown : 'rowLabels', 30,
                    { face: 'mn', size: fig(R.labelH), align: 'left', color: K.label, alpha: rowsShown },
                    [{ str: sc.marks[0], x: R.labelX[0], y: base, pen: true },
                     { str: sc.marks[1], x: R.labelX[1], y: base, ink: 'c' },
                     { str: sc.marks[2], x: R.labelX[2], y: base, ink: 'r' }]);
                shown++;
                /* (the degree sign's units are set a little smaller than the words, as the frame's are) */
                (sc.unitFace ? unitsX : units).push({ str: sc.unit, x: R.unitX, y: top + R.unitDy, ink: 'r',
                    size: sc.unit.charAt(0) === '°' ? words(R.degEm) : undefined });
                icons.push({ ch: sc.icon, cx: R.iconX, cy: top + R.iconDy });
            });
            /* the units stand in a column: one narrow layer */
            if (units.length) snug('rowUnits', 30, { face: 'ms', size: words(R.unitEm), align: 'left', color: K.unit, alpha: rowsShown }, units);
            if (unitsX.length) snug('rowUnitsX', 30, { face: 'mx', size: words(R.unitEm), align: 'left', color: K.unit, alpha: rowsShown }, unitsX);
            /* the symbols: one layer, each centred before its row */
            var isize = ICON_EM * SC;
            statics('rowIcons', 30, box(204, R.y0 - 24, 262, T.rowTop(R.n - 1) + 16),
                { face: 'mt', size: isize, align: 'left', color: K.icon, alpha: fading.alpha },
                icons.map(function (it) {
                    var p = iconPen(atlas, 'mt', it.ch, isize, X(it.cx), Y(it.cy));
                    return { str: it.ch, x: p.x, y: p.y };
                }));
        }

        /* ------------------------------------------------------ the rev counter */
        var G = T.TACH;
        var MARKS = T.revMarks(S.engine, S.scaleMaxRpm);
        var topMark = MARKS[MARKS.length - 1];
        function revY(s) { return T.revY(s.rpm, MARKS); }
        /* the red field: from the top of the scale down to the redline (lower while the engine is cold:
           s.redRpm, src/engine/state.js shiftPoint) */
        function redY(s) { return Math.max(topMark, T.revY(s.redRpm || S.rpmRedline, MARKS)); }
        shape('revDial', 10, MARKS.length === 9 ? 'mtgauge' : 'mtgauge' + (MARKS.length - 1), box(742, 74, 1296, 484), function (s) {
            return { u_ym: revY(s), u_red: redY(s), u_warn: flashRail ? (s.limiter || 0) : 0,
                     u_line: K.R.line, u_topCol: K.R.top, u_chan: K.R.chan, u_chanMid: K.R.chanMid,
                     u_rail: K.R.rail, u_tick: K.R.tick, u_zone: K.R.zone, u_fill: K.R.fill, u_fillEdge: K.R.fillEdge };
        });
        /* the numerals: each level with its mark, right of the rail. The
           frame's nine stand where the frame has them; any other scale's
           are set as far off the rail as those are. */
        var NUM_H = 20.0;
        var REV_INK = [1037.74, 1065.96, 1092.46, 1119.53, 1142.03, 1174.10, 1199.14, 1224.04, 1247.43];
        var REV_GAP = { figure: 19.9, '4': 15.4, '1': 20.6 };
        function revNumeral(k) {
            var str = String(k), y = MARKS[k];
            var ink = MARKS.length === 9 ? REV_INK[k] : T.railX(y) + (REV_GAP[str] || REV_GAP.figure);
            return { str: str, x: ink, y: y - 0.4 + NUM_H / 2, ink: 'l' };
        }
        var numerals = [];
        for (var k = MARKS.length - 1; k >= 0; k--) numerals.push(revNumeral(k));
        /* (three to a layer: they stand down a leaning scale, and one box round all nine is mostly empty) */
        for (var g3 = 0; g3 * 3 < numerals.length; g3++) {
            snug(g3 ? 'revScale_' + g3 : 'revScale', 20, { face: 'mw', size: fig(NUM_H), align: 'left', color: K.revNum },
                numerals.slice(g3 * 3, g3 * 3 + 3));
        }
        fixed('revTitle', 20, box(1100, 50, 1232, 80), { face: 'ms', size: words(21.8), align: 'left', color: K.title },
            [{ str: '1/min x 1000', x: 1108.0, y: 73.6 }]);

        /* --------------------------------------------------- oil and fuel */
        var ST = T.STRIP;
        function strip(id, at, kind, fn) {
            var x1 = T.slash(at, ST.top) + ST.ladderW + ST.gap + ST.lineW, x0 = T.slash(at, ST.bottom);
            shape(id, 12, 'mtstrip', box(x0 - 3, ST.top - 3, x1 + 3, ST.bottom + 3), function (s) {
                var v = fn(s);
                return { u_at: at, u_kind: kind, u_level: v === null ? 0 : clamp01(v), u_on: v === null ? 0 : 1,
                         u_lit: K.segLit, u_dim: K.segDim, u_ink: K.stripInk,
                         u_hotCol: K.stripHot, u_coldCol: K.stripCold, u_lowCol: K.segLow };
            });
        }
        /* oil temperature between its end marks: 50 to 150 C, or 120 to 300 F
           (an electric car has no oil: the strip is its drive battery's temperature) */
        strip('oilStrip', ST.oil, 1, function (s) {
            if (bev) return typeof s.hvTempFrac === 'number' ? s.hvTempFrac : null;
            var t = typeof s.oilTempC === 'number' && isFinite(s.oilTempC) ? s.oilTempC : null;
            if (t === null) return null;
            return celsius ? (t - 50) / 100 : (c2f(t) - 120) / 180;
        });
        strip('fuelStrip', ST.fuel, 0, function (s) {
            var f = s.pods && s.pods.fuel;
            return f && f.text !== '--' ? f.frac : null;
        });
        var LBL = 16.7;
        var oilMarks = bev ? (celsius ? ['60', '25', '-10'] : ['140', '77', '14'])
            : celsius ? ['150', '100', '50'] : ['300', '210', '120'];
        /* (the oil's and the fuel's apart: each a layer the size of its own three figures) */
        snug('stripLabels', 30, { face: 'mn', size: fig(LBL), align: 'left', color: K.label },
            [{ str: oilMarks[0], x: 1248.0, y: 336.5, ink: 'r' }, { str: oilMarks[1], x: 1211.8, y: 398.9, ink: 'r' },
             { str: oilMarks[2], x: 1175.9, y: 461.6, ink: 'r' }]);
        snug('stripLabels_1', 30, { face: 'mn', size: fig(LBL), align: 'left', color: K.label },
            [{ str: '1', x: 1362.4, y: 336.9, ink: 'r' }, { str: '1/2', x: 1329.0, y: 400.6, ink: 'r' },
             { str: '0', x: 1292.8, y: 462.2, ink: 'r' }]);
        fixed('oilUnit', 30, box(1196, 344, 1236, 376), { face: 'ms', size: words(24.5), align: 'left', color: K.unit },
            [{ str: celsius ? '°C' : '°F', x: 1202.5, y: 369.5 }]);
        /* (the oil can and the pump are an engine's: an electric car's strips go without them) */
        if (!bev) {
            icon('oilIcon', 30, 'mi', 'o', 1178.2, 420.85, 0.94, K.stripIcon);
            icon('fuelIcon', 30, 'mi', 'f', 1301.85, 423.8, 1.065, K.stripIcon);
        }

        /* --------------------------------------------------- gear and speed */
        /* the gear, its ink ending where the frame's D does: a letter in the
           frame's own hand, a number in the dials' */
        /* (two characters - a stage and its gear - are set smaller, so the pair stays on the band) */
        /* (the gear and the speed blinking red at the shift point: Palette.blinkOn) */
        function shiftCol(s) { return Palette.blinkOn(s) ? K.shiftRed : K.white; }
        var GEAR = { h: 80.0, pair: 0.84, right: 854.6, base: 286.9 };
        layers.push((function () {
            var b = box(630, 200, 866, 294);
            return { id: 'gear', z: 30, shader: 'text', x: b.x, y: b.y, w: b.w, h: b.h,
                uniforms: function (s) {
                    var str = String(s.gear || 'P').slice(0, 2), items = [], pen = 0, i;
                    var size = fig(GEAR.h * (str.length > 1 ? GEAR.pair : 1));
                    for (i = 0; i < str.length; i++) {
                        var ch = str.charAt(i), face = atlas.faces.mg.glyphs[ch] ? 'mg' : 'mw';
                        if (!atlas.faces[face].glyphs[ch]) continue;
                        items.push({ str: ch, face: face, x: pen, y: Y(GEAR.base) - b.y });
                        pen += atlas.faces[face].glyphs[ch].adv * size;
                    }
                    if (!items.length) return null;
                    /* the last glyph's ink ends on the frame's line */
                    var last = items[items.length - 1], m = atlas.faces[last.face].glyphs[last.str];
                    var shift = X(GEAR.right) - b.x - (last.x + (m.bx + m.w - PADEM) * size);
                    items.forEach(function (it) { it.x += shift; });
                    var L = Text.place(atlas, items, { face: 'mg', size: size, align: 'left' });
                    if (!L) return null;
                    var col = shiftCol(s);
                    return { u_g: L.g, u_quad: L.p, u_count: L.count, u_sharp: L.sharp,
                             u_color: [col[0], col[1], col[2], 1], u_glowCol: col, u_glow: 0,
                             u_outline: 0, u_outCol: col };
                } };
        }()));
        /* the speed: flush right, its unit after it */
        var SPD = { h: 37.0, right: 831.8, base: 365.2 };
        dyn('speed', 30, box(644, 322, 840, 372), function (s) {
            return { str: s.speedText !== undefined ? s.speedText : String(Math.round(Math.max(0, s.speed || 0))), face: 'mw', size: fig(SPD.h),
                     x: X(SPD.right), y: Y(SPD.base), ink: 'r', color: shiftCol(s) };
        });
        fixed('speedUnit', 30, box(834, 340, 896, 374), { face: 'ms', size: words(22.2), align: 'left', color: K.speedUnit },
            [{ str: kmh ? 'km/h' : 'mph', x: 840.2, y: 364.6 }]);

        /* ------------------------------------------------------- the footer */
        /* the M mark: the frame's own, heavier of line than the M View's */
        icon('mMark', 30, 'mt', 'm', 184.4, 468.1, 1.0, K.soft);

        var FOOT_H = 22.4, FOOT_Y = 538.6, UNIT_EM = 24.0;
        var READINGS = Readings.table({ u: S.u, clock12: S.clock12 });
        var TAG_H = 11.7, TAG_GAP = 6.8, UNIT_GAP = 6.0, ICON_GAP = 8.9;
        /*
         * A place: [symbol or word] figures unit, set from the place's left
         * end - or, for the place on the right, up to its right end, the
         * unit where the frame's is. at: { x, right, box } in frame units;
         * x is where the figures' ink starts (or, on the right, ends).
         */
        function place(name, kind, at) {
            var Rd = READINGS[kind];
            if (!Rd) return;
            var b = at.box, size = fig(FOOT_H), usize = words(UNIT_EM), tsize = fig(TAG_H);
            /* a named reading with no value shows dashes, so a place the owner filled never just goes dark */
            function figures(s) { var v = Rd.value(s); return v === null ? (Rd.tag ? '--' : null) : String(v); }
            function unitOf(s) { return typeof Rd.unit === 'function' ? Rd.unit(s) : Rd.unit; }
            function width(s) { var k = inkSpan(atlas, 'mn', figures(s), size); return k.r - k.l; }
            if (at.right) {
                /* the unit ends where the frame's does (at.x), the figures a gap before it: with the
                   frame's own unit that sets them where the frame has them, and a longer unit
                   moves them left instead of running off the panel */
                var figEnd = function (s) {
                    var un = unitOf(s);
                    if (!un) return X(at.x);
                    var k = inkSpan(atlas, 'ms', un, usize);
                    return X(at.x) - (k.r - k.l) - UNIT_GAP * SC;
                };
                dyn(name, 30, b, function (s) {
                    return { str: figures(s), face: 'mn', size: size, x: figEnd(s), y: Y(FOOT_Y), ink: 'r', color: K.soft };
                });
                dyn(name + 'Unit', 30, b, function (s) {
                    if (figures(s) === null || !unitOf(s)) return null;
                    return { str: unitOf(s), face: 'ms', size: usize, x: X(at.x), y: Y(FOOT_Y), ink: 'r', color: K.soft };
                });
                if (Rd.tag) {
                    dyn(name + 'Tag', 30, b, function (s) {
                        if (figures(s) === null) return null;
                        return { str: Rd.tag, face: 'mb', size: tsize, ink: 'r',
                                 x: figEnd(s) - width(s) - TAG_GAP * SC, y: Y(FOOT_Y), color: K.unit };
                    });
                }
                if (Rd.icon) {
                    dyn(name + 'Icon', 30, b, function (s) {
                        if (figures(s) === null) return null;
                        var isz = ICON_EM * SC, m = atlas.faces.mi.glyphs[Rd.icon];
                        return { str: Rd.icon, face: 'mi', size: isz, ink: 'r', x: figEnd(s) - width(s) - ICON_GAP * SC,
                                 y: Y(FOOT_Y - FOOT_H / 2) - (m.by + m.h / 2) * isz, color: K.soft };
                    });
                }
                return;
            }
            /* from the left: what names the reading, then its figures */
            var pen = at.x;
            if (Rd.icon) {
                var isz = ICON_EM * SC, m = atlas.faces.mi.glyphs[Rd.icon];
                var iw = (m.w - 2 * PADEM) * ICON_EM;                  /* the symbol's ink, frame units */
                snugPx(name + 'Icon', 30, { face: 'mi', size: isz, align: 'left', color: K.soft,
                                            show: function (s) { return figures(s) !== null; } },
                    [{ str: Rd.icon, x: X(at.x) - (m.bx + PADEM) * isz, y: Y(FOOT_Y - FOOT_H / 2) - (m.by + m.h / 2) * isz }]);
                pen = at.x + iw + ICON_GAP;
            } else if (Rd.tag) {
                var tw = inkSpan(atlas, 'mb', Rd.tag, tsize);
                fixed(name + 'Tag', 30, b, { face: 'mb', size: tsize, align: 'left', color: K.unit }, [{ str: Rd.tag, x: at.x, y: FOOT_Y }]);
                pen = at.x + (tw.r - tw.l) / SC + TAG_GAP;
            }
            dyn(name, 30, b, function (s) {
                return { str: figures(s), face: 'mn', size: size, x: X(pen), y: Y(FOOT_Y), color: K.soft };
            });
            dyn(name + 'Unit', 30, b, function (s) {
                if (figures(s) === null || !unitOf(s)) return null;
                return { str: unitOf(s), face: 'ms', size: usize, x: X(pen) + width(s) + UNIT_GAP * SC, y: Y(FOOT_Y), color: K.soft };
            });
        }
        /* the frame has the time on the left, the range (after its symbol,
           which stands at 312.9) in the middle, the outside temperature on the right */
        if (S.footL !== 'off') place('footL', S.footL, { x: 124.7, box: box(118, 508, 308, 544.5) });
        if (S.footM !== 'off') place('footM', S.footM, { x: 312.9, box: box(306, 508, 600, 544.5) });
        /* (on the right the unit's ink ends at 1556.2; the frame's figures then end at 1526. Lowered, the
           style is wider than the screen there: the place ends as far from the screen's edge as it does now) */
        var FOOT_R = Math.min(1556.2, (Panel.PANEL_WIDTH - 13 - A.ox) / SC);
        if (S.footR !== 'off') place('footR', S.footR, { x: FOOT_R, right: true, box: box(FOOT_R - 266.2, 508, FOOT_R + 9.8, 544.5) });

        /* ---------------------------------- the reference frame's speed limit */
        if (fixture) {
            var lim = T.FOOT.limit;
            /* (the frame's sign ends a hair under where the car's own strip starts at the panel's fit:
               there it is set that much higher, so that nothing of it is asked below the cut) */
            var limY = Math.min(lim.y, (Strip.foot(S) - 2 - A.oy) / SC - lim.ring - 1);
            var lb = box(lim.x - lim.ring - 1, limY - lim.ring - 1, lim.x + lim.ring + 1, limY + lim.ring + 1);
            layers.push({
                id: 'limitSign', z: 30, shader: 'mbadge', x: lb.x, y: lb.y, w: lb.w, h: lb.h,
                uniforms: function () { return { u_disc: K.limitDisc, u_ring: K.limitRing, u_r: [lim.r * SC, lim.ring * SC] }; }
            });
            fixed('limitFig', 31, lb, { face: 'ms', size: words(27.0), align: 'left', color: K.limitInk },
                [{ str: '70', x: lim.x, y: limY + 9.9, ink: 'c' }]);
        }

        /* ---------------------------------------------- the limiter flash */
        if (flashEdges) {
            /* (lowered, it is the style's own size: three pieces, round the gear's columns - src/theme/strip.js) */
            Strip.spread(S).forEach(function (r, i) {
                var L = {
                    id: 'flash' + ['', 'L', 'R'][i], z: 95, shader: S.lower > 0 ? 'flashPart' : 'flash',
                    x: r.x, y: r.y, w: r.w, h: r.h,
                    uniforms: function (s) {
                        /* nothing to flash: not drawn at all. (It lies over the whole style, and a layer
                           that is drawn costs the renderer every pixel it covers, lit or not.) */
                        if (!(s.limiter > 0)) return null;
                        var u = { u_on: s.limiter || 0, u_rate: S.flashRate,
                                  u_col: K.R.rail, u_strength: S.flashStrength,
                                  u_style: S.flashStyleIndex, u_spread: S.flashSpread, u_burst: 0 };
                        if (S.lower > 0) u.u_frame = [r.x, r.y, Panel.PANEL_WIDTH, Strip.foot(S)];
                        return u;
                    }
                };
                if (S.lower > 0) L.still = true;
                layers.push(L);
            });
        }

        var wb = T.windowBox(), win = box(wb.x0, wb.y0, wb.x1, wb.y1);
        if (whole) {
            /* (the wing's point stands a few px left of the picture's edge, where nothing opens) */
            var wx1 = win.x + win.w;
            win.x = Math.max(win.x, T.SLOT.x); win.w = wx1 - win.x;
        }
        var snow = [[0, 0, 214, 646], [1730, 0, 190, 646]], tree = [1764, 352, 136, 172];
        if (whole) {
            /* the style stands further right: more room for the snow on its left, none on its right */
            snow = [[0, 0, Math.floor(snow[0][2] + A.ox - baseOx), 646]];
            tree = null;
        }
        if (S.lower > 0) {
            /* lowered: the snow keeps to what is left beside the wing and the strips, and the tree
               goes with the fuel strip it stands by - or is left out, where that is off the screen */
            var sl = Strip.lowerRect(snow[0], S.lower), sr = Strip.lowerRect(snow[1], S.lower);
            snow = [[0, 0, Math.max(40, Math.floor(sl[0] + sl[2])), 646],
                    [Math.ceil(sr[0]), 0, Panel.PANEL_WIDTH - Math.ceil(sr[0]), 646]];
            tree = Strip.lowerRect(tree, S.lower).map(Math.round);
            if (tree[0] + tree[2] > Panel.PANEL_WIDTH) tree = null;
        }
        return { id: 'mtrack', name: 'M Track Mode',
                 layers: layers, profile: P, settings: S,
                 /* the row the style ends above: the strip's top, or lower (S.lower) */
                 foot: Strip.foot(S),
                 /* the holiday dressing: snow left of the wing and right of the strips, the tree right of the fuel */
                 places: { snow: snow, tree: tree,
                           clearOf: /^(foot[LMR]|mMark)/ },
                 palette: K, imperial: !kmh, hasCentre: true, art: A, rows: S.rows.slice(),
                 /* is the whole wing over the picture (S.wing, where it can be)? */
                 wingWhole: whole,
                 /* row readings the car side passes on as they arrive unless asked: a degree or a tenth of a
                    volt at a time, which on a rail is a mark that jumps. Named, they glide (src/car/smooth.js) */
                 glide: S.rows.map(function (kind) { return ROW_GLIDE[kind]; }).filter(function (k) { return !!k; }),
                 /* readings shown that the car's bus may not carry: what the rows and the footer hold */
                 shows: { oil: rowShows('oilp'), boost: rowShows('boost') || footShows('boost'),
                          iat: rowShows('iat') || footShows('iat'), volts: rowShows('volts') || footShows('volts') },
                 window: { x: win.x, y: win.y, w: win.w, h: win.h } };
    }

    return { build: build, ROW_KINDS: ROW_KINDS, ROW_HOME: ROW_HOME, rowScales: rowScales, revealAt: T.revealAt,
             /* how far the style can be lowered (BETA): to the screen's edge */
             LOWER_MOST: Strip.LOWER_MOST,
             inkSpan: inkSpan, penFor: penFor, iconPen: iconPen, X: X, Y: Y, PADEM: PADEM };
}));
