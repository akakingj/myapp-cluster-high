'use strict';
/*
 * BMW SOME/IP signals -> the raw reading set src/engine/state.js expects.
 *
 * Field names, invalid markers and scalings are taken from the projects that
 * read them on real cars (ZEKAI ID7-Cluster-Themes car.js, ALMSTRA idv7lol
 * vehicle.js / signals.js). Nothing here is guessed: where a reading has no
 * confirmed source it is left undefined, and the theme shows dashes rather
 * than a number we cannot stand behind.
 *
 * Node 8.
 */

/*
 * The services and fields to subscribe to - the app manifest's "signals".
 * Field names and members were checked by other projects against an F98 X4 M
 * Competition's own SOME/IP catalog, the platform family the X3 M40i is on.
 */
var Drive = require('./drive');
var RoadSigns = require('./road_signs');
var PSI_BAR = 14.503774;

var SIGNALS = {
    'de.bmw.infotainment.vehicle.Vehicle2': { statusCarSpeed2: 'rs' },
    'de.bmw.infotainment.vehicle.Vehicle': {
        statusNewCurrentUnitsStatusExt: 'rs',
        _optional: 'The car\'s pressure unit: the Sport Display\'s boost comes in it'
    },
    'de.bmw.infotainment.vehicle.CDS': {
        statusEngineSpeed2: 'rs',
        statusEngineTemperature: 'rs'
    },
    'de.bmw.infrastructure.VehicleInformation': {
        statusGearboxDrive: 's',
        DataPowerTrain2: 's'
    },
    'de.bmw.infrastructure.VehicleCondition': {
        VehicleCondition: 's',
        _optional: 'the car switching on and off: the theme stays off the cluster then'
    },
    /* (before the slower ones: each service's set-up waits for the one before it, kit signals.js nativeTick, and
       twelfth of thirteen the sign's figures came about 30 s after a start) */
    'de.bmw.infotainment.displaydataserver.DisplayDataServer': {
        functionalLibraryData: 'rs',
        _optional: 'The speed limit the car has read, as the head-up display gets it (Display > Speed limit sign)'
    },
    /* the speed limit SIGN itself (0.28.0, sliNow): its one event, about twice a second; a unit without it builds the
       app without it (kit build.py fit_to_unit, "_optional") and the sign comes from the head-up display's figures */
    'de.bmw.dass.TrafficSignRecognition': {
        _broadcasts: ['TrafficSignRecognition'],
        _optional: 'The speed limit sign the front camera reads (Display > Speed limit sign): the head-up display\'s figures instead'
    },
    /* the warning signs the front camera reads (0.29.0, src/car/road_signs.js): one event as the car passes a sign */
    'de.bmw.environmentalmodel.SignRecognitionFrontCamera': {
        _broadcasts: ['TrafficSignRecognitionFrontCamera'],
        _optional: 'The warning signs the front camera reads, beside the speed limit sign (Display > Speed limit sign)'
    },
    'de.bmw.infotainment.KombiIF': {
        statusRangeTankStatus: 'rs',
        statusShowTimeDate: 'rs',
        statusBordcomputerAverage: 'rs',
        statusBordcomputerTravelData: 'rs',
        /* a plug-in hybrid's or an electric car's range on its battery (used only with "Electric range" on) */
        displayRangeElectricVehicle: 'rs',
        _optional: 'Fuel range, tank level and odometer; the time of day the cluster shows; the trip computer\'s average consumption, distance and driving time; electric range'
    },
    'de.bmw.infotainment.drivingexcitement.Efficiencytainment2': {
        statusChargeOfBatteryHybrid: 'rs',
        statusBatteryTemperature: 'rs',
        _optional: 'The drive battery\'s charge and temperature, on a plug-in hybrid or an electric car'
    },
    'de.bmw.infrastructure.EnvironmentalInformation': {
        ExteriorTemperature: 's',
        _optional: 'Outside temperature'
    },
    'de.bmw.infotainment.drivingexcitement.FES': {
        statusSwitchDriveDynamicSport2: 'rs',
        statusFESVehicleDynamicSwitchHMI: 'rs',
        statusActualValueTorque2: 'rs',
        _optional: 'Boost pressure from the Sport Display, the driving mode, the engine\'s torque'
    },
    'de.bmw.infrastructure.analytics.BasicDataSet': {
        basicDataSet: 's',
        _optional: 'The gearbox oil\'s temperature'
    },
    'de.bmw.infotainment.misc.MDrive': {
        controlDisplayMSystems: 's',
        dataDisplayGearbox: 's',
        _optional: 'Driving mode on M cars; the gearbox\'s S / M programme'
    },
    'de.bmw.infotainment.vehicle.CDS2': {
        statusLateralAccelerationMassCenter: 'rs',
        statusLongitudinalAccelerationMassCenter: 'rs',
        _optional: 'Lateral and longitudinal load for the G meter'
    }
};

/* Enums arrive as their name or their wire number; take either. */
function enumOf(v, names) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(names, v) ? names[v] : v;
}
function member(v, key) { return v && typeof v === 'object' ? v[key] : v; }
/*
 * The speed limit sign's figures (Display > Speed limit sign), as the car's own cluster shows its sign (0.27.0): the last
 * limit recognised, kept until another one is - 60 shown until an 80 is recognised, then 80 - whatever the cruise
 * control does. AK Cluster Info's log of Nov 27 2026 (a drive with the cruise control off): vSLISpeedValue x 5 is the
 * limit the car knows of (16: 80, 20: 100); a new one is first announced - vSLISymbol LDM_VZA_VSLI_SPEED_LIMIT,
 * vSLIDistance counting down 1.3 km ... 250 m, vSLISpeedValue already the new figure - and counts once it is reached
 * (vSLIDistance OFF, or the symbol gone). 0 or nothing: the one shown kept. Up to 140 km/h (28): a 30 (150) seen once on
 * a motorway (Nov 24) is no road's. '--' till the first one, and 10 s after the head-up display's data stops. (0.25.1 -
 * 0.26.6 showed it only with the limiter or the cruise control on and ldmAdditionalSign TAKEOVER_SET: '--' otherwise.)
 * A curve's or junction's speed (vSLISymbol LDM_VZA_VSLI_COURSE, the log of 16:35, Nov 27: a 10 = 50 at 500 m ... OFF on a
 * 100 road, the cruise control at 102) is no limit: not shown, nor the same figure left after it with no symbol, till
 * another figure or a limit sign comes (mem.course). The cruise control's own speed never comes in it (102, then 112:
 * vSLISpeedValue 20 all along).
 * AK Cluster Layouts' shared/data.js sliStep is the same rule.
 */
