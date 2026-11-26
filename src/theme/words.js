(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUWords = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    /*
     * The start-up message in the owner's own typed words, Korean among them: the letters the atlas's face for the
     * message (lambo: A to Z, figures and a few marks) does not have are drawn from the head unit's own Korean
     * glyphs (the kit's font, kit/runtime/fonts.js: Noto Sans CJK KR at 36 px, every Hangul syllable of KS X 1001,
     * the Latin letters and marks) and added under the atlas as a face of their own, "words", as distance fields
     * like the rest of it (assets/fonts: a value of 0.5 is the edge, atlas.spread px of distance at atlas.emPx to
     * either end). Only the message's own letters go in, so the atlas grows by a few rows (a row is about 45 px
     * high and holds 22), and only while the message needs them.
     *
     * Node 8, no dependencies. Never throws: null where it can't be done.
     */
    var FACE = 'words';
    var PAD = 4;              /* px of distance round each letter, at the font's size */
    var UP = 4;               /* the letters are measured at four times their size, then put back */
    var MAX = 64;             /* different letters at most */

    /* Whether str has a letter the face for the message has not (Korean, small letters). */
    function needs(atlas, face, str) {
        var glyphs = atlas && atlas.faces && atlas.faces[face] ? atlas.faces[face].glyphs : {};
        var s = String(str || '').replace(/\s+/g, ' ').trim();
        for (var i = 0; i < s.length; i++) {
            var ch = s.charAt(i);
            if (ch !== ' ' && !glyphs[ch] && !glyphs[ch.toUpperCase()]) return true;
        }
        return false;
    }

    /* The squared distance to the nearest set cell along one line (Felzenszwalb and Huttenlocher), in place. */
    var INF = 1e20;
    function line(f, n, d, v, z) {
        var k = 0, q, s;
        v[0] = 0; z[0] = -INF; z[1] = INF;
        for (q = 1; q < n; q++) {
            do {
                var r = v[k];
                s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r);
            } while (s <= z[k] && --k > -1);
            k++; v[k] = q; z[k] = s; z[k + 1] = INF;
        }
        for (k = 0, q = 0; q < n; q++) {
            while (z[k + 1] < q) k++;
            var dq = q - v[k];
            d[q] = dq * dq + f[v[k]];
        }
    }
    /* The distance (px) from each cell of a w x h grid to the nearest cell where on(i) holds. */
    function distances(w, h, on) {
        var n = Math.max(w, h), g = new Float64Array(w * h);
        var f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
        var x, y;
        for (var i = 0; i < w * h; i++) g[i] = on(i) ? 0 : INF;
        for (x = 0; x < w; x++) {
            for (y = 0; y < h; y++) f[y] = g[y * w + x];
            line(f, h, d, v, z);
            for (y = 0; y < h; y++) g[y * w + x] = d[y];
        }
        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) f[x] = g[y * w + x];
            line(f, w, d, v, z);
            for (x = 0; x < w; x++) g[y * w + x] = Math.sqrt(d[x]);
        }
        return g;
    }

    /*
     * One letter of the font as a distance field: tw x th bytes (its size plus PAD each side). alpha: the font's
     * atlas (atlasW wide), m: [x, y, w, h, ...] its place there.
     */
    function field(font, m, scale) {
        var gw = m[2], gh = m[3], tw = gw + 2 * PAD, th = gh + 2 * PAD;
        var W = tw * UP, H = th * UP, inside = new Uint8Array(W * H), X, Y;
        /* the letter's coverage at UP times its size (bilinear), then inside where it is over half */
        function cov(x, y) {
            if (x < 0 || y < 0 || x >= gw || y >= gh) return 0;
            return font.alpha[(m[1] + y) * font.atlasW + m[0] + x] / 255;
        }
        for (Y = 0; Y < H; Y++) {
            var fy = (Y + 0.5) / UP - PAD - 0.5, y0 = Math.floor(fy), ty = fy - y0;
            for (X = 0; X < W; X++) {
                var fx = (X + 0.5) / UP - PAD - 0.5, x0 = Math.floor(fx), tx = fx - x0;
                var c = (cov(x0, y0) * (1 - tx) + cov(x0 + 1, y0) * tx) * (1 - ty) +
                        (cov(x0, y0 + 1) * (1 - tx) + cov(x0 + 1, y0 + 1) * tx) * ty;
                inside[Y * W + X] = c >= 0.5 ? 1 : 0;
            }
        }
        var out = distances(W, H, function (i) { return !inside[i]; });
        var into = distances(W, H, function (i) { return inside[i] === 1; });
        var px = new Uint8Array(tw * th);
        for (var y = 0; y < th; y++) {
            for (var x = 0; x < tw; x++) {
                var i = (y * UP + (UP >> 1)) * W + x * UP + (UP >> 1);
                var dist = (inside[i] ? out[i] - 0.5 : -(into[i] - 0.5)) / UP;      /* px at the font's size, + inside */
                var val = 0.5 + dist * scale;
                px[y * tw + x] = Math.max(0, Math.min(255, Math.round(val * 255)));
            }
        }
        return { tw: tw, th: th, px: px };
    }

    /*
     * The atlas with the "words" face under it for str: { meta, pixels }, the meta a copy with h (its rows now)
     * and key (what the face holds) added; null where str has no letter the font has, or there is no font.
     * font(text): the kit's fonts.get('label', 36, text) - its family for Korean.
     */
    function extend(atlas, pixels, str, font) {
        try {
            var s = String(str || '').replace(/\s+/g, ' ').trim().slice(0, 90);
            var f = font && font(s);
            if (!f || !f.glyphs || !f.alpha || !s) return null;
            var R = f.size, scale = atlas.emPx / (2 * atlas.spread * R);
            var W = atlas.size, H0 = atlas.h || atlas.size;
            var chars = [], seen = {}, i;
            for (i = 0; i < s.length && chars.length < MAX; i++) {
                var ch = s.charAt(i), m = f.glyphs[ch.codePointAt(0)];
                if (!m || seen[ch] || ch === ' ') continue;
                seen[ch] = true; chars.push(ch);
            }
            var glyphs = { ' ': { adv: ((f.glyphs[32] || [0, 0, 0, 0, 0, 0, R / 4])[6]) / R, bx: 0, by: 0, w: 0, h: 0 } };
            var tiles = [], x = 1, y = H0 + 1, rowH = 0;
            chars.forEach(function (c) {
                var m = f.glyphs[c.codePointAt(0)];
                if (!m[2] || !m[3]) { if (c !== ' ') glyphs[c] = { adv: m[6] / R, bx: 0, by: 0, w: 0, h: 0 }; return; }
                var t = field(f, m, scale);
                if (x + t.tw + 1 > W) { x = 1; y += rowH + 1; rowH = 0; }
                tiles.push({ t: t, u: x, v: y });
                glyphs[c] = { adv: m[6] / R, bx: (m[4] - PAD) / R, by: (m[5] - PAD) / R, w: t.tw / R, h: t.th / R,
                              tw: t.tw, th: t.th, u: x, v: y };
                x += t.tw + 1; rowH = Math.max(rowH, t.th);
            });
            var H = y + rowH + 1;
            /* (a whole number of 8-row bands, so the renderer's rows stay aligned) */
            H = Math.ceil(H / 8) * 8;
            var out = Buffer.alloc ? Buffer.alloc(W * H) : new Buffer(W * H).fill(0);
            pixels.copy(out, 0, 0, Math.min(pixels.length, W * H0));
            tiles.forEach(function (q) {
                for (var r = 0; r < q.t.th; r++) {
                    for (var c = 0; c < q.t.tw; c++) out[(q.v + r) * W + q.u + c] = q.t.px[r * q.t.tw + c];
                }
            });
            var faces = {};
            Object.keys(atlas.faces).forEach(function (k) { faces[k] = atlas.faces[k]; });
            faces[FACE] = { glyphs: glyphs };
            var meta = {};
            Object.keys(atlas).forEach(function (k) { meta[k] = atlas[k]; });
            meta.faces = faces; meta.h = H; meta.key = FACE + ':' + chars.join('');
            return { meta: meta, pixels: out };
        } catch (e) { return null; }
    }

    return { FACE: FACE, needs: needs, extend: extend, field: field, distances: distances };
}));
