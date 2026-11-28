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
 * Shown on the cluster: the warnings (DS_ types) and no passing (not its end) - the speed limit has its own sign -
 * each for 10 s after the camera last read it, oldest first, as South Korea's own signs (src/theme/signs.js, made by
 * tools/make-signs.py; the picture's name from artOf).
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
        .filter(function (t) { return typeof t === 'string' && !!t; }).map(function (t) { return t.toUpperCase(); });
}

/** Whether a type is shown on the cluster: a warning, or no passing (not its end). */
function shown(t) { return /^DS_/.test(t) || (/NO_PASSING|OVERTAK/.test(t) && !/(^|_)END(_|$)/.test(t)); }

/** The signs seen lately: add(types, t), current(t) -> the types to show, oldest first (at most max). */
function makeTracker(showMs, max) {
    showMs = showMs || SHOW_MS; max = max || 4;
    var seen = {};      /* type -> { first, last } */
    return {
        add: function (types, t) {
            types.filter(shown).forEach(function (ty) {
                var s = seen[ty];
                if (s && t - s.last < showMs) s.last = t; else seen[ty] = { first: t, last: t };
            });
        },
        current: function (t) {
            var out = [];
            Object.keys(seen).forEach(function (ty) {
                var s = seen[ty];
                if (t - s.last < showMs) out.push([s.first, ty]); else delete seen[ty];
            });
            return out.sort(function (a, b) { return a[0] - b[0]; }).slice(-max).map(function (e) { return e[1]; });
        }
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
    [/BICYC|CYCLE/, 'bicycle'], [/HUMP|SPEED_BUMP/, 'speed_hump'], [/UNEVEN|BUMP/, 'bumpy_road'],
    [/ROCK|FALLING/, 'falling_rocks'], [/WIND/, 'crosswind'], [/TUNNEL/, 'tunnel'], [/BRIDGE/, 'bridge'],
    [/RAIL|TRAIN|LEVEL_CROSS/, 'railway'], [/LIGHT|SIGNAL/, 'traffic_lights'], [/ROUNDABOUT|CIRCLE/, 'roundabout'],
    [/MERGE|JOIN/, side('merge_left', 'merge_right')], [/RIVER|QUAY|BANK/, 'riverside']
];
/** Which picture a type gets: 'danger' (140, "!") for a warning with none of its own. */
function artOf(t) {
    for (var i = 0; i < ART_OF.length; i++) {
        var n = ART_OF[i][1];
        if (ART_OF[i][0].test(t)) return typeof n === 'function' ? n(t) : n;
    }
    return 'danger';
}

module.exports = { CAM_IFACE: CAM_IFACE, CAM_EVENT: CAM_EVENT, SHOW_MS: SHOW_MS, parseSigns: parseSigns, shown: shown,
    makeTracker: makeTracker, artOf: artOf };
