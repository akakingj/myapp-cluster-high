(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUPanel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';
/*
 * Panel geometry and keep-clear zones for the iDrive 7 cluster.
 * Every number here is documented in docs/CLUSTER-CONSTRAINTS.md.
 * Node 8 compatible: this module also runs on the head unit.
 */

var PANEL_WIDTH = 1920;
var PANEL_HEIGHT = 720;

/*
 * The hard cut. Layers must not draw at or below this line, or the KOMBI
 * draws a fallback gear box over our artwork that can outlive our layers.
 * Car-verified across several projects. See CLUSTER-CONSTRAINTS.md §2.
 */
var BOTTOM_CUT = 646;

/* The drawable area once the strip is left to the car. */
var DRAW_WIDTH = PANEL_WIDTH;
var DRAW_HEIGHT = BOTTOM_CUT;

/*
 * The narrower window that actually triggers the fallback gear box
 * (Vizualyse, car-verified). We never rely on this - BOTTOM_CUT is the
 * rule - but tooling reports it so a future layout can make a judgement.
 */
var GEAR_TRIGGER_WINDOW = { x: 1385, y: 665, w: 77, h: 55 };

/*
 * What may be laid over the car's bottom strip, from that measurement and
 * from this car (docs/CLUSTER-CONSTRAINTS.md section 2):
 *
 *   STRIP_TRIM_MAX  how far below the cut a layer may run right across:
 *                   to y 664, the row above the gear's window. One row
 *                   more, across the gear, and the KOMBI answers with its
 *                   black fallback box in the rev dial - which is what the
 *                   old "cover a little" (24 px, to y 670) brought on.
 *   GEAR_KEEP       the columns left open from there down when the rest of
 *                   the strip is covered. BMW's gear letter stays in view
 *                   there; nothing of ours is ever drawn in it. Its left
 *                   edge is a column short of the gear's window, as the
 *                   trim is a row short of it: the driving mode's name
 *                   stands right against the gear ("COMFORT" ends about
 *                   x 1354 on this car, "SPORT PLUS" about 1384), and
 *                   anything left open there shows its last letter. The
 *                   right edge keeps 38 px: nothing stands there.
 *   GEAR_KEEP_WIDE  the same with 45 px to the left of the window: what
 *                   "hide" left open up to Beta 5, and the one gap that
 *                   has been driven on this car. Kept as a setting, in
 *                   case a car's cluster wants more room than the
 *                   measured window says.
 */
var STRIP_TRIM_MAX = GEAR_TRIGGER_WINDOW.y - 1 - BOTTOM_CUT;      /* 18 */
var GEAR_KEEP = { x: GEAR_TRIGGER_WINDOW.x - 1, w: 116 };          /* 1384 - 1500 */
var GEAR_KEEP_WIDE = { x: 1340, w: 160 };                          /* 1340 - 1500 */
/*
 * Speed Limit Info: with a limit showing, the top of BMW's sign stands up
 * out of the strip, right of the clock - a red arc at about x 471 - 499,
 * y 669 - 675 (off one photograph of a 2020s plug-in hybrid, good to a few
 * px). SIGN_PATCH is a cover for it alone: from the cut down to the row
 * above the strip's own figures (their tops are at about y 676), far from
 * the gear's window. A setting, off as it comes.
 */
var SIGN_PATCH = { x: 440, y: BOTTOM_CUT, w: 90, h: 30 };          /* 440 - 530, 646 - 676 */

/* The glass is cut on a diagonal at the top corners: nothing there is seen. */
var CORNER_LEFT = [{ x: 0, y: 0 }, { x: 325, y: 0 }, { x: 0, y: 190 }];
var CORNER_RIGHT = [{ x: 1920, y: 0 }, { x: 1650, y: 0 }, { x: 1920, y: 200 }];

/*
 * The driver camera's cowl over the top middle of the glass (measured from
 * photographs of the car by AK Cluster Layouts: x 730 - 1190, y 0 - 128),
 * with 10 px each side: what is drawn under it is not seen.
 */
var CAMERA = { x: 720, y: 0, w: 480, h: 128 };
/*
 * The KOMBI's green turn signal arrows, drawn over every layer: at the
 * cowl's two lower corners, below the top row (measured off a photograph
 * of a G05's cluster with the hazard lights on, 2026-11-23, its cowl laid
 * on the one above: about x 685 - 749, y 98 - 158 and x 1146 - 1212, y 94 -
 * 149), with 10 px round each.
 */
var TURN_ARROWS = [{ id: 'turnL', x: 675, y: 88, w: 84, h: 80, name: 'Turn signal, left' },
                   { id: 'turnR', x: 1136, y: 84, w: 86, h: 75, name: 'Turn signal, right' }];

/* Telltales the KOMBI draws over us, whatever we put there. */
var TELLTALES = [
    { id: 'tyre', x: 40, y: 260, w: 96, h: 96, name: 'Tyre pressure warning' },
    { id: 'parkBrake', x: 1840, y: 245, w: 80, h: 96, name: 'Parking brake' }
];

/*
 * The KOMBI's fallback gear box, as it shows on this car (measured off a
 * photograph of the cluster laid over our own render, 2026-11-21): a black
 * rectangle in the rev dial, over the top of the M style's oil strip. It is
 * not a zone to keep clear - it is not there unless the gear's window in
 * the bottom strip was covered, and it can outlive our layers until the
 * cluster next restarts. Tooling and the docs name it; no layout bends
 * round it.
 */
var FALLBACK_GEAR_BOX = { id: 'gearFallback', x: 1407, y: 337, w: 188, h: 82, name: 'Fallback gear box (X3 M40i, where it was measured)' };

/* Boxes some KOMBIs draw over a panel layer, by drivetrain. */
var EDRIVE_BOX = { id: 'edrive', x: 1770, y: 170, w: 150, h: 95, name: 'eDrive status box' };
var M_BOX_A = { id: 'mBoxA', x: 793, y: 289, w: 246, h: 92, name: 'M box (left)' };
var M_BOX_B = { id: 'mBoxB', x: 1223, y: 328, w: 171, h: 78, name: 'M box (right)' };

/*
 * Vehicle profiles (GENERAL > Car). B48, B58, S58 and the plug-in hybrid are the owner's figures for those
 * engines (`rev`): the most the engine revs (the limiter; the tach goes to the thousand at or above it), where
 * the red zone starts, where to shift (Shift now: the shift lights flash, the speed and the gear blink), where
 * the yellow starts (the shift lights and the M dial's amber), and the speedometer's top (km/h). With one of
 * them chosen, GENERAL's Redline, Limiter, Shift lights from, Shift now at and Tach scale are not used.
 * "carprofile" takes all of those from GENERAL as set there or by the Car profile app (its own figures below
 * only where neither says). Also each car's: the top of Toro's boost gauge, the fuel tank (the fuel's litres as
 * a level), and the boxes some KOMBIs draw over a panel layer.
 */
var PROFILES = {
    b48: {
        id: 'b48', name: 'B48', engine: 'B48', cylinders: 4, aspiration: 'turbo',
        rpmMax: 7000, rpmRedline: 6000, rpmLimiter: 7000,
        rev: { limiter: 7000, red: 6000, shift: 6500, yellow: null, speedMax: 260 },
        gearCount: 8, gearbox: 'ZF 8HP', boost: true, boostMaxPsi: 20, tankLitres: 59, extraZones: []
    },
    b58: {
        id: 'b58', name: 'B58', engine: 'B58', cylinders: 6, aspiration: 'turbo',
        rpmMax: 8000, rpmRedline: 6500, rpmLimiter: 7500,
        rev: { limiter: 7500, red: 6500, shift: 7000, yellow: null, speedMax: 260 },
        gearCount: 8, gearbox: 'ZF 8HP', boost: true, boostMaxPsi: 22, tankLitres: 60, extraZones: []
    },
    mCarS58: {
        id: 'mCarS58', name: 'S58 (M car)', engine: 'S58', cylinders: 6, aspiration: 'turbo',
        rpmMax: 8000, rpmRedline: 7000, rpmLimiter: 8000,
        rev: { limiter: 8000, red: 7000, shift: 7500, yellow: 6500, speedMax: 330 },
        gearCount: 8, gearbox: 'ZF 8HP / DCT', boost: true, boostMaxPsi: 26, tankLitres: 59,
        extraZones: [M_BOX_A, M_BOX_B]
    },
    hybrid: {
        id: 'hybrid', name: 'Plug-in hybrid (eDrive)', engine: 'B46/B58 PHEV', cylinders: 4, aspiration: 'turbo',
        rpmMax: 7000, rpmRedline: 6000, rpmLimiter: 6500,
        rev: { limiter: 6500, red: 6000, shift: null, yellow: null, speedMax: 260 },
        gearCount: 8, gearbox: 'ZF 8HP', boost: false, boostMaxPsi: 18, tankLitres: 60, extraZones: [EDRIVE_BOX]
    },
    /* GENERAL's own figures, or the Car profile's (Redline and Limiter on "From the car": these) */
    carprofile: {
        id: 'carprofile', name: 'Car profile', engine: '', cylinders: 6, aspiration: 'turbo',
        rpmMax: 8000, rpmRedline: 6750, rpmLimiter: 7000, rev: null,
        gearCount: 8, gearbox: 'ZF 8HP', boost: true, boostMaxPsi: 22, tankLitres: 60, extraZones: []
    }
};

var DEFAULT_PROFILE = 'b48';

function profile(id) {
    return PROFILES[id] || PROFILES[DEFAULT_PROFILE];
}

/* The profile for a car, with GENERAL's tank and boost gauge where it is "carprofile" (tankLitres: the Car
   profile's where it gives one; boostMax) */
function profileFor(id, settings) {
    var p = profile(id);
    if (p.id !== 'carprofile' || !settings) return p;
    var num = function (v, lo, hi, d) { v = Number(v); return v >= lo && v <= hi ? v : d; };
    var out = {}, k;
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
    out.boostMaxPsi = num(settings.boostMax, 5, 60, p.boostMaxPsi);
    out.tankLitres = num(settings.tankLitres, 20, 120, p.tankLitres);
    return out;
}

/* Every rectangular zone a layout must keep clear for the given profile. */
function keepClear(profileId) {
    var p = profile(profileId);
    var zones = [{
        id: 'bottomStrip', x: 0, y: BOTTOM_CUT, w: PANEL_WIDTH,
        h: PANEL_HEIGHT - BOTTOM_CUT, name: "Bottom strip (the car's own)"
    }];
    var i;
    for (i = 0; i < TELLTALES.length; i++) zones.push(TELLTALES[i]);
    for (i = 0; i < p.extraZones.length; i++) zones.push(p.extraZones[i]);
    return zones;
}

/* True when a point is inside one of the cut glass corners. */
function inCutCorner(x, y) {
    if (x * 190 + y * 325 < 325 * 190 && x < 325 && y < 190) return true;
    var rx = PANEL_WIDTH - x;
    if (rx * 200 + y * 270 < 270 * 200 && rx < 270 && y < 200) return true;
    return false;
}

/* Does a rect overlap any keep-clear zone? Used by the layout validator. */
function violations(rect, profileId) {
    var zones = keepClear(profileId);
    var hits = [];
    for (var i = 0; i < zones.length; i++) {
        var z = zones[i];
        if (rect.x < z.x + z.w && rect.x + rect.w > z.x &&
            rect.y < z.y + z.h && rect.y + rect.h > z.y) hits.push(z);
    }
    return hits;
}

return {
    PANEL_WIDTH: PANEL_WIDTH,
    PANEL_HEIGHT: PANEL_HEIGHT,
    BOTTOM_CUT: BOTTOM_CUT,
    DRAW_WIDTH: DRAW_WIDTH,
    DRAW_HEIGHT: DRAW_HEIGHT,
    GEAR_TRIGGER_WINDOW: GEAR_TRIGGER_WINDOW,
    STRIP_TRIM_MAX: STRIP_TRIM_MAX,
    GEAR_KEEP: GEAR_KEEP,
    GEAR_KEEP_WIDE: GEAR_KEEP_WIDE,
    SIGN_PATCH: SIGN_PATCH,
    CORNER_LEFT: CORNER_LEFT,
    CORNER_RIGHT: CORNER_RIGHT,
    CAMERA: CAMERA,
    TURN_ARROWS: TURN_ARROWS,
    TELLTALES: TELLTALES,
    FALLBACK_GEAR_BOX: FALLBACK_GEAR_BOX,
    PROFILES: PROFILES,
    DEFAULT_PROFILE: DEFAULT_PROFILE,
    profile: profile,
    profileFor: profileFor,
    keepClear: keepClear,
    inCutCorner: inCutCorner,
    violations: violations
};
}));
