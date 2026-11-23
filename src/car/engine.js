'use strict';
/*
 * Readings the car's bus does not carry, asked of the engine unit itself:
 * oil pressure, the intake air's temperature, the battery's voltage - and
 * boost, for a car whose Sport Display sends none. For a head unit without
 * BeeM-Flash, whose feed (src/car/feed.js) supplies the same readings.
 *
 * READ ONLY, and lightly.
 *   - The link is the kit's read-only one (kit/runtime/readonly-diag.js): it
 *     refuses everything but UDS 22 (ReadDataByIdentifier) and OBD 01 / 09
 *     before a request leaves the head unit. Nothing here could write to the
 *     car if it tried.
 *   - One request at a time, to one unit: the engine unit, 0x12.
 *   - Only while the service says so (tick's `allowed`, src/car/main.js):
 *     our layers up, the car on, THE ENGINE RUNNING (or stopped by auto
 *     start-stop with the car still in drive readiness) - never parked,
 *     where requests would keep the car's networks awake, and never with
 *     the ignition on and the engine off, which is when a control unit is
 *     coded or flashed. And never while BeeM-Flash is feeding, nor - on the
 *     automatic setting - on a head unit that has BeeM-Flash at all: it has
 *     the readings, and the link.
 *   - Only what a style is showing: a reading nobody shows is never asked.
 *   - A reading that gets no answer three times is asked once a minute.
 *
 * WHERE THE IDENTIFIERS COME FROM. Every one below is published in the
 * open projects this app is built on, and is listed with its source in
 * docs/ENGINE-READINGS.md; test/engine.test.js holds this file to that
 * list. None is taken from BeeM-Flash's own tables, and nothing that only
 * BeeM-Flash knows belongs here.
 *
 * Candidates are in the kit's form (kit/runtime/dids.js): tried in order,
 * the first that answers with a plausible number is kept and tried first
 * from then on. { did } is UDS 22, { obd } the same reading as an OBD-II
 * service 01 PID (SAE J1979: a public standard).
 *
 * Never throws. Node 8.
 */

var DME = 0x12;
var WAIT_MS = 600;            /* how long one request waits for its answer */

function c(o) { o.ecu = DME; o.timeoutMs = WAIT_MS; if (o.at === undefined) o.at = 0; return o; }

var CANDIDATES = {
    /* oil pressure, absolute, hPa */
    oilAbs: [
        c({ did: '4436', bytes: 2, factor: 1, min: 300, max: 20000 }),
        c({ did: '586F', bytes: 2, factor: 1, signed: true, min: 300, max: 20000 })
    ],
    /* the engine unit's own ambient pressure, hPa: what the oil's is measured against */
    ambient: [
        c({ did: '4201', bytes: 2, factor: 0.0390625, min: 500, max: 1100 }),
        c({ did: 'F433', bytes: 1, factor: 10, min: 500, max: 1100 }),
        c({ obd: '33', bytes: 1, factor: 10, min: 500, max: 1100 })
    ],
    /* intake air temperature, C (below -45 is an unset sensor, not a reading) */
    iat: [
        c({ did: '580F', bytes: 1, factor: 0.75, offset: -48, min: -45, max: 150 }),
        c({ did: 'F40F', bytes: 1, factor: 1, offset: -40, min: -40, max: 150 }),
        c({ obd: '0F', bytes: 1, factor: 1, offset: -40, min: -40, max: 150 })
    ],
    /* battery voltage, V: the battery sensor's, else the engine unit's own supply */
    volts: [
        c({ did: '5853', bytes: 2, factor: 0.001, min: 5, max: 18 }),
        c({ did: 'F442', bytes: 2, factor: 0.001, min: 5, max: 18 }),
        c({ obd: '42', bytes: 2, factor: 0.001, min: 5, max: 18 })
    ],
    /* boost, absolute, kPa - and the barometer it is taken over, kPa */
    boostAbs: [
        c({ did: '580B', bytes: 2, factor: 0.00390625, min: 20, max: 400 }),
        c({ did: 'F470', bytes: 2, at: 3, factor: 0.03125, min: 20, max: 600 }),
        c({ obd: '70', bytes: 2, at: 3, factor: 0.03125, min: 20, max: 600 }),
        c({ obd: '0B', bytes: 1, factor: 1, min: 20, max: 255 })
    ],
    baro: [
        c({ did: 'F433', bytes: 1, factor: 1, min: 50, max: 115 }),
        c({ obd: '33', bytes: 1, factor: 1, min: 50, max: 115 })
    ]
};

