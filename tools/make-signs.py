#!/usr/bin/env python3
"""
make-signs.py - the warning signs' pictures (AK 0.29.0; src/theme/overlays.js WARN, src/car/road_signs.js artOf).

The pictures are South Korea's road signs (도로교통법 시행규칙 별표 6; Government of the Republic of Korea, free to use
as public works under Article 24-2 of the Korean Copyright Act), as the owner downloaded them (Nov 27 2026; the same
designs as Wikipedia's "Road signs in South Korea"), kept 240 px wide in assets/signs/src/<name>.png - the same files
and the same cut as AK Cluster Layouts' (akakingj/myapp-cluster tools/make_sign_art.py).

Each is cut out along the outside of its thick red edge (the thin outer line and the white rim dropped), made H high
(as the speed limit sign: overlays.js WARN.h; a triangle at most 1.2 H wide) and packed in one atlas at most 1024 wide:
src/theme/signs.js (cells { name: [x, y, w, h] }; the atlas raw RGBA, deflated, base64, for the car, src/car/cluster.js)
and assets/signs/signs.png (for the preview). "danger" (140, "!") is made from the speed hump's sign.

    python3 tools/make-signs.py
"""
import base64
import json
import re
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'signs' / 'src'
OUT = ROOT / 'src' / 'theme' / 'signs.js'
PNG = ROOT / 'assets' / 'signs' / 'signs.png'
OVERLAYS = ROOT / 'src' / 'theme' / 'overlays.js'


def warn_h():
    m = re.search(r'var WARN = \{[^}]*h:\s*(\d+)', OVERLAYS.read_text(encoding='utf-8'))
    if not m:
        raise SystemExit('overlays.js: no WARN h')
    return int(m.group(1))


def cut(im):
    """The sign along the outside of its thick red edge: RGBA, cropped to it."""
    a = np.asarray(im.convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 150) & (g < 100) & (b < 100)
    k = max(2, round(im.width / 110))
    yy, xx = np.mgrid[-k:k + 1, -k:k + 1]
    edge = ndimage.binary_opening(red, structure=(xx * xx + yy * yy) <= k * k)
    lab, n = ndimage.label(edge)
    if not n:
        raise ValueError('no red edge')
    edge = lab == (1 + int(np.argmax(ndimage.sum(edge, lab, range(1, n + 1)))))
    shape = ndimage.binary_fill_holes(edge)
    ys, xs = np.nonzero(shape)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return Image.fromarray(np.dstack([a, (shape * 255)]).astype(np.uint8)[y0:y1, x0:x1], 'RGBA')


def danger(base):
    """140 (위험): a warning sign's picture painted out, a "!" in its place."""
    a = np.asarray(base).copy()
    rgb = a[..., :3].astype(int)
    yellow = (rgb[..., 0] > 200) & (rgb[..., 1] > 140) & (rgb[..., 1] < 220) & (rgb[..., 2] < 90)
    col = np.median(rgb[yellow], axis=0).astype(np.uint8)
    ys, xs = np.nonzero(yellow)
    inside = np.zeros(yellow.shape, bool)
    inside[ys.min():ys.max() + 1, xs.min():xs.max() + 1] = True
    dark = (rgb.sum(axis=2) < 300) & inside & (a[..., 3] > 0)
    dark = ndimage.binary_dilation(dark, iterations=2) & inside & ~((rgb[..., 0] > 150) & (rgb[..., 1] < 100))
    a[dark, :3] = col
    im = Image.fromarray(a, 'RGBA')
    d = ImageDraw.Draw(im)
    w, h = im.size
    cx, top, bot = w / 2, ys.min() + (ys.max() - ys.min()) * 0.30, ys.min() + (ys.max() - ys.min()) * 0.72
    bw, ink = w * 0.075, (35, 28, 26, 255)
    d.polygon([(cx - bw / 2, top), (cx + bw / 2, top), (cx + bw * 0.32, bot), (cx - bw * 0.32, bot)], fill=ink)
    r = bw * 0.52
    cy = ys.min() + (ys.max() - ys.min()) * 0.86
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
    return im


def shrink(im, h, wmax):
    k = min(h / im.height, wmax / im.width)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def main():
    h = warn_h()
    cuts = {f.stem: cut(Image.open(f)) for f in sorted(SRC.glob('*.png'))}
    cuts['danger'] = danger(cuts['speed_hump'])
    ims = {n: shrink(im, h, round(h * 1.2)) for n, im in cuts.items()}
    W, x, y, cells = 1024, 0, 0, {}
    for n in sorted(ims):
        im = ims[n]
        if x + im.width > W:
            x, y = 0, y + h + 2
        cells[n] = [x, y, im.width, im.height]
        x += im.width + 2
    sheet = Image.new('RGBA', (W, y + h), (0, 0, 0, 0))
    for n, (cx, cy, cw, ch) in cells.items():
        sheet.paste(ims[n], (cx, cy))
    sheet.save(PNG, optimize=True)
    OUT.write_text("""/*
 * signs.js - made by tools/make-signs.py; don't edit. South Korea's road signs (Government of the Republic of Korea,
 * 도로교통법 시행규칙 별표 6; free to use as public works, Article 24-2 of the Korean Copyright Act), cut out along
 * their red edge, %d px high, in one atlas (%dx%d): cells { name: [x, y, w, h] }; z the atlas, raw RGBA, deflated,
 * base64 (the car's, src/car/cluster.js; the preview reads assets/signs/signs.png).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.MGUSigns = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    return {
        h: %d,
        w: %d,
        ah: %d,
        cells: %s,
        z: %s
    };
}));
""" % (h, sheet.width, sheet.height, h, sheet.width, sheet.height, json.dumps(cells, separators=(',', ':')),
           json.dumps(base64.b64encode(zlib.compress(sheet.tobytes(), 9)).decode())), encoding='utf-8')
    print('%s: %d signs, %d px high, atlas %dx%d, %d bytes' % (OUT.relative_to(ROOT), len(cells), h, sheet.width, sheet.height, OUT.stat().st_size))


if __name__ == '__main__':
    main()
