#!/usr/bin/env python3
"""
Compares M Track Mode's render with the reference frame it is traced from.

  python3 tools/mt-compare.py [--shot build/x.png] [--query "..."] [--out build/mt-compare]

The photograph (docs/ref/m-track-reference.jpg, 1582 x 579) is of a curved
display, taken a little from one side: level lines bow and tilt by up to
8 px, and the picture is 1.7 % larger at its top than at its foot. So the
style is not traced off the photograph as it stands but off the photograph
rectified - levelled, then squared - and that is what this compares with:

  1. level   y_f = y - T(x, y)
             T = sum of c_i * term_i, with u = (x - 791) / 800,
             v = (y - 289.5) / 300, w = max(0, (700 - x) / 600) and the terms
             u, u v, u^2, w^2, w^2 v, w^2 v^2, w^3, w^3 v
             (fitted to 28 edges that are level in the design: rms 0.14 px)
  2. square  q = 1 + C (y_f - 289.5): the photograph's scale at that height
             x_d = X0 + (x - X0) / q,   y_d = 289.5 + (y_f - 289.5) / q
             (C and X0 fitted to 15 diagonals and 6 uprights)

In the rectified frame the gauge rows are evenly spaced, uprights are
upright and every diagonal has one lean: src/theme/tgeom.js works in it.
docs/ref/M-TRACK-MEASUREMENTS.md has the working.

With no --shot it takes one of the preview's reference fixture
(preview/index.html?fixture=mt: 0 km/h, D, 840 rpm, 19:02, 402 km, +21.0 C),
rendered on the frame's own 1582 x 579 artboard, one render pixel a frame
unit (art=native). It writes

  photograph.png  the photograph as taken
  reference.png   the photograph, rectified: what the style is traced from
  render.png      ours, on the same artboard
  overlay.png     the two at 50 % each
  edges.png       edges only: the photograph's magenta, ours green, both white
  colour.png      absolute RGB difference, x2
  blink.gif       the two alternating
  A.png .. F.png  the study regions, photograph | ours | overlay
  zoom-*.png      figures and symbols at 400 %
  points.png      the control points (tools/mt-points.js) on the overlay at
                  200 %: green where the photograph is within 2 px of ours,
                  red where it is not, blue for anchors (not measured)

and prints how far apart they are: mean colour difference per region, how
many of each picture's edges have a partner within 2 px in the other, and at
each control point how far the photograph's picture sits from ours.

What the frame shows that is the car's own - the parking sensor, side light
and dipped beam lamps at its left edge - is not drawn by the style and is
left out of the figures (LAMPS, below). The photograph's grain, the bloom
round its bright figures, the dark halo a phone's sharpening leaves beside
them, and what is left of its distortion after the two maps (about 3 px in
the footer's corners) are in it and not in the render, so the numbers never
reach zero. They are for comparing one build with the next.
"""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / "docs" / "ref" / "m-track-reference.jpg"
W, H = 1582, 579

# the level map's coefficients, and the squaring's (see above)
XL = 700.0
COEF = (7.50146913, 1.57839067, -0.212808564, 4.64491785, 32.9769432, 1.15707110, -2.87573750, -24.9147361)
XC, YC = 791.0, 289.5
C, X0 = -7.91699432e-05, 564.402519

# the car's own lamps in the frame, which the style does not draw: (x, y, w, h), rectified
LAMPS = (58, 140, 66, 240)
REGIONS = {  # (x, y, w, h)
    "A": (100, 96, 600, 362),      # the wing and its gauge rows
    "B": (560, 60, 460, 400),      # the plates, the gear and the speed
    "C": (880, 44, 420, 452),      # the rev counter
    "D": (1124, 304, 290, 172),    # oil and fuel
    "E": (100, 440, 960, 116),     # the footer, left and middle
    "F": (1000, 440, 582, 116),    # the footer, right
}
ZOOMS = {
    "gear": (746, 198, 124, 98), "speed": (776, 320, 120, 54), "row1": (206, 170, 344, 40),
    "row3": (206, 284, 344, 40), "8": (1180, 70, 110, 60), "marker": (900, 400, 180, 90),
    "oil": (1136, 314, 150, 156), "fuel": (1270, 314, 130, 156), "clock": (116, 506, 120, 40),
    "range": (304, 506, 164, 40), "hook": (598, 446, 104, 40), "bracket": (546, 72, 70, 36),
}