var SLI_STALE_MS = 10000, SLI_MAX = 28;
/* the members the rule needs, from DisplayDataServer.functionalLibraryData (null: none of them) */
function sliRawOf(value) {
    var x = findKey(value, 'xSpeedLimitAssist', 3), acc = findKey(value, 'activeCruiseControl', 3);
    if (!x && !acc) return null;
    return {
        value: x ? x.vSLISpeedValue : undefined, symbol: x ? x.vSLISymbol : undefined, dist: x ? x.vSLIDistance : undefined,
        takeover: x ? x.ldmAdditionalSign : undefined, extra: x ? x.vSLIAdditionalSign : undefined,
        limiter: findKey(value, 'statusLimiter', 3), acc: acc ? acc.symbolACC : undefined,
        cruise: findKey(value, 'cruiseCtrlSpeedHUD', 3),
        pia: findKey(value, 'pia', 3)
    };
}
/* whether the head-up display's data announces the NEXT limit (a sign ahead, its distance counting down) */
function sliAhead(r) { return r.symbol === 'LDM_VZA_VSLI_SPEED_LIMIT' && !!r.dist && !/_OFF$/.test(String(r.dist)); }
/*
 * The speed limit SIGN itself (0.28.0): de.bmw.dass.TrafficSignRecognition's TrafficSignRecognition event - AK Cluster
 * Info's signal survey of 27 Nov 2026 (21 min in town): presentClassLimitSpeed x 5 is the sign the front camera last
 * read (8 = 40, 18 = 90, 22 = 110, within 1 - 3 s of the camera's own SPEED_LIMIT), while the head-up display's
 * vSLISpeedValue stayed at 20 (100), the limiter's taken figure. It comes first; the head-up display's figures only
 * without it (a car without the event, or 10 s of silence). 1 - 28 (5 - 140 km/h); anything else (254: none) keeps
 * the last. As AK Cluster Layouts 0.68.0 (shared/data.js tsrStep).
 */
function tsrStep(prev, v) {
    var n = findKey(v, 'presentClassLimitSpeed', 3);
    return typeof n === 'number' && n >= 1 && n <= SLI_MAX ? n * 5 : prev;
}
var SLI_COURSE = 'LDM_VZA_VSLI_COURSE', SLI_LIMIT = 'LDM_VZA_VSLI_SPEED_LIMIT';
/* the limit shown after this data (km/h, the car's own figures), from the one shown before it (prev; undefined: none);
   mem (an object kept with it) remembers a curve's speed */
function sliStep(prev, r, mem) {
    var n = r && r.value;
    if (!r || typeof n !== 'number' || n < 1 || n > SLI_MAX) return prev;
    if (r.symbol === SLI_COURSE) { if (mem) mem.course = n; return prev; }
    if (sliAhead(r)) return prev;
    if (mem && mem.course === n && r.symbol !== SLI_LIMIT) return prev;
    if (mem) mem.course = undefined;
    return n * 5;
}

/* a member by its name at any depth up to `depth` (the head-up display's data nests its groups) */
function findKey(v, key, depth) {
    if (!v || typeof v !== 'object' || depth < 0) return undefined;
    if (Object.prototype.hasOwnProperty.call(v, key)) return v[key];
    var ks = Object.keys(v);
    for (var i = 0; i < ks.length; i++) {
        var f = findKey(v[ks[i]], key, depth - 1);
        if (f !== undefined) return f;
    }
    return undefined;
}

/*
 * VehicleCondition.statusConditionVehicle (kit/runtime/car.js numbering):
 * 5 parked/living, 7 ignition on, 8 drive readiness starting, 10 ready,
 * 12 drive readiness ending.
 */
var CONDITIONS = { PARKEN_BN_NIO: 1, PARKEN_BN_IO: 2, STANDFUNKTIONEN_KUNDE_NICHT_IM_FZG: 3,
    WOHNEN: 5, PRUEFEN_ANALYSE_DIAGNOSE: 7, FAHRBEREITSCHAFT_HERSTELLEN: 8, FAHREN: 10,
    FAHRBEREITSCHAFT_BEENDEN: 12 };
function conditionOf(x) {
    var n = typeof x === 'number' ? x : CONDITIONS[x];
    return n >= 1 && n <= 12 ? n : undefined;
}

/*
 * DataPowerTrain2.statusGearSelectionDrive: P, R, N and the engaged gear in
 * one enum (N 1, R 2, P 3, N-or-P 4, _1.._9 = 5..13). This is where the gear
 * number comes from; statusGearboxDrive only says P/R/N/D, and some cars
 * never send it.
 */
function selectionOf(x) {
    var n = typeof x === 'number' ? x
        : ({ N: 1, R: 2, P: 3, NP: 4 })[x] ||
          (/^_\d$/.test(String(x)) ? 4 + Number(String(x).slice(1)) : undefined);
    if (n === 1) return { stage: 'N', gear: 0 };
    if (n === 2) return { stage: 'R', gear: -1 };
    if (n === 3) return { stage: 'P', gear: 0 };
    if (n === 4) return { stage: undefined, gear: 0 };
    if (n >= 5 && n <= 13) return { stage: 'D', gear: n - 4 };
    return undefined;
}

/* Driving Experience Control: FES.actualValueModeDrivingExperience, each mode by its own name, as BMW's
   cluster shows it (Sport, Sport+, Sport Individual, Comfort, Comfort+, Comfort Individual, ECO PRO, ECO PRO+,
   ECO PRO Individual, Adaptive) */
