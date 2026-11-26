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

/*
 * Telltales the KOMBI draws over us, whatever we put there. The tyre pressure and parking brake lights measured on the
 * car (a calibration grid, 2026-11-14); the others along the glass's sides placed from BMW's guide to the G-series
 * cluster (TE18-0859, its lights laid on those two and the turn arrows) and a photo of a G20's cluster (Auto Hold),
 * each as its shape: a round symbol about 46 px (two crossed rectangles, 4 px to spare), Auto Hold's words. Auto
 * Hold is lit while it holds, the rest on a fault. Not here: the lane departure light (lit whenever that assistant is
 * on), placed by the guide at about x 163, y 207 - on the "180" of BMW's own M view, which M Sport draws as BMW does,
 * so its place waits for a photo of it lit on the car.
 */
function roundLight(id, x, y, name) {
    return [{ id: id, x: x - 27, y: y - 15, w: 54, h: 30, name: name }, { id: id + '2', x: x - 15, y: y - 27, w: 30, h: 54, name: name }];
}
var TELLTALES = [
    { id: 'tyre', x: 40, y: 260, w: 96, h: 96, name: 'Tyre pressure warning' },
    { id: 'parkBrake', x: 1840, y: 245, w: 80, h: 96, name: 'Parking brake' },
    { id: 'autoHold', x: 1784, y: 228, w: 100, h: 38, name: 'Auto Hold' }
].concat(roundLight('brakes', 94, 248, 'Brake system'),
    roundLight('abs', 80, 366, 'ABS'), roundLight('dsc', 73, 424, 'Dynamic Stability Control'),
    roundLight('steering', 1888, 349, 'Steering system'));

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
 * The kinds of car (Panel.kindOf: General > Engine and Electric range, as set there or by the Car profile app).
 * Each gives the figures used where General's are left to the car (Redline, Limiter on "From the car"), the top of
 * Toro's boost gauge where General's Boost gauge up to is on Automatic, the fuel tank where nothing says, whether
 * the car has boost to show, and the boxes its KOMBI draws over a panel layer: an M car's two in the M display,
 * a plug-in hybrid's eDrive box.
 */
var PROFILES = {
    carprofile: {
        id: 'carprofile', name: 'Car', engine: '', cylinders: 6, aspiration: 'turbo',
        rpmMax: 8000, rpmRedline: 6750, rpmLimiter: 7000,
        gearCount: 8, gearbox: 'ZF 8HP', boost: true, boostMaxPsi: 22, tankLitres: 60, extraZones: []
    },
    mCarS58: {
        id: 'mCarS58', name: 'M car', engine: 'S58', cylinders: 6, aspiration: 'turbo',
        rpmMax: 8000, rpmRedline: 7000, rpmLimiter: 8000,
        gearCount: 8, gearbox: 'ZF 8HP / DCT', boost: true, boostMaxPsi: 26, tankLitres: 59,
        extraZones: [M_BOX_A, M_BOX_B]
    },
    /* a plug-in hybrid: Car > Engine Plug-in hybrid (or Auto, found from the car), as Cluster Layouts' */
    hybrid: {
        id: 'hybrid', name: 'Plug-in hybrid (eDrive)', engine: 'B46/B58 PHEV', cylinders: 4, aspiration: 'turbo',
        rpmMax: 7000, rpmRedline: 6000, rpmLimiter: 6500,
        gearCount: 8, gearbox: 'ZF 8HP', boost: false, boostMaxPsi: 18, tankLitres: 60, extraZones: [EDRIVE_BOX]
    }
};

var DEFAULT_PROFILE = 'carprofile';

/* The kind of car for the settings: Car > Engine "Petrol, M car", else a plug-in hybrid (its electric side, as
   main.js has worked it out from Engine), else a car. */
function kindOf(settings) {
    if (settings && settings.engine === 'm') return 'mCarS58';
    return settings && settings.electric === 'hybrid' ? 'hybrid' : 'carprofile';
}

