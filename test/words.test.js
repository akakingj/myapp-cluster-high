'use strict';
/*
 * The start-up message in the owner's own typed words, Korean among them (src/theme/words.js): the letters the
 * message's face has not come from the head unit's own Korean font, as distance fields under the atlas, and the
 * cluster draws them from there.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Words = require('../src/theme/words.js');
const Overlays = require('../src/theme/overlays.js');
const Themes = require('../src/theme/index.js');
const Text = require('../src/engine/text.js');
const Atlas = require('../src/car/atlas.js');
const Main = require('../src/car/main.js');

/* the kit's Korean font, as a Korean package carries it (kit/runtime/fonts.js get('label', 36, text)) */
const KO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'kit', 'localization', 'fonts', 'korean.json'), 'utf8')).sizes[0];
KO.alpha = zlib.inflateSync(Buffer.from(KO.alpha, 'base64'));
const font = () => KO;
const { meta: atlas, pixels } = Atlas.load();

test('words the message\'s face has (A to Z, figures) stay in it; Korean or small letters need their own', () => {
    assert.strictEqual(Words.needs(atlas, 'lambo', 'Ciao bella 3'), false);
    assert.strictEqual(Words.needs(atlas, 'lambo', '안녕하세요'), true);
    assert.strictEqual(Words.needs(atlas, 'lambo', 'Drive safe ~'), true);
});

test('the words\' own letters under the atlas: the atlas as it was above them, each letter once, a distance field', () => {
    const t0 = Date.now();
    const ext = Words.extend(atlas, pixels, '안전 운전 하세요, 동하님!', font);
    const ms = Date.now() - t0;
    assert.ok(ext, 'made');
    assert.ok(ms < 3000, 'quick enough for the head unit: ' + ms + ' ms here');
    const m = ext.meta;
    assert.strictEqual(m.size, 1024);
    assert.ok(m.h > 1024 && m.h <= 1024 + 200 && m.h % 8 === 0, 'a few rows more: ' + m.h);
    assert.strictEqual(ext.pixels.length, 1024 * m.h);
    assert.ok(ext.pixels.slice(0, 1024 * 1024).equals(pixels), 'the atlas above is untouched');
    assert.strictEqual(atlas.h, undefined, 'and its own meta is left as it was');
    const g = m.faces.words.glyphs;
    for (const ch of '안전운하세요,동님!') assert.ok(g[ch] && g[ch].tw > 0, ch);
    assert.ok(g[' '] && g[' '].adv > 0);
    assert.strictEqual(m.key, 'words:안전운하세요,동님!');
    /* a syllable's field: inside over the edge in its middle stroke, outside at its corners */
    const q = g['하'], at = (x, y) => ext.pixels[(q.v + y) * 1024 + q.u + x];
    assert.ok(at(0, 0) < 40 && at(q.tw - 1, q.th - 1) < 40, 'outside at the corners');
    let most = 0;
    for (let y = 0; y < q.th; y++) for (let x = 0; x < q.tw; x++) most = Math.max(most, at(x, y));
    assert.ok(most > 160, 'inside its strokes: ' + most);
    /* its size: about a Hangul syllable's (0.92 em) */
    assert.ok(q.adv > 0.85 && q.adv < 1.0, 'advance ' + q.adv);
});

test('the cluster draws the words from their own face, as typed (not in capitals)', () => {
    const ext = Words.extend(atlas, pixels, '안녕 Nicole', font);
    const th = Themes.build(ext.meta, 'carprofile', { intro: true, introMessage: 'custom', introText: '안녕 Nicole', introFace: 'words' });
    const L = th.layers.find((x) => x.id === 'introText');
    assert.ok(L, 'the words\' layer');
    assert.strictEqual(Overlays.clean(ext.meta, '안녕  Nicole', 'words'), '안녕 Nicole');
    const F = Overlays.fit(ext.meta, '안녕 Nicole', 'words');
    assert.deepStrictEqual(F.lines, ['안녕 Nicole']);
    /* the glyphs' places in the taller atlas: v within it */
    const lay = Text.layout(ext.meta, '안녕', { face: 'words', size: 60, x: 0, y: 100 });
    assert.strictEqual(lay.count, 2);
    for (let i = 0; i < 2; i++) {
        const v = lay.g[i * 4 + 1], h = lay.g[i * 4 + 3];
        assert.ok(v > 1024 / ext.meta.h && v + h <= 1, 'in the rows under the atlas');
    }
});

test('the service: typed Korean words go up with their own letters; the message\'s own words keep the atlas as it is', { timeout: 10000 }, () => {
    const cr = { on() {}, asset: () => 1, effect: () => 2, uniform() {}, bind() {}, set() {}, drop() {}, pixels() {}, close() {} };
    const run = (values) => {
        const host = { log: { info() {}, warn() {} }, settings: () => Object.assign({ profile: 'carprofile', enabled: true }, values),
            onSettingsChanged() {}, subscribe() {} };
        const svc = Main.start(host, { cr, font, presence: { othersShowing: () => false, mark() {} }, message: null });
        const th = svc.theme();
        svc.stop();
        return th;
    };
    const ko = run({ intro: true, introMessage: 'custom', introWords: '  안녕하세요   동하님 ' });
    assert.strictEqual(ko.settings.introText, '안녕하세요 동하님');
    assert.strictEqual(ko.settings.introFace, 'words');
    const latin = run({ intro: true, introMessage: 'custom', introWords: 'Ciao bella' });
    assert.strictEqual(latin.settings.introFace, null, 'the message\'s own face (in capitals)');
    const none = run({ intro: true, introMessage: 'welcome', introWords: '안녕' });
    assert.strictEqual(none.settings.introText, 'Welcome back', 'typed words only for Your own words');
});