/*
 * A DIESEL (the owner's "Engine" setting) has a DDE for its engine unit, not
 * the DME 8 that BMW's own identifiers above belong to: what those numbers
 * answer with on a DDE, none of the open projects has published. So a diesel
 * is asked only the standard forms - the OBD-II service 01 PIDs and the same
 * PIDs through UDS (F4xx) - which mean the same on every engine. Oil
 * pressure has no standard form: a diesel is not asked for it at all.
 */
function isStandard(x) { return !!x.obd || /^F4/i.test(String(x.did)); }
var STANDARD = {};
Object.keys(CANDIDATES).forEach(function (name) { STANDARD[name] = CANDIDATES[name].filter(isStandard); });
/* the candidates each reading is read through, first to last (boost and oil are taken over a second one) */
var LISTS = { boost: 'boostAbs', oil: 'oilAbs', iat: 'iat', volts: 'volts' };

/*
 * The readings: how often each is asked while it is shown, and how long a
 * value is kept once read (a few asks: one missed answer does not blank a
 * gauge).
 */
var READINGS = {
    boost: { everyMs: 250, keepMs: 1500, words: 'boost' },
    oil: { everyMs: 500, keepMs: 2500, words: 'oil pressure' },
    iat: { everyMs: 2000, keepMs: 9000, words: 'intake air' },
    volts: { everyMs: 5000, keepMs: 21000, words: 'battery' }
};
var ORDER = ['boost', 'oil', 'iat', 'volts'];
var SLOW_MS = 60000;          /* ambient pressure and the barometer: once a minute */
var MISS_LIMIT = 3;           /* answers missed in a row before a reading goes quiet */
var RETRY_MS = 60000;         /* ... and is then asked this often */
var STANDARD_BARO = 101.3;    /* kPa, until the engine unit has told us its own */

function known(v) { return typeof v === 'number' && isFinite(v); }

/*
 * opts: {
 *   open()   -> { reader, link, ready } | null: the kit's DidReader on its
 *               ReadOnlyDiag, made by the app shell (app/entry.js). Called
 *               once, the first time a reading is really wanted.
 *   log, now
 * }
 */
