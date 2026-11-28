'use strict';
/*
 * The warning signs the front camera reads (AK 0.29.0, Display > Speed limit sign on), as AK Cluster Layouts 0.69.0
 * shows them (akakingj/myapp-cluster shared/road_signs.js, the same rules):
 *
 * de.bmw.environmentalmodel.SignRecognitionFrontCamera's TrafficSignRecognitionFrontCamera event, found by AK Cluster
 * Info's signal survey (a drive on 2026-11-26), comes once as the car passes a sign, not at a rate:
 *   trafficSignRecognition.numberSigns=1  trafficSign[0].type="DS_ANIMAL_CROSSING"  trafficSign[0].value=0
 * Types seen: SPEED_LIMIT, NO_PASSING_SIGN, GIVE_WAY, DS_TRAFFIC_JAM, DS_SPLIPPERY_ROAD (BMW's spelling),
 * DS_RIGHT_DOWNWARDS, DS_ANIMAL_CROSSING.
 *
 * Shown on the cluster (0.29.1, the owner's): a warning (DS_ types) when the camera reads it, for 10 s, a warning read
 * after it in its place (one event's two together); no passing (not its end) till its zone ends (makeZone) - the speed
 * limit has its own sign - as South Korea's own signs (src/theme/signs.js, made by tools/make-signs.py; the picture's
 * name from artOf).
 *
 * Node 8.
 */
var CAM_IFACE = 'de.bmw.environmentalmodel.SignRecognitionFrontCamera';
var CAM_EVENT = 'TrafficSignRecognitionFrontCamera';
var SHOW_MS = 10000;

function find(o, key, d) {
    if (!o || typeof o !== 'object' || d > 5) return undefined;
    if (key in o) return o[key];
    var ks = Object.keys(o);
    for (var i = 0; i < ks.length; i++) { var r = find(o[ks[i]], key, d + 1); if (r !== undefined) return r; }
    return undefined;
}
/** The sign types in one of the camera's values: ['GIVE_WAY', ...] (as many as numberSigns says, if it says). */
function parseSigns(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return []; } }
    if (!v || typeof v !== 'object') return [];
    var list = find(v, 'trafficSign', 0);
    if (!Array.isArray(list)) list = list && typeof list === 'object' ? Object.keys(list).map(function (k) { return list[k]; }) : [];
    var n = find(v, 'numberSigns', 0);
    if (typeof n === 'number' && n >= 0) list = list.slice(0, n);
    return list.map(function (s) { return s && typeof s === 'object' ? s.type : undefined; })
        .filter(function (t) { return typeof t === 'string' && !!t; }).map(function (t) { return t.toUpperCase(); })
        /* (the event's 20 places: an empty one is SIGNAL_UNFILLED, the car's catalog; never a sign) */
        .filter(function (t) { return !/^(SIGNAL_UNFILLED|UNKNOWN|INITIALIZATION_STATUS_UNKNOWN)$/.test(t); });
}

/*
 * (0.29.6) The 79 types of the car's catalog by the owner's table (akakingj/myapp-cluster tools/known_sign_types.json;
 * its shared/road_signs.js KNOWN, the same): name -> [picture or null, shown]. Shown on the cluster as on the head-up
 * display (the owner, 2026-11-28: "the signs the HUD shows, on ID8 too") - the warnings and give way, stop, no entry,
 * no cars, no stopping; no passing by its zone (makeZone), the speed limit by its own sign. A name not in the table
 * (another firmware): a warning (DS_) only.
 */