def T(x, y):
    u = (x - XC) / 800.0
    v = (y - YC) / 300.0
    w = np.maximum(0.0, (XL - x) / 600.0)
    terms = (u, u * v, u * u, w * w, w * w * v, w * w * v * v, w ** 3, w ** 3 * v)
    return sum(c * q for c, q in zip(COEF, terms))


def to_photo(xd, yd):
    """a point of the rectified frame -> where it is in the photograph"""
    v = (yd - YC) / (1 - C * (yd - YC))
    yf = YC + v
    x = X0 + (xd - X0) * (1 + C * v)
    y = yf.copy()
    for _ in range(8):
        y = yf + T(x, y)
    return x, y


def rectify(photo):
    """the photograph -> the frame the style is traced from, same size"""
    yd, xd = np.mgrid[0:H, 0:W].astype(float)
    x, y = to_photo(xd, yd)
    a = np.asarray(photo.convert("RGB")).astype(float)
    out = np.stack([ndimage.map_coordinates(a[..., ch], [y, x], order=3, mode="nearest") for ch in range(3)], axis=-1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def helpers():
    """offset_at, edges and partner are the M View comparison's own"""
    spec = importlib.util.spec_from_file_location("m_compare", str(ROOT / "tools" / "m-compare.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def control_points():
    return json.loads(subprocess.check_output(["node", "tools/mt-points.js", "--json"], cwd=str(ROOT)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot")
    ap.add_argument("--query", default="fixture=mt&freeze=1&strip=off")
    ap.add_argument("--out", default=str(ROOT / "build" / "mt-compare"))
    ap.add_argument("--quiet", action="store_true", help="print the summary lines only")
    args = ap.parse_args()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    mc = helpers()

    shot = args.shot
    if not shot:
        shot = str(out / "shot.png")
        subprocess.check_call(["node", "tools/shot.js", shot, args.query + "&art=native"], cwd=str(ROOT),
                              stdout=subprocess.DEVNULL)
    photo = Image.open(REF).convert("RGB")
    assert photo.size == (W, H), "the reference is not the artboard's size"
    ref = rectify(photo)
    ren = Image.open(shot).convert("RGB").crop((0, 0, W, H))

    photo.save(out / "photograph.png")
    ref.save(out / "reference.png")
    ren.save(out / "render.png")
    Image.blend(ref, ren, 0.5).save(out / "overlay.png")
    ref.save(out / "blink.gif", save_all=True, append_images=[ren], duration=600, loop=0)

    R = np.asarray(ref).astype(float)
    N = np.asarray(ren).astype(float)
    diff = np.abs(R - N)
    Image.fromarray(np.clip(diff * 2, 0, 255).astype(np.uint8)).save(out / "colour.png")

    keep = np.ones((H, W), dtype=bool)                     # everything but the car's own lamps
    lx, ly, lw, lh = LAMPS
    keep[ly:ly + lh, lx:lx + lw] = False
    er, en = mc.edges(ref) & keep, mc.edges(ren) & keep
    e = np.zeros(R.shape, dtype=np.uint8)
    e[..., 0] = er * 255
    e[..., 2] = er * 255          # the photograph: magenta
    e[..., 1] = en * 255          # ours: green; both: white
    Image.fromarray(e).save(out / "edges.png")

    print("%-9s %9s %12s %12s" % ("region", "colour", "ref edges", "our edges"))
    report = {}
    for name, (x, y, w, h) in [("all", (0, 0, W, H))] + sorted(REGIONS.items()):
        sl = (slice(y, y + h), slice(x, x + w))
        c = float(diff[sl][keep[sl]].mean())
        p1, p2 = mc.partner(er[sl], en[sl]), mc.partner(en[sl], er[sl])
        report[name] = {"colour": round(c, 2), "refEdgesMatched": round(p1, 3), "ourEdgesMatched": round(p2, 3)}
        print("%-9s %9.2f %11.1f%% %11.1f%%" % (name, c, p1 * 100, p2 * 100))
        if name != "all":
            cr, cn = ref.crop((x, y, x + w, y + h)), ren.crop((x, y, x + w, y + h))
            sheet = Image.new("RGB", (w * 3 + 16, h), (40, 40, 40))
            sheet.paste(cr, (0, 0))
            sheet.paste(cn, (w + 8, 0))
            sheet.paste(Image.blend(cr, cn, 0.5), (2 * w + 16, 0))
            sheet.save(out / (name + ".png"))

    for name, (x, y, w, h) in ZOOMS.items():
        cr, cn = ref.crop((x, y, x + w, y + h)), ren.crop((x, y, x + w, y + h))
        tiles = [t.resize((w * 4, h * 4), Image.BICUBIC) for t in (cr, cn, Image.blend(cr, cn, 0.5))]
        sheet = Image.new("RGB", (w * 12 + 16, h * 4), (60, 60, 60))
        for i, t in enumerate(tiles):
            sheet.paste(t, (i * (w * 4 + 8), 0))
        sheet.save(out / ("zoom-" + name + ".png"))

    # the control points: how far the photograph's picture at each one sits from ours
    lum = lambda im: ndimage.gaussian_filter(np.asarray(im.convert("L")).astype(float), 1.0)
    Lr, Ln = lum(ref), lum(ren)
    marks = Image.blend(ref, ren, 0.5).resize((W * 2, H * 2), Image.BICUBIC)
    px = marks.load()
    rows, far, weak = [], [], []
    for p in control_points():
        on = p["kind"] != "anchor"
        m = mc.offset_at(Lr, Ln, p["x"], p["y"]) if on else None
        if on and m is not None:
            d, agree = m
            if agree < 0.5:
                weak.append((p["id"], round(agree, 2)))       # too little in common to measure: not counted
                col = (255, 200, 60)
            else:
                rows.append((p["id"], d))
                if d > 2.0:
                    far.append((p["id"], round(d, 1)))
                col = (60, 255, 90) if d <= 2.0 else (255, 60, 60)
        else:
            col = (150, 160, 255)
        cx, cy = int(round(p["x"] * 2)), int(round(p["y"] * 2))
        for k in range(-5, 6):
            for (ux, uy) in ((cx + k, cy), (cx, cy + k)):
                if 0 <= ux < marks.size[0] and 0 <= uy < marks.size[1]:
                    px[ux, uy] = col
    marks.save(out / "points.png")
    d = np.array([r[1] for r in rows])
    report["controlPoints"] = {
        "measured": len(rows), "within1px": int((d <= 1.0).sum()), "within2px": int((d <= 2.0).sum()),
        "meanPx": round(float(d.mean()), 2), "worstPx": round(float(d.max()), 2),
        "beyond2px": far, "notMeasurable": weak,
    }
    print("control points measured: %d; the photograph within 1 px of ours at %d, within 2 px at %d; "
          "mean %.2f px, worst %.2f px" % (len(rows), int((d <= 1.0).sum()), int((d <= 2.0).sum()), d.mean(), d.max()))
    if not args.quiet:
        for f in far:
            print("   beyond 2 px: %-18s %.1f px" % f)
        if weak:
            print("   not measurable (the photograph and ours share too little there): " +
                  ", ".join("%s (%.2f)" % w for w in weak))
    (out / "report.json").write_text(json.dumps(report, indent=2))
    print("wrote", out)


if __name__ == "__main__":
    sys.exit(main())
