'use strict';
/*
 * Shift now and the cold engine, as the Car profile sets them for every app that follows it (Shift now warning
 * at, Cold-engine rev guard, Cold rev limit, Oil is warm at): the shift lights flash from the shift point, the
 * speed and the gear blink red there, and while the oil is cold the shift point and the red zone come down.
 *   node --test test/shift.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const Panel = require('../src/geometry/panel.js');
const Themes = require('../src/theme/index.js');
const State = require('../src/engine/state.js');
const atlas = require('../assets/fonts/atlas.json');

const P = Panel.profile('carprofile');
const build = (style, cfg) => Themes.build(atlas, 'carprofile', Object.assign({ style }, cfg));
const layer = (t, id) => t.layers.find((L) => L.id === id);
const at = (t, rpm, oil, now) => Object.assign(State.present({ rpm, oilTempC: oil }, P, t.settings), { now: now || 0 });

test('Shift now at: off as it comes (the shift lights flash at the limiter), Auto 300 under the redline, or an rpm', () => {
    const off = build('toro', {}), auto = build('toro', { shiftAt: 'auto' }), set = build('toro', { shiftAt: '6200', rpmRedline: '6500' });
    assert.strictEqual(off.settings.shiftWarn, false);
    assert.strictEqual(at(off, 6900).shiftNow, false);
    const strobe = (t, rpm) => layer(t, 'shift').uniforms(at(t, rpm, 90), 0).u_strobe;
    assert.deepStrictEqual([strobe(off, 6900), strobe(off, 6950)], [0, 1]);
    /* Auto: the redline (6,750: Car profile values' own) less 300 */
    assert.strictEqual(at(auto, 6440, 90).shiftNow, false);
    assert.strictEqual(at(auto, 6450, 90).shiftNow, true);
    assert.deepStrictEqual([strobe(auto, 6440), strobe(auto, 6450)], [0, 1]);
    /* an rpm: the lights full there, flashing from there */
    assert.deepStrictEqual([strobe(set, 6150), strobe(set, 6200)], [0, 1]);
    assert.strictEqual(layer(set, 'shift').uniforms(at(set, 6200, 90), 0).u_frac, 1);
    /* the engine off: nothing to shift */
    assert.strictEqual(at(set, 0, 90).shiftNow, false);
});

test('Yellow light at Off (the Car profile\'s, a G20 but an M car\'s): no amber on the M dial, the shift lights green then red', () => {
    const on = build('toro', { shiftFrom: '5000', shiftStyle: 'gt3' }), off = build('toro', { shiftFrom: 'off', shiftStyle: 'gt3' });
    assert.deepStrictEqual([on.settings.yellowOff, off.settings.yellowOff, off.settings.yellowRpm], [false, true, null]);
    const cols = (t, id) => { const u = layer(t, id).uniforms(at(t, 6000, 90), 0); return [u.u_c1, u.u_c2, u.u_c3]; };
    const isAmber = (c) => c[0] > 0.9 && c[1] > 0.6 && c[1] < 0.8 && c[2] < 0.2;
    assert.ok(cols(on, 'shift').concat(cols(on, 'shiftR')).some(isAmber), 'amber as it comes');
    assert.ok(!cols(off, 'shift').concat(cols(off, 'shiftR')).some(isAmber), 'none with Off');
    const m = build('track', { shiftFrom: 'off' }), z = layer(m, 'revDial').uniforms(at(m, 3000, 90), 0).u_zone;
    assert.ok(z[3] - z[2] <= 0, 'the M dial: no amber run before the red');
    /* the shift now warning past the red (Car profile 1.14.0's Auto on a 320i: red 6000, solid from 6500, the limiter 7000) */
    const g20 = build('toro', { rpmRedline: '6000', rpmLimiter: '7000', scaleMaxRpm: '7000', shiftAt: '6500' });
    assert.strictEqual(g20.settings.shiftAtRpm, 6500);
    assert.deepStrictEqual([at(g20, 6450, 90).shiftNow, at(g20, 6500, 90).shiftNow], [false, true]);
});

test('at the shift point the speed and the gear blink red in every style, four times a second', () => {
    const red = (c) => c[0] > 0.8 && c[1] < 0.4;
    for (const style of ['toro', 'track', 'mplus', 'mtrack']) {
        const t = build(style, { shiftAt: '6000' });
        const col = (id, rpm, now) => {
            const u = layer(t, id).uniforms(Object.assign(at(t, rpm, 90, now), { gear: '4', speedText: '120' }), 0);
            return [u.u_color, u.u_outCol];
        };
        /* (Toro's gear is red as it comes and blinks white; the speed white, blinking red) */
        const speed = (rpm, now) => col('speed', rpm, now)[0];
        assert.ok(!red(speed(5900, 0)), style + ': under the shift point, as it comes');
        assert.ok(red(speed(6100, 0)), style + ': blinking on');
        assert.ok(!red(speed(6100, 125)), style + ': blinking off');
        assert.ok(red(speed(6100, 250)), style + ': on again');
        const gear = (rpm, now) => JSON.stringify(col(style === 'toro' ? 'gearBig' : 'gear', rpm, now));
        assert.notStrictEqual(gear(6100, 0), gear(6100, 125), style + ': the gear blinks');
        assert.strictEqual(gear(5900, 0), gear(5900, 125), style + ': ... only at the shift point');
    }
});

test('the cold-engine guard: the shift point down at the Cold rev limit with the oil at 30 °C, back by Oil is warm at', () => {
    const cfg = { shiftAt: '6500', rpmRedline: '6800', coldGuard: 'on', coldLimit: '4000', warmOil: '80' };
    const t = build('track', cfg);
    const s = (oil) => at(t, 3000, oil);
    assert.deepStrictEqual([s(30).shiftRpm, s(30).redRpm], [4000, 4300]);
    assert.deepStrictEqual([s(55).shiftRpm, s(55).redRpm], [5250, 5550]);
    assert.deepStrictEqual([s(80).shiftRpm, s(80).redRpm], [6500, 6800]);
    assert.deepStrictEqual([s(undefined).shiftRpm, s(undefined).redRpm], [6500, 6800], 'no oil reading: as warm');
    /* off: the oil makes no difference */
    const warm = build('track', Object.assign({}, cfg, { coldGuard: 'off' }));
    assert.deepStrictEqual([at(warm, 3000, 30).shiftRpm, at(warm, 3000, 30).redRpm], [6500, 6800]);
    /* the red field follows it in every style */
    const zone = (st, oil) => JSON.stringify(layer(st, 'revDial').uniforms(at(st, 3000, oil), 0));
    for (const style of ['track', 'mplus', 'mtrack']) {
        const b = build(style, cfg);
        assert.notStrictEqual(zone(b, 30), zone(b, 90), style);
    }
    const toro = build('toro', cfg), dial = (oil) => layer(toro, 'dial').uniforms(at(toro, 3000, oil), 0).u_redFrom;
    assert.deepStrictEqual([dial(30), dial(90)], [4.3, 6.8]);
});