function profile(id) {
    return PROFILES[id] || PROFILES[DEFAULT_PROFILE];
}

var PSI_PER_BAR = 14.503774;
/* Boost gauge up to: the car's own boost gauges, each by its end in psi, and its end in bar - 2.0 up to 30 psi, 3.0 at 45
   (kPa a hundredfold) */
var BOOST_BAR = { 15: 2, 20: 2, 30: 2, 45: 3 };
var BOOST_TICKS = { 15: [0, 5, 10, 15], 20: [0, 10, 20], 30: [0, 10, 20, 30], 45: [0, 15, 30, 45] };
/*
 * A boost scale's numbers as the car's own gauges number them, by the end's figure (psi as it is, bar x 10, kPa / 10):
 * 0 5 10 15, 0 10 20, 0 10 20 30, 0 15 30 45 psi; 0.0 1.0 2.0, 0.0 1.0 2.0 3.0 bar; 0 100 200,
 * 0 100 200 300 kPa. Any other end: 0, its middle and it. end in the unit. [{ at 0..1, str }]. (AK Cluster Layouts' and
 * M Vitals' the same.)
 */
function boostTicks(end, unit) {
    var per = unit === 'bar' ? 10 : unit === 'kpa' ? 0.1 : 1, f = Math.round(end * per), dec = unit === 'bar' ? 1 : 0;
    var at = Math.abs(end * per - f) < 1e-6 && BOOST_TICKS[f] ? BOOST_TICKS[f].map(function (v) { return v / per; }) : [0, end / 2, end];
    var whole = function (v) { return Math.abs(v * Math.pow(10, dec) - Math.round(v * Math.pow(10, dec))) < 1e-6; };
    return at.map(function (v) { return { at: v / end, str: v.toFixed(whole(v) ? dec : dec + 1) }; });
}

/* The car's Sport Display's boost gauge end (bar) as one of Boost gauge up to's gauges, its setting's value (psi): the
   least at or over it, within 5 % (200 kPa, 29 psi: 30; null: none) */
function snapBoost(bar) {
    if (!(typeof bar === 'number' && bar > 0)) return null;
    var ends = [15, 20, 30, 45];
    for (var i = 0; i < ends.length; i++) if (ends[i] * 1.05 >= bar * PSI_PER_BAR) return String(ends[i]);
    return '45';
}

/* The profile for a car with General's tank and boost gauge (each set there or by the Car profile app): boostPsi, Boost
   gauge up to's end in psi, and boostBar its end in bar (both null on Automatic: the kind's own, boostMaxPsi) */
function profileFor(id, settings) {
    var p = profile(id);
    if (!settings) return p;
    var num = function (v, lo, hi, d) { v = Number(v); return v >= lo && v <= hi ? v : d; };
    var out = {}, k;
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) out[k] = p[k];
    var psi = BOOST_BAR[Number(settings.boostMax)] ? Number(settings.boostMax) : null;
    out.boostPsi = psi;
    out.boostBar = psi ? BOOST_BAR[psi] : null;
    out.boostMaxPsi = psi || p.boostMaxPsi;
    out.tankLitres = num(settings.tankLitres, 20, 120, p.tankLitres);
    return out;
}

/*
 * General > Car, B48 / B58 / S58 (M car) / Plug-in hybrid, as chosen before it went: each one's own figures, which
 * General's settings now hold (app/entry.js moves them across once). null for Car profile values or nothing chosen.
 */
