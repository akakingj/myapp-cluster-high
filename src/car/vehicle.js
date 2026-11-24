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

var SIGNALS = {
    'de.bmw.infotainment.vehicle.Vehicle2': { statusCarSpeed2: 'rs' },
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

/* Driving Experience Control: FES.actualValueModeDrivingExperience. */
var MODE_BY_KEY = {
    SPORT_DYNAMIC: 'SPORT', SPORT_EXPERT: 'SPORT_PLUS', SPORT_INDIVIDUAL: 'SPORT',
    COMFORT: 'COMFORT', COMFORT_PLUS: 'COMFORT', COMFORT_INDIVIDUAL: 'COMFORT',
    ECO_PRO_EFFICIENT: 'ECO_PRO', ECO_PRO_PLUS: 'ECO_PRO', ECO_PRO_INDIVIDUAL: 'ECO_PRO',
    ADAPTIVE: 'ADAPTIVE', BOOST: 'SPORT'
};
var MODE_PATTERNS = [
    [/ECO_?PRO|EFFICIENT|ECO/i, 'ECO_PRO'], [/SPORT_?PLUS|SPORT\+|SPORTPLUS/i, 'SPORT_PLUS'],
    [/TRACK|RACE/i, 'TRACK'], [/ADAPTIVE|ADAPTIV/i, 'ADAPTIVE'],
    [/SPORT|XTRABOOST/i, 'SPORT'], [/COMFORT|NORMAL|BASIS|BASE/i, 'COMFORT']
];
function driveModeOf(raw) {
    var v = member(raw, 'actualValueModeDrivingExperience');
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
    function get(key, now) {
        var e = v[key];
        if (!e) return undefined;
        /* A reading nobody has refreshed is not shown as if it were live. */
        if (now - e.at > STALE_MS) return undefined;
        return e.value;
    }
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
        if (service === 'de.bmw.infotainment.vehicle.Vehicle2' && field === 'statusCarSpeed2') {
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
            if (typeof gb === 'number' && gb !== 255 && gb - 48 > -40 && gb - 48 < 160) put('gearboxC', gb - 48, now);
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
                /* displayBoostPressure: hundredths of a bar, 255 = no value */
                b = value && value.displayBoostPressure;
                if (typeof b === 'number' && b >= 0 && b < 255) put('boostBus', b / 100, now);
                put('driveMode', driveModeOf(value), now);
                put('phevMode', phevModeOf(value), now);
            } else if (field === 'statusFESVehicleDynamicSwitchHMI') {
                put('driveMode', driveModeOf(value), now);
                put('phevMode', phevModeOf(value), now);
            }
        } else if (service === 'de.bmw.infotainment.misc.MDrive' && field === 'dataDisplayGearbox') {
            put('program', programOf(value), now);
        } else if (service === 'de.bmw.infotainment.misc.MDrive' && field === 'controlDisplayMSystems') {
            var mm = mEngineModeOf(value);
            if (mm) { put('driveMode', mm, now); put('mDrive', true, now); }
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
    var FED = ['iatC', 'batteryV', 'pedalPct', 'throttlePct', 'timingDeg', 'boostTargetBar', 'hpfpBar', 'lpfpBar', 'kw', 'kwOut', 'kwIn'];
    function setFeed(key, value, now) {
        if (FED.indexOf(key) >= 0 && typeof value === 'number' && isFinite(value)) {
            put(key, value, now || Date.now());
        }
    }

    var peakBoost = 0, peakLat = 0, peakLon = 0, lastPeak = 0;

    function raw(now, tankLitres) {
        now = now || Date.now();
        /* the tank is read slowly; holding it stops the gauge blinking
           between a number and dashes between polls */
        var litres = held('fuelLitres');
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
            program: held('program'),
            boostBar: boost,
            boostPeakBar: peakBoost,
            oilTempC: get('oilTempC', now),
            oilPressBar: get('oilPressBar', now),
            coolantC: get('coolantC', now),
            fuelPct: typeof litres === 'number' && tankLitres
                ? Math.max(0, Math.min(100, litres / tankLitres * 100)) : undefined,
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
            gLat: gOk ? lat : undefined, gLon: gOk ? lon : undefined,
            gPeakLat: gOk ? peakLat : undefined, gPeakLon: gOk ? peakLon : undefined
        };
    }

    return {
        receive: receive, raw: raw,
        setBoostBar: setBoostBar, hasBusBoost: hasBusBoost,
        setOilPressureBar: setOilPressureBar, setAccel: setAccel,
        setFeed: setFeed
    };
}

module.exports = {
    SIGNALS: SIGNALS,
    createReader: createReader,
    scaled: scaled, stageOf: stageOf, gearText: gearText, gearStaged: gearStaged, programOf: programOf,
    selectionOf: selectionOf, conditionOf: conditionOf,
    driveModeOf: driveModeOf, phevModeOf: phevModeOf, mEngineModeOf: mEngineModeOf, clockOffset: clockOffset,
    averageL100: averageL100
};