var KNOWN = {
    NO_PASSING_SIGN: ["no_passing", false],
    WITHDRAWAL_NO_PASSING_SIGN: [null, false],
    WITHDRAWAL_SPEED_LIMIT: [null, false],
    GENERAL_WITHDRAWAL: [null, false],
    SPEED_LIMIT: [null, false],
    WITHDRAWAL_SPEED_LIMIT_2_DIGITS: [null, false],
    WITHDRAWAL_SPEED_LIMIT_3_DIGITS: [null, false],
    MANDATORY_PASSING_LEFT: [null, false],
    MANDATORY_PASSING_RIGHT: [null, false],
    MANDATORY_PASSING_STRAIGHT: [null, false],
    ROUNDABOUT_SIGN: ["roundabout", true],
    NO_ENTRY: ["no_entry", true],
    VEHICLES_PROHIBITED: ["no_cars", true],
    MOTORWAY_START_OF: [null, false],
    MOTORWAY_END_OF: [null, false],
    EXPRESSWAY_START_OF: [null, false],
    EXPRESSWAY_END_OF: [null, false],
    TRAFFIC_CALMING_ZONE_START_OF: [null, false],
    TRAFFIC_CALMING_ZONE_END_OF: [null, false],
    STOP_SIGN: ["stop", true],
    GIVE_WAY: ["give_way", true],
    PRIORITY_ROAD_START_OF: [null, false],
    PRIORITY_ROAD_END_OF: [null, false],
    DS_BEND_LEFT: ["curve_left", true],
    DS_BEND_RIGHT: ["curve_right", true],
    DS_DOUBLE_BEND_LEFT_FIRST: ["double_bend_left", true],
    DS_DOUBLE_BEND_RIGHT_FIRST: ["double_bend_right", true],
    DS_ROAD_NARROW_BOTH_SIDES: ["danger", true],   // narrow_both (new picture to come)
    DS_ROAD_NARROW_LEFT_SIDE: ["danger", true],   // narrow_left (new picture to come)
    DS_ROAD_NARROW_RIGHT_SIDE: ["danger", true],   // narrow_right (new picture to come)
    DS_CROSS_ROAD: ["danger", true],   // crossroad (new picture to come)
    DS_CROSS_ROAD_SMALL_ROAD: ["danger", true],   // priority_road (new picture to come)
    DS_ROAD_FROM_LEFT__DEGREE: ["danger", true],   // junction_left (new picture to come)
    DS_ROAD_FROM_RIGHT__DEGREE: ["danger", true],   // junction_right (new picture to come)
    DS_ONE_BUMP: ["speed_hump", true],
    DS_TWO_BUMP: ["bumpy_road", true],
    DS_CONCAVE: ["bumpy_road", true],
    DS_TRAFFIC_JAM: ["traffic_jam", true],
    DS_ROAD_WORKS: ["road_works", true],
    DS_RIGHT_DOWNWARDS: ["downhill", true],
    DS_RIGHT_UPWARDS: ["uphill", true],
    DS_TRAFFIC_LIGHT: ["traffic_lights", true],
    DS_ANIMAL_CROSSING: ["wild_animal", true],
    DS_CHILDREN: ["children", true],
    DS_SNOW: ["danger", true],
    DS_SPLIPPERY_ROAD: ["slippery", true],
    DS_GIVE_WAY_ROUNDABOUT: ["roundabout", true],
    DS_WIND_FROM_SIDE: ["crosswind", true],
    DS_PEDESTRIAN_CROSSING: ["crosswalk", true],
    DS_BYCICLE_CROSSING: ["bicycle", true],
    DS_TRAIN_CROSS_WITHOUT_BARRIER: ["railway", true],
    DS_TRAIN_CROSS_WITH_BARRIER: ["railway", true],
    DS_GRAVEL: ["danger", true],
    DS_TWO_WAY_TRAFFIC: ["danger", true],   // two_way (new picture to come)
    CITY_LIMIT_START_OF: [null, false],
    CITY_LIMIT_END_OF: [null, false],
    CITY_LIMIT_START_END_OF: [null, false],
    ENVIRONMENTAL_ZONE_START_OF: [null, false],
    ENVIRONMENTAL_ZONE_END_OF: [null, false],
    UNKNOWN: [null, false],
    ALL_VEHICLES_PROHIBITED: ["danger", false],   // no_through (new picture to come)
    MANDATORY_PASSING_HERE_LEFT: [null, false],
    MANDATORY_PASSING_HERE_RIGHT: [null, false],
    MANDATORY_PASSING_LEFT_ALONG: [null, false],
    MANDATORY_PASSING_RIGHT_ALONG: [null, false],
    MANDATORY_PASSING_STRAIGHT_LEFT: [null, false],
    MANDATORY_PASSING_STRAIGHT_RIGHT: [null, false],
    DS_PEDESTRIAN: ["crosswalk", true],
    DS_DOMESTIC_ANIMAL_CROSSING: ["wild_animal", true],
    DS_GENERAL: ["danger", true],
    DS_DRAW_BRIDGE: ["bridge", true],
    DS_LOW_FLYING_AIRCRAFT: ["danger", true],   // aircraft (new picture to come)
    DS_RIVER_BANK: ["riverside", true],
    DS_TRAIN_CROSS: ["railway", true],
    STOPPING_RESTRICTION: ["no_stopping", true],
    NO_STANDING_ANYTIME: ["no_stopping", true],
    DRIVING_EMERGANCY_LANE_ALLOWED: [null, false],
    DRIVING_EMERGANCY_LANE_CANCELLATION: [null, false],
    SIGNAL_UNFILLED: [null, false],
};
function known(t) { return Object.prototype.hasOwnProperty.call(KNOWN, t) ? KNOWN[t] : null; }
/** Shown when the camera reads it: as the table says; another name, a warning (DS_ types). */
function warning(t) { var k = known(t); return k ? k[1] : /^DS_/.test(t); }