function create(opts) {
    opts = opts || {};
    var log = opts.log || { info: function () {}, warn: function () {} };
    var nowFn = opts.now || Date.now;

    var d = null;                 /* { reader, link, ready } once opened */
    var openFailedAt = -Infinity; /* no link: tried again after RETRY_MS */
    var noLink = null;            /* why there is none, in words */
    var busy = false;
    var allowed = false;
    var stopped = false;
    var gen = 0;                  /* counted up when we stand down: an answer still on its way is dropped */

    var jobs = {};
    ORDER.forEach(function (k) {
        jobs[k] = { key: k, next: 0, misses: 0, value: undefined, at: -Infinity, told: null, asked: 0, answered: 0 };
    });
    var ambient = { value: undefined, at: -Infinity };      /* hPa */
    var baro = { value: STANDARD_BARO, at: -Infinity };     /* kPa */

    /*
     * Which identifiers are in use: all of them, or - for a diesel - the
     * standard ones alone. The reader remembers which candidate answered
     * under the name it is given, so each set is asked under names of its
     * own and a change of engine never tries a remembered place in the
     * other's list.
     */
    var diesel = false;
    function list(name) { return (diesel ? STANDARD : CANDIDATES)[name]; }
    function nameOf(name) { return diesel ? name + '.std' : name; }
    /* a reading with no identifier to ask in this set (a diesel's oil pressure) is never asked */
    function askable(key) { return list(LISTS[key]).length > 0; }
    function setDiesel(on) {
        on = !!on;
        if (on === diesel) return;
        diesel = on;
        /* another engine unit's answers are not this one's: start again (an answer still
           on its way is dropped, and the next ask waits for it as ever: one at a time) */
        gen++; cancel();
        ORDER.forEach(function (k) {
            var j = jobs[k];
            j.next = 0; j.misses = 0; j.value = undefined; j.at = -Infinity; j.told = null;
        });
        ambient.value = undefined; ambient.at = -Infinity;
        baro.value = STANDARD_BARO; baro.at = -Infinity;
        log.info('engine: ' + (on ? 'a diesel: only the standard identifiers are asked (no oil pressure)'
            : 'a petrol engine: BMW\'s identifiers first, then the standard ones'));
    }

    function open(now) {
        if (d) return d;
        if (!opts.open || now - openFailedAt < RETRY_MS) return null;
        try {
            d = opts.open();
            if (!d || !d.reader) { d = null; throw new Error('no diagnostic link on this head unit'); }
            noLink = null;
            log.info('engine: reading the engine unit, read-only');
        } catch (e) {
            d = null;
            openFailedAt = now;
            noLink = String(e && e.message || e);
            log.warn('engine: ' + noLink);
        }
        return d;
    }

    function wake() {
        try { if (d && d.link && d.link.wake) d.link.wake(DME); } catch (e) { /* the next ask says */ }
    }
    function cancel() {
        try { if (d && d.link && d.link.cancel) d.link.cancel(); } catch (e) { /* nothing queued */ }
    }

    /* each resolves with the reading in the unit the reader takes it in, or null */
    var READ = {
        oil: function (rd, now) {
            var first = now - ambient.at > SLOW_MS ? rd.value(nameOf('ambient'), list('ambient')) : Promise.resolve(null);
            return Promise.resolve(first).then(function (amb) {
                if (known(amb)) { ambient.value = amb; ambient.at = now; }
                return rd.value(nameOf('oilAbs'), list('oilAbs'));
            }).then(function (abs) {
                /* no ambient reading yet: no figure, rather than one against a guessed barometer */
                if (!known(abs) || !known(ambient.value)) return null;
                var bar = (abs - ambient.value) / 1000;
                if (bar < -0.1 || bar > 20) return null;
                return Math.max(0, bar);
            });
        },
        iat: function (rd) { return rd.value(nameOf('iat'), list('iat')); },
        volts: function (rd) { return rd.value(nameOf('volts'), list('volts')); },
        boost: function (rd, now) {
            var first = now - baro.at > SLOW_MS ? rd.value(nameOf('baro'), list('baro')) : Promise.resolve(null);
            return Promise.resolve(first).then(function (b) {
                if (known(b)) { baro.value = b; baro.at = now; }
                return rd.value(nameOf('boostAbs'), list('boostAbs'));
            }).then(function (abs) {
                return known(abs) ? (abs - baro.value) / 100 : null;       /* bar over atmosphere */
            });
        }
    };

    /* what answered a reading last: '4436', 'OBD 0F' ... (for the log) */
    function source(key) {
        var name = LISTS[key];
        try {
            var cand = list(name)[(d.reader.pick && d.reader.pick[nameOf(name)]) || 0];
            return cand.obd ? 'OBD ' + cand.obd : cand.did;
        } catch (e) { return '?'; }
    }

    function ask(job, now) {
        var mine = gen;
        busy = true;
        job.asked++;
        /* asked again after going quiet: the link stops asking a unit that did not answer, until woken */
        if (job.misses >= MISS_LIMIT) wake();
        Promise.resolve(d.ready).then(function () {
            if (mine !== gen) return undefined;
            if (d.link && d.link.available === false) return null;      /* the car's diagnostic service is not up */
            return READ[job.key](d.reader, now);
        }).then(function (v) {
            if (mine !== gen || v === undefined) return;                /* stood down meanwhile */
            var t = nowFn();
            if (known(v)) {
                job.value = v; job.at = t; job.misses = 0; job.answered++;
                job.next = t + READINGS[job.key].everyMs;
                if (job.told !== true) {
                    job.told = true;
                    log.info('engine: ' + READINGS[job.key].words + ' from the engine unit (' + source(job.key) + ')');
                }
            } else {
                job.misses++;
                job.next = t + (job.misses >= MISS_LIMIT ? RETRY_MS : READINGS[job.key].everyMs);
                if (job.misses === MISS_LIMIT && job.told !== false) {
                    job.told = false;
                    log.info('engine: no ' + READINGS[job.key].words + ' from the engine unit; asked again every minute');
                }
            }
        }).catch(function (e) {
            job.misses++;
            job.next = nowFn() + (job.misses >= MISS_LIMIT ? RETRY_MS : READINGS[job.key].everyMs);
            if (job.told !== false && job.misses >= MISS_LIMIT) {
                job.told = false;
                log.warn('engine: ' + READINGS[job.key].words + ': ' + (e && e.message || e));
            }
        }).then(function () { busy = false; });
    }

    return {
        /*
         * Once a frame. st: { allowed, needs: { oil, iat, volts, boost }, diesel }.
         * allowed is the service's whole say-so (see the top of this file);
         * needs is what the style on the cluster is showing; diesel is the
         * owner's "Engine" setting (only the standard identifiers are asked).
         */
        tick: function (now, st) {
            if (stopped) return;
            setDiesel(st && st.diesel);
            var ok = !!(st && st.allowed);
            if (!ok) {
                if (allowed) { allowed = false; gen++; cancel(); }
                return;
            }
            if (!allowed) {
                /* the engine has just started (or BeeM-Flash has stopped feeding): ask at once, a unit
                   that went quiet included */
                allowed = true;
                ORDER.forEach(function (k) { jobs[k].next = 0; if (jobs[k].misses >= MISS_LIMIT) jobs[k].misses = MISS_LIMIT - 1; });
                wake();
            }
            if (busy) return;
            var needs = st.needs || {}, due = null, i, j;
            for (i = 0; i < ORDER.length; i++) {
                j = jobs[ORDER[i]];
                if (!needs[j.key] || !askable(j.key) || now < j.next) continue;
                /* the one waiting longest for its turn */
                if (!due || now - j.next > now - due.next) due = j;
            }
            if (!due) return;
            if (!open(now)) return;
            ask(due, now);
        },
        /* what has been read and is still fresh; undefined where there is nothing to show */
        values: function (now) {
            function fresh(k) { var j = jobs[k]; return known(j.value) && now - j.at <= READINGS[k].keepMs ? j.value : undefined; }
            return { oilBar: fresh('oil'), iatC: fresh('iat'), batteryV: fresh('volts'), boostBar: fresh('boost') };
        },
        /* for the app's page: { state, have: [words], missing: [words] } */
        info: function (needs, now) {
            needs = needs || {};
            now = now === undefined ? nowFn() : now;
            var have = [], missing = [], wanted = 0;
            ORDER.forEach(function (k) {
                if (!needs[k] || !askable(k)) return;
                wanted++;
                var j = jobs[k];
                if (known(j.value) && now - j.at <= READINGS[k].keepMs) have.push(READINGS[k].words);
                else if (j.misses >= MISS_LIMIT) missing.push(READINGS[k].words);
            });
            var state = !wanted ? 'idle' : noLink ? 'nolink' : !allowed ? 'waiting'
                : have.length ? 'reading' : missing.length === wanted ? 'silent' : 'asking';
            return { state: state, have: have, missing: missing, why: noLink };
        },
        stop: function () { stopped = true; allowed = false; gen++; cancel(); },
        /* for tests */
        jobs: jobs
    };
}

