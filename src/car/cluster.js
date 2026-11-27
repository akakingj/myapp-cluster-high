'use strict';
/*
 * Drives the theme on the instrument cluster through cluster-render.
 *
 * Every layer of the theme becomes one effect layer on the `panel` target.
 * Effect layers upload no pixels: the only thing that crosses the socket
 * after start-up is the uniforms that actually changed, a few hundred bytes
 * a frame against a 5500 KB/s budget shared with the whole head unit. That
 * includes the time: animation runs on a clock of ours (src/engine/clock.js).
 *
 * Node 8: no spread, no optional chaining, no template literals.
 */

var Prelude = require('../shaders/prelude.js');
var Panel = require('../geometry/panel.js');
var Clock = require('../engine/clock.js');

var TARGET = 'panel';
var EPS = 0.0005;

function same(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPS;
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) >= EPS) return false;
    }
    return true;
}

function copy(v) { return typeof v === 'number' ? v : v.slice(); }
/* the layers the service gives an app (cluster-render): the new ones and the old one held must fit */
var MAX_LAYERS = 64;

/*
 * opts: {
 *   cr,          a ClusterRender (or anything with the same surface)
 *   theme,       from src/theme/lambo.js
 *   shaders,     { id: fragment body }
 *   atlas,       assets/fonts/atlas.json
 *   atlasPixels, Buffer of w*h bytes, r8
 *   log          { info, warn }
 *   adopt        optional: the driver this one follows (a change of settings). Where every layer is as it had it
 *                (its id, shader, place, class and order), its layers and atlas are taken over as they are and only
 *                the uniforms are sent again; else it hands the cluster back first and this one builds its own.
 * }
 */