var MODE_BY_KEY = {
    SPORT_DYNAMIC: 'SPORT', SPORT_EXPERT: 'SPORT_PLUS', SPORT_INDIVIDUAL: 'SPORT_INDIVIDUAL',
    COMFORT: 'COMFORT', COMFORT_PLUS: 'COMFORT_PLUS', COMFORT_INDIVIDUAL: 'COMFORT_INDIVIDUAL',
    ECO_PRO_EFFICIENT: 'ECO_PRO', ECO_PRO_PLUS: 'ECO_PRO_PLUS', ECO_PRO_INDIVIDUAL: 'ECO_PRO_INDIVIDUAL',
    ADAPTIVE: 'ADAPTIVE', BOOST: 'SPORT'
};
var MODE_PATTERNS = [
    [/ECO_?PRO_?INDIVIDUAL/i, 'ECO_PRO_INDIVIDUAL'], [/ECO_?PRO_?PLUS|ECO_?PRO\+/i, 'ECO_PRO_PLUS'],
    [/ECO_?PRO|EFFICIENT|ECO/i, 'ECO_PRO'],
    [/SPORT_?INDIVIDUAL/i, 'SPORT_INDIVIDUAL'], [/SPORT_?PLUS|SPORT\+|SPORTPLUS|SPORT_?EXPERT/i, 'SPORT_PLUS'],
    [/TRACK|RACE/i, 'TRACK'], [/ADAPTIVE|ADAPTIV/i, 'ADAPTIVE'],
    [/COMFORT_?INDIVIDUAL/i, 'COMFORT_INDIVIDUAL'], [/COMFORT_?PLUS|COMFORT\+/i, 'COMFORT_PLUS'],
    [/SPORT|XTRABOOST/i, 'SPORT'], [/COMFORT|NORMAL|BASIS|BASE/i, 'COMFORT']
];
/* the same by number, as Cluster Layouts reads them (its shared/data.js FES_MODES); a plug-in hybrid's own modes
   other than its SPORT (0x11 - 0x16) are phevNameOf's */
var MODE_BY_NUMBER = { 1: 'SPORT', 2: 'SPORT_PLUS', 3: 'SPORT_INDIVIDUAL', 4: 'COMFORT', 5: 'COMFORT_PLUS', 6: 'COMFORT_INDIVIDUAL',
                       7: 'ECO_PRO', 8: 'ECO_PRO_PLUS', 9: 'ECO_PRO_INDIVIDUAL', 10: 'ADAPTIVE', 15: 'SPORT', 16: 'SPORT_INDIVIDUAL' };
function driveModeOf(raw) {
    var v = member(raw, 'actualValueModeDrivingExperience');
    if (typeof v === 'number') return MODE_BY_NUMBER[v];
    if (typeof v === 'string' && MODE_BY_KEY[v.toUpperCase()]) return MODE_BY_KEY[v.toUpperCase()];
    if (typeof v !== 'string') return undefined;
    for (var i = 0; i < MODE_PATTERNS.length; i++) {
        if (MODE_PATTERNS[i][0].test(v)) return MODE_PATTERNS[i][1];
    }
    return undefined;
}
/*
 * A plug-in hybrid's own modes, from the same field: 'electric' (ELECTRIC,
 * ELECTRIC INDIVIDUAL), 'hybrid' (HYBRID, its ECO PRO and COMFORT, BATTERY
 * CONTROL) or 'sport' (its SPORT, XTRABOOST); by name, or by number as
 * Cluster Layouts reads them (its shared/data.js FES_MODES). undefined for
 * any other (a petrol car's modes: driveModeOf has those).
 */
function phevModeOf(raw) {
    var v = member(raw, 'actualValueModeDrivingExperience');
    if (typeof v === 'number') {
        return v === 0x14 || v === 0x15 ? 'electric' : (v >= 0x11 && v <= 0x13) || v === 0x16 ? 'hybrid'
            : v === 0x0F || v === 0x10 ? 'sport' : undefined;
    }
    if (typeof v !== 'string') return undefined;
    var s = v.toUpperCase();
    if (/(XTRA|EXTRA)_?BOOST/.test(s) && !/NOT|INACTIVE|OFF|INVALID/.test(s)) return 'sport';
    if (!/PHEV/.test(s)) return undefined;
    return /ELECTRIC/.test(s) ? 'electric' : /HYBRID|BATTERY/.test(s) ? 'hybrid' : /SPORT/.test(s) ? 'sport' : undefined;
}
/*
 * A plug-in hybrid's mode by the name BMW's own cluster shows (the key src/engine/state.js names it by): its SPORT
 * (and SPORT INDIVIDUAL), HYBRID (and its ECO PRO and COMFORT), ELECTRIC (and INDIVIDUAL), BATTERY CONTROL, and
 * XTRABOOST while that is on; by name, or by number as Cluster Layouts reads them (FES_MODES). undefined for any
 * other: a petrol or diesel car's modes are driveModeOf's.
 */
var PHEV_NAMES = { 15: 'PHEV_SPORT', 16: 'PHEV_SPORT_INDIVIDUAL', 17: 'HYBRID', 18: 'HYBRID_ECO_PRO', 19: 'HYBRID_COMFORT',
                   20: 'ELECTRIC', 21: 'ELECTRIC_INDIVIDUAL', 22: 'BATTERY_CONTROL' };
