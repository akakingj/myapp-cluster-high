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
    var KINDS = ['time', 'range', 'economy', 'outside', 'iat', 'rpm', 'oil', 'coolant', 'boost', 'volts',
                 'gearbox', 'torque', 'power', 'pedal', 'throttle', 'timing', 'trip', 'tripTime', 'odo', 'erange', 'charge', 'hvtemp', 'off'];
    function kind(v, home) { return KINDS.indexOf(v) >= 0 ? v : home; }

    function known(v) { return v !== null && v !== undefined && v !== '' && v !== '--'; }
    function infoOf(key) { return function (s) { return s.info && known(s.info[key]) ? s.info[key] : null; }; }

    /*
     * A reading for a place: its figures (null: nothing to show), its
     * unit, and what says which it is - a symbol, or a short word in
     * capitals before the figures. The frames' own three need neither.
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
            /* the engine unit's: the accelerator pedal and the throttle (per cent: the face has no %), the ignition angle */
            pedal: { tag: 'PEDAL', value: infoOf('pedal'), unit: '' },
            throttle: { tag: 'THROTTLE', value: infoOf('throttle'), unit: '' },
            timing: { tag: 'IGN', value: infoOf('timing'), unit: '°' }
        };
    }

    return { KINDS: KINDS, kind: kind, known: known, table: table };
}));
