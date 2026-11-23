'use strict';
/*
 * The centre's sources against fake Maps-on-cluster and Turn View services
 * on real Unix sockets: when the opening opens, that the phone's map is
 * only ever read (never moved: the service has no command for it any more,
 * and waiting for one is why the map never showed on the car), and that we
 * never stay connected to Turn View.
 */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const Centre = require('../src/car/centre.js');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'centre-')); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) {
    const end = Date.now() + (ms || 4000);
    while (Date.now() < end) { if (fn()) return true; await wait(25); }
    return false;
}

/*
 * Maps on cluster (waze-on-cluster): its status file, and its control
 * socket. `legacy`: an old service that still takes {"cmd":"start"} and
 * moves the map; the current one logs "unknown command" and does nothing.
 */
function fakeWaze(dir, opts) {
    opts = opts || {};
    const st = Object.assign({ ev: 'status', state: opts.state || 'showing', target: 'map', reason: '', cluster: 1, hud: 0 }, opts.status || {});
    const file = path.join(dir, 'status.json');
    const write = () => fs.writeFileSync(file, JSON.stringify(st));
    write();
    const tick = setInterval(write, 200);
    const cmds = [];
    const sock = path.join(dir, 'ctl.sock');
    const srv = net.createServer((c) => {
        c.setEncoding('utf8');
        c.on('data', (d) => {
            d.split('\n').filter(Boolean).forEach((l) => {
                const m = JSON.parse(l);
                cmds.push(m);
                if (opts.legacy && m.cmd === 'start') { st.target = m.target; write(); c.write('{"ok":true}\n'); }
            });
        });
        c.on('error', () => {});
    }).listen(sock);
    return { st, cmds, file, sock, write, close: () => { clearInterval(tick); srv.close(); } };
}

/* Turn View's tool: pushes its state on connect, takes 'set' */
function fakeTv(dir, init) {
    const state = { settings: { enabled: false }, status: { camera: 'off', route: 'none', maneuver: null } };
    Object.assign(state.status, init || {});
    let open = 0, maxOpen = 0, connects = 0;
    const sets = [];
    const sock = path.join(dir, 'tv.sock');
    const srv = net.createServer((c) => {
        open++; connects++; maxOpen = Math.max(maxOpen, open);
        c.on('close', () => { open--; });
        c.on('error', () => {});
        c.setEncoding('utf8');
        c.write(JSON.stringify({ state }) + '\n');
        c.on('data', (d) => {
            d.split('\n').filter(Boolean).forEach((l) => {
                const q = JSON.parse(l);
                if (q.op === 'set') {
                    sets.push(q.settings);
                    Object.assign(state.settings, q.settings);
                    state.status.camera = state.settings.enabled ? 'decoding' : 'off';
                    c.write(JSON.stringify({ state }) + '\n');
                }
            });
        });
    }).listen(sock);
    return { state, sets, sock, stats: () => ({ open, maxOpen, connects }), close: () => srv.close() };
}

function make(dir, w, t) {
    return Centre.create({ dataDir: dir, paths: { wazeStatus: w ? w.file : path.join(dir, 'none.json'), wazeCtl: w ? w.sock : path.join(dir, 'none.sock'), tvCtl: t ? t.sock : path.join(dir, 'none2.sock') } });
}

test('waze: the opening opens while the phone\'s map is on the cluster, and nothing is ever sent to its service', async (t) => {
    const dir = tmp(), w = fakeWaze(dir), c = make(dir, w, null);
    t.after(() => { c.stop(); w.close(); });
    c.start();
    await wait(300);
    assert.strictEqual(c.state().mode, 'neutral', 'shut while not wanted');
    c.want('waze');
    assert.ok(await until(() => c.info().wazeUp), c.info().waze);
    assert.ok(await until(() => c.state().open === 1), 'fully open');
    assert.strictEqual(c.state().mode, 'map');
    assert.match(c.info().waze, /on the cluster/);
    c.want('off');
    assert.ok(await until(() => c.state().open === 0 && c.state().mode === 'neutral'));
    await wait(1300);
    assert.deepStrictEqual(w.cmds, [], 'the map is where it always is: there is nothing to ask');
    assert.strictEqual(w.st.target, 'map');
});

test('waze: shut while the phone sends no map, open the moment it does, shut again when it stops', async (t) => {
    const dir = tmp(), w = fakeWaze(dir, { state: 'idle' }), c = make(dir, w, null);
    t.after(() => { c.stop(); w.close(); });
    c.start(); c.want('waze');
    await wait(1300);
    assert.strictEqual(c.state().mode, 'neutral', 'no map from the phone: the style stays whole');
    assert.match(c.info().waze, /No map from the phone/);
    assert.strictEqual(c.info().wazeUp, false);
    w.st.state = 'starting'; w.st.reason = 'the stock map holds the slot'; w.write();
    assert.ok(await until(() => c.state().mode === 'map'), 'it is on its way: open');
    assert.match(c.info().waze, /starting \(the stock map holds the slot\)/);
    w.st.state = 'showing'; w.st.reason = ''; w.write();
    assert.ok(await until(() => /on the cluster/.test(c.info().waze)));
    assert.ok(await until(() => c.state().open === 1));
    w.st.state = 'frozen'; w.write();
    await wait(1300);
    assert.strictEqual(c.state().mode, 'map', 'a frozen picture is still a picture');
    w.st.state = 'idle'; w.write();
    assert.ok(await until(() => c.state().mode === 'neutral' && c.state().open === 0), 'the phone stopped: shut');
    assert.deepStrictEqual(w.cmds, []);
});

