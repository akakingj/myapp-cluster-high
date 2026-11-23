'use strict';
/*
 * The designs' pictures on the app's page (CLUSTER): each as the cluster draws it, with BMW's strip under it
 * (previews_data.js, baked by tools/make-previews.py). big(id): W x H, thumb(id): TW x TH, RGBA bytes, made once
 * each; null for a design without one.
 */
const zlib = require('zlib');
const DATA = require('./previews_data.js');

const W = DATA.w, H = DATA.h;
const TW = 232, TH = Math.round(232 * H / W);
const bigs = {}, thumbs = {};

function big(id) {
    if (bigs[id] !== undefined) return bigs[id];
    let px = null;
    try {
        const rgb = zlib.inflateSync(Buffer.from(DATA.designs[id], 'base64'));
        px = Buffer.alloc(W * H * 4);
        for (let i = 0, j = 0; i < W * H; i++, j += 3) {
            px[i * 4] = rgb[j]; px[i * 4 + 1] = rgb[j + 1]; px[i * 4 + 2] = rgb[j + 2]; px[i * 4 + 3] = 255;
        }
    } catch (e) { px = null; }
    bigs[id] = px;
    return px;
}

/* the big picture made smaller: each pixel the mean of the ones it covers */
function thumb(id) {
    if (thumbs[id] !== undefined) return thumbs[id];
    const src = big(id);
    let px = null;
    if (src) {
        px = Buffer.alloc(TW * TH * 4);
        for (let y = 0; y < TH; y++) {
            const y0 = Math.floor(y * H / TH), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / TH));
            for (let x = 0; x < TW; x++) {
                const x0 = Math.floor(x * W / TW), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / TW));
                let r = 0, g = 0, b = 0, n = 0;
                for (let v = y0; v < y1; v++) {
                    for (let u = x0; u < x1; u++) { const k = (v * W + u) * 4; r += src[k]; g += src[k + 1]; b += src[k + 2]; n++; }
                }
                const o = (y * TW + x) * 4;
                px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n; px[o + 3] = 255;
            }
        }
    }
    thumbs[id] = px;
    return px;
}

module.exports = { W, H, TW, TH, big, thumb };