var PHEV_PATTERNS = [
    [/ELECTRIC_?INDIVIDUAL/, 'ELECTRIC_INDIVIDUAL'], [/ELECTRIC/, 'ELECTRIC'], [/BATTERY/, 'BATTERY_CONTROL'],
    [/HYBRID_?ECO/, 'HYBRID_ECO_PRO'], [/HYBRID_?COMFORT/, 'HYBRID_COMFORT'], [/HYBRID/, 'HYBRID'],
    [/SPORT_?PLUS/, 'XTRABOOST'], [/SPORT_?INDIVIDUAL/, 'PHEV_SPORT_INDIVIDUAL'], [/SPORT/, 'PHEV_SPORT']
];
function phevNameOf(raw) {
    var v = member(raw, 'actualValueModeDrivingExperience');
    if (typeof v === 'number') return PHEV_NAMES[v];
    if (typeof v !== 'string') return undefined;
    var s = v.toUpperCase();
    if (/(XTRA|EXTRA)_?BOOST/.test(s) && !/NOT|INACTIVE|OFF|INVALID/.test(s)) return 'XTRABOOST';
    if (!/PHEV/.test(s)) return undefined;
    for (var i = 0; i < PHEV_PATTERNS.length; i++) {
        if (PHEV_PATTERNS[i][0].test(s)) return PHEV_PATTERNS[i][1];
    }
    return undefined;
}
/*
 * Which of the per-mode styles a drive mode takes (Settings > Display > Style in Sport / Style in ECO PRO), as AK
 * Cluster Layouts' Layout in Sport / in ECO PRO: 'sport' for every Sport (Sport+, Individual, Track, a plug-in
 * hybrid's Sport and XtraBoost), 'eco' for ECO PRO (+, Individual) and a plug-in hybrid's Electric, null for the
 * rest (Comfort, Adaptive, Hybrid and its ECO PRO, Battery Control) and for none yet.
 */
function modeClassOf(raw) {
    var m = (raw && (raw.phevName || raw.driveMode)) || '';
    if (/SPORT|XTRABOOST|TRACK/.test(m)) return 'sport';
    if (/ECO_PRO|ELECTRIC/.test(m) && !/HYBRID/.test(m)) return 'eco';
    return null;
}
/* M cars: MDrive.controlDisplayMSystems.controlDisplayEngineMode. */
function mEngineModeOf(raw) {
    var n = enumOf(member(raw, 'controlDisplayEngineMode'), { KOMFORT: 1, SPORT: 2, SPORT_PLUS: 3 });
    return n === 1 ? 'COMFORT' : n === 2 ? 'SPORT' : n === 3 ? 'SPORT_PLUS' : undefined;
}

var G0 = 9.80665;

/* A raw field with its invalid marker, scale and offset. */
function scaled(raw, invalid, factor, offset) {
    if (typeof raw !== 'number' || raw === invalid) return undefined;
    return raw * factor + (offset || 0);
}

var STAGE_CODES = [null, 'P', 'R', 'N', 'D'];

function stageOf(value) {
    if (STAGE_CODES.indexOf(value) > 0) return value;
    if (typeof value === 'number' && value === Math.floor(value)) {
        return STAGE_CODES[value] || undefined;
    }
    return undefined;
}

/*
 * The gearbox's programme (MDrive.dataDisplayGearbox, as Cluster Layouts reads it): S or M, else D's own.
 */
var PROGRAMS = { S_MINUS_PROGRAMM: 'S', M_MINUS_PROGRAMM: 'M', 1: 'S', 2: 'M' };
function programOf(value) {
    var raw = value && typeof value === 'object'
        ? (value.dataDisplayGearbox !== undefined ? value.dataDisplayGearbox : value[Object.keys(value)[0]]) : value;
    return PROGRAMS[raw] || '';
}

/*
 * The gear with its programme: D1, S1, M1 (P, R and N as they are), for Toro's
 * numeral when it shows them (TORO > Gear).
 */
function gearStaged(stage, gear, program) {
    var t = gearText(stage, gear);
    return typeof gear === 'number' && gear > 0 && /^[0-9]$/.test(t || '') ? (program || 'D') + t : t;
}

/*
 * What the big numeral shows. P, R and N come from the selector; in D the
 * engaged gear is shown, as a Lamborghini does.
 */
function gearText(stage, gear) {
    if (stage === 'P' || stage === 'R' || stage === 'N') return stage;
    if (typeof gear === 'number') {
        if (gear === -1) return 'R';
        if (gear === 0) return stage || 'N';
        return String(gear);
    }
    return stage || undefined;
}

/*
 * The head unit's own clock runs on UTC, so the time of day is taken from
 * the instrument cluster's display time (KombiIF statusShowTimeDate): the
 * zone, the summer time and any minutes the owner has set it fast are the
 * car's own. What is kept is how far the cluster's clock runs ahead of
 * ours, in milliseconds, so the minute turns over when the car's does and
 * nothing depends on the head unit's clock being right - only on it
 * running. The cluster shows the time while statusDisplayClockTimeDate is
 * odd, --:-- while it is even (null: we show none either), and 15 means
 * the field is not filled (undefined: keep what we had).
 */
function clockOffset(show, now) {
    var status = show && show.statusDisplayClockTimeDate;
    if (typeof status !== 'number' || status === 15) return undefined;
    var h = show.displayHour, m = show.displayMinute;
    if (status % 2 !== 1 || !(h >= 0 && h < 24) || !(m >= 0 && m < 60)) return null;
    var sec = show.displaySecond >= 0 && show.displaySecond < 60 ? show.displaySecond : 0;
    var DAY = 86400000;
    return ((((h * 60 + m) * 60 + sec) * 1000 - now) % DAY + DAY) % DAY;
}

/*
 * The trip computer's average consumption (KombiIF statusBordcomputerAverage,
 * trip 1), as litres per 100 km whatever unit the car is set to show:
 * tenths, in statusUnitOfMeasurementConsumptionBC's unit (1 l/100 km,
 * 2 mpg UK, 3 mpg US, 4 km/l; names or numbers). 65535 and 0 are "none";
 * so is a unit we cannot name, rather than a figure in the wrong one.
 * Field, scale and enum as Vizualyse's cluster and the kit's Live Data read
 * them (their scale is marked a best fit: the car's own screen is the check).
 */
var CONSUMPTION_UNITS = { VERBRAUCH_IN_L_S_100KM: 1, VERBRAUCH_IN_MPG_UK: 2, VERBRAUCH_IN_MPG_US: 3,
    VERBRAUCH_IN_KM_S_L: 4 };
function averageL100(v) {
    var raw = v && v.consumptionAverage1BC1;
    if (typeof raw !== 'number' || raw <= 0 || raw >= 65535) return undefined;
    var c = raw * 0.1;
    var unit = enumOf(v.statusUnitOfMeasurementConsumptionBC, CONSUMPTION_UNITS);
    if (unit === 1) return c;
    if (unit === 2) return 282.481 / c;
    if (unit === 3) return 235.215 / c;
    if (unit === 4) return 100 / c;
    return undefined;
}