test('waze: switched off in its own app, shown elsewhere, in error or not running - each is said, none opens', async (t) => {
    const cases = [
        [{ state: 'off' }, /switched off in Maps on cluster/],
        [{ state: 'showing', status: { cluster: 0 } }, /switched off in Maps on cluster/],
        [{ state: 'showing', status: { target: 'hud' } }, /shown by another app/],
        [{ state: 'error', status: { reason: 'cluster renderer not reachable' } }, /Maps on cluster: cluster renderer not reachable/],
        [{ state: 'unsupported' }, /car not supported/]
    ];
    for (const [opts, text] of cases) {
        const dir = tmp(), w = fakeWaze(dir, opts), c = make(dir, w, null);
        c.start(); c.want('waze');
        await wait(350);
        assert.match(c.info().waze, text);
        assert.strictEqual(c.state().mode, 'neutral', JSON.stringify(opts));
        assert.strictEqual(c.info().wazeUp, false);
        c.stop(); w.close();
    }
    const c2 = make(tmp(), null, null);
    c2.start(); c2.want('waze');
    await wait(300);
    assert.match(c2.info().waze, /not running/);
    assert.strictEqual(c2.state().mode, 'neutral');
    c2.stop();
    /* a status file nobody has written for a while: the service has gone */
    const dir3 = tmp(), w3 = fakeWaze(dir3);
    w3.close();
    const old = new Date(Date.now() - 60000);
    fs.utimesSync(w3.file, old, old);
    const c3 = make(dir3, w3, null);
    c3.start(); c3.want('waze');
    await wait(300);
    assert.match(c3.info().waze, /not running/);
    assert.strictEqual(c3.state().mode, 'neutral');
    c3.stop();
});

test('map: always open, whatever the phone is doing - BMW\'s own map, or the phone\'s when it takes over', async (t) => {
    for (const w0 of [null, { state: 'idle' }, { state: 'showing' }, { state: 'off' }]) {
        const dir = tmp(), w = w0 ? fakeWaze(dir, w0) : null, c = make(dir, w, null);
        c.start(); c.want('map');
        assert.strictEqual(c.state().mode, 'map', 'at once: ' + JSON.stringify(w0));
        assert.ok(await until(() => c.state().open === 1));
        assert.strictEqual(c.info().mode, 'map');
        if (w) assert.deepStrictEqual(w.cmds, []);
        c.want('off');
        assert.ok(await until(() => c.state().open === 0 && c.state().mode === 'neutral'));
        c.stop(); if (w) w.close();
    }
});

test('a map an earlier version moved into the panel is given back once, and then forgotten', async (t) => {
    /* an old service that still knows "start": the map really is in the panel */
    const dir = tmp(), w = fakeWaze(dir, { legacy: true, status: { target: 'panel' } });
    fs.writeFileSync(path.join(dir, 'centre.json'), JSON.stringify({ wazeMoved: true, tvEnabled: false }));
    const c = make(dir, w, null);
    t.after(() => { c.stop(); w.close(); });
    c.start();
    assert.ok(await until(() => w.st.target === 'map'), 'given back to its own slot');
    assert.deepStrictEqual(w.cmds, [{ cmd: 'start', target: 'map' }]);
    assert.ok(await until(() => JSON.parse(fs.readFileSync(path.join(dir, 'centre.json'))).wazeMoved === false));
    c.want('waze');
    assert.ok(await until(() => c.state().mode === 'map'));
    await wait(1300);
    assert.strictEqual(w.cmds.length, 1, 'nothing more, ever');

    /* a map somebody else put in the panel is not ours to move */
    const dir2 = tmp(), w2 = fakeWaze(dir2, { legacy: true, status: { target: 'panel' } }), c2 = make(dir2, w2, null);
    t.after(() => { c2.stop(); w2.close(); });
    c2.start(); c2.want('waze');
    await wait(1300);
    assert.deepStrictEqual(w2.cmds, []);
    assert.strictEqual(c2.state().mode, 'map', 'but it is in view, so the opening opens over it');

    /* the current service ignores the command: the note is cleared all the same */
    const dir3 = tmp(), w3 = fakeWaze(dir3);
    fs.writeFileSync(path.join(dir3, 'centre.json'), JSON.stringify({ wazeMoved: true, tvEnabled: false }));
    const c3 = make(dir3, w3, null);
    t.after(() => { c3.stop(); w3.close(); });
    c3.start();
    assert.ok(await until(() => JSON.parse(fs.readFileSync(path.join(dir3, 'centre.json'))).wazeMoved === false));
    assert.deepStrictEqual(w3.cmds, [], 'its map is in its own slot: nothing to send');
});