var CAR_FIGURES = {
    /* (the boost gauge's end as Toro drew it in psi: 20 for a B48, 30 for the others) */
    b48: { rpmLimiter: '7000', rpmRedline: '6000', shiftAt: '6500', shiftFrom: 'auto', scaleMaxRpm: '7000', speedMax: '260',
           boostMax: '20', tankLitres: '59' },
    b58: { rpmLimiter: '7500', rpmRedline: '6500', shiftAt: '7000', shiftFrom: 'auto', scaleMaxRpm: '8000', speedMax: '260',
           boostMax: '30', tankLitres: '60' },
    mCarS58: { engine: 'm', rpmLimiter: '8000', rpmRedline: '7000', shiftAt: '7500', shiftFrom: '6500', scaleMaxRpm: '8000',
               speedMax: '330', boostMax: '30', tankLitres: '59' },
    hybrid: { engine: 'phev' }
};
function figuresOfCar(saved) {
    var car = saved && ({ x3m40i: 'b48', custom: 'carprofile' }[saved.profile] || saved.profile);
    var f = CAR_FIGURES[car];
    if (!f) return null;
    var out = {}, k;
    for (k in f) if (Object.prototype.hasOwnProperty.call(f, k)) out[k] = f[k];
    /* (a diesel stays one) */
    if (out.engine && saved.engine === 'diesel') delete out.engine;
    return out;
}
/*
 * General > Car went in AK 0.18.0: the figures of the car chosen there are set in General's own settings once, when
 * the app starts (app/entry.js), so the cluster reads as it did. settings: the kit's (values as saved). Nothing for
 * a new install, nor for Car profile values: General's already.
 */
/*
 * General > Electric range went in AK 0.19.1 (a plug-in hybrid is Car > Engine's, as Cluster Layouts' and the Car
 * profile's): a saved Plug-in hybrid on a petrol car becomes Engine Plug-in hybrid, once. Returns whether it moved.
 */
function moveElectric(settings, log) {
    var v = settings.values || {};
    if (v._electricMoved) return false;
    var moved = v.electric === 'hybrid' && (v.engine === undefined || v.engine === 'petrol');
    if (moved) {
        settings.set('engine', 'phev');
        if (log) log.info('Electric range: Plug-in hybrid is Engine: Plug-in hybrid now');
    }
    settings.set('_electricMoved', 1);
    return moved;
}

function moveCarFigures(settings, log) {
    var v = settings.values || {};
    if (v._carMoved || v.profile === undefined) return null;
    var f = figuresOfCar(v);
    if (f) {
        Object.keys(f).forEach(function (k) { settings.set(k, f[k]); });
        if (log) log.info('General > Car ' + v.profile + ': its figures are General\'s own now ' + JSON.stringify(f));
    }
    settings.set('_carMoved', 1);
    return f;
}

/*
 * The style a drive mode shows (Settings > Display > Style in Sport / Style in ECO PRO, as AK Cluster Layouts'
 * Layout in Sport / in ECO PRO): each is one of the page's designs (a style and, for Toro, its background) or Same
 * as Style. modeKey: the setting the mode now uses ('style' where it has none of its own), so a design picked on
 * the page goes there; styleFor: the settings with that design's style and background in them.
 */
var DESIGN_OF = { toro_genuine: { style: 'toro', background: 'genuine' }, toro_modern: { style: 'toro', background: 'modern' },
    toro_revuelto: { style: 'toro', background: 'revuelto' }, track: { style: 'track' }, mplus: { style: 'mplus' },
    mtrack: { style: 'mtrack' } };
var MODE_KEYS = { sport: 'styleSport', eco: 'styleEco' };
function modeKey(settings, cls) {
    var k = MODE_KEYS[cls];
    return k && settings && DESIGN_OF[settings[k]] ? k : 'style';
}
function styleFor(settings, cls) {
    var k = modeKey(settings, cls);
    return k === 'style' ? settings : Object.assign({}, settings, DESIGN_OF[settings[k]]);
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
    kindOf: kindOf,
    figuresOfCar: figuresOfCar,
    moveCarFigures: moveCarFigures,
    moveElectric: moveElectric,
    DESIGN_OF: DESIGN_OF, modeKey: modeKey, styleFor: styleFor,
    PSI_PER_BAR: PSI_PER_BAR,
    snapBoost: snapBoost,
    BOOST_BAR: BOOST_BAR,
    boostTicks: boostTicks,
    keepClear: keepClear,
    inCutCorner: inCutCorner,
    violations: violations
};
}));
