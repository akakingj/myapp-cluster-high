'use strict';
/*
 * Runs the app's own page off the car: the staged app
 * (apps/mgustyles_ak/main.js) exactly as it is, with the kit's recorder
 * and stand-ins for what only the head unit can give - the settings store,
 * the cluster service, and the kit's display (the finger, the controller).
 * tools/page-shot.js draws from it; test/page.test.js presses its places.
 *
 *   const page = require('./page-harness').open({ values: { style: 'mplus' }, own: true });
 *   page.shot()            the last frame drawn (a kit Recorder: .targets, .words())
 *   page.run('tab:toro')   press a place, as a finger or the controller would
 *   page.touch(1, x, y)    a finger: 1 down, 2 move, 3 up (page px)
 *   page.focus(key)        the controller lands on a place
 *   page.back(edge)        the controller pushed left
 *   page.click('BTN_SHOW') one of the HMI's bar buttons
 *   page.values            the settings as they stand
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'apps', 'mgustyles_ak');
const KIT = path.join(ROOT, 'kit', 'runtime');
const { Recorder } = require(path.join(KIT, 'record.js'));
const EXTRA = 80;               /* 720 / 1.2 - 520: the rows "fill" leaves below the page (kit/runtime/display.js) */

/* the app asks the kit to run it: keep what it hands over instead; its other kit modules are the kit's own */
function loadApp() {
    let app = null;
    const main = path.join(APP, 'main.js');
    const load = Module._load;
    Module._load = function (request, parent, isMain) {
        if (parent && parent.filename === main && /^\.\/kit\//.test(request)) {
            if (request === './kit/mgu') return { run(a) { app = a; } };
            return load.call(this, path.join(KIT, request.slice(6)), parent, isMain);
        }
        return load.call(this, request, parent, isMain);
    };
    try {
        delete require.cache[main];
        require(main);
    } finally { Module._load = load; }
    if (!app || typeof app.start !== 'function') throw new Error('the app did not hand a page over');
    return app;
}

/*
 * opts: { values: settings laid over the app's defaults, own: the kit runs
 *         the screen (default true), centre: what the service reports
 *         ('idle': no map from the phone), status: the service's line }
 */
function open(opts) {
    opts = opts || {};
    const own = opts.own !== false;
    const spec = JSON.parse(fs.readFileSync(path.join(APP, 'app.json'), 'utf8'));
    const items = spec.settings || [];
    const values = {};
    items.forEach((s) => { values[s.key] = s.default; });
    values.enabled = true;
    Object.assign(values, opts.values || {});

    let shot = null, frame = null, sheet = null;
    const listeners = [], handlers = {}, clicks = {}, hidden = {}, closed = [];
    const centreKey = () => ({ toro: 'tCentre', track: 'mCentre', mplus: 'pCentre' }[values.style] || 'tCentre');
    function centreInfo() {
        const want = values[centreKey()];
        const up = opts.centre !== 'idle';
        return {
            waze: up ? 'Phone map on the cluster' : 'No map from the phone yet',
            turnView: want === 'camera' ? 'Turn View camera showing' : 'No route',
            wazeUp: want === 'waze' && up, cameraUp: want === 'camera', want,
            mode: want === 'map' || (want === 'waze' && up) ? 'map' : want === 'camera' ? 'camera' : 'neutral'
        };
    }
    const settings = {
        schema: items,
        get: (k) => values[k],
        /* set by the Car profile (opts.held: the settings it holds) */
        held: (k) => (opts.held || []).indexOf(k) >= 0,
        set(k, v) { values[k] = v; listeners.slice().forEach((fn) => fn(k, v)); },
        item: (k) => items.find((s) => s.key === k),
        shown: (s) => !!s && !s.hidden,
        display(k) { const s = this.item(k), o = s && s.options && s.options.find((q) => q[0] === String(values[k])); return o ? o[1] : String(values[k]); },
        cycle() {},
        onChange(fn) { listeners.push(fn); }
    };
    const mStyle = () => values.style === 'track' || values.style === 'mplus';
    const ctx = {
        spec,
        ui: {
            image(name, cv) { shot = cv; },
            onClick(id, fn) { clicks[id] = fn; },
            onVisible() {},
            close(name) { closed.push(name); return Promise.resolve(); }
        },
        settings,
        background: opts.service === null ? null : {
            status: () => opts.status || (values.enabled ? 'On the cluster' : 'Off - BMW original cluster'),
            centre: centreInfo,
            feed: () => (mStyle() ? 'BeeM-Flash: 9 channels' : 'BeeM-Flash: oil pressure, G')
        },
        loop(name, hz, fn) { frame = fn; return { kick() { fn(); } }; },
        canvas(w, h) {
            const r = new Recorder(w, h + (own ? EXTRA : 0), { textScale: own ? 1.2 : 1 });
            r.own = own;
            r.extra = own ? EXTRA : 0;
            return r;
        },
        onLayout() {},
        hideButton(id, hide) { hidden[id] = hide !== false; },
        sheet(sh) { if (!own) return false; sheet = sh; return true; }
    };
    if (own) {
        ctx.onTouch = (fn) => { handlers.touch = fn; };
        ctx.onBack = (fn) => { handlers.back = fn; };
        ctx.onPageFocus = (fn) => { handlers.focus = fn; };
        ctx.focus = (key) => { handlers.focused = key; };
    }
    loadApp().start(ctx);
    if (!shot) throw new Error('the page drew nothing');

    const target = (key) => (shot.targets || []).find((t) => t.key === key);
    return {
        own, spec, values, settings, EXTRA,
        shot: () => shot,
        frame: () => frame(),
        targets: () => (shot.targets || []).slice(),
        target,
        run(key) {
            const t = target(key);
            if (!t) throw new Error('no place "' + key + '" on this page (' + (shot.targets || []).map((q) => q.key).join(' ') + ')');
            t.run();
            frame();
        },
        touch(phase, x, y) { const r = handlers.touch ? handlers.touch(phase, x, y) : false; frame(); return r; },
        focus(key) { if (handlers.focus) handlers.focus(key); frame(); },
        back(edge) { const r = handlers.back ? handlers.back(!!edge) : false; frame(); return r; },
        click(id) { if (!clicks[id]) throw new Error('no handler for ' + id); clicks[id](); frame(); },
        sheet: () => sheet,
        closeSheet() { const sh = sheet; sheet = null; if (sh && sh.onClose) sh.onClose(); frame(); },
        hidden, closed, focused: () => handlers.focused
    };
}

module.exports = { open, EXTRA, ROOT, APP, KIT };
