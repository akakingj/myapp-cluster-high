'use strict';
/*
 * Taking turns on the cluster with the AK Cluster apps (akakingj/myapp-cluster).
 *
 * A full-panel layout says it is showing by touching a file in
 * /dev/shm/cluster-layouts, layouts.json ({ at, ... }), at most once a
 * second: AK Cluster Layouts does, and AK Cluster Centre steps aside while
 * the file is fresh (under 3 s old). This app says the same, with its own
 * id in it (app), so Centre steps aside for it too.
 *
 * It and Cluster Layouts take turns, the one that came up first keeping the
 * cluster: each also keeps a file of its own, named by its id, with since
 * (when it came up). While this one waits it stays off as long as Layouts'
 * file is fresh; while it shows it steps aside only if Layouts came up before
 * it (the same moment: the smaller id). An older Cluster Layouts, with no
 * file of its own and no app in layouts.json, never steps aside: this one
 * waits for it whenever layouts.json is fresh.
 *
 * Settings > Start on the cluster with the car (the Car profile's choice, or each
 * app's own): the app chosen says auto in its file and keeps the cluster from
 * the other whichever came up first (0.23.0: the lighter Layouts came up first
 * at every start, and this one, also on, waited).
 *
 * Node 8.
 */

var fs = require('fs');
var path = require('path');

var FRESH_MS = 3000;
var MARK_MS = 1000;
var LOOK_MS = 500;

/* opts: { app: this app's id, other: the app it takes turns with (AK Cluster Layouts), dir (default: CLUSTER_PRESENCE_DIR,
   else /dev/shm/cluster-layouts) } */
function create(opts) {
    opts = opts || {};
    var dir = opts.dir || process.env.CLUSTER_PRESENCE_DIR || '/dev/shm/cluster-layouts';
    var file = path.join(dir, 'layouts.json');
    var app = String(opts.app || '');
    var otherId = String(opts.other || 'akakingj_cluster_layouts');
    var own = path.join(dir, app + '.json'), theirs = path.join(dir, otherId + '.json');
    var markedAt = 0, lookedAt = -Infinity, other = false, madeDir = false;

    function write(f, body) {
        /* written whole: a temp file renamed over it */
        var tmp = f + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(body), { mode: 420 });
        try { fs.chmodSync(tmp, 420); } catch (e) { /* the mode given above */ }
        fs.renameSync(tmp, f);
    }
    /* this app is on the cluster (since: when it came up, by the wall clock; auto: started with the car): said again
       at most once a second */
    function mark(t, since, auto) {
        if (t - markedAt < MARK_MS) return;
        markedAt = t;
        try {
            /* (readable by the other apps, which run as other users: the folder 0755, the file 0644) */
            if (!madeDir) {
                try { fs.mkdirSync(dir, 493); } catch (e) { if (e.code !== 'EEXIST') throw e; }
                try { fs.chmodSync(dir, 493); } catch (e) { /* not ours */ }
                madeDir = true;
            }
            write(file, { app: app, at: Date.now() });
            write(own, { app: app, since: typeof since === 'number' ? since : Date.now(), auto: !!auto, at: Date.now() });
        } catch (e) { /* no tmpfs there: nothing shared */ }
    }

    function read(f) {
        try {
            var v = JSON.parse(fs.readFileSync(f, 'utf8'));
            return v && typeof v.at === 'number' && Math.abs(Date.now() - v.at) < FRESH_MS ? v : null;
        } catch (e) { return null; }      /* none, or one in the making: no one */
    }
    /* Cluster Layouts is on the cluster and keeps it from this one (since: when this one came up, null while it
       waits; auto: this one is started with the car - then only a Layouts also started with it, and up first, keeps
       it, and a Layouts that is keeps it from this one when it is not); looked at twice a second */
    var lookedFor, lookedAuto;
    function othersShowing(t, since, auto) {
        auto = !!auto;
        if (t - lookedAt < LOOK_MS && t >= lookedAt && lookedFor === since && lookedAuto === auto) return other;
        lookedAt = t; lookedFor = since; lookedAuto = auto;
        var v = read(theirs);
        if (v) {
            var at = typeof v.since === 'number' ? v.since : Infinity, theirsAuto = v.auto === true;
            other = theirsAuto !== auto ? theirsAuto
                : since === null || since === undefined || at < since || (at === since && otherId < app);
        } else {
            /* an older Cluster Layouts: no file of its own, no app in layouts.json */
            var l = read(file);
            other = !!l && l.app === undefined;
        }
        return other;
    }

    return { mark: mark, othersShowing: othersShowing, file: file };
}

module.exports = { create: create, FRESH_MS: FRESH_MS };
