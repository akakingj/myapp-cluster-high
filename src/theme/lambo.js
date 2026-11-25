(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../engine/text.js'),
                                 require('../geometry/panel.js'),
                                 require('./palette.js'),
                                 require('./guide.js'),
                                 require('./textlayers.js'),
                                 require('./strip.js'),
                                 require('./readings.js'));
    } else {
        root.MGUTheme = factory(root.MGUText, root.MGUPanel, root.MGUPalette, root.MGUGuide,
                                root.MGUTextLayers, root.MGUStrip, root.MGUReadings);
    }
}(typeof self !== 'undefined' ? self : this, function (Text, Panel, Palette, Guide, TextLayers, Strip, Readings) {
    'use strict';

    /*
     * "Toro" - the Lamborghini Huracan CORSA cluster, reconstructed for the
     * BMW iDrive 7 panel.
     *
     * Geometry and art direction come from the CORSA brief, held as data in
     * src/theme/guide.js so it can be read against the document. The brief's
     * grid runs to y = 704; the MGU keeps y >= 646 for the car's own bottom
     * strip, so the whole instrument is scaled as one and centred.
     *
     * Deliberate departures from the brief, all of them for the car:
     *  - rendered as cluster-render effect layers, not SVG (the head unit
     *    gives us no other way to draw smoothly; see README);
     *  - a progressive lit run on the dial as the rpm indication, which the
     *    brief leaves open rather than specifies;
     *  - GT3 shift lights and a boost gauge, separately asked for;
     *  - the far-left region, which the brief says is unreadable in the
     *    photograph, carries oil temperature and pressure.
     */

    var G = Guide, T = Guide.TACH, B = Guide.BOUNDS;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    /* The dial reads in thousands: 0 at the start of the sweep, N at its end. */
    function vOf(rpm, scaleMax) {
        return clamp01(rpm / scaleMax) * scaleMax / 1000;
    }

    /*
     * The brief's own angle function places its 1..10 across the sweep. Our
     * scale runs 0..N over the same sweep, so map a scale value onto the
     * brief's v before asking where it sits: the arc, its crown and its
     * ends stay exactly where the brief puts them whatever N is.
     */
    function briefV(d, n) { return T.vMin + (T.vMax - T.vMin) * d / n; }

    function gearNames(profile) {
        var names = ['P', 'R', 'N'], i;
        for (i = 1; i <= profile.gearCount; i++) names.push(String(i));
        return names;
    }

    /*
     * The gear's two corner places (S.gearPlace), on the guide's grid:
     * where the figure is seen, left and right of the dial's axis (945),
     * how high its middle is and how tall its capitals are - half the
     * numeral in the middle, which is all the room there is between the
     * mode's name above and the boost and the speed below. `lean` is how
     * far right of its setting point this face's ink stands, per unit of
     * size.
     */
    var GEAR_CORNER = { left: 645, right: 1245, cy: 520, cap: 124, lean: 0.10 };
    /* the G meter is drawn at this much of the brief's size */
    var G_METER_SCALE = 0.85;

    /*
     * How far Toro can be lowered (BETA, src/theme/strip.js): 58 rows,
     * where it stands at the size the brief drew it - its content 16 rows
     * off the screen's foot, its side gauges 13 px off the screen's sides.
     * Any further and those gauges' scales leave the screen.
     */
    var LOWER_MOST = 58;

    function build(atlas, profileId, settings) {
        var P = Panel.profileFor(profileId, settings);
        var S = Palette.resolve(settings, P);
        /* (the M styles' widest window is not one of this dial's openings: its largest is "most") */
        if (S.centreSize === 'full') S.centreSize = 'most';
        S.lower = Math.min(S.lower, LOWER_MOST);
        /* how much of the screen it fills, and where it sits */
        G.setFit(S.zoom, S.shiftY, S.lower);
        /* lowered: where the instrument ends, and what nothing of it may touch - the gear's
           columns in what was the strip, as far round them as the limiter's shake can carry a layer */
        var FOOT = Strip.foot(S);
        var GUARD = S.lower > 0 ? Strip.gearGuard(S, S.shakePx) : null;
        /* a box whose foot would stand in those columns ends above them */
        function clearGear(b) {
            if (GUARD && b.x < GUARD.x + GUARD.w && b.x + b.w > GUARD.x && b.y + b.h > GUARD.y) b.h = GUARD.y - b.y;
            return b;
        }
        /* lowered, the instrument is as wide as the screen: a text layer's box is held to the
           screen (its words stand where they are set, whatever the box) */
        function onScreen(b) {
            if (!(S.lower > 0)) return b;
            var x0 = Math.max(0, b.x), x1 = Math.min(Panel.PANEL_WIDTH, b.x + b.w);
            return { x: x0, y: b.y, w: x1 - x0, h: b.h };
        }
        var C = S.colours;
        var GC = G.COLOURS;
        /* The brief paints the gear and the mode labels red. With the
           colour set to apply to everything they follow the accent, which
           is read every frame so the interior light can move it live. */
        function keyCol() { return S.accentScope === 'full' ? C.accent : GC.corsaRed; }
        var names = gearNames(P);
        var layers = [];
        /* the units shown (S.u, units.js), as this style letters them */
        var UN = S.u;
        var imperial = UN.miles;
        var U = {
            dist: UN.labels.dist.toUpperCase(),
            temp: UN.labels.temp,
            press: UN.labels.press.toUpperCase(),
            speed: UN.labels.speed.toUpperCase()
        };
        var bandFlash = S.revFlash === 'band' || S.revFlash === 'both';
        var edgeFlash = S.revFlash === 'edges' || S.revFlash === 'both';

        /* The dial, in panel pixels. */
        var DC = { x: G.gx(T.cx), y: G.gy(T.cy) };
        var rOuter = G.gs(T.rOuter);
        var ANG = [G.phiRad(T.vMin), G.phiRad(T.vMax)];
        /* The brief's sweep runs past the crown, so the box is the whole
           circle's upper cap plus a margin for the glow. */
        var dialBox = {
            x: Math.max(0, G.gx(T.cx - T.rOuter) - 26),
            y: Math.max(0, G.gy(T.cy - T.rOuter) - 26),
            w: 0, h: 0
        };
        dialBox.w = Math.min(Panel.PANEL_WIDTH, G.gx(T.cx + T.rOuter) + 26) - dialBox.x;
        dialBox.h = Math.min(FOOT, G.point(T.vMax, T.rOuter).y + 40) - dialBox.y;
        clearGear(dialBox);

        var dialCentre = [DC.x - dialBox.x, DC.y - dialBox.y];
        var N = S.scaleMaxRpm / 1000;
        /* Where the red detailing starts, as a scale value. */
        var redV = S.redFromScale !== null && S.redFromScale !== undefined
            ? S.redFromScale : S.rpmRedline / 1000;
        /* ... and now: lower while the engine is cold (s.redRpm, src/engine/state.js shiftPoint) */
        function redNow(s) {
            return S.redFromScale !== null && S.redFromScale !== undefined || !(s && s.redRpm) ? redV : s.redRpm / 1000;
        }

        /*
         * A plug-in hybrid's Power % in its electric and hybrid modes (s.power, src/engine/state.js):
         * on the same numerals' places, its 0 a quarter up, 100 at the top (Palette.powerAt), the
         * regeneration below the 0 in green; the red detailing off.
         */
        function powerOn(s) { return !!s && s.power !== null && s.power !== undefined; }
        function valueOf(s) { return powerOn(s) ? Palette.powerAt(s.power, N) : vOf(s.rpm || 0, S.scaleMaxRpm); }
        function zeroOf(s) { return powerOn(s) ? Palette.powerZero(N) : 0; }
        function redOf(s) { return powerOn(s) ? N + 1 : redNow(s); }

        /* ------------------------------------------------------ helpers */

        var TL = TextLayers.create(atlas, layers, { text: C.text, muted: C.muted });
        var txt = TL.txt, statics = TL.statics;

        /*
         * A larger opening is held inside the dial: a circle about the
         * dial's own centre, a little inside the band's inner contour
         * (Palette.HOLES). It moves and scales with the dial, so "fill the
         * screen" and "nudge up" carry it along.
         */
        var holeDisc = S.holeDisc
            ? [DC.x, DC.y, G.gs(T.rRecess) - S.holeDisc.inset, S.holeDisc.feather]
            : [0, 0, 0, 0];
        /*
         * Every opening ends above the G meter, whose top figure is the
         * first white thing under the dial: no more than its size's
         * `footRoom` below that figure's top (Palette.HOLES). The meter
         * moves with the dial, so the opening's foot is found from it: as
         * the dial comes that changes nothing, and with the dial made
         * larger or nudged up the foot rises with the meter.
         */
        var gTop = G.gy(B.gForce.cy - B.gForce.h * G_METER_SCALE * 0.54) - G.gs(12.5);
        var holeFoot = Math.round(gTop) + S.holeFootRoom;
        if (S.hole[1] + S.hole[3] > holeFoot) S.hole[3] = Math.max(40, holeFoot - S.hole[1]);

        /* ------------------------------------------------- background */
        layers.push({
            /* the hosted picture (the map, the camera) is the cluster's own
               slot, under everything of ours.
               belowCut: it may run a little way over the car's bottom strip
               (S.bottomExtra: never as far as the gear, src/theme/strip.js). */
            id: 'bg', z: 1, shader: 'bg', belowCut: true, still: true,
            x: 0, y: 0, w: Panel.PANEL_WIDTH, h: Panel.BOTTOM_CUT + S.bottomExtra,
            uniforms: function (s) {
                var c = s && s.centre;
                /* the opening: for the map and for the camera alike */
                var open = (c && (c.mode === 'map' || c.mode === 'camera') ? c.open : 0) * S.holeMax;
                return {
                    u_hole: S.hole, u_holeOpen: [open, S.holeFeather, S.holeChamfer],
                    u_holeDisc: holeDisc,
                    u_foot: [Panel.BOTTOM_CUT, S.bottomExtra],
                    u_black: GC.screenBlack, u_blue: GC.screenBlueBlack,
                    u_lower: GC.lowerField, u_line: GC.geometricLine,
                    u_hex: S.hexagons, u_hexSize: S.hexSize, u_facets: S.facets, u_rev: S.revuelto,
                    u_hexTint: S.hexTint,
                    /* white lifted towards the accent, unless a colour was set */
                    u_node: C.node || [0.5 + 0.5 * C.accent[0], 0.5 + 0.5 * C.accent[1],
                                       0.5 + 0.5 * C.accent[2]],
                    u_accent: C.accent
                };
            }
        });

        /* BMW's bottom strip hidden: plain covers either side of its gear */
        Strip.layers(S, [0, 0, 0]).forEach(function (L) { layers.push(L); });

        /* ---------------------------------------------- the tachometer */
        function dialBase() {
            return {
                u_centre: dialCentre, u_ang: ANG,
                u_scale: [0, N]
            };
        }

        layers.push({
            id: 'stipple', z: 4, shader: 'stipple',
            x: dialBox.x, y: dialBox.y, w: dialBox.w, h: dialBox.h,
            uniforms: function (s) {
                var u = dialBase();
                u.u_rev = [valueOf(s), S.dialFill];
                u.u_litCol = C.lit;
                u.u_needle = GC.corsaRed;
                u.u_redV = redOf(s);
                u.u_zero = zeroOf(s);
                u.u_regen = Palette.REGEN;
                u.u_ring = [G.gs(T.stippleInner), G.gs(T.stippleOuter)];
                u.u_dot = [G.gs(G.STIPPLE.spacing), G.gs(G.STIPPLE.dotRadius),
                           G.STIPPLE.opacity * S.stipple];
                /* the wash is the stipple ring's own outline: always draw it */
                u.u_redFrom = redOf(s);
                u.u_col = GC.stipple;
                u.u_red = GC.dimRed;
                u.u_smoke = S.background === 'modern'
                    ? [GC.screenBlack[0], GC.screenBlack[1], GC.screenBlack[2], 0.78]
                    : [0, 0, 0, 0];
                return u;
            }
        });

        layers.push({
            id: 'dial', z: 10, shader: 'dial',
            x: dialBox.x, y: dialBox.y, w: dialBox.w, h: dialBox.h,
            uniforms: function (s) {
                var u = dialBase();
                u.u_rOuter = rOuter;
                u.u_arcW = G.gs(1.6);
                u.u_tick = [G.gs(T.tickMinor), G.gs(T.tickMajor), G.gs(T.tickWidth)];
                u.u_step = T.tickStep;
                u.u_frac = valueOf(s);
                u.u_redFrom = redOf(s);
                u.u_zero = zeroOf(s);
                u.u_regen = Palette.REGEN;
                u.u_warn = bandFlash ? (s.limiter || 0) : 0;
                u.u_lit = C.lit;
                u.u_base = GC.fineContour;
                u.u_red = GC.corsaRed;
                return u;
            }
        });

        layers.push({
            id: 'contour', z: 12, shader: 'contour',
            x: dialBox.x, y: dialBox.y, w: dialBox.w, h: dialBox.h,
            uniforms: function (s) {
                var u = dialBase();
                u.u_radii = [G.gs(T.rRecess), G.gs(T.rPlateau)];
                u.u_width = G.gs(T.contourWidth);
                u.u_redFrom = redOf(s);
                u.u_frac = valueOf(s);
                u.u_zero = zeroOf(s);
                u.u_regen = Palette.REGEN;
                u.u_col = GC.fineContour;
                u.u_red = GC.corsaRed;
                u.u_lit = C.lit;
                return u;
            }
        });

        /* Scale numerals: narrow, inclined, hollow; red from the red mark. */
        var numSize = G.gs(T.numeralHeight) / 0.70;   /* cap height -> em */
        var numItems = [], numVals = [], v;
        for (v = S.showZeroNumeral ? 0 : 1; v <= N; v++) {
            var at = G.point(briefV(v, N), T.rNumeral);
            numItems.push({ str: String(v), x: at.x, y: at.y });
            numVals.push(v);
        }
        var numBox = {
            x: Math.max(0, G.gx(T.cx - T.rNumeral) - 84),
            y: Math.max(0, G.gy(T.cy - T.rNumeral) - 74), w: 0, h: 0
        };
        numBox.w = Math.min(Panel.PANEL_WIDTH, G.gx(T.cx + T.rNumeral) + 84) - numBox.x;
        numBox.h = Math.min(FOOT,
            Math.max(G.point(T.vMax, T.rNumeral).y, G.point(T.vMin, T.rNumeral).y) + 88) - numBox.y;
        clearGear(numBox);

        var numLayout = Text.place(atlas, numItems.map(function (it) {
            return { str: it.str, x: it.x - numBox.x, y: it.y - numBox.y };
        }), { face: 'dial', size: numSize, align: 'centre', baseline: 'middle' });

        /*
         * The scale grows as it climbs: the first numeral a tenth larger
         * than the brief's, each one after it a little larger again, and
         * the numeral at the red mark the largest - a twentieth above the
         * first. Baked into the glyph quads here rather than sent to the
         * shader, which has no uniform vectors to spare; the shader's own
         * scaling, as the needle passes, multiplies on top of it.
         */
        (function growWithTheScale() {
            var first = 1.10, atRed = 1.05, span = Math.max(1, redV - 1), i, j = 0;
            for (i = 0; i < numVals.length; i++) {
                var t = Math.max(0, Math.min(1, (numVals[i] - 1) / span));
                var k = first * (1 + (atRed - 1) * t);
                var n = String(numVals[i]).length, c;
                for (c = 0; c < n && j < 12; c++, j++) {
                    var q = j * 4;
                    var cx = numLayout.p[q] + numLayout.p[q + 2] / 2;
                    var cy = numLayout.p[q + 1] + numLayout.p[q + 3] / 2;
                    numLayout.p[q + 2] *= k;
                    numLayout.p[q + 3] *= k;
                    numLayout.p[q] = cx - numLayout.p[q + 2] / 2;
                    numLayout.p[q + 1] = cy - numLayout.p[q + 3] / 2;
                }
            }
        }());

        /* Each glyph carries its own scale value, so "10" works as two. */
        var gt = [];
        (function () {
            var i, j = 0;
            for (i = 0; i < numVals.length; i++) {
                var n = String(numVals[i]).length, c;
                for (c = 0; c < n; c++) {
                    gt.push(numVals[i], numVals[i] >= redV - 0.001 ? 1 : 0, 0, 0);
                    j++;
                }
            }
            while (gt.length < 12 * 4) gt.push(0, 0, 0, 0);
        }());

        layers.push({
            id: 'arcNums', z: 16, shader: 'arcnum',
            x: numBox.x, y: numBox.y, w: numBox.w, h: numBox.h,
            uniforms: function (s) {
                if (powerOn(s)) return null;
                return {
                    u_g: numLayout.g, u_quad: numLayout.p, u_gt: gt,
                    u_cfg: [numLayout.count, numLayout.sharp,
                            vOf(s.rpm, S.scaleMaxRpm), G.gs(T.numeralStroke)],
                    u_colOff: [GC.secondaryWhite[0] * 0.62, GC.secondaryWhite[1] * 0.62,
                               GC.secondaryWhite[2] * 0.62],
                    u_colOn: GC.primaryWhite,
                    u_colRed: GC.corsaRed,
                    /* the accent, and whether the numeral at the needle fills */
                    u_colPop: [C.accent[0], C.accent[1], C.accent[2], S.numeralFill ? 1 : 0]
                };
            }
        });

        /* ... and a Power %'s: 0, 50 and 100 on the numerals' places they stand at, set the same way */
        (function powerNumerals() {
            var items = [], vals = [], k;
            for (k = 0; k <= N; k++) {
                var f = Palette.powerFigure(k, N);
                if (!f) continue;
                var at = G.point(briefV(k, N), T.rNumeral);
                items.push({ str: f, x: at.x - numBox.x, y: at.y - numBox.y });
                vals.push(k);
            }
            var L = Text.place(atlas, items, { face: 'dial', size: numSize * 1.08, align: 'centre', baseline: 'middle' });
            var pgt = [], i, c;
            for (i = 0; i < vals.length; i++) for (c = 0; c < items[i].str.length; c++) pgt.push(vals[i], 0, 0, 0);
            while (pgt.length < 12 * 4) pgt.push(0, 0, 0, 0);
            layers.push({
                id: 'pctNums', z: 16, shader: 'arcnum',
                x: numBox.x, y: numBox.y, w: numBox.w, h: numBox.h,
                uniforms: function (s) {
                    if (!powerOn(s)) return null;
                    return {
                        u_g: L.g, u_quad: L.p, u_gt: pgt,
                        u_cfg: [L.count, L.sharp, Math.max(0, valueOf(s)), G.gs(T.numeralStroke)],
                        u_colOff: [GC.secondaryWhite[0] * 0.62, GC.secondaryWhite[1] * 0.62, GC.secondaryWhite[2] * 0.62],
                        u_colOn: GC.primaryWhite,
                        u_colRed: GC.corsaRed,
                        u_colPop: [C.accent[0], C.accent[1], C.accent[2], S.numeralFill ? 1 : 0]
                    };
                }
            });
        }());
        /* its name under the mode's: POWER %, or CHARGE in green while the battery takes the regeneration */
        txt('pctWord', 24, { x: G.gx(B.corsa.cx) - 76, y: G.gy(B.corsa.cy) + G.gs(16), w: 152, h: 36 },
            { face: 'label', size: G.gs(18) / 0.70, align: 'centre',
              x: G.gx(B.corsa.cx), y: G.gy(B.corsa.cy) + G.gs(42), tracking: 1.2,
              color: function (s) { return powerOn(s) && s.power < 0 ? Palette.REGEN : GC.secondaryWhite; } },
            function (s) { return powerOn(s) ? (s.power < 0 ? 'CHARGE' : 'POWER %') : ''; });

        /* ------------------------------------------------ shift lights */
        /* Three kinds (src/shaders/core.js shiftbar). The Lamborghini one
           is wider, closes in from both ends and fires in bursts at the
           limit, with the screen flash in step and the cluster shaking.
           All stand clear of the driver camera's cowl (Panel.CAMERA), and of
           the turn signal arrows at its lower corners (Panel.TURN_ARROWS,
           below them): the Lamborghini blades either side of an empty
           middle, the GT3 LEDs and the blade in two halves, left then
           right. */
        var toroShift = S.shiftStyle === 'toro';
        if (S.shiftLights) {
            /* the empty middle: the cowl's width, and an arrow's where one stands in the bar's rows (top 50) */
            var GAP_L = Panel.CAMERA.x, GAP_R = Panel.CAMERA.x + Panel.CAMERA.w;
            Panel.TURN_ARROWS.forEach(function (a) {
                if (a.y < 50) { GAP_L = Math.min(GAP_L, a.x); GAP_R = Math.max(GAP_R, a.x + a.w); }
            });
            /* lit from Shift lights from up to the limiter, flashing there; with Shift now warning at set, up to the
               shift point, flashing from there */
            var shiftEnd = function (s) { return S.shiftWarn && s.shiftRpm ? s.shiftRpm : S.rpmLimiter; };
            var shiftFrac = function (s) {
                var start = Math.min(S.shiftFromRpm, shiftEnd(s) - 100);
                return powerOn(s) ? 0 : clamp01((s.rpm - start) / Math.max(1, shiftEnd(s) - start));
            };
            var shiftLayer = function (id, SB, frac, c) {
                layers.push({
                    id: id, z: 60, shader: 'shiftbar',
                    x: SB.x, y: SB.y, w: SB.w, h: SB.h,
                    uniforms: function (s) {
                        return {
                            u_frac: frac(shiftFrac(s)),
                            u_leds: SB.leds, u_style: S.shiftStyleIndex, u_burst: toroShift ? 1 : 0,
                            u_gap: SB.gap || 0,
                            u_strobe: !powerOn(s) && (S.shiftWarn ? s.shiftNow : s.rpm >= S.rpmLimiter - 60) ? 1 : 0,
                            u_c1: c[0], u_c2: c[1], u_c3: c[2]
                        };
                    }
                });
            };
            var orange = [1.0, 0.45, 0.08];
            if (toroShift) {
                /* (from where the glass's corners leave it whole, the middle the cowl's width) */
                shiftLayer('shift', { x: 400, y: 2, w: 1120, h: 46, leds: 8, gap: (GAP_R - GAP_L) / 2 },
                    function (f) { return f; }, [GC.primaryWhite, orange, GC.corsaRed]);
            } else {
                var blade = S.shiftStyle === 'blade';
                var half = blade ? { y: 8, h: 30, leds: 1 } : { y: 6, h: 34, leds: 8 };
                var L = { x: 400, w: GAP_L - 400 }, R = { x: GAP_R, w: 1520 - GAP_R };
                shiftLayer('shift', Object.assign({}, half, L), function (f) { return clamp01(f * 2); },
                    blade ? [GC.primaryWhite, GC.primaryWhite, GC.primaryWhite] : [C.green, C.green, C.amber]);
                shiftLayer('shiftR', Object.assign({}, half, R), function (f) { return clamp01(f * 2 - 1); },
                    blade ? [GC.primaryWhite, GC.primaryWhite, GC.corsaRed] : [C.amber, GC.corsaRed, GC.corsaRed]);
            }
        }
        if (edgeFlash) {
            /* (lowered, it is the instrument's own size: three pieces, round the gear's columns - src/theme/strip.js) */
            Strip.spread(S).forEach(function (r, i) {
                layers.push({
                    id: 'flash' + ['', 'L', 'R'][i], z: 95, shader: S.lower > 0 ? 'flashPart' : 'flash', still: true,
                    x: r.x, y: r.y, w: r.w, h: r.h,
                    uniforms: function (s) {
                        /* nothing to flash: not drawn at all. (It lies over the whole style, and a layer
                           that is drawn costs the renderer every pixel it covers, lit or not.) */
                        if (!(s.limiter > 0)) return null;
                        var u = { u_on: s.limiter || 0, u_rate: S.flashRate,
                                  u_col: S.flashCol, u_strength: S.flashStrength,
                                  u_style: S.flashStyleIndex, u_spread: S.flashSpread,
                                  u_burst: toroShift ? 1 : 0 };
                        if (S.lower > 0) u.u_frame = [r.x, r.y, Panel.PANEL_WIDTH, FOOT];
                        return u;
                    }
                });
            });
        }

        /* --------------------------------------- gear, CORSA, secondary */
        /*
         * The gear. The Huracan's own is a tall hollow numeral in the
         * middle of the dial. Two things can be chosen for it:
         *
         *   S.gearFill   outline: that fine hollow numeral
         *                heavy:   the same with a stroke about twice as
         *                         thick (the first versions of this style
         *                         drew it so)
         *                filled:  bold - the numeral solid, in the colour
         *                         the outline has (white at the limiter,
         *                         as that is)
         *   S.gearPlace  left | right: half the height, out of the middle
         *                and into a corner of the dial's foot - on the left
         *                above the boost gauge, on the right above the
         *                speed, the same distance either side of the dial's
         *                axis. The middle is then the picture's alone.
         *
         * The face leans, so a figure's ink stands to the right of where
         * it is set (about a tenth of its size): the corner places are
         * given by where the figure is seen, and set back by that.
         *
         * (No glow on any of them: this face's glyphs are baked with a
         * narrow margin, and a glow would end on that margin as a box.)
         */
        var gearRect = G.grect(B.gear);
        var gearCorner = S.gearPlace !== 'centre';
        var gearCap = gearCorner ? G.gs(GEAR_CORNER.cap) : gearRect.h;
        var gearSize = gearCap / 0.70;
        var gearAt = gearCorner
            ? { x: G.gx(GEAR_CORNER[S.gearPlace]) - GEAR_CORNER.lean * gearSize, y: G.gy(GEAR_CORNER.cy) }
            : { x: gearRect.x + gearRect.w / 2, y: gearRect.y + gearRect.h / 2 };
        /* the stroke, in the guide's units: fine | heavy, tall | in a corner */
        var gearLine = G.gs(S.gearFill === 'heavy' ? (gearCorner ? 5.0 : 7.0) : (gearCorner ? 3.0 : 3.6));
        var gearRoom = G.gs(3.0);
        /* the gear as TORO > Gear has it: with its programme (D1, S1, M1) or the figure alone */
        /* a pair's size against a figure's: the widest pair, M8, within the box a single M has (a corner's is tighter) */
        var PAIR = gearCorner ? 0.58 : 0.68;
        function gearShown(s) { return String((S.gearShows === 'staged' ? s.gearStaged : s.gear) || s.gear || 'P'); }
        txt('gearBig', 24,
            gearCorner
                /* every figure the face has, the wide M included, and a little to spare
                   (a stroke is drawn inside the figure's own cell, so it needs no more) */
                ? { x: Math.floor(gearAt.x - 0.44 * gearSize - gearRoom), y: Math.floor(gearAt.y - 0.41 * gearSize - gearRoom),
                    w: Math.ceil(1.09 * gearSize + 2 * gearRoom), h: Math.ceil(0.83 * gearSize + 2 * gearRoom) }
                : { x: gearRect.x - 90, y: gearRect.y - 44, w: gearRect.w + 180, h: gearRect.h + 92 },
            /* (two characters - the programme and the gear, TORO > Gear - set smaller: PAIR) */
            { face: 'gear', size: function (s) { return gearShown(s).length > 1 ? gearSize * PAIR : gearSize; },
              align: 'centre', baseline: 'middle',
              x: gearAt.x, y: gearAt.y,
              /* (the stroke smaller with the pair, as the figures are: it keeps inside each figure's cell) */
              outline: S.gearFill === 'filled' ? 0 : function (s) { return gearShown(s).length > 1 ? gearLine * PAIR : gearLine; }, glow: 0.0,
              /* (white at the limiter, and blinking white at the shift point) */
              color: function (s) { return S.gearFill === 'filled' && (s.limiter > 0.5 || Palette.blinkOn(s)) ? [1, 1, 1] : keyCol(); },
              outCol: function (s) {
                  return s.limiter > 0.5 || Palette.blinkOn(s) ? [1, 1, 1] : keyCol();
              } },
            gearShown);

        txt('corsa', 24, { x: G.gx(B.corsa.cx) - 100, y: G.gy(B.corsa.cy) - 28, w: 200, h: 50 },
            { face: 'label', size: G.gs(26) / 0.70, align: 'centre',
              x: G.gx(B.corsa.cx), y: G.gy(B.corsa.cy) + G.gs(13),
              color: keyCol, tracking: 1.5 },
            function (s) { return s.modeLabel || S.mode; });

        if (S.secondaryGlyph) {
            statics('secondary', 24,
                { x: G.gx(B.secondaryR.cx) - 40, y: G.gy(B.secondaryR.cy) - 30, w: 80, h: 50 },
                { face: 'gear', size: G.gs(30) / 0.70, align: 'centre',
                  color: GC.secondaryWhite },
                [{ str: S.secondaryGlyph, x: G.gx(B.secondaryR.cx), y: G.gy(B.secondaryR.cy) + G.gs(15) }]);
        }

        /* ---------------------------------------- side instruments */
        /*
         * The Huracan's side instruments: two slanted horizontal gauges a
         * side, each a label with its icon, a scale with numbers and ticks,
         * a hatched bar whose last section is orange-red, and a red needle
         * at the value (shader 'hgauge'). They lean with the screen's own
         * angled corners, and the upper one of each pair sits further in so
         * the pair follows that edge too.
         *
         * rect is in guide units; inside it the gauge keeps a fixed grid,
         * 100 units tall (src/shaders/parts.js hgauge).
         */
        var HOT = [1.0, 0.36, 0.10];
        function instrument(id, rect, o) {
            var r = G.grect(rect);
            var k = r.h / 100;
            var left = o.side === 'left';
            var shear = o.shear !== undefined ? o.shear : left ? 0.30 : -0.30;
            var podOf = o.pod || function (s) { return s.pods[o.key]; };
            var X0 = 16, X1 = r.w / k - 16;
            /* where a fraction of the scale lands, at a height in the grid */
            function at(f, y) {
                var ff = o.dir < 0 ? 1 - f : f;
                return r.x + k * (X0 + ff * (X1 - X0) + (63 - y) * shear);
            }
            var iconS = o.icon === null ? 0 : 26 * k;
            var iconX = left ? r.x + k * (2 + (63 - 12) * shear) : r.x + r.w - k * 2 - iconS + k * (63 - 12) * shear;
            if (o.icon !== null) layers.push({
                id: 'icon_' + id, z: 20, shader: 'icon',
                x: iconX, y: r.y - 10 * k, w: iconS, h: iconS,
                uniforms: function () {
                    return { u_kind: o.icon, u_col: GC.secondaryWhite };
                }
            });
            var lblX = left ? iconX + iconS + (iconS ? 8 * k : 0) : iconX - 8 * k;
            var lblBox = onScreen({ x: r.x - 20 * k, y: r.y - 12 * k, w: r.w + 40 * k, h: 30 * k });
            function label(suffix, str, show) {
                statics('lbl_' + id + suffix, 20, lblBox,
                    { face: 'label', size: 16 * k / 0.70, align: left ? 'left' : 'right',
                      color: GC.secondaryWhite, tracking: 0.8, show: show },
                    [{ str: str, x: lblX, y: r.y + 13 * k }]);
            }
            /* the scale's numbers in the car's orange-red italic figures */
            /* (places: each one's place 0..1, else evenly along the scale) */
            function numbers(suffix, marks, show, places) {
                var figures = marks.every(function (m) { return /^[0-9]+$/.test(m); });
                statics('scale_' + id + suffix, 21,
                    onScreen({ x: r.x - 30 * k, y: r.y + 18 * k, w: r.w + 60 * k, h: 28 * k }),
                    { face: figures ? 'dial' : 'label', size: (figures ? 15 : 14) * k / 0.70, align: 'centre',
                      color: HOT, alpha: 0.95, show: show },
                    marks.map(function (m, i) {
                        return { str: m, x: at(places ? places[i] : i / (marks.length - 1), 34), y: r.y + 41 * k };
                    }));
            }
            if (o.alt) {
                label('', o.label, function (s) { return !s.auxIsOil; });
                label('_alt', o.alt.label, function (s) { return !!s.auxIsOil; });
                numbers('', o.marks, function (s) { return !s.auxIsOil; }, o.marksAt);
                numbers('_alt', o.alt.marks, function (s) { return !!s.auxIsOil; });
            } else {
                label('', o.label, null);
                numbers('', o.marks, null, o.marksAt);
            }

            layers.push({
                id: 'bar_' + id, z: 21, shader: 'hgauge',
                x: r.x, y: r.y, w: r.w, h: r.h,
                uniforms: function (s) {
                    var g = podOf(s);
                    var red = o.alt && s.auxIsOil ? o.alt.red : o.red;
                    return {
                        u_frac: clamp01(g.frac), u_dir: o.dir, u_redZone: red,
                        u_ticks: (o.alt && s.auxIsOil) || !o.ticks ? [0, 0, 0, 0] : o.ticks,
                        u_shear: shear, u_on: g.text === '--' ? 0 : 1,
                        u_alarm: g.alarm ? 1 : 0,
                        u_col: GC.primaryWhite, u_hot: HOT, u_needle: GC.corsaRed
                    };
                }
            });

            /* the reading itself, at the far end of the label row */
            var valX = left ? r.x + r.w - 4 * k + (63 - 12) * shear * k : r.x + 4 * k + (63 - 12) * shear * k;
            txt('val_' + id, 21,
                { x: left ? valX - 90 * k : valX, y: r.y - 14 * k, w: 90 * k, h: 32 * k },
                { face: 'display', size: 19 * k / 0.70, align: left ? 'right' : 'left',
                  x: valX, y: r.y + 14 * k,
                  color: function (s) {
                      return podOf(s).alarm ? GC.corsaRed : GC.primaryWhite;
                  } },
                function (s) { return podOf(s).text; });
        }

        /*
         * What a side gauge can be given: its label, symbol, scale and
         * red end, and where its reading comes from - the state's own pods
         * for the four the style has, or the readings as numbers (s.num)
         * set on a scale here.
         */
        function numPod(key, lo, hi, show, text, alarm) {
            return function (s) {
                var v = s.num ? s.num[key] : null;
                if (v === null || v === undefined) return { frac: 0, text: '--', alarm: 0 };
                var x = show(v);
                return { frac: (x - lo) / (hi - lo), text: text(x, v), alarm: alarm(v, s) ? 1 : 0 };
            };
        }
        /* a figure as it is, with this many decimals, never in alarm */
        function plain(key, lo, hi, digits) {
            return numPod(key, lo, hi, function (v) { return v; }, function (v) { return v.toFixed(digits); }, function () { return false; });
        }
        function tempPod(key, lo, hi, hot) {
            return numPod(key, lo, hi, function (c) { return c; },
                function (c) { return String(Math.round(UN.tempIn(c))); }, function (c) { return hot !== null && c >= hot; });
        }
        /*
         * The turbo gauges' end in the unit shown: General > Boost gauge up to (one of the car's own gauges: its
         * psi, or its bar), else the style's own 25 psi, 1.7 bar, marked at the start, the middle and the end.
         */
        var turboTop = P.boostBar ? { psi: P.boostPsi, bar: P.boostBar, kpa: P.boostBar * 100 }[UN.press] : null;
        /* (set: numbered by its end, 0 10 20 30, 0 17.5 35, each at its place: turboAt) */
        var turboTicks = turboTop ? Panel.boostTicks(turboTop, UN.press) : null;
        var turboAt = turboTicks ? turboTicks.map(function (t) { return t.at; }) : null;
        /* (its ticks: tall ones at its numbers, the small ones about 20 with every number on one - 0 5 10 15: 21) */
        var turboTickU = null;
        if (turboTicks) {
            var cent = turboTicks.map(function (t) { return Math.round(Number(t.str) * 100); });
            var gcd = function (a, b) { return b ? gcd(b, a % b) : a; };
            var parts = cent[cent.length - 1] / cent.reduce(gcd);
            var mid = turboAt.slice(1, -1);
            turboTickU = [parts * Math.max(1, Math.round(20 / parts)), mid.length > 0 ? mid[0] : -1, mid.length > 1 ? mid[1] : -1, mid.length > 2 ? mid[2] : -1];
        }
        function turboMarks() {
            if (!turboTicks) return { psi: ['0', '12', '25'], bar: ['0', '0.8', '1.7'], kpa: ['0', '85', '170'] }[UN.press];
            return turboTicks.map(function (t) { return t.str; });
        }
        function pressPod(key, hiBar, oil) {
            var hi = { psi: oil ? 140 : 25, bar: hiBar, kpa: hiBar * 100 }[UN.press];
            return numPod(key, 0, hi, UN.pressIn, function (x, bar) { return UN.pressText(bar, oil); },
                function (bar, s) { return oil && s.rpm > 1200 && bar < 1.0; });
        }
        /* a reading on a scale to hi in the unit shown (show: the car's unit to it), its figure whole */
        function unitPod(key, hi, show) {
            return numPod(key, 0, hi, show, function (x) { return String(Math.round(x)); }, function () { return false; });
        }
        function thirds(hi) { return ['0', String(hi / 2), String(hi)]; }
        var PW_HI = { hp: 400, ps: 400, kw: 300 }[UN.power] || 400;
        var TQ_HI = { nm: 600, kgm: 60, lbft: 450 }[UN.torque] || 600;
        var RAIL_HI = { psi: 5000, bar: 350, kpa: 35000 }[UN.press];
        /* the fuel's name in Italian, as the car's own gauge names its fuel: petrol (benzina) or diesel (gasolio) */
        var FUEL_WORD = S.engine === 'diesel' ? 'GASOLIO' : 'BENZINA';
        function gaugeKind(kind) {
            var P3 = turboMarks();
            var O3 = { psi: ['0', '70', '140'], bar: ['0', '5', '10'], kpa: ['0', '500', '1000'] }[UN.press];
            switch (kind) {
            case 'fuel': return { icon: 0, label: FUEL_WORD, key: 'fuel', marks: ['0', '50', '100'], red: [0, 0.12] };
            case 'coolant': return { icon: 1, label: 'TEMP. ACQUA', key: 'coolant', marks: tLabels([50, 90, 130]), red: [0.81, 1] };
            case 'oil': return { icon: 2, label: 'TEMP. OLIO', key: 'oilTemp', marks: tLabels([50, 110, 170]), red: [0.83, 1] };
            case 'oilp': return { icon: 2, label: 'PRESS. OLIO', pod: pressPod('oilBar', 10, true), marks: O3, red: [0, 0.08] };
            case 'boost': return { icon: null, label: 'PRESS. TURBO', marksAt: turboAt, ticks: turboTickU, pod: turboTop ? numPod('boostBar', 0, turboTop, UN.pressIn, function (x, bar) { return UN.pressText(bar, false); },
                                                                               function () { return false; }) : pressPod('boostBar', 1.7, false), marks: P3, red: [0.86, 1] };
            case 'gearbox': return { icon: null, label: 'TEMP. CAMBIO', pod: tempPod('gearboxC', 40, 130, 120),
                                     marks: tLabels([40, 85, 130]), red: [0.89, 1] };
            case 'iat': return { icon: null, label: 'TEMP. ARIA', pod: tempPod('iatC', -20, 60, null),
                                 marks: tLabels([-20, 20, 60]), red: [0.88, 1] };
            case 'volts': return { icon: null, label: 'BATTERIA V',
                                   pod: numPod('volts', 10, 16, function (v) { return v; }, function (v) { return v.toFixed(1); },
                                               function (v) { return v < 11.8; }),
                                   marks: ['10', '13', '16'], red: [0, 0.3] };
            case 'pedal': return { icon: null, label: 'PEDALE %', pod: plain('pedalPct', 0, 100, 0), marks: ['0', '50', '100'], red: [0.9, 1] };
            case 'throttle': return { icon: null, label: 'FARFALLA %', pod: plain('throttlePct', 0, 100, 0), marks: ['0', '50', '100'], red: [0.9, 1] };
            case 'timing': return { icon: null, label: 'ANTICIPO °', pod: plain('timingDeg', -10, 50, 1), marks: ['-10', '20', '50'], red: [0, 0.17] };
            /* (the same readings AK Cluster Layouts' gauges offer: the engine's power and torque in the units shown,
               the fuel rail's and the supply's pressures, a plug-in hybrid's drive battery) */
            case 'power': return { icon: null, label: 'POTENZA', pod: unitPod('powerKw', PW_HI, UN.powerIn), marks: thirds(PW_HI), red: [0.9, 1] };
            case 'torque': return { icon: null, label: 'COPPIA', pod: unitPod('torqueNm', TQ_HI, UN.torqueIn), marks: thirds(TQ_HI), red: [0.9, 1] };
            case 'hpfp': return { icon: null, label: 'PRESS. RAIL', pod: unitPod('hpfpBar', RAIL_HI, UN.pressIn), marks: thirds(RAIL_HI), red: [0, 0.1] };
            case 'lpfp': return { icon: null, label: 'PRESS. BENZINA', pod: pressPod('lpfpBar', 10, true), marks: O3, red: [0, 0.08] };
            case 'charge': return { icon: null, label: 'BATTERIA %', pod: numPod('socPct', 0, 100, function (v) { return v; },
                                                                              function (v) { return String(Math.round(v)); }, function (v) { return v <= 10; }),
                                    marks: ['0', '50', '100'], red: [0, 0.1] };
            case 'hvtemp': return { icon: null, label: 'TEMP. BATTERIA', pod: tempPod('hvC', -10, 60, 50), marks: tLabels([-10, 25, 60]), red: [0.86, 1] };
            default: return null;
            }
        }

        /* scale numbers in the units shown: the pods' fractions are fixed in C */
        function tLabels(cs) {
            return cs.map(function (c) { return String(Math.round(UN.tempIn(c))); });
        }
        /*
         * The right pair reads right to left, the mirror of the left pair:
         * each needle sweeps in from the outer edge as its reading rises.
         */
        /*
         * Electric range (S.electric) takes one gauge's place: the same
         * wedge, its bar the drive battery's charge, its figure the range
         * in the units shown. Which one is a setting; left to itself it is
         * oil pressure on a plug-in hybrid (coolant, with the left pair
         * hidden) and the fuel gauge on an electric car, which has no fuel.
         */
        /* what each side gauge shows (left upper, left lower, right upper, right lower) */
        var GAUGE_KINDS = ['auto', 'fuel', 'coolant', 'oil', 'oilp', 'boost', 'gearbox', 'iat', 'volts', 'pedal', 'throttle', 'timing',
                           'power', 'torque', 'hpfp', 'lpfp', 'charge', 'hvtemp', 'off'];
        S.gauges = {};
        ['L1', 'L2', 'R1', 'R2'].forEach(function (n) {
            var v = S['gauge' + n];
            S.gauges[n] = GAUGE_KINDS.indexOf(v) >= 0 ? v : 'auto';
        });
        function anyGauge(kinds) {
            return ['L1', 'L2', 'R1', 'R2'].some(function (n) { return kinds.indexOf(S.gauges[n]) >= 0; });
        }
        /* those set on a scale here are read as numbers */
        if (anyGauge(['oilp', 'boost', 'gearbox', 'iat', 'volts', 'pedal', 'throttle', 'timing', 'power', 'torque', 'hpfp', 'lpfp',
                      'charge', 'hvtemp'])) S.numbers = true;
        var evSlot = S.electric === 'off' ? null
            : S.electricGauge !== 'auto' ? S.electricGauge
            : S.electric === 'bev' ? 'fuel' : S.showAuxLeft ? 'oilP' : 'coolant';
        if ((evSlot === 'oilP' || evSlot === 'oilT') && !S.showAuxLeft) evSlot = S.electric === 'bev' ? 'fuel' : 'coolant';
        /* (a gauge given a reading of the owner's choosing keeps it) */
        if (evSlot && S.gauges[{ fuel: 'R1', coolant: 'R2', oilT: 'L1', oilP: 'L2' }[evSlot]] !== 'auto') evSlot = null;
        function gaugeOr(slot, id, rect, o) {
            if (evSlot !== slot) return instrument(id, rect, o);
            instrument('battery', rect, {
                side: o.side, icon: null, label: 'ELETTRICO ' + U.dist, key: 'battery', dir: o.dir,
                marks: ['0', '50', '100'], red: o.dir < 0 ? [0, 0.12] : [0, 0.12]
            });
        }
        /*
         * Each of the four can be given any reading (S.gauges: left upper,
         * left lower, right upper, right lower); 'auto' keeps the style's
         * own, as below, and 'off' leaves the place empty.
         */
        var RECTS = { L1: [14, 430, 304, 530], L2: [0, 540, 290, 640], R1: [1572, 422, 1882, 522], R2: [1600, 538, 1910, 638] };
        function chosen(kind, side) {
            var o = gaugeKind(kind);
            if (!o) return null;
            o.side = side;
            o.dir = side === 'left' ? 1 : -1;
            return o;
        }
        function slot(name, auto) {
            var kind = S.gauges[name];
            if (kind === 'auto') return auto();
            var o = chosen(kind, name.charAt(0) === 'L' ? 'left' : 'right');
            if (o) instrument('g' + name, RECTS[name], o);
        }
        slot('R1', function () {
            gaugeOr('fuel', 'fuel', RECTS.R1, {
                side: 'right', icon: 0, label: FUEL_WORD, key: 'fuel', dir: -1,
                marks: ['0', '50', '100'], red: [0, 0.12]
            });
        });
        slot('R2', function () {
            gaugeOr('coolant', 'coolant', RECTS.R2, {
                side: 'right', icon: 1, label: 'TEMP. ACQUA', key: 'coolant', dir: -1,
                marks: tLabels([50, 90, 130]), red: [0.81, 1]
            });
        });

        /* The far-left region the brief cannot resolve: our own readings. */
        /* Both read left to right, each wedge deepest at its high
           numbers; both sit clear of the dial's low end. */
        slot('L1', function () {
            if (!S.showAuxLeft) return;
            /* an electric car has no oil: the gauge is its drive battery's temperature */
            if (S.electric === 'bev' && evSlot !== 'oilT') {
                instrument('batteryT', RECTS.L1, {
                    side: 'left', icon: null, label: 'TEMP. BATT.', key: 'batteryTemp', dir: 1,
                    marks: tLabels([-10, 25, 60]), red: [0.86, 1]
                });
            } else gaugeOr('oilT', 'oilT', RECTS.L1, {
                side: 'left', icon: 2, label: 'TEMP. OLIO', key: 'oilTemp', dir: 1,
                marks: tLabels([50, 110, 170]), red: [0.83, 1]
            });
        });
        /*
         * The Huracan's second left gauge is oil pressure. Nothing on
         * this car's bus carries it: the engine unit can (src/car/engine.js),
         * and until it does the slot shows turbo pressure, labelled as
         * what it is rather than left reading dashes.
         */
        slot('L2', function () {
            if (!S.showAuxLeft) return;
            gaugeOr('oilP', 'auxPress', RECTS.L2, {
                side: 'left', icon: 2, label: 'PRESS. TURBO', key: 'auxPress', dir: 1,
                marks: turboMarks(), marksAt: turboAt, ticks: turboTickU, red: [0.86, 1],
                alt: { label: 'PRESS. OLIO', marks: { psi: ['0', '70', '140'], bar: ['0', '5', '10'], kpa: ['0', '500', '1000'] }[UN.press],
                       red: [0, 0.08] }
            });
        });

        /* the style's own second left gauge, which wants oil pressure, and turbo pressure while there is none */
        var auxLeft = !!S.showAuxLeft && S.gauges.L2 === 'auto' && evSlot !== 'oilP';

        /* ------------------------------------------- G-force widget */
        /*
         * The load meter under the gear: a point that moves with the car's
         * acceleration (right turn: right; accelerating: up; braking: down),
         * the four chevrons lighting towards it, and the hardest load of the
         * last moments drawn as a line from the middle - held for PEAK_HOLD,
         * then fading over PEAK_FADE, and replaced at once by a harder one.
         */
        var gf = B.gForce, GS = G_METER_SCALE;
        var PEAK_HOLD = 3000, PEAK_FADE = 1500;
        var peak = { x: 0, y: 0, at: -1e9 };
        function peakOf(s) {
            var t = typeof s.now === 'number' ? s.now : Date.now();
            var mag = Math.sqrt(s.gX * s.gX + s.gY * s.gY);
            var age = t - peak.at;
            var held = age < PEAK_HOLD + PEAK_FADE ? Math.sqrt(peak.x * peak.x + peak.y * peak.y) : 0;
            if (mag >= held && mag > 0.05) { peak.x = s.gX; peak.y = s.gY; peak.at = t; age = 0; }
            var a = age < PEAK_HOLD ? 1 : Math.max(0, 1 - (age - PEAK_HOLD) / PEAK_FADE);
            return { x: peak.x, y: peak.y, a: a };
        }
        layers.push({
            id: 'gforce', z: 22, shader: 'gforce',
            x: G.gx(gf.cx - gf.w * GS / 2), y: G.gy(gf.cy - gf.h * GS / 2),
            w: G.gs(gf.w * GS), h: G.gs(gf.h * GS),
            uniforms: function (s) {
                if (!s.gOk) return null;
                var pk = peakOf(s);
                return { u_g: [s.gX, s.gY], u_peak: [pk.x, pk.y], u_peakA: pk.a,
                         u_max: 1.2, u_col: GC.primaryWhite, u_acc: GC.corsaRed };
            }
        });
        /* Four readings around it, one per direction, from the same vector. */
        [['gR', 'left', gf.w * GS * 0.56, 5, function (s) { return Math.max(s.gX, 0); }],
         ['gL', 'right', -gf.w * GS * 0.56, 5, function (s) { return Math.max(-s.gX, 0); }],
         ['gU', 'centre', 0, -gf.h * GS * 0.54, function (s) { return Math.max(s.gY, 0); }],
         ['gD', 'centre', 0, gf.h * GS * 0.66, function (s) { return Math.max(-s.gY, 0); }]
        ].forEach(function (r) {
            var ax = G.gx(gf.cx + r[2]), ay = G.gy(gf.cy + r[3]);
            txt(r[0], 22, { x: ax - G.gs(40), y: ay - G.gs(18), w: G.gs(80), h: G.gs(24) },
                { face: 'display', size: G.gs(12.5) / 0.70, align: r[1],
                  x: ax, y: ay, color: GC.secondaryWhite },
                function (s) { return s.gOk ? r[4](s).toFixed(1) : '--'; });
        });

        /*
         * No range, clock or outside temperature of ours: the cluster's own
         * bottom strip, which we never cover, already carries all three -
         * and the head unit's clock runs on UTC, so ours read the wrong
         * time on the car. The room they took goes to the instrument.
         */

        /* ------------------------------------------------------ speed */
        var sp = G.grect(B.speed);
        var spBox = { x: Math.max(0, sp.x - G.gs(160)), y: sp.y - 12,
                      w: sp.w + G.gs(170), h: FOOT - sp.y + 12 };
        var unitSize = G.gs(28) / 0.70, unitX = sp.x + sp.w - G.gs(168);
        var unitBox = { x: sp.x + sp.w - G.gs(174), y: sp.y + G.gs(62), w: G.gs(110), h: G.gs(38) };
        var spDx = 0;
        if (GUARD) {
            /* lowered, the speed stands beside BMW's gear letter: it and its unit are set as far
               left as keeps the unit's last letter out of the gear's columns, and their boxes end there */
            var unitEnd = unitX + Text.measure(atlas, 'label', U.speed, unitSize, 0.5) + 3;
            spDx = Math.max(0, Math.ceil(unitEnd - GUARD.x));
            spBox.x = Math.max(0, spBox.x - spDx);
            unitBox.x -= spDx;
            spBox.w = Math.min(spBox.w, GUARD.x - spBox.x);
            unitBox.w = Math.min(unitBox.w, GUARD.x - unitBox.x);
        }
        txt('speed', 30, spBox,
            { face: 'gear', size: G.gs(79) / 0.70, align: 'right',
              x: sp.x + sp.w - G.gs(175) - spDx, y: sp.y + G.gs(92),
              color: function (s) { return Palette.blinkOn(s) ? GC.corsaRed : GC.primaryWhite; } },
            function (s) { return s.speedText !== undefined ? s.speedText : String(Math.max(0, Math.round(s.speed))); });
        statics('speedUnit', 30, unitBox,
            { face: 'label', size: unitSize, align: 'left',
              color: GC.secondaryWhite, tracking: 0.5 },
            [{ str: U.speed, x: unitX - spDx, y: sp.y + G.gs(92) }]);

        /* ------------------------------------------------------ boost */
        /*
         * Left of the load indicator, under CORSA, where the dial's interior
         * is open - well clear of the G readings and the gear's foot.
         */
        if (P.boost && S.showBoost) {
            /*
             * Boost, level with the speed: the same figure and unit as the
             * speed's, on the left of the gear's foot, growing a step with
             * every psi (tenth of a bar) as boost builds, and to its right a
             * faint hanging wedge gauge whose needle sweeps right to left,
             * deepest at the top of the range beside the figure.
             */
            /* the top of its range, in the unit shown: Boost gauge up to's (its psi, or its bar), else the car's own up to a
               whole 10 psi, tenth of a bar, 10 kPa */
            var bMaxShown = UN.pressIn(P.boostMaxPsi / 14.503774), bGrain = UN.press === 'psi' ? 10 : UN.pressStep;
            var bTop = turboTop || Math.round(Math.ceil(bMaxShown / bGrain - 1e-9) * bGrain * 100) / 100;
            var bSteps = Math.round(bTop / UN.pressStep);
            var bShown = function (s) { return Math.max(0, s.boostPsi); };     /* in the pressure unit shown */
            var base = sp.y + G.gs(92);              /* the speed's own baseline */
            var bRight = 548;                        /* the figure's right edge */
            var bBase = G.gs(52) / 0.70;
            txt('boostNum', 30, { x: bRight - 196, y: base - 118, w: 220, h: 134 },
                { face: UN.press === 'bar' ? 'display' : 'gear', align: 'right', x: bRight, y: base,
                  size: function (s) {
                      var step = Math.floor(bShown(s) / UN.pressStep + 1e-6);
                      return bBase * (1 + 0.55 * Math.min(1, step / bSteps));
                  },
                  color: function (s) { return bShown(s) >= bTop * 0.88 ? GC.corsaRed : GC.primaryWhite; } },
                function (s) {
                    return UN.press === 'bar' ? bShown(s).toFixed(2) : String(Math.floor(bShown(s) + 1e-6));
                });
            statics('boostUnit', 30, { x: bRight + 4, y: base - G.gs(30) - 8, w: 80, h: G.gs(38) + 8 },
                { face: 'label', size: G.gs(28) / 0.70, align: 'left',
                  color: GC.secondaryWhite, tracking: 0.5 },
                [{ str: U.press, x: bRight + 8, y: base }]);
            /* the gauge: 100 units tall on its grid, scale and wedge only */
            var gh = 64;
            layers.push({
                id: 'boostGauge', z: 26, shader: 'hgauge',
                x: bRight + 78, y: base - gh * 0.84, w: 158, h: gh,
                uniforms: function (s) {
                    return { u_frac: clamp01(bShown(s) / bTop), u_dir: -1, u_redZone: [0.88, 1],
                             u_shear: -0.30, u_on: 1, u_alarm: 0, u_alpha: 0.42,
                             u_col: GC.primaryWhite, u_hot: HOT, u_needle: GC.corsaRed };
                }
            });
        }

        var PSI_PER_BAR = 14.503774;
        var bMax = UN.pressIn(P.boostMaxPsi / PSI_PER_BAR);
        var bMin = UN.pressIn(-10 / PSI_PER_BAR);

        return { id: 'toro', name: 'Toro', layers: layers, profile: P,
                 /* the row the instrument ends above: the strip's top, or lower (S.lower) */
                 foot: FOOT,
                 setAccent: function (rgb) { return Palette.setAccent(S, rgb); },
                 /* the shake: the layers moved, a step a frame, while the limiter holds (src/car/cluster.js) */
                 shakeKeys: S.shakePx > 0 ? shakeKeys(S.shakePx, toroShift) : null,
                 shake: function (s) { return s.limiter >= 0.98; },
                 hasCentre: true, window: { x: S.hole[0], y: S.hole[1], w: S.hole[2], h: S.hole[3] },
                 /* the round limit a larger opening has (centre, radius, fade: radius 0, none) */
                 holeDisc: holeDisc,
                 /* which side gauge the electric range has taken (null: none) */
                 electricGauge: evSlot,
                 /* readings shown that the car's bus may not carry: whoever supplies them
                    (BeeM-Flash's feed, or the engine unit: src/car/engine.js) is asked for
                    these and no others. The second left gauge is oil pressure when there is
                    one and turbo pressure when there is not, so it wants both. */
                 shows: Object.assign(Readings.shows(['L1', 'L2', 'R1', 'R2'].map(function (n) { return S.gauges[n]; })),
                          { oil: auxLeft || anyGauge(['oilp']), boost: !!(P.boost && (S.showBoost || auxLeft)) || anyGauge(['boost']),
                            /* the tank's level: the fuel gauge, its own place's or one given it */
                            tank: (S.gauges.R1 === 'auto' && evSlot !== 'fuel') || anyGauge(['fuel']) }),
                 settings: S, palette: C, guide: G, imperial: imperial,
                 dial: { centre: DC, rOuter: rOuter, ang: ANG, redV: redV } };
    }

    /*
     * The shake's keyframes, "t:x,y,0 ...": a hard jolt that dies away.
     * With the Lamborghini lights it lands on their bursts (0.36 s of
     * every 0.9 s) and rests between; otherwise it never stops.
     */
    function shakeKeys(a, bursts) {
        var path = [[0, 0], [-1, 0.4], [0.9, -0.5], [-0.75, 0.3], [0.7, 0.5],
                    [-0.55, -0.4], [0.45, 0.2], [-0.3, -0.2], [0.15, 0.1], [0, 0]];
        var step = 40, out = [], i;
        for (i = 0; i < path.length; i++) {
            out.push(i * step + ':' + (path[i][0] * a).toFixed(1) + ',' + (path[i][1] * a).toFixed(1) + ',0');
        }
        if (bursts) out.push('900:0,0,0');
        return out.join(' ');
    }

    var BOOST_ZERO = 0.22;
    function boostFrac(v, max, min) {
        if (v >= 0) return clamp01(BOOST_ZERO + (1 - BOOST_ZERO) * (v / max));
        return clamp01(BOOST_ZERO * (1 - v / min));
    }

    /*
     * How much of a hosted picture shows at a panel point with the opening
     * fully open: what the background's shader computes (src/shaders/core.js;
     * the tests hold the two together). 0: the style is whole there.
     */
    function openAt(theme, x, y) {
        var S = theme.settings, h = S.hole, disc = theme.holeDisc;
        function step(e0, e1, v) { var t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
        var hx = Math.abs(x - (h[0] + h[2] / 2)), hy = Math.abs(y - (h[1] + h[3] / 2));
        var box = Math.max(hx - h[2] / 2, hy - h[3] / 2);
        var cut = (hx + hy - (h[2] / 2 + h[3] / 2 - S.holeChamfer)) * 0.70710678;
        var t = step(-S.holeFeather, 0, Math.max(box, cut));
        var keep = t * t * (3 - 2 * t);
        if (disc[2] > 0.5) {
            var dx = x - disc[0], dy = y - disc[1];
            var td = step(-disc[3], 0, Math.sqrt(dx * dx + dy * dy) - disc[2]);
            keep = 1 - (1 - keep) * (1 - td * td * (3 - 2 * td));
        }
        return S.holeMax * (1 - keep);
    }

    return { build: build, Guide: Guide, vOf: vOf, briefV: briefV, shakeKeys: shakeKeys, openAt: openAt, LOWER_MOST: LOWER_MOST };
}));
