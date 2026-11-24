'use strict';
/*
 * A change of settings (src/car/main.js reconfigure): the next driver takes the layers over where they stay the same
 * (cluster.js adopt), so nothing is dropped or made again and only the uniforms go; another layout of layers is
 * built new, after the old one has handed the cluster back.
 *
 * Run: node --test test/adopt.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');

const Driver = require('../src/car/cluster.js');
const Theme = require('../src/theme/index.js');
const atlas = require('../assets/fonts/atlas.json');
const State = require('../src/engine/state.js');
const Panel = require('../src/geometry/panel.js');
const Sim = require('../preview/sim.js');
const profile = Panel.profile('b48');
const frame = () => State.present(Sim.create(profile).raw(), profile, {});
const core = require('../src/shaders/core.js');
const parts = require('../src/shaders/parts.js');
const dialShaders = require('../src/shaders/dial.js');

const SHADERS = Object.assign({}, core, parts, dialShaders);
const PIXELS = Buffer.alloc(atlas.size * atlas.size);

function fakeCR() {
    const calls = { asset: [], effect: [], uniform: [], bind: [], set: [], drop: [], pixels: [] };
    let ref = 0;
    return {
        calls,
        asset(o) { calls.asset.push(o); return ++ref; },
        effect(o) { calls.effect.push(o); return ++ref; },
        uniform(r, name, values) { calls.uniform.push({ ref: r, name, values }); },
        bind(r, sampler, a) { calls.bind.push({ ref: r, sampler, asset: a }); },
        set(r, o) { calls.set.push({ ref: r, opts: o }); },
        drop(r) { calls.drop.push(r); },
        pixels(r, rects, px) { calls.pixels.push({ ref: r, bytes: px.length }); },
        reset() { Object.keys(calls).forEach((k) => { calls[k].length = 0; }); }
    };
}
const drive = (cr, theme, adopt) => Driver.create({ cr, theme, shaders: SHADERS, atlas, atlasPixels: PIXELS, adopt });

test('the same layers with other colours: taken over, nothing dropped, made or uploaded again', () => {
    const cr = fakeCR();
    const a = drive(cr, Theme.build(atlas, 'b48', { style: 'toro', accent: 'arancio' }));
    a.ready();
    a.tick(frame());
    const layers = cr.calls.effect.length;
    cr.reset();
    const t2 = Theme.build(atlas, 'b48', { style: 'toro', accent: 'verde' });
    assert.strictEqual(t2.layers.length, layers);
    const b = drive(cr, t2, a);
    b.ready();
    assert.deepStrictEqual([cr.calls.effect.length, cr.calls.asset.length, cr.calls.drop.length, cr.calls.pixels.length], [0, 0, 0, 0]);
    assert.strictEqual(Object.keys(b.refs()).length, layers);
    assert.strictEqual(Object.keys(a.refs()).length, 0, 'the old driver let go of them');
    const n = b.tick(frame());
    assert.ok(n > 0, 'the uniforms go again');
    a.stop();
    assert.strictEqual(cr.calls.drop.length, 0, 'the old driver no longer drops what it handed over');
});

test('another style: the old layers dropped first, the new ones built with their atlas', () => {
    const cr = fakeCR();
    const a = drive(cr, Theme.build(atlas, 'b48', { style: 'toro' }));
    a.ready();
    const old = cr.calls.effect.length + 1;            /* its layers and its atlas */
    cr.reset();
    const t2 = Theme.build(atlas, 'b48', { style: 'mplus' });
    const b = drive(cr, t2, a);
    b.ready();
    assert.strictEqual(cr.calls.drop.length, old);
    assert.strictEqual(cr.calls.asset.length, 1);
    assert.strictEqual(cr.calls.pixels.length, 1);
    assert.ok(cr.calls.effect.length > 0);
    assert.notStrictEqual(cr.calls.effect.length, old - 1);
});

test('a uniform the new settings leave out goes back to 0, as on a layer made new', () => {
    const cr = fakeCR();
    const layer = (u) => ({ id: 'one', shader: 'flat', x: 10, y: 10, w: 40, h: 20, uniforms: () => u });
    const sh = Object.keys(SHADERS).filter((k) => SHADERS[k].indexOf('u_atlas') < 0)[0];
    const th = (u) => ({ layers: [Object.assign(layer(u), { shader: sh })], foot: 0 });
    const a = drive(cr, th({ u_a: 1, u_b: [3, 4] }));
    a.ready(); a.tick({ now: 0 });
    cr.reset();
    const b = drive(cr, th({ u_a: 2 }), a);
    b.ready(); b.tick({ now: 10 });
    const got = {};
    cr.calls.uniform.forEach((c) => { got[c.name] = c.values; });
    assert.deepStrictEqual(got.u_a, [2]);
    assert.deepStrictEqual(got.u_b, [0, 0]);
    cr.reset();
    b.tick({ now: 20 });
    assert.strictEqual(cr.calls.uniform.length, 0, 'once only');
});

test('not built yet (the cluster off): nothing to take over, the next one builds its own', () => {
    const cr = fakeCR();
    const a = drive(cr, Theme.build(atlas, 'b48', { style: 'toro' }));
    const b = drive(cr, Theme.build(atlas, 'b48', { style: 'toro' }), a);
    b.ready();
    assert.strictEqual(cr.calls.asset.length, 1);
    assert.strictEqual(cr.calls.pixels.length, 1);
});