/* every identifier asked, as 'DID 4436' / 'OBD 0F', for the docs and their test
   (standardOnly: what a diesel is asked) */
function identifiers(standardOnly) {
    var out = {}, from = standardOnly ? STANDARD : CANDIDATES;
    Object.keys(from).forEach(function (name) {
        out[name] = from[name].map(function (x) { return x.obd ? 'OBD ' + x.obd : 'DID ' + x.did; });
    });
    return out;
}

/*
 * The head unit's diagnostic transport, for the app's manifest: the same
 * entry every app that reads the car this way declares. Optional: a unit
 * without it installs the app all the same, and simply has no such readings.
 */
var INTERFACE = {
    'com.harman.infotainment.systemfunctions.tasu.tasu.InternalTasu': {
        _instances: 'SystemFunctionsInternalTasuInst1',
        _methods: ['sendTasuRequest'],
        _broadcasts: ['sendTasuResponse'],
        _optional: 'Oil pressure, intake air temperature and battery voltage read from the engine unit (read only), for cars without BeeM-Flash'
    }
};

module.exports = {
    create: create, DME: DME, CANDIDATES: CANDIDATES, STANDARD: STANDARD, READINGS: READINGS, ORDER: ORDER,
    MISS_LIMIT: MISS_LIMIT, RETRY_MS: RETRY_MS, SLOW_MS: SLOW_MS, WAIT_MS: WAIT_MS,
    identifiers: identifiers, INTERFACE: INTERFACE
};
