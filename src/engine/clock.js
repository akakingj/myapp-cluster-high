(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUClock = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /*
     * The clock every animated layer runs on: u_time, sent by us.
     *
     * cluster-render can feed u_time itself ("time": 1): an animation the
     * instrument cluster plays on its own clock. On the car this is built
     * for it never ran - two photographs six minutes apart show the snow in
     * the same places - so nothing that moved by it moved: the snow, the
     * limiter's flash, the shift lights' strobe, a gauge's alarm. The
     * head unit's clock does run, and the needles prove uniforms arrive, so
     * the time goes the same way as every other reading: a uniform, sent
     * only to the layers that are animating at that moment.
     *
     * It runs from 0 to PERIOD seconds and starts again. Nine seconds is a
     * whole number of every cycle the shaders make of it (the 9 Hz strobe,
     * the 0.9 s burst, the whole-Hz pulses, the tree's 3 s and 4.5 s
     * twinkles), so the turn-over is not seen - and the number stays small
     * enough for any float the cluster's GPU has.
     *
     * A shader that reads u_time is listed here with the uniform that says
     * it is animating (none: it always is) and, where slower will do, how
     * often it needs the time. test/clock.test.js holds this list to the
     * shader sources: one that reads u_time and is not listed fails there,
     * not on the car.
     */
    var PERIOD_MS = 9000;

    var GATES = {
        shiftbar: { gate: 'u_strobe' },     /* the shift lights at the limit */
        flash: { gate: 'u_on' },            /* the limiter's flash */
        flashPart: { gate: 'u_on' },        /* ... in pieces, over a lowered style */
        dial: { gate: 'u_warn' },           /* Toro's dial at the limiter */
        mgauge: { gate: 'u_warn' },         /* the M rev rail at the limiter */
        mgauge6: { gate: 'u_warn' },        /* ... and a diesel's (the same dial, 0 - 6) */
        mtgauge: { gate: 'u_warn' },        /* M Track Mode's rev counter at the limiter */
        mtgauge6: { gate: 'u_warn' },       /* ... and a diesel's */
        vbar: { gate: 'u_alarm' },
        gauge: { gate: 'u_alarm' },
        hgauge: { gate: 'u_alarm' },
        xtree: { hz: 15 }                   /* the holiday tree's twinkle */
    };

    /* the time for a shader, in seconds: 0 .. PERIOD, stepped at hz when given */
    function seconds(nowMs, hz) {
        var ms = ((Number(nowMs) || 0) % PERIOD_MS + PERIOD_MS) % PERIOD_MS;
        if (hz > 0) { var step = 1000 / hz; ms = Math.floor(ms / step + 1e-6) * step; }
        return ms / 1000;
    }

    /* is a layer of this shader animating, given the uniforms it has just made? */
    function running(shader, u) {
        var g = GATES[shader];
        if (!g) return false;
        if (!g.gate) return true;
        var v = u ? u[g.gate] : 0;
        return typeof v === 'number' ? v > 0 : !!v;
    }

    /* u_time for a layer now, or null when it is not animating (nothing to send) */
    function timeFor(shader, u, nowMs) {
        if (!running(shader, u)) return null;
        return seconds(nowMs, GATES[shader].hz);
    }

    return { PERIOD_MS: PERIOD_MS, GATES: GATES, seconds: seconds, running: running, timeFor: timeFor };
}));