test('turn view: maneuvers become a turn card, with short connections only', async (t) => {
    const dir = tmp();
    const tv = fakeTv(dir, { route: 'active', maneuver: { kind: 'intersection', angle: 90, side: -1, exit: 0, text: '0.3 mi' } });
    const c = make(dir, null, tv);
    t.after(() => { c.stop(); tv.close(); });
    c.start(); c.want('turn');
    assert.ok(await until(() => c.state().mode === 'turn'));
    const m = c.state().maneuver;
    assert.deepStrictEqual(m, { kind: 'intersection', angle: 90, side: -1, exit: 0, text: '0.3 mi' });
    assert.strictEqual(c.state().open, 0, 'our own card: no window');
    await wait(2500);
    assert.ok(tv.stats().connects >= 2, 'polled again');
    assert.strictEqual(tv.stats().open, 0, 'no connection held between polls');
    assert.strictEqual(tv.stats().maxOpen, 1);
    assert.deepStrictEqual(tv.sets, [], 'turn card never switches Turn View on');
    tv.state.status.route = 'none';
    assert.ok(await until(() => c.state().mode === 'neutral', 4000), 'route ended: card goes');
});

test('turn view camera: switched on when chosen, off again when left', async (t) => {
    const dir = tmp(), tv = fakeTv(dir), c = make(dir, null, tv);
    t.after(() => { c.stop(); tv.close(); });
    c.start(); c.want('camera');
    assert.ok(await until(() => c.info().cameraUp), c.info().turnView);
    assert.deepStrictEqual(tv.sets, [{ enabled: true }]);
    assert.ok(await until(() => c.state().mode === 'camera' && c.state().open === 1));
    c.want('off');
    assert.ok(await until(() => tv.sets.length === 2));
    assert.deepStrictEqual(tv.sets[1], { enabled: false });
    assert.ok(await until(() => c.state().open === 0));
});

test('turn view camera: one the driver switched on is left on', async (t) => {
    const dir = tmp(), tv = fakeTv(dir), c = make(dir, null, tv);
    t.after(() => { c.stop(); tv.close(); });
    tv.state.settings.enabled = true; tv.state.status.camera = 'decoding';
    c.start(); c.want('camera');
    assert.ok(await until(() => c.info().cameraUp));
    c.want('off');
    await wait(2500);
    assert.deepStrictEqual(tv.sets, [], 'not ours to switch off');
});

test('the window closes before it changes picture', async (t) => {
    let clock = 0;
    const dir = tmp(), w = fakeWaze(dir);
    t.after(() => w.close());
    const c = Centre.create({ dataDir: dir, now: () => Date.now() + clock, paths: { wazeStatus: w.file, wazeCtl: w.sock, tvCtl: path.join(dir, 'x') } });
    c.start(); c.want('waze');
    assert.ok(await until(() => c.state().mode === 'map'));
    clock += Centre.OPEN_MS + 10;
    assert.strictEqual(c.state().open, 1);
    c.want('turn');                     /* no maneuver: neutral */
    const a = c.state();
    assert.strictEqual(a.mode, 'map', 'still the map while it closes');
    clock += Centre.CLOSE_MS / 2;
    const mid = c.state();
    assert.ok(mid.open > 0 && mid.open < 1, 'half closed: ' + mid.open);
    clock += Centre.CLOSE_MS;
    const end = c.state();
    assert.strictEqual(end.open, 0);
    assert.strictEqual(end.mode, 'neutral');
    c.stop();
});

test('the camera takes the slot from the map and gives it back: switching between them never leaves it on', async (t) => {
    const dir = tmp(), w = fakeWaze(dir), tv = fakeTv(dir), c = make(dir, w, tv);
    t.after(() => { c.stop(); w.close(); tv.close(); });
    c.start(); c.want('camera');
    assert.ok(await until(() => c.state().mode === 'camera'));
    assert.deepStrictEqual(tv.sets, [{ enabled: true }]);
    c.want('waze');                     /* the map again: our camera must let go of the slot */
    assert.ok(await until(() => tv.sets.length === 2), 'the camera we switched on is switched off');
    assert.deepStrictEqual(tv.sets[1], { enabled: false });
    assert.ok(await until(() => c.state().mode === 'map' && c.state().open > 0));
    c.want('map');
    await wait(1200);
    assert.strictEqual(tv.sets.length, 2, 'and stays off');
    assert.strictEqual(c.state().mode, 'map');
});

test('the opening fades: no faster than the eye can follow, and the whole way', () => {
    assert.ok(Centre.OPEN_MS >= 300 && Centre.OPEN_MS <= 700, 'opening: ' + Centre.OPEN_MS + ' ms');
    assert.ok(Centre.CLOSE_MS >= 180 && Centre.CLOSE_MS <= Centre.OPEN_MS, 'closing: ' + Centre.CLOSE_MS + ' ms');
    assert.deepStrictEqual(Centre.PREFS, ['waze', 'map', 'camera', 'turn', 'off']);
});
