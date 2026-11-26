(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUReadings = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /*
     * What a place in an M style's footer can show: the readings
     * themselves, apart from where a style puts them. M Sport, M Sport
     * Plus and M Track Mode each lay their footer out to their own
     * reference frame; all of them fill its three places from this one
     * table, so a reading means the same thing - and has the same unit and
     * the same name - in each.
     *
     * The frames have the time, the range and the outside temperature
     * there, which the car's own bottom strip shows too, right under them:
     * so each place can be given something the strip does not have, or
     * nothing.
     */
    /* (the same readings AK Cluster Layouts' readout places offer: its READOUTS) */
    var KINDS = ['time', 'range', 'economy', 'outside', 'rpm', 'speed2', 'gear', 'boost', 'boostTarget', 'boostPeak', 'power',
                 'powerPeak', 'torque', 'oil', 'oilp', 'coolant', 'gearbox', 'iat', 'pedal', 'throttle', 'timing', 'hpfp', 'lpfp',
                 'volts', 'fuel', 'charge', 'hvtemp', 'kw', 'erange', 'trip', 'tripTime', 'odo', 'zero100', 'lastShift', 'off'];
    function kind(v, home) { return KINDS.indexOf(v) >= 0 ? v : home; }

    function known(v) { return v !== null && v !== undefined && v !== '' && v !== '--'; }

    /* what a reading needs read from the engine unit (src/car/engine.js: its needs), for a style's shows */
    var NEEDS = { oilp: 'oil', iat: 'iat', volts: 'volts', boost: 'boost', boostPeak: 'boost', boostTarget: 'boostTarget',
                  pedal: 'pedal', throttle: 'throttle', timing: 'timing', hpfp: 'hpfp', lpfp: 'lpfp', fuel: 'tank', gearbox: 'gearbox' };
    var ASKED = ['oil', 'boost', 'iat', 'volts', 'pedal', 'throttle', 'timing', 'boostTarget', 'hpfp', 'lpfp', 'tank', 'gearbox'];
    function shows(kinds) {
        var out = {};
        ASKED.forEach(function (k) { out[k] = false; });
        (kinds || []).forEach(function (k) { if (NEEDS[k]) out[NEEDS[k]] = true; });
        return out;
    }
    function infoOf(key) { return function (s) { return s.info && known(s.info[key]) ? s.info[key] : null; }; }

    /*
     * A reading for a place: its figures (null: nothing to show), its
     * unit, and what says which it is - a symbol, or a short word in
     * capitals before the figures. The frames' own three need neither.
     * face: the figures' face where the footer's figures have not the
     * letters (the gear's D, S, M); unitFace: the unit's (the per cent).
     *
     * opts: { u: the units shown (units.js), clock12 }
     */
    function table(opts) {
        var L = opts.u.labels, clock12 = !!(opts && opts.clock12);
        var DEG = L.temp;
        return {
            time: { value: function (s) { return known(s.clockText) ? s.clockText : null; },
                    unit: function (s) { return clock12 ? s.clockHalf : ''; } },
            range: { icon: 'r', value: function (s) { return known(s.rangeText) ? s.rangeText : null; },
                     unit: L.dist },
            outside: { value: function (s) {
                           if (!known(s.ambientText)) return null;
                           return s.ambientText.charAt(0) === '-' ? s.ambientText : '+' + s.ambientText;
                       }, unit: DEG },
            /* the trip computer's average: "l/100km" and "km/l" say so by themselves, and with a word
               before them would not fit the left place; "mpg" has the room and needs the word */
            economy: { tag: opts.u.econ === 'mpg' ? 'AVG' : null, value: infoOf('economy'),
                       unit: { l100: 'l/100km', kml: 'km/l', mpg: 'mpg' }[opts.u.econ] },
            iat: { tag: 'IAT', value: infoOf('iat'), unit: DEG },
            rpm: { value: infoOf('rpm'), unit: 'rpm' },
            oil: { tag: 'OIL', value: infoOf('oil'), unit: DEG },
            coolant: { tag: 'WATER', value: infoOf('coolant'), unit: DEG },
            boost: { tag: 'BOOST', value: infoOf('boost'), unit: L.press },
            volts: { tag: 'BATT', value: infoOf('volts'), unit: 'v' },
            /* a plug-in hybrid's or an electric car's own (General: Electric range) */
            erange: { tag: 'EV', value: infoOf('erange'), unit: L.dist },
            hvtemp: { tag: 'BATT', value: infoOf('hvtemp'), unit: DEG },
            charge: { tag: 'CHARGE', value: infoOf('charge'), unit: '' },  /* per cent: the face has no % */
            /* as Cluster Layouts names them: the gearbox oil, the engine's torque and power, the trip computer's
               distance and driving time, the odometer */
            gearbox: { tag: 'TRANS', value: infoOf('gearbox'), unit: DEG },
            torque: { tag: 'TQ', value: infoOf('torque'), unit: L.torque },
            power: { tag: 'PWR', value: infoOf('power'), unit: L.power },
            trip: { tag: 'TRIP', value: infoOf('trip'), unit: L.dist },
            tripTime: { tag: 'TIME', value: infoOf('tripTime'), unit: 'h' },
            odo: { tag: 'ODO', value: infoOf('odo'), unit: L.dist },
            /* the speed in the other unit; the gear with its programme (D4), in the footer's capitals */
            speed2: { value: infoOf('speed2'), unit: opts.u.speed === 'mph' ? 'km/h' : 'mph' },
            gear: { value: infoOf('gear'), unit: '', face: 'mb' },
            oilp: { tag: 'OILP', value: infoOf('oilp'), unit: L.press },
            boostTarget: { tag: 'TGT', value: infoOf('boostTarget'), unit: L.press },
            /* this drive's (src/car/drive.js): the unit says which peak */
            boostPeak: { tag: 'PEAK', value: infoOf('boostPeak'), unit: L.press },
            powerPeak: { tag: 'PEAK', value: infoOf('powerPeak'), unit: L.power },
            pedal: { tag: 'PEDAL', value: infoOf('pedal'), unit: '%', unitFace: 'mx' },
            throttle: { tag: 'THR', value: infoOf('throttle'), unit: '%', unitFace: 'mx' },
            timing: { tag: 'IGN', value: infoOf('timing'), unit: '°' },
            hpfp: { tag: 'HPFP', value: infoOf('hpfp'), unit: L.press },
            lpfp: { tag: 'LPFP', value: infoOf('lpfp'), unit: L.press },
            fuel: { tag: 'FUEL', value: infoOf('fuel'), unit: '%', unitFace: 'mx' },
            /* the drive battery's power, + out of it (its unit for its word: the words' face sets k and w into each other) */
            kw: { tag: 'KW', value: infoOf('kw'), unit: '' },
            zero100: { tag: opts.u.speed === 'mph' ? '0-60' : '0-100', value: infoOf('zero100'), unit: 's' },
            lastShift: { tag: 'SHIFT', value: infoOf('lastShift'), unit: 'rpm' }
        };
    }

    return { KINDS: KINDS, kind: kind, known: known, table: table, shows: shows, NEEDS: NEEDS };
}));
