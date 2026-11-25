'use strict';
/*
 * Runs the app's own page off the car: the staged app
 * (apps/akakingj_cluster_id8/main.js) exactly as it is, with the kit's recorder
 * and stand-ins for what only the head unit can give - the settings store,
 * the cluster service, and the kit's display (the finger, the controller).
 * tools/page-shot.js draws from it; test/page.test.js presses its places.
 *
 *   const page = require('./page-harness').open({ values: { style: 'mplus' }, own: true });
 *   page.shot()            the last frame drawn (a kit Recorder: .targets, .words())
 *   page.run('design:mplus')  press a place, as a finger or the controller would
 *   page.back()            the controller pushed left with nothing further left
 *   page.click('BTN_LOGS') one of the bar's buttons
 *   page.settings          the settings store (as the kit's, "when" included: the kit's list reads it)
 *   page.values            the settings as they stand
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'apps', 'akakingj_cluster_id8');
const KIT = path.join(ROOT, 'kit', 'runtime');
const { Recorder } = require(path.join(KIT, 'record.js'));

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
    const listeners = [], handlers = {}, clicks = {}, closed = [];
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
        shown: (s) => !!s && !s.hidden && Object.keys(s.when || {}).every((k) => [].concat(s.when[k]).indexOf(values[k]) >= 0),
        display(k) { const s = this.item(k), o = s && s.options && s.options.find((q) => q[0] === String(values[k])); return o ? o[1] : String(values[k]); },
        cycle() {},
        onChange(fn) { listeners.push(fn); }
    };
    const mStyle = () => values.style === 'track' || values.style === 'mplus';
    const ctx = {
        spec,
        dataDir: opts.dataDir,
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
            const r = new Recorder(w, h);
            r.own = own;
            return r;
        },
        onLayout() {},
        sheet(sh) { if (!own) return false; sheet = sh; return true; }
    };
    if (own) ctx.onBack = (fn) => { handlers.back = fn; };
    loadApp().start(ctx);
    if (!shot) throw new Error('the page drew nothing');

    const target = (key) => (shot.targets || []).find((t) => t.key === key);
    return {
        own, spec, values, settings,
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
        back() { const r = handlers.back ? handlers.back(true) : false; frame(); return r; },
        click(id) { if (!clicks[id]) throw new Error('no handler for ' + id); clicks[id](); frame(); },
        sheet: () => sheet,
        closeSheet() { const sh = sheet; sheet = null; if (sh && sh.onClose) sh.onClose(); frame(); },
        closed
    };
}

module.exports = { open, ROOT, APP, KIT };