var DRIVE_MODES = {
    1: 'COMFORT', 2: 'SPORT', 3: 'SPORT PLUS', 4: 'ECO PRO',
    5: 'ADAPTIVE', 6: 'TRACK'
};

/*
 * Holds the latest reading of each signal and hands out a raw set.
 * `now` is passed in so staleness is testable.
 */
function createReader(opts) {
    opts = opts || {};
    var STALE_MS = opts.staleMs || 1500;
    var v = {};      /* key -> { value, at } */
    var drive = Drive.create();     /* this drive's peaks, 0-60 / 0-100 and last upshift (src/car/drive.js) */

    function put(key, value, now) {
        if (value === undefined) return;
        v[key] = { value: value, at: now };
    }
    var hmiModeAt = -Infinity;      /* when the HMI's switch field last named a mode */
    var gearboxBusAt = -Infinity;   /* when the car's own BasicDataSet last gave the gearbox oil */
    function modes(value, now) {
        put('driveMode', driveModeOf(value), now);
        put('phevMode', phevModeOf(value), now);
        put('phevName', phevNameOf(value), now);
    }
    /* the car's pressure unit (statusNewCurrentUnitsStatusExt): the Sport Display's boost comes in it */
    var carPress = null;
    function inBar(raw) { return carPress === 'PSI' ? raw * 0.1 / PSI_BAR : raw / 100; }
    function get(key, now) {
        var e = v[key];
        if (!e) return undefined;
        /* A reading nobody has refreshed is not shown as if it were live. */
        if (now - e.at > STALE_MS) return undefined;
        return e.value;
    }
    /*
     * For the Logs (--- sli ---): each change of what the head-up display has of Speed Limit Assist, with the time and
     * the car's speed, the last 20; and how often its data comes (the last 60 s) and when it last came.
     */
    var sliChanges = [], sliTimes = [], sliLast = '', sliShown, sliMem = {}, tsrShown;
    /* the signs the camera read (0.29.1): a warning 10 s, a new one in its place; no passing till its zone ends
       (src/car/road_signs.js); the last event for the Logs (the sign services' every field: AK Cluster Info's Test log's,
       0.29.3) */
    var roadTracker = RoadSigns.makeTracker(RoadSigns.SHOW_MS, 2), npZone = RoadSigns.makeZone(RoadSigns.NP_KM);
    var camLast = null, camSeen = {};
    function sliSeen(r, now) {
        sliTimes.push(now);
        while (sliTimes.length && now - sliTimes[0] > 60000) sliTimes.shift();
        var key = JSON.stringify(r);
        if (key === sliLast) return;
        sliLast = key;
        var sp = get('speedKmh', now);
        sliChanges.push({ at: now, speed: typeof sp === 'number' ? Math.round(sp) : null, raw: r, shown: sliShown });
        if (sliChanges.length > 20) sliChanges.shift();
    }
    function sliLog(now, last) {
        var e = v.sli, age = e ? Math.round((now - e.at) / 100) / 10 : null;
        var head = 'head-up display data: ' + sliTimes.filter(function (t) { return now - t <= 60000; }).length + ' in the last 60 s, ' +
            (age === null ? 'none yet' : 'the last ' + age + ' s ago') + '; shown: ' + (sliNow(now) || '--');
        var t = v.tsr, tAge = t ? Math.round((now - t.at) / 100) / 10 : null;
        var sign = 'sign (TrafficSignRecognition): ' + (tAge === null ? 'none yet'
            : 'presentClassLimitSpeed ' + findKey(t.value, 'presentClassLimitSpeed', 3) + ', ' + tAge + ' s ago, shown ' + (tsrShown || '--'));
        var cam = 'warning signs (front camera): ' + (camLast ? camLast.types.join(', ') + ', ' + Math.round((now - camLast.at) / 100) / 10 + ' s ago; seen ' +
            Object.keys(camSeen).map(function (k) { return k + ' ' + camSeen[k]; }).join(', ') : 'none yet') +
            '; no passing ' + (npZone.on() ? 'on, ' + npZone.km().toFixed(2) + ' km since its sign' : 'off');
        return [sign, head, cam].concat(sliChanges.slice(-(last || 20)).map(function (c) {
            return new Date(c.at).toISOString() + ' at ' + (c.speed === null ? '?' : c.speed) + ' km/h  shown ' + (c.shown || '--') + '  ' + JSON.stringify(c.raw);
        })).join('\n');
    }
    /* the signs to show now (0.29.1): no passing first while its zone lasts, then the warnings, two at most */
    function roadSignsNow(now) {
        npZone.step(now, get('speedKmh', now));
        return (npZone.on() ? ['no_passing'] : []).concat(roadTracker.current(now).map(RoadSigns.artOf)).slice(0, 2);
    }
    /* the last limit recognised (sliStep), while the head-up display's data comes (10 s) */
    function sliNow(now) {
        if (tsrOn(now)) return tsrShown;
        var e = v.sli;
        return e && now - e.at <= SLI_STALE_MS ? sliShown : undefined;
    }
    /* the sign's own event has come in the last 10 s (tsrStep) */
    function tsrOn(now) { return !!v.tsr && now - v.tsr.at <= SLI_STALE_MS; }
    /* Readings that only change slowly are not aged out. */
    function held(key) { return v[key] ? v[key].value : undefined; }

    /* One notification from the head unit. Never throws: a bad payload is
       simply not a reading. */
    function receive(service, field, value, now) {
        now = now || Date.now();
        try { decode(service, field, value, now); } catch (e) { /* not a reading */ }
    }

    function decode(service, field, value, now) {
        var b;
        if (service === 'de.bmw.infotainment.vehicle.Vehicle' && field === 'statusNewCurrentUnitsStatusExt') {
            /* the car's pressure unit (1 bar, 2 kPa, 3 psi; by name or number) */
            var pu = value && typeof value === 'object' ? value.unitOfMeasurementAirPressure : value;
            var pn = pu && typeof pu === 'object' ? (pu.name || pu.value) : pu;
            var pp = { 1: 'BAR', 2: 'KPA', 3: 'PSI' }[pn] || (/BAR|KPA|PSI/.test(String(pn)) ? String(pn).match(/BAR|KPA|PSI/)[0] : null);
            if (pp) carPress = pp;
        } else if (service === 'de.bmw.infotainment.vehicle.Vehicle2' && field === 'statusCarSpeed2') {
            var sp = value && value.speedVehicleCentreOfGravity;
            /* 25601 and up is past 400 km/h: an invalid frame, not a speed */
            if (typeof sp === 'number' && sp < 25601) put('speedKmh', scaled(sp, 65535, 1 / 64), now);
        } else if (service === 'de.bmw.infotainment.vehicle.CDS') {
            if (field === 'statusEngineSpeed2') {
                put('rpm', scaled(value && value.actualValueRPMEngineCrankshaft, 65535, 0.25), now);
            } else if (field === 'statusEngineTemperature') {
                put('coolantC', scaled(value && value.temperatureEngineDrive, 255, 1, -48), now);
                put('oilTempC', scaled(value && value.temperatureEngineOilDrive, 255, 1, -48), now);
            }
        } else if (service === 'de.bmw.infrastructure.VehicleInformation') {
            if (field === 'DataPowerTrain2') {
                var sel = selectionOf(value && value.statusGearSelectionDrive);
                if (sel) {
                    if (sel.stage) put('stage', sel.stage, now);
                    put('gearNum', sel.gear, now);
                }
            } else if (field === 'statusGearboxDrive') {
                put('stageBox', stageOf(value && value.statusActualStageDrive), now);
            }
        } else if (service === 'de.bmw.infrastructure.VehicleCondition' && field === 'VehicleCondition') {
            put('condition', conditionOf(value && value.statusConditionVehicle), now);
        } else if (service === 'de.bmw.infotainment.KombiIF' && field === 'statusShowTimeDate') {
            put('clockOffsetMs', clockOffset(value, now), now);
        } else if (service === 'de.bmw.infotainment.KombiIF' && field === 'statusBordcomputerAverage') {
            var avg = averageL100(value);
            /* held: the trip computer moves slowly and is polled every 5 s */
            if (avg !== undefined && avg > 0.5 && avg < 99) put('avgL100', avg, now);
        } else if (service === 'de.bmw.infotainment.KombiIF' && field === 'statusBordcomputerTravelData') {
            /* the trip computer's distance (km) and driving time, as Cluster Layouts reads them */
            var km = value && value.wayPassed, hr = value && value.rideDurationHours, mn = value && value.rideDurationMinutes;
            if (typeof km === 'number' && km >= 0 && km < 0xFFFE) put('tripKm', km, now);
            if (typeof hr === 'number' && hr >= 0 && hr < 0xFFFE && typeof mn === 'number' && mn >= 0 && mn < 60) put('tripMin', hr * 60 + mn, now);
        } else if (service === 'de.bmw.infrastructure.analytics.BasicDataSet' && field === 'basicDataSet') {
            /* the gearbox oil (Cluster Layouts' gearboxTemp: raw - 48, 255 no value) */
            var gb = value && value.valueTemperatureTransmissionOil;
            if (typeof gb === 'number' && gb !== 255 && gb - 48 > -40 && gb - 48 < 160) { put('gearboxC', gb - 48, now); gearboxBusAt = now; }
        } else if (service === 'de.bmw.infotainment.drivingexcitement.FES' && field === 'statusActualValueTorque2') {
            /* the crankshaft's torque: 0.5 Nm a step, 0 at 2047, 4095 and up no value; engine braking counts as 0 */
            var tqr = value && value.actualValueTorqueCrankshaft;
            if (typeof tqr === 'number' && tqr < 4095) put('torqueNm', Math.max(0, tqr * 0.5 - 1023.5), now);
        } else if (service === 'de.bmw.infotainment.KombiIF' && field === 'statusRangeTankStatus') {
            put('rangeKm', scaled(value && value.range, 4095, 1), now);
            put('fuelLitres', scaled(value && value.fluidLevelFuelTank, 255, 1), now);
            put('odoKm', scaled(value && value.mileageKilometre, 16777215, 1), now);
        } else if (service === 'de.bmw.infotainment.KombiIF' && field === 'displayRangeElectricVehicle') {
            /*
             * Electric range, as the cluster shows it: km, 65535 for none
             * (Vizualyse/idrive-apps reads it so; no project has confirmed
             * the scaling on a car). A petrol car answers nothing or none.
             */
            var ev = value && typeof value === 'object' ? value.displayRangeElectricVehicle : value;
            put('evRangeKm', typeof ev === 'number' && ev >= 0 && ev <= 1500 ? ev : undefined, now);
        } else if (service === 'de.bmw.infotainment.drivingexcitement.Efficiencytainment2' &&
                   field === 'statusChargeOfBatteryHybrid') {
            /* the drive battery's charge as the car displays it, in per cent; over 100 is none (same source) */
            var soc = value && value.displayChargingConditionHighVoltageStorage;
            put('socPct', typeof soc === 'number' && soc >= 0 && soc <= 100 ? soc : undefined, now);
        } else if (service === 'de.bmw.infotainment.drivingexcitement.Efficiencytainment2' &&
                   field === 'statusBatteryTemperature') {
            /* the drive battery's temperature: raw - 50 C, 255 none
               (cauliflowermossgrape/idrive7-apps apps/redline/electrical.js) */
            var hv = value && value.actualValueTemperatureHighVoltageStorage;
            put('hvTempC', typeof hv === 'number' && hv >= 0 && hv < 255 ? hv - 50 : undefined, now);
        } else if (service === 'de.bmw.infrastructure.EnvironmentalInformation' &&
                   field === 'ExteriorTemperature') {
            put('ambientC', scaled(value && value.temperatureExterior, 255, 0.5, -40), now);
        } else if (service === 'de.bmw.infotainment.drivingexcitement.FES') {
            if (field === 'statusSwitchDriveDynamicSport2') {
                /* displayBoostPressure over atmosphere in the car's pressure unit, as BMW's Sport Display shows it:
                   hundredths of a bar (or 1 kPa) a step, tenths of a psi on a car set to psi (as AK Cluster Layouts reads
                   it); 255 = no value */
                b = value && value.displayBoostPressure;
                if (typeof b === 'number' && b >= 0 && b < 255) put('boostBus', inBar(b), now);
                /* ... and the Sport Display's own boost gauge's end, the same way (Boost gauge up to: From the car's
                   Sport Display); a figure no boost gauge ends at (under 0.5 bar, past 4) is not taken */
                var mx = value && value.displayMaximumValueBoostPressure;
                if (typeof mx === 'number' && mx > 0 && mx < 255 && inBar(mx) >= 0.5 && inBar(mx) <= 4) put('boostMaxCar', inBar(mx), now);
                /* (the mode from here only while the HMI's switch field, the one the stock cluster names, has said
                   nothing for a minute, as Cluster Layouts reads them) */
                if (now - hmiModeAt > 60000) modes(value, now);
            } else if (field === 'statusFESVehicleDynamicSwitchHMI') {
                if (driveModeOf(value) !== undefined || phevNameOf(value) !== undefined) hmiModeAt = now;
                modes(value, now);
            }
        } else if (service === 'de.bmw.infotainment.misc.MDrive' && field === 'dataDisplayGearbox') {
            put('program', programOf(value), now);
        } else if (service === 'de.bmw.infotainment.misc.MDrive' && field === 'controlDisplayMSystems') {
            var mm = mEngineModeOf(value);
            if (mm) { put('driveMode', mm, now); put('mDrive', true, now); }
        } else if (service === RoadSigns.CAM_IFACE && field === RoadSigns.CAM_EVENT) {
            /* a sign the front camera passed (src/car/road_signs.js): the warnings and no passing kept 10 s */
            var types = RoadSigns.parseSigns(value);
            roadTracker.add(types, now);
            npZone.add(types);
            camLast = { at: now, types: types };
            types.forEach(function (ty) { camSeen[ty] = (camSeen[ty] || 0) + 1; });
        } else if (service === 'de.bmw.dass.TrafficSignRecognition' && field === 'TrafficSignRecognition') {
            /* the sign itself (tsrStep): presentClassLimitSpeed x 5 */
            put('tsr', value, now);
            tsrShown = tsrStep(tsrShown, value);
        } else if (service === 'de.bmw.infotainment.displaydataserver.DisplayDataServer' && field === 'functionalLibraryData') {
            /* what the head-up display has of Speed Limit Assist (sliRawOf), and the limit shown after it (sliStep) */
            var raw = sliRawOf(value);
            if (raw) { put('sli', raw, now); sliShown = sliStep(sliShown, raw, sliMem); sliSeen(raw, now); }
        } else if (service === 'de.bmw.infotainment.vehicle.CDS2') {
            if (field === 'statusLateralAccelerationMassCenter') {
                b = value && value.lateralAccelerationCentreOfGravity;
                if (typeof b === 'number' && b !== 65535) put('gLat', (b * 0.002 - 65) / G0, now);
            } else if (field === 'statusLongitudinalAccelerationMassCenter') {
                b = value && value.longitudinalAccelerationCentreOfGravity;
                if (typeof b === 'number' && b !== 65535) put('gLon', (b * 0.002 - 65) / G0, now);
            }
        }
    }

    /* Boost from the engine unit (src/car/engine.js), used only while the
       Sport Display gives none: the car's own reading always comes first. */
    function setBoostBar(bar, now) {
        if (typeof bar === 'number' && isFinite(bar)) put('boostDme', bar, now || Date.now());
    }
    /* has the Sport Display sent a boost reading in the last `ms`? */
    function hasBusBoost(now, ms) {
        return !!v.boostBus && (now || Date.now()) - v.boostBus.at < (ms || STALE_MS);
    }
    function setOilPressureBar(bar, now) { put('oilPressBar', bar, now || Date.now()); }
    function setAccel(lat, lon, now) {
        put('gLat', lat, now || Date.now());
        put('gLon', lon, now || Date.now());
    }
    /* Readings the bus does not carry: the intake air's temperature (C), the
       battery's voltage, the accelerator pedal and the throttle (%) and the
       ignition angle (degrees), the boost target and the fuel pressures (bar), from the engine unit (src/car/engine.js; or a
       feed, src/car/feed.js, where a host turns one on); a plug-in hybrid's
       battery power and its limits (kW), from eDrive Live (src/car/providers.js).
       They age out like any other, so a source that stops leaves dashes, not a number. */
    var FED = ['iatC', 'batteryV', 'pedalPct', 'throttlePct', 'timingDeg', 'boostTargetBar', 'hpfpBar', 'lpfpBar', 'tankPct', 'kw', 'kwOut', 'kwIn', 'socPct',
               'gearboxC'];
    function setFeed(key, value, now) {
        if (FED.indexOf(key) >= 0 && typeof value === 'number' && isFinite(value)) {
            put(key, value, now || Date.now());
        }
    }

    var peakBoost = 0, peakLat = 0, peakLon = 0, lastPeak = 0;
    /* the engine unit's tank level last answered: the gauge holds it while the unit is not asked or silent */
    var lastTank;

    function raw(now) {
        now = now || Date.now();
        /* the tank is read slowly; holding it stops the gauge blinking
           between a number and dashes between polls */
        var litres = held('fuelLitres');
        /*
         * The fuel gauge's figure, as AK Cluster Layouts': the engine unit's own tank level (OBD PID 0x2F,
         * src/car/engine.js) and nothing else, its last answer held; none ('--') till it first answers.
         * (0.26.0: the car's litres over a tank size, General: Fuel tank size and Fuel % from, gone)
         */
        var byEngine = get('tankPct', now);
        if (typeof byEngine === 'number') lastTank = Math.max(0, Math.min(100, byEngine));
        var fuelPct = lastTank;
        var boost = get('boostBus', now);
        if (boost === undefined) boost = get('boostDme', now);
        var latR = get('gLat', now), lonR = get('gLon', now);
        var gOk = typeof latR === 'number' || typeof lonR === 'number';
        var lat = typeof latR === 'number' ? latR : 0;
        var lon = typeof lonR === 'number' ? lonR : 0;

        /* Peaks decay so an old number does not sit on the gauge for ever. */
        var dt = lastPeak ? Math.min(2, (now - lastPeak) / 1000) : 0;
        lastPeak = now;
        peakBoost = Math.max(typeof boost === 'number' ? boost : 0, peakBoost - dt * 0.18);
        peakLat = Math.abs(lat) > Math.abs(peakLat) ? lat : peakLat * (1 - dt * 0.25);
        peakLon = Math.abs(lon) > Math.abs(peakLon) ? lon : peakLon * (1 - dt * 0.25);

        /* this drive's figures (src/car/drive.js): the engine's power from its torque and revs while it runs */
        var rpmNow = get('rpm', now), tq = get('torqueNm', now);
        var dr = drive.sample(now, { speedKmh: get('speedKmh', now), rpm: rpmNow, gear: held('gearNum'), boostBar: boost,
                                     powerKw: typeof tq === 'number' && typeof rpmNow === 'number' && rpmNow >= 300 ? tq * rpmNow / 9549 : undefined,
                                     engineOn: typeof rpmNow === 'number' ? rpmNow >= 300 : undefined });

        /* the car's time of day, once its cluster has told us the zone */
        var off = held('clockOffsetMs');
        var d = typeof off === 'number' ? new Date(now + off) : null;
        return {
            rpm: get('rpm', now),
            speedKmh: get('speedKmh', now),
            gear: gearText(held('stage') || held('stageBox'), held('gearNum')),
            gearStaged: gearStaged(held('stage') || held('stageBox'), held('gearNum'), held('program')),
            condition: held('condition'),
            driveMode: held('driveMode'),
            phevMode: held('phevMode'),
            phevName: held('phevName'),
            program: held('program'),
            boostBar: boost,
            /* the Sport Display's own boost gauge's end, bar (Boost gauge up to: From the car's Sport Display) */
            boostMaxCar: held('boostMaxCar'),
            boostPeakBar: peakBoost,
            oilTempC: get('oilTempC', now),
            oilPressBar: get('oilPressBar', now),
            coolantC: get('coolantC', now),
            /* the car's litres as it sends them and the engine unit's level (the Logs tab), and the gauge's figure */
            fuelLitres: typeof litres === 'number' ? litres : undefined,
            tankPct: byEngine,
            fuelPct: fuelPct,
            odoKm: held('odoKm'),
            /* the trip computer's distance and time, the gearbox oil, the torque */
            tripKm: held('tripKm'),
            tripMin: held('tripMin'),
            gearboxC: held('gearboxC'),
            torqueNm: get('torqueNm', now),
            rangeKm: held('rangeKm'),
            /* held: both move slowly and are polled every 5 s */
            evRangeKm: held('evRangeKm'),
            socPct: held('socPct'),
            hvTempC: held('hvTempC'),
            ambientC: held('ambientC'),
            avgL100: held('avgL100'),
            /* from BeeM-Flash's feed or the engine unit, whichever is in use (setFeed) */
            iatC: get('iatC', now),
            batteryV: get('batteryV', now),
            pedalPct: get('pedalPct', now), throttlePct: get('throttlePct', now), timingDeg: get('timingDeg', now),
            boostTargetBar: get('boostTargetBar', now), hpfpBar: get('hpfpBar', now), lpfpBar: get('lpfpBar', now),
            drivePeakBoostBar: dr.boostPeakBar, powerPeakKw: dr.powerPeakKw, zero60S: dr.zero60S, zero100S: dr.zero100S,
            lastShift: dr.lastShift,
            kw: get('kw', now), kwOut: get('kwOut', now), kwIn: get('kwIn', now),
            clock: d ? { h: d.getUTCHours(), m: d.getUTCMinutes() } : undefined,
            /* undefined, not zero, when the car is not sending it: the
               meter then shows dashes instead of a convincing 0.00 */
            /* the last speed limit recognised (sliStep; the head-up display's data polled every 2 s) */
            speedLimit: sliNow(now),
            /* (for the Logs' data now: what it goes by) */
            sliRaw: v.sli ? v.sli.value.value : undefined, sliSymbol: v.sli ? v.sli.value.symbol : undefined,
            sliDist: v.sli ? v.sli.value.dist : undefined, sliTakeover: v.sli ? v.sli.value.takeover : undefined,
            sliAgeS: v.sli ? Math.round((now - v.sli.at) / 100) / 10 : undefined,
            sliSource: tsrOn(now) ? 'sign' : v.sli ? 'head-up display' : 'none',
            sliSign: v.tsr ? findKey(v.tsr.value, 'presentClassLimitSpeed', 3) : undefined,
            /* the warning signs to show now, oldest first, as their pictures' names (src/theme/signs.js) */
            roadSigns: roadSignsNow(now),
            gLat: gOk ? lat : undefined, gLon: gOk ? lon : undefined,
            gPeakLat: gOk ? peakLat : undefined, gPeakLon: gOk ? peakLon : undefined
        };
    }

    return {
        receive: receive, raw: raw, sliLog: sliLog,
        setBoostBar: setBoostBar, hasBusBoost: hasBusBoost,
        setOilPressureBar: setOilPressureBar, setAccel: setAccel,
        setFeed: setFeed,
        /* whether the car's BasicDataSet has given the gearbox oil within ms (else the gearbox unit is asked: src/car/engine.js) */
        hasBusGearbox: function (now, ms) { return now - gearboxBusAt <= ms; }
    };
}

module.exports = {
    SIGNALS: SIGNALS,
    createReader: createReader,
    scaled: scaled, stageOf: stageOf, gearText: gearText, gearStaged: gearStaged, programOf: programOf,
    selectionOf: selectionOf, conditionOf: conditionOf, sliStep: sliStep, sliRawOf: sliRawOf, sliAhead: sliAhead, tsrStep: tsrStep,
    driveModeOf: driveModeOf, modeClassOf: modeClassOf, phevModeOf: phevModeOf, phevNameOf: phevNameOf, mEngineModeOf: mEngineModeOf, clockOffset: clockOffset,
    averageL100: averageL100
};