/** The warnings to show (the owner, 2026-11-28: on when the camera reads one, off a while after; a new one read takes
 * its place): add(types, t) - one event's warnings become the ones shown, in place of those before (one event may carry
 * two); current(t) -> them, at most max, while showMs has not passed since. */
function makeTracker(showMs, max) {
    showMs = showMs || SHOW_MS; max = max || 2;
    var cur = [], at = -Infinity;
    return {
        add: function (types, t) {
            var f = types.filter(function (ty, i) { return warning(ty) && types.indexOf(ty) === i; });
            if (f.length) { cur = f; at = t; }
        },
        current: function (t) {
            if (t - at >= showMs) { cur = []; return []; }
            return cur.slice(0, max);
        }
    };
}

/*
 * No passing (the head-up display has its own; the cluster covers BMW's): on from the camera's no passing sign until
 * the zone ends (the owner, 2026-11-28: no distance as BMW's own shows, but gone when the zone ends) - an end sign
 * (npEnd) read by the camera; or, while what tells the end is not known (the camera sent no end sign on the drives
 * logged so far; TrafficSignRecognition's event may carry it: the Logs keep its every field as it changes),
 * NP_KM driven since the sign was last read.
 * (2026-11-28, the car's catalog: the camera's own end sign is WITHDRAWAL_NO_PASSING_SIGN, and GENERAL_WITHDRAWAL the
 * end of every restriction; before, the first was taken for a no passing sign and started the zone again.)
 */
var NP_KM = 3;
var NP_END = /(NO_PASSING|OVERTAK|PASSING).*(END|CANCEL|LIFT|RELEASE)|(END|CANCEL|LIFT)_.*(NO_PASSING|OVERTAK|PASSING)|END_OF_ALL|ALL_RESTRICTIONS?_END|DERESTRICT|WITHDRAWAL_NO_PASSING|^GENERAL_WITHDRAWAL$/;
function npEnd(t) { return NP_END.test(t); }
function npStart(t) { return /NO_PASSING|OVERTAK/.test(t) && !npEnd(t) && !/(^|_)END(_|$)/.test(t); }
/** add(types): a no passing sign starts (or keeps on) the zone, an end sign ends it; step(t, kmh): the distance driven
 * (gaps over 2 s counted as 2 s); on(); km(): driven since its sign. */