function create(opts) {
    var cr = opts.cr;
    var theme = opts.theme;
    var log = opts.log || { info: function () {}, warn: function () {} };

    var atlasRef = 0;
    var refs = {};        /* layer id -> ref */
    var sent = {};        /* layer id -> { uniform: lastValue } */
    var visible = {};     /* layer id -> bool */
    var built = false;
    var stopped = false;
    /* the layers go up hidden and show together on the first frame, once each has its values (as Cluster Layouts'
       engine.js): made visible one by one, the full-screen background stood alone - the cluster black - while the
       rest still had nothing to draw */
    var revealed = true;
    /* the driver before this one's last layer and its atlas, held until ours show (build, letGo) */
    var anchor = null;
    /* layer id -> { uniform: last value } the driver before this one sent: those the new settings leave out go
       back to 0 on the first frame (as a layer made new has them), not kept from the old settings */
    var stale = {};
    var CUT = theme.foot > Panel.BOTTOM_CUT ? theme.foot : Panel.BOTTOM_CUT;

    /* Sorted bottom to top; cluster-render draws by class then z. */
    var ordered = theme.layers.slice().sort(function (a, b) {
        return (a.z || 0) - (b.z || 0);
    });

    function send(id, ref, name, value) {
        var last = sent[id];
        if (last && same(last[name], value)) return 0;
        var values = typeof value === 'number' ? [value] : value;
        if (values.length > 4) cr.uniform(ref, name, values, { type: 'vec4' });
        else cr.uniform(ref, name, values);
        last[name] = copy(value);
        return 1;
    }

    /* What makes a layer the same layer on the renderer: everything build() sends for it but the uniforms. */
    function pixelRect(T) {
        var x0 = Math.floor(T.x), y0 = Math.floor(T.y);
        return Object.assign({}, T, { x: x0, y: y0,
            w: Math.ceil(T.x + T.w) - x0, h: Math.ceil(T.y + T.h) - y0 });
    }
    function keepOf(L) { return (L.belowCut || CUT >= L.y + L.h) ? 0 : Math.max(0, (CUT - L.y) / L.h); }
    /* (and the atlas: the start-up message in the owner's own words has letters of its own under it, words.js) */
    var shape = ['atlas|' + (opts.atlas.h || opts.atlas.size) + '|' + (opts.atlas.key || '')].concat(ordered.map(function (T) {
        var L = pixelRect(T);
        return [L.id, L.shader, L.klass || 'content', L.z || 0, L.x, L.y, L.w, L.h, keepOf(L)].join('|');
    })).join('\n');

    /* Taken over from the driver this one follows: its layers stay on the cluster, nothing is dropped or made. */
    function takeOver(prev) {
        var got = prev && prev.handOver ? prev.handOver(shape) : null;
        if (!got) return false;
        atlasRef = got.atlasRef; refs = got.refs; visible = got.visible;
        for (var i = 0; i < ordered.length; i++) {
            var L = pixelRect(ordered[i]);
            if (!refs[L.id]) continue;
            sent[L.id] = {};                 /* every uniform goes again: the settings changed them */
            base[L.id] = { x: L.x, y: L.y };
            if (got.sent[L.id]) stale[L.id] = got.sent[L.id];
        }
        built = true;
        log.info('cluster: settings changed, ' + Object.keys(refs).length + ' layers kept');
        return true;
    }

    /* true: the layers were taken over (their atlas is on the renderer already) */
    function build() {
        if (built) return false;
        var prev = opts.adopt;
        opts.adopt = null;
        if (prev) {
            if (takeOver(prev)) return true;
            /* another layout of layers: the old one keeps one of its layers up (and the atlas it draws with) until the
               new ones show (tick: revealed), so the cluster is never left empty - an empty target goes back to the
               stock HMI, and the cluster flashed the stock gauges at every such change (as Cluster Layouts' engine.js
               keeps one; the service gives an app 64 layers, so only while the new ones leave room for it) */
            anchor = ordered.length < MAX_LAYERS && prev.keepOne ? prev.keepOne() : null;
            if (!anchor) { try { prev.stop(); } catch (e) { log.warn('cluster: stop: ' + e); } }
        }
        /*
         * The atlas first: binds are refused until the asset exists, and the
         * service allows only 16 assets per client - over that it hands out a
         * ref and silently refuses it, so layers bound to it draw nothing.
         * One asset is all this theme needs.
         */
        atlasRef = cr.asset({
            target: TARGET, format: 'r8',
            w: opts.atlas.size, h: opts.atlas.h || opts.atlas.size,
            sampling: 'bilinear', wrap: 'clamp'
        });
        if (!atlasRef) { log.warn('cluster: the glyph atlas was refused'); letGo(); return false; }

        for (var i = 0; i < ordered.length; i++) {
            /* whole pixels on the wire: the renderer's rectangles are integers */
            var L = pixelRect(ordered[i]);
            var body = opts.shaders[L.shader];
            if (!body) { log.warn('cluster: no shader "' + L.shader + '"'); continue; }

            var ref = cr.effect({
                target: TARGET,
                klass: L.klass || 'content',
                z: L.z || 0,
                x: L.x, y: L.y, w: L.w, h: L.h,
                fs: Prelude.compose(body),
                /* no "time": the renderer's own clock for u_time never ran
                   on the car (src/engine/clock.js). u_time is a uniform of
                   ours, sent in tick() to the layers that are animating. */
                /* We never take the slot from the stock cluster by force and
                   we leave BMW's turn box alone. */
                contend: false,
                guide_hold: false,
                /* hidden until the first frame has given every layer its values (tick: revealed) */
                visible: false
            });
            if (!ref) { log.warn('cluster: layer "' + L.id + '" was refused'); continue; }

            refs[L.id] = ref;
            sent[L.id] = {};
            visible[L.id] = false;
            base[L.id] = { x: L.x, y: L.y };

            cr.uniform(ref, 'u_size', [L.w, L.h]);
            /*
             * How much of the layer survives the bottom-strip cut. The theme
             * keeps every layer above it, so this is 0 ("all of it") - but
             * the shader honours it, so a layout change cannot quietly start
             * covering the strip. (CUT: where the style ends - the strip's
             * top, or lower for a style the owner has had lowered into a
             * hidden strip's rows, theme.foot.)
             */
            cr.uniform(ref, 'u_keep', [keepOf(L)]);
            if (body.indexOf('u_atlas') >= 0) {
                cr.bind(ref, 'u_atlas', atlasRef);
                cr.uniform(ref, 'u_atlasSize', [opts.atlas.size, opts.atlas.h || opts.atlas.size]);
            }
        }
        built = true;
        revealed = false;
        log.info('cluster: ' + Object.keys(refs).length + ' layers, 1 asset');
        return false;
    }

    /* Called on every (re)connect: the client replays layers and uniforms
       itself, but the asset's bytes are ours to send. */
    function ready() {
        var took = build();
        if (atlasRef && !took) cr.pixels(atlasRef, null, opts.atlasPixels);
    }

    /*
     * The shake at the limiter: every layer but those marked `still` (the
     * full-screen background, the flash, the covers by the gear - their
     * edges would show the stock cluster, or reach where they must not)
     * is moved along the theme's path of jolts, a whole pixel at a time.
     *
     * The path is the theme's shakeKeys ("ms:x,y,z ..."), stepped from key
     * to key on the head unit's clock and sent as each layer's place. It
     * used to be handed to the renderer to play (an `animate`, looped) -
     * and like the renderer's clock for u_time, that never ran on the car
     * this is built for (src/engine/clock.js). A jolt is ten keys 40 ms
     * apart, so this costs one small message a layer 25 times a second,
     * and only while the limiter is hit.
     */
    var shakePath = parseKeys(theme.shakeKeys);
    var base = {};              /* layer id -> its own place { x, y } */
    var shaking = false, shakeFrom = 0, shakeAt = null;
    var calmFrames = 0;
    var SHAKE_HOLD = 12;        /* frames it keeps going after the limiter lets go */

    function parseKeys(str) {
        if (!str) return null;
        var keys = String(str).split(/\s+/).map(function (k) {
            var m = /^(\d+):(-?[\d.]+),(-?[\d.]+)/.exec(k);
            return m ? { t: Number(m[1]), x: Number(m[2]), y: Number(m[3]) } : null;
        }).filter(Boolean);
        return keys.length > 1 ? keys : null;
    }
    /* where the path is at a time: the last key reached, the path starting again at its end */
    function offsetAt(ms) {
        var len = shakePath[shakePath.length - 1].t;
        var t = len > 0 ? ((ms % len) + len) % len : 0, k = shakePath[0], i;
        for (i = 0; i < shakePath.length; i++) { if (shakePath[i].t <= t) k = shakePath[i]; }
        return { x: Math.round(k.x), y: Math.round(k.y) };
    }
    function moveAll(off) {
        if (shakeAt && shakeAt.x === off.x && shakeAt.y === off.y) return 0;
        shakeAt = off;
        var n = 0;
        for (var i = 0; i < ordered.length; i++) {
            var L = ordered[i], b = base[L.id];
            if (L.still || !refs[L.id] || !b) continue;
            cr.set(refs[L.id], { x: b.x + off.x, y: b.y + off.y });
            n++;
        }
        return n;
    }
    function shake(on, now) {
        if (!shakePath) return 0;
        if (on) {
            calmFrames = 0;
            if (!shaking) { shaking = true; shakeFrom = now; shakeAt = { x: 0, y: 0 }; }
        } else if (shaking && ++calmFrames >= SHAKE_HOLD) {
            shaking = false;
            return moveAll({ x: 0, y: 0 });         /* every layer back where it belongs */
        }
        return shaking ? moveAll(offsetAt(now - shakeFrom)) : 0;
    }

    /* One frame. Returns how many uniform messages went out. */
    function tick(state) {
        if (!built || stopped) return 0;
        var writes = 0;
        /* the first frame after the layers went up: every value sent first, then those with something to say shown together */
        var reveal = !revealed, show = [];
        if (theme.shake) writes += shake(!!theme.shake(state), state && state.now ? state.now : Date.now());
        for (var i = 0; i < ordered.length; i++) {
            var L = ordered[i];
            var ref = refs[L.id];
            if (!ref) continue;
            var u = L.uniforms ? L.uniforms(state, 0) : {};

            /* A layer with nothing to say is hidden rather than drawn blank. */
            if (u === null) {
                if (visible[L.id]) { cr.set(ref, { visible: false }); visible[L.id] = false; }
                continue;
            }
            if (!visible[L.id]) {
                if (reveal) show.push(L.id);
                else { cr.set(ref, { visible: true }); visible[L.id] = true; }
            }

            for (var k in u) {
                if (Object.prototype.hasOwnProperty.call(u, k)) {
                    writes += send(L.id, ref, k, u[k]);
                }
            }
            if (stale[L.id]) {
                var old = stale[L.id];
                delete stale[L.id];
                for (var n in old) {
                    if (!Object.prototype.hasOwnProperty.call(old, n) || n === 'u_time' ||
                        Object.prototype.hasOwnProperty.call(u, n)) continue;
                    writes += send(L.id, ref, n, typeof old[n] === 'number' ? 0 : old[n].map(function () { return 0; }));
                }
            }
            /* the clock, only to a layer that is animating now: a parked,
               quiet cluster still sends nothing */
            var t = Clock.timeFor(L.shader, u, state ? state.now : 0);
            if (t !== null) writes += send(L.id, ref, 'u_time', t);
        }
        if (reveal) {
            show.forEach(function (id) { cr.set(refs[id], { visible: true }); visible[id] = true; });
            revealed = true;
            letGo();                    /* the new layers are up: the old one held till now goes */
        }
        return writes;
    }

    /* The next driver takes these layers over when they are the same (its shape): this one lets go of them without
       dropping them. null: not the same, or nothing built - the next one builds its own. */
    function handOver(next) {
        if (!built || stopped || next !== shape) return null;
        if (shaking) moveAll({ x: 0, y: 0 });       /* every layer back where it belongs */
        var got = { atlasRef: atlasRef, refs: refs, visible: visible, sent: sent };
        stopped = true;
        refs = {}; sent = {}; visible = {}; base = {}; stale = {}; atlasRef = 0; built = false; revealed = true;
        shaking = false; shakeAt = null; calmFrames = 0;
        return got;
    }

    /* The driver before this one's last layer and atlas (keepOne), held while ours go up: dropped once they show. */
    function letGo() {
        if (!anchor) return;
        try { cr.drop(anchor.ref); if (anchor.atlasRef) cr.drop(anchor.atlasRef); } catch (e) { log.warn('cluster: drop: ' + e); }
        anchor = null;
    }

    /* For the next driver, of another layout of layers: every layer dropped but the lowest one showing (the
       background, as a rule), which with the atlas is handed over to be dropped once the next one's layers show;
       null when nothing shows. This driver is stopped after it. */
    function keepOne() {
        if (!built || stopped) return null;
        if (shaking) moveAll({ x: 0, y: 0 });
        var keep = null;
        for (var i = 0; i < ordered.length && !keep; i++) {
            var id = ordered[i].id;
            if (refs[id] && visible[id]) keep = id;
        }
        if (!keep) return null;
        var got = { ref: refs[keep], atlasRef: atlasRef };
        delete refs[keep];
        atlasRef = 0;
        stop();
        return got;
    }

    /* Hand the cluster back to BMW. */
    function stop() {
        letGo();
        stopped = true;
        for (var id in refs) {
            if (Object.prototype.hasOwnProperty.call(refs, id)) cr.drop(refs[id]);
        }
        if (atlasRef) cr.drop(atlasRef);
        refs = {}; sent = {}; visible = {}; base = {}; atlasRef = 0; built = false; revealed = true;
        shaking = false; shakeAt = null; calmFrames = 0;
    }

    return {
        ready: ready, tick: tick, stop: stop, handOver: handOver, keepOne: keepOne,
        refs: function () { return refs; },
        isBuilt: function () { return built; },
        isRevealed: function () { return built && revealed; },
        isShaking: function () { return shaking; }
    };
}

module.exports = { create: create, TARGET: TARGET };
