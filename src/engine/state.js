(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./units.js'));
    else root.MGUState = factory(root.MGUUnits);
}(typeof self !== 'undefined' ? self : this, function (Units) {
    'use strict';

    /*
     * Turns raw vehicle signals into what the theme draws. The car app and
     * the preview both go through here, so the simulator exercises exactly
     * the code that runs in the car.
     *
     * Raw signals use the canonical units the head unit reports:
     * km/h, rpm, degrees C, bar, km, percent.
     */

    var MI_PER_KM = 0.621371;
    var PSI_PER_BAR = 14.503774;

    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    function pad(n, w) {
        var s = String(Math.max(0, Math.floor(n)));
        while (s.length < w) s = '0' + s;
        return s;
    }

    /*
     * BMW's driving modes as the Lamborghini names its own: Strada for the
     * road, Sport, and Corsa for the track. 'bmw' shows BMW's own name;
     * 'fixed' always shows the mode setting's text.
     */
    var LAMBO = { COMFORT: 'STRADA', ECO_PRO: 'STRADA', ADAPTIVE: 'STRADA',
                  SPORT: 'SPORT', SPORT_PLUS: 'CORSA', TRACK: 'CORSA' };
    var BMW = { COMFORT: 'COMFORT', ECO_PRO: 'ECO PRO', ADAPTIVE: 'ADAPTIVE',
                SPORT: 'SPORT', SPORT_PLUS: 'SPORT+', TRACK: 'TRACK' };
    function modeLabelOf(mode, style, fallback) {
        if (style === 'fixed' || !mode) return fallback;
        var t = style === 'bmw' ? BMW : LAMBO;
        return t[mode] || fallback;
    }

    /*
     * The figures as the car's own cluster keeps them: the speed's digits move on once the reading is
     * 0.75 past the one shown (79 holds through 79.6 and 80.4 alike, not flicking between them), the
     * engine speed's once it is 15 rpm past, shown to the nearest ten. One held speed per unit, so a
     * change of unit starts afresh.
     */
    var held = { speed: null, speedUnit: '', rpm: null };
    function speedShown(v, unit) {
        if (held.speedUnit !== unit) { held.speedUnit = unit; held.speed = null; }
        if (held.speed === null || Math.abs(v - held.speed) >= 0.75) held.speed = Math.round(v);
        return held.speed;
    }
    function rpmShown(v) {
        if (held.rpm === null || Math.abs(v - held.rpm) >= 15) held.rpm = Math.round(v / 10) * 10;
        return held.rpm;
    }

    /*
     * The shift point and the red zone now, as Cluster Layouts and the Redline app work them (the Car
     * profile's Shift now warning at, Cold-engine rev guard, Cold rev limit, Oil is warm at): the shift point
     * opts.shiftAtRpm (palette.js: Auto, 300 under the red zone); with the cold-engine guard on, pulled down
     * to opts.coldLimit with the oil at 30 °C and climbing back as the oil reaches opts.warmOil, the red zone
     * keeping its distance to it. { rpm, red, cold }
     */
    function shiftPoint(opts, profile, oilC) {
        var red = opts.rpmRedline || profile.rpmRedline || 7000;
        var n = opts.shiftAtRpm || red - 300, before = red - n;
        var warm = opts.warmOil || 80;
        if (opts.coldGuard !== 'on' || !has(oilC) || oilC >= warm) return { rpm: n, red: red, cold: false };
        var cold = Math.min(opts.coldLimit || 4500, n), f = clamp01((oilC - 30) / Math.max(1, warm - 30));
        var at = Math.round((cold + (n - cold) * f) / 50) * 50;
        return { rpm: at, red: Math.max(2000, Math.min(red, at + Math.max(0, before))), cold: true };
    }
    /* A reading that has gone stale shows dashes rather than a stale number. */
    function has(v) { return typeof v === 'number' && isFinite(v); }

    function pod(frac, warn, alarm, text, col) {
        return { frac: clamp01(frac), warn: warn, alarm: alarm ? 1 : 0,
                 text: text, col: col };
    }

    var DANGER = [1.0, 0.141, 0.078];
    var COOL = [0.286, 0.600, 1.0];
    var LIT = [0.878, 0.945, 1.0];
    var GOLD = [1.0, 0.796, 0.173];
    /* a gauge with nothing to show. One object, not one a frame: nothing writes to a pod, and the
       drive battery's two are this on every frame of every car that is not electric */
    var NO_POD = pod(0, 2, 0, '--', LIT);

    /*
     * raw: { rpm, speedKmh, gear, driveMode, boostBar, boostPeakBar,
     *        oilTempC, oilPressBar, coolantC, fuelPct, odoKm, rangeKm,
     *        ambientC, clock: {h, m}, gLat, gLon, gPeakLat, gPeakLon }
     */
    function present(raw, profile, opts) {
        opts = opts || {};
        /* the units shown (units.js; palette.resolve has made them, else from opts as they come) */
        var U = opts.u || Units.of(opts);
        var dash = '--';
        var deg = function (c) { return String(Math.round(U.tempIn(c))); };

        var rpm = has(raw.rpm) ? raw.rpm : 0;
        var speed = U.speedIn(has(raw.speedKmh) ? raw.speedKmh : 0);

        /* The rev-limit warning, ramped in so it never snaps on. Where it
           starts and ends is a setting (src/theme/palette.js). */
        var limAt = opts.rpmLimiter || profile.rpmLimiter;
        var limFrom = opts.flashFromRpm || (limAt - 150);
        var limiter = clamp01((rpm - limFrom) / Math.max(1, limAt - limFrom));
        /* the shift point and the red zone now (shiftPoint, below) */
        var shift = shiftPoint(opts, profile, raw.oilTempC);

        /* boost in the pressure unit shown */
        var boostBar = has(raw.boostBar) ? raw.boostBar : 0;
        var boost = U.pressIn(boostBar);
        var boostPeak = U.pressIn(has(raw.boostPeakBar) ? raw.boostPeakBar : 0);

        /* ---- side pods ---- */
        var oilC = raw.oilTempC, oilP = raw.oilPressBar;
        var watC = raw.coolantC, fuel = raw.fuelPct;
        /*
         * Electric range (opts.electric: off | hybrid | bev; off unless
         * the owner turned it on - it has not been on an electric car of
         * ours). hybrid: the electric range is a reading of its own, beside
         * the fuel's. bev: there is no fuel, so the electric range is "the
         * range", and the battery's charge is what a fuel level shows.
         */
        var electric = opts.electric === 'hybrid' || opts.electric === 'bev' ? opts.electric : 'off';
        var evKm = electric !== 'off' && has(raw.evRangeKm) ? raw.evRangeKm : null;
        var soc = electric !== 'off' && has(raw.socPct) ? raw.socPct : null;
        var evText = evKm === null ? dash : String(Math.round(U.distIn(evKm)));
        if (electric === 'bev') fuel = soc === null ? undefined : soc;
        /* the battery as a gauge: the bar is its charge (or, with no charge
           reported, the range against a full one's), the figure the range */
        var EV_FULL_KM = electric === 'bev' ? 500 : 80;
        var battery = evKm === null && soc === null ? NO_POD
            : pod(soc !== null ? soc / 100 : evKm / EV_FULL_KM, 2,
                  soc !== null ? soc <= 10 : evKm <= EV_FULL_KM * 0.1,
                  evKm !== null ? evText : String(Math.round(soc)), LIT);
        /* the drive battery's temperature, on a scale of its own: -10 to 60 C */
        var hvC = electric !== 'off' && has(raw.hvTempC) ? raw.hvTempC : null;
        var HV_LO = -10, HV_SPAN = 70;
        var batteryTemp = hvC === null ? NO_POD
            : pod((hvC - HV_LO) / HV_SPAN, (50 - HV_LO) / HV_SPAN, hvC >= 50,
                  deg(hvC), hvC < 5 ? COOL : LIT);

        var oilTemp = has(oilC)
            ? pod((oilC - 50) / 120, (150 - 50) / 120, oilC >= 150,
                  deg(oilC),
                  oilC < 80 ? COOL : LIT)
            : pod(0, 2, 0, dash, LIT);

        var oilPress = has(oilP)
            ? pod(oilP / 10, 2, rpm > 1200 && oilP < 1.0, U.pressText(oilP, true), LIT)
            : pod(0, 2, 0, dash, LIT);

        var coolant = has(watC)
            ? pod((watC - 50) / 80, (115 - 50) / 80, watC >= 115,
                  deg(watC),
                  watC < 70 ? COOL : LIT)
            : pod(0, 2, 0, dash, LIT);

        var fuelPod = has(fuel)
            ? pod(fuel / 100, 2, fuel <= 10,
                  String(Math.round(fuel)), fuel <= 10 ? DANGER : GOLD)
            : pod(0, 2, 0, dash, GOLD);

        /* The second left dial: oil pressure when something can supply it. */
        var auxIsOil = has(oilP);
        var auxPress = auxIsOil
            ? pod(U.press === 'psi' ? oilP * PSI_PER_BAR / 140 : oilP / 10, 2, rpm > 1200 && oilP < 1.0,
                  U.pressText(oilP, true), LIT)
            : pod(boostBar * PSI_PER_BAR / 25, 2, 0, U.pressText(boostBar), LIT);

        /* ---- readouts ---- */
        var odoText = dash;
        if (has(raw.odoKm)) {
            odoText = pad(U.distIn(raw.odoKm), 6);
        }
        var rangeText = electric === 'bev' ? evText
            : has(raw.rangeKm) ? String(Math.round(U.distIn(raw.rangeKm)))
            : dash;
        var ambientText = has(raw.ambientC)
            ? (U.temp === 'f' ? deg(raw.ambientC) : raw.ambientC.toFixed(1))
            : dash;

        /*
         * What else a footer can show, each as its figures alone (the
         * style adds the unit): dashes where the car - or the app that
         * supplies it - is not saying.
         */
        var info = {
            /* engine speed to the nearest ten, held (rpmShown): a last digit that flickers reads as noise */
            rpm: has(raw.rpm) ? String(rpmShown(Math.max(0, raw.rpm))) : dash,
            /* the trip computer's average, in the units chosen here */
            economy: has(raw.avgL100) && raw.avgL100 > 0
                ? U.econIn(raw.avgL100).toFixed(1) : dash,
            iat: has(raw.iatC) ? deg(raw.iatC) : dash,
            oil: has(oilC) ? deg(oilC) : dash,
            coolant: has(watC) ? deg(watC) : dash,
            boost: has(raw.boostBar) ? U.pressText(raw.boostBar) : dash,
            volts: has(raw.batteryV) ? raw.batteryV.toFixed(1) : dash,
            /* electric range, and the drive battery's charge in per cent */
            erange: evText,
            charge: soc === null ? dash : String(Math.round(soc)),
            hvtemp: hvC === null ? dash : deg(hvC),
            /* the gearbox oil; the engine's torque and power (power from the torque and the revs) */
            gearbox: has(raw.gearboxC) ? deg(raw.gearboxC) : dash,
            torque: has(raw.torqueNm) ? String(Math.round(U.torqueIn(raw.torqueNm))) : dash,
            power: has(raw.torqueNm) && has(raw.rpm) ? String(Math.round(U.powerIn(raw.torqueNm * raw.rpm / 9549))) : dash,
            /* the trip computer's distance and driving time (h:mm), the odometer */
            trip: has(raw.tripKm) ? U.distIn(raw.tripKm).toFixed(U.distIn(raw.tripKm) < 1000 ? 1 : 0) : dash,
            tripTime: has(raw.tripMin) ? Math.floor(raw.tripMin / 60) + ':' + pad(raw.tripMin % 60, 2) : dash,
            odo: has(raw.odoKm) ? String(Math.round(U.distIn(raw.odoKm))) : dash
        };

        var clockText = dash, clockHalf = '';
        if (raw.clock && has(raw.clock.h)) {
            var h = raw.clock.h, m = raw.clock.m || 0;
            clockHalf = h < 12 ? 'am' : 'pm';
            if (opts.clock12) {
                var hh = h % 12; if (hh === 0) hh = 12;
                clockText = hh + ':' + pad(m, 2);
            } else {
                clockText = pad(h, 2) + ':' + pad(m, 2);
            }
        }

        return {
            rpm: rpm,
            speed: speed,
            /* the speed's digits (speedShown); the needles and bars take speed */
            speedText: String(speedShown(Math.max(0, speed), U.speed)),
            gear: raw.gear || 'P',
            /* the gear with its programme, D1 / S1 / M1 (src/car/vehicle.js gearStaged; a bare figure is D's) */
            gearStaged: raw.gearStaged || (/^[1-9]$/.test(String(raw.gear)) ? 'D' + raw.gear : raw.gear || 'P'),
            driveMode: raw.driveMode || '',
            modeLabel: modeLabelOf(raw.driveMode, opts.modeLabel,
                                   opts.mode === undefined || opts.mode === null ? 'CORSA' : opts.mode),
            limiter: limiter,
            shiftRpm: shift.rpm,
            redRpm: shift.red,
            /* Shift now: the shift lights flash, the speed and the gear blink red (palette.js blinkOn) */
            shiftNow: !!opts.shiftWarn && rpm > 0 && rpm >= shift.rpm,
            boostPsi: boost,
            boostPeakPsi: boostPeak,
            gOk: has(raw.gLat) || has(raw.gLon),
            auxIsOil: auxIsOil,
            /* the meter's own axes: x to the right, y forward. The bus's
               lateral is ISO (left positive), so a right-hand turn - the
               car accelerating to the right - reads to the right */
            gX: has(raw.gLat) ? -raw.gLat : 0,
            gY: has(raw.gLon) ? raw.gLon : 0,
            gLat: has(raw.gLat) ? raw.gLat : 0,
            gLon: has(raw.gLon) ? raw.gLon : 0,
            gPeakLat: has(raw.gPeakLat) ? raw.gPeakLat : 0,
            gPeakLon: has(raw.gPeakLon) ? raw.gPeakLon : 0,
            pods: { oilTemp: oilTemp, oilPress: oilPress,
                    coolant: coolant, fuel: fuelPod, battery: battery, batteryTemp: batteryTemp,
                    /* the Huracan's second left dial is oil pressure. This
                       car does not publish it, so turbo pressure takes the
                       slot unless a feed supplies the real thing. */
                    auxPress: auxPress },
            odoText: odoText, rangeText: rangeText,
            clockText: clockText, clockHalf: clockHalf, ambientText: ambientText,
            /* the oil's own temperature, for a scale that is not the pod's */
            oilTempC: has(oilC) ? oilC : null,
            electric: electric,
            /* the drive battery's temperature as a fraction of its scale (null: none) */
            hvTempFrac: hvC === null ? null : (hvC - HV_LO) / HV_SPAN,
            /* the readings as numbers, in the car's own units (null: not known): for a
               style that sets them on scales of its own and says so (opts.numbers: M Track
               Mode's gauge rows). No other style is made them. */
            num: opts.numbers ? { boostBar: has(raw.boostBar) ? raw.boostBar : null,
                   coolantC: has(watC) ? watC : null, oilC: has(oilC) ? oilC : null,
                   iatC: has(raw.iatC) ? raw.iatC : null, oilBar: has(oilP) ? oilP : null,
                   volts: has(raw.batteryV) ? raw.batteryV : null, socPct: soc, hvC: hvC,
                   gearboxC: has(raw.gearboxC) ? raw.gearboxC : null } : null,
            info: info
        };
    }

    return { shiftPoint: shiftPoint, present: present, modeLabelOf: modeLabelOf,
             MI_PER_KM: MI_PER_KM, PSI_PER_BAR: PSI_PER_BAR };
}));