function makeZone(maxKm) {
    maxKm = maxKm || NP_KM;
    var on = false, km = 0, last = null;
    return {
        add: function (types) {
            if (types.some(npEnd)) on = false;
            else if (types.some(npStart)) { on = true; km = 0; }
        },
        step: function (t, kmh) {
            if (last !== null && on && typeof kmh === 'number' && kmh > 0) km += kmh * Math.min(2000, Math.max(0, t - last)) / 3600000;
            last = t;
            if (km >= maxKm) on = false;
        },
        on: function () { return on; },
        km: function () { return km; }
    };
}
function side(l, r) { return function (t) { return /LEFT/.test(t) ? l : r; }; }
var ART_OF = [
    [/NO_PASSING|OVERTAK/, 'no_passing'],
    [/SLIP|SPLIP|SKID/, 'slippery'], [/JAM|QUEUE|CONGEST/, 'traffic_jam'], [/ANIMAL|DEER|WILD/, 'wild_animal'],
    [/DOWNWARD|DESCENT|DOWNHILL/, 'downhill'], [/UPWARD|ASCENT|UPHILL/, 'uphill'],
    [/DOUBLE|SERIES|WINDING|(^|[^A-Z])S_(CURVE|BEND)/, function (t) { return /LEFT.*RIGHT|LEFT_FIRST|^DS_LEFT/.test(t) ? 'double_bend_left' : 'double_bend_right'; }],
    [/CURVE|BEND/, side('curve_left', 'curve_right')],
    [/WORK|CONSTRUCTION/, 'road_works'], [/PEDESTRIAN|CROSSWALK|ZEBRA/, 'crosswalk'], [/CHILD|SCHOOL/, 'children'],
    [/BICYC|BYCIC|CYCLE/, 'bicycle'], [/HUMP|SPEED_BUMP/, 'speed_hump'], [/UNEVEN|BUMP/, 'bumpy_road'],
    [/ROCK|FALLING/, 'falling_rocks'], [/WIND/, 'crosswind'], [/TUNNEL/, 'tunnel'], [/BRIDGE/, 'bridge'],
    [/RAIL|TRAIN|LEVEL_CROSS/, 'railway'], [/LIGHT|SIGNALS?$/, 'traffic_lights'], [/ROUNDABOUT|CIRCLE/, 'roundabout'],
    [/MERGE|JOIN/, side('merge_left', 'merge_right')], [/RIVER|QUAY|BANK/, 'riverside']
];
/*
 * Speed cameras (0.30.0, the owner: fixed or mobile, as on AK Cluster Info's HUD): BMW's navigation lists them among a
 * route's events; AK Cluster Info decodes them and shares the one to show in /dev/shm/cluster-info/camera.json
 * ({ t, camera: { type } }, its road_signs.js CAMERAS; src/car/providers.js camera()). Fixed or mobile goes by the icon
 * BMW's map draws for it (not yet seen on a drive); a section camera (구간단속) is its own.
 */
var CAMERAS = { SPEED_CAMERA_FIXED: 'camera_fixed', SPEED_CAMERA_MOBILE: 'camera_mobile', SPEED_CAMERA_SECTION: 'camera_section' };
function cameraArt(t) { return typeof t === 'string' && Object.prototype.hasOwnProperty.call(CAMERAS, t) ? CAMERAS[t] : null; }
/** Which picture a type gets: 'danger' (140, "!") for a warning with none of its own. */
function artOf(t) {
    if (cameraArt(t)) return cameraArt(t);
    var k = known(t);
    if (k && k[0]) return k[0];
    for (var i = 0; i < ART_OF.length; i++) {
        var n = ART_OF[i][1];
        if (ART_OF[i][0].test(t)) return typeof n === 'function' ? n(t) : n;
    }
    return 'danger';
}

module.exports = { KNOWN: KNOWN, CAM_IFACE: CAM_IFACE, CAM_EVENT: CAM_EVENT, SHOW_MS: SHOW_MS, parseSigns: parseSigns, warning: warning,
    makeTracker: makeTracker, NP_KM: NP_KM, npStart: npStart, npEnd: npEnd, makeZone: makeZone, artOf: artOf, CAMERAS: CAMERAS, cameraArt: cameraArt };
