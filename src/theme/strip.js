(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('../geometry/panel.js'));
    else root.MGUStrip = factory(root.MGUPanel);
}(typeof self !== 'undefined' ? self : this, function (Panel) {
    'use strict';

    /*
     * BMW's bottom strip (y 646 - 720: range, clock, street, driving mode,
     * gear, outside temperature) and how much of it stays in view. Both
     * styles use this, so there is one rule.
     *
     * The strip is the car's, under our layers; what we lay over it is
     * hidden, with one exception the car enforces: the gear. Cover its
     * window (x 1385 - 1462, y 665 - 720) and the KOMBI draws a black
     * fallback box in the rev dial instead, which can stay until the
     * cluster restarts. Everything else in the strip can be covered with
     * no such answer; warning lamps are drawn over us either way.
     * (docs/CLUSTER-CONSTRAINTS.md section 2: measured by others on their
     * cars, and seen on this one.)
     *
     * So the setting ("bottomExtra", its name from when it was a height),
     * On (18) or Off (hide) in the app's menu:
     *
     *   18             On: the style's background runs 18 px below y 646,
     *                  right across, ending on the row above the gear's
     *                  window. (0, 6 and 12 trim less: pieces of BMW's own
     *                  dials showed at the sides on a car, 2026-11-26.)
     *   hide           Off: the trim at its most, and from there down to the
     *                  screen's edge two plain covers, one each side of the
     *                  columns kept open for the gear (Panel.GEAR_KEEP: the
     *                  left cover ends a column short of the gear's
     *                  window, so the driving mode's name beside it is
     *                  covered to its last letter). BMW's gear letter is
     *                  all that is left of the strip.
     *   hideWide       the same with a wider gap left of the gear
     *                  (Panel.GEAR_KEEP_WIDE, x 1340): what "hide" was up
     *                  to Beta 5. The end of a long mode name shows in it
     *                  ("COMFORT": its T).
     *
     * Values an earlier version saved go to On or Off when the settings are
     * loaded (app.json aliases: 0, 6, 12 and 24 to 18; 48, 74 and hideWide
     * to hide); resolve() still reads them all.
     */
    var HIDE = 'hide';
    var HIDE_WIDE = 'hideWide';

    function resolve(value) {
        var max = Panel.STRIP_TRIM_MAX;
        if (value === HIDE_WIDE) return { trim: max, hide: true, wide: true };
        if (value === HIDE || value === true) return { trim: max, hide: true, wide: false };
        var n = Number(value);
        if (!isFinite(n) || n <= 0) return { trim: 0, hide: false, wide: false };
        if (n >= 40) return { trim: max, hide: true, wide: false };
        return { trim: Math.min(max, Math.round(n)), hide: false, wide: false };
    }

    /*
     * The covers for "hide": S is a style's resolved settings (bottomExtra
     * the trim in px, stripHide, stripWide), col what they are painted -
     * black, as the strip itself is behind the gear, the style's background
     * going down to black across the trim so there is no seam either way.
     * Both are `still`: the limiter's shake must never carry one over the
     * gear.
     */
    function keep(S) {
        return S && S.stripWide ? Panel.GEAR_KEEP_WIDE : Panel.GEAR_KEEP;
    }

    /* the cover for the speed limit sign's top edge alone (Panel.SIGN_PATCH): only
       where the strip is otherwise in view - hidden, it is covered already */
    function signLayer(S, col) {
        var p = Panel.SIGN_PATCH;
        return { id: 'stripSign', z: 1, shader: 'cover', belowCut: true, still: true,
                 x: p.x, y: p.y, w: p.w, h: p.h, uniforms: function () { return { u_col: col }; } };
    }

    function layers(S, col) {
        if (S && S.signCover && !S.stripHide) return [signLayer(S, col)];
        if (!S || !S.stripHide) return [];
        var top = Panel.BOTTOM_CUT + S.bottomExtra;
        var h = Panel.PANEL_HEIGHT - top;
        var k = keep(S);
        function cover(id, x, w) {
            return { id: id, z: 1, shader: 'cover', belowCut: true, still: true,
                     x: x, y: top, w: w, h: h,
                     uniforms: function () { return { u_col: col }; } };
        }
        return [cover('stripL', 0, k.x), cover('stripR', k.x + k.w, Panel.PANEL_WIDTH - (k.x + k.w))];
    }

    /*
     * BETA, "lower": with the strip hidden there are 74 rows under a style
     * that hold nothing but our own black covers. The whole style can be
     * drawn into them: `d` px further down and larger by as much,
     * (646 + d) / 646, about the top of the screen's middle - so its top
     * stays where it is, its foot goes d rows lower, and it is the same
     * picture, only bigger. Off as it comes, and the menu offers 20 px
     * (further cut M Sport's 260 and brought Toro's boost reading under the
     * seat belt light on a car, 2026-11-26; saved 40, 58 and 74 go to 20);
     * it hides the strip itself
     * (src/theme/palette.js), and a style goes only as far as it has room
     * for (its own most: Toro's side gauges reach the screen's edges
     * first).
     *
     * One thing does not move for it: the gear. From the trim's foot
     * (y 664) down, the columns kept open for BMW's gear letter are never
     * drawn on by anything, lowered or not - gearGuard() is that
     * rectangle, and a style lays its lowest readings out round it.
     */
    var LOWER_MOST = Panel.PANEL_HEIGHT - Panel.BOTTOM_CUT;        /* 74: to the screen's edge */
    function lowerPx(value) {
        var n = Math.round(Number(value));
        return isFinite(n) && n > 0 ? Math.min(LOWER_MOST, n) : 0;
    }
    function lowerScale(d) { return (Panel.BOTTOM_CUT + (d > 0 ? d : 0)) / Panel.BOTTOM_CUT; }
    /* an artboard's fit to the panel { s, ox, oy }, lowered by d */
    function lowerFit(f, d) {
        var k = lowerScale(d), cx = Panel.PANEL_WIDTH / 2;
        return { s: f.s * k, ox: cx + (f.ox - cx) * k, oy: f.oy * k };
    }
    /* a panel rectangle [x, y, w, h] of the style as it comes -> where that is once lowered by d */
    function lowerRect(r, d) {
        var k = lowerScale(d), cx = Panel.PANEL_WIDTH / 2;
        return [cx + (r[0] - cx) * k, r[1] * k, r[2] * k, r[3] * k];
    }
    /* where a lowered style's foot is: nothing of it is drawn at or below this row */
    function foot(S) { return Panel.BOTTOM_CUT + (S && S.lower > 0 ? S.lower : 0); }
    /*
     * What nothing of ours may be laid over once layers go below the cut:
     * the gear's columns from the trim's foot down, { x, y, w, h }. reach:
     * for a layer the limiter's shake moves, how far it can be carried
     * (px) - the rectangle is that much wider each side and starts that
     * much higher, so a jolt cannot bring the layer into it either.
     */
    function gearGuard(S, reach) {
        var k = keep(S), r = reach > 0 ? Math.ceil(reach) + 1 : 0;
        var top = Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX - r;
        return { x: k.x - r, y: top, w: k.w + 2 * r, h: Panel.PANEL_HEIGHT - top };
    }
    /* is a rectangle { x, y, w, h } clear of it? */
    function clearOfGear(b, S, reach) {
        var g = gearGuard(S, reach);
        return b.x >= g.x + g.w || b.x + b.w <= g.x || b.y + b.h <= g.y;
    }

    /*
     * The rectangles of a layer that lies over the whole style - the
     * limiter's flash, the start-up message's veil. As a style comes that
     * is one, down to the cut. Over a lowered style it is three: the whole
     * width down to the trim's foot, and from there to the style's foot one
     * each side of the gear's columns, which nothing covers.
     */
    function spread(S) {
        var W = Panel.PANEL_WIDTH, f = foot(S);
        if (!(S && S.lower > 0)) return [{ x: 0, y: 0, w: W, h: Panel.BOTTOM_CUT }];
        var top = Panel.BOTTOM_CUT + Panel.STRIP_TRIM_MAX, k = keep(S);
        var out = [{ x: 0, y: 0, w: W, h: Math.min(f, top) }];
        if (f > top) {
            out.push({ x: 0, y: top, w: k.x, h: f - top });
            out.push({ x: k.x + k.w, y: top, w: W - (k.x + k.w), h: f - top });
        }
        return out;
    }

    /* does a rectangle reach into the gear's window? (tests, tools) */
    function overGear(r) {
        var g = Panel.GEAR_TRIGGER_WINDOW;
        return r.x < g.x + g.w && r.x + r.w > g.x && r.y < g.y + g.h && r.y + r.h > g.y;
    }

    return { resolve: resolve, layers: layers, keep: keep, overGear: overGear, HIDE: HIDE, HIDE_WIDE: HIDE_WIDE,
             LOWER_MOST: LOWER_MOST, lowerPx: lowerPx, lowerScale: lowerScale, lowerFit: lowerFit, lowerRect: lowerRect,
             foot: foot, gearGuard: gearGuard, clearOfGear: clearOfGear, spread: spread };
}));
