#!/usr/bin/env python3
"""
Bakes an SDF (signed distance field) glyph atlas.

One atlas serves every piece of text on the cluster. An SDF stays crisp at
any size, so the huge centre gear glyph and a 16 px label come from the same
texture - which matters because cluster-render allows only 16 assets per
client (docs/CLUSTER-CONSTRAINTS.md section 5).

Faces may carry a slant. The Huracan's dial numerals, gear character and
speed are all inclined (Huracan_Corsa guide, sections 4, 5 and 10), so the
shear is baked into the glyph rather than applied in the shader: the field
then describes the real shape and the metrics come out right.

Output: assets/fonts/atlas.png     (R = distance, 128 = the glyph edge)
        assets/fonts/atlas.r8.gz   (the same bytes raw, for the head unit)
        assets/fonts/atlas.json    (per-glyph uv + metrics, in em units)

Run after tools/fetch-fonts.sh. Deterministic: same fonts in, same bytes out.
"""
import gzip
import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import distance_transform_edt

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "build" / "fonts"
OUT = ROOT / "assets" / "fonts"

RASTER = 256            # cell resolution for one em before downsampling
SUPER = 4               # supersample while rasterising
SPREAD = 10             # distance range, in final-atlas pixels
DOWN = 4                # RASTER -> cell size
PAD = SPREAD + 2

DIGITS = "0123456789"
# id -> (file, characters, slant in degrees)
#
# The faces as they stood at Beta 1, in that order. They are packed first,
# exactly as then, so every glyph Toro draws keeps its place in the atlas
# and Toro renders bit for bit as it did (tools/toro-regress.sh). Three of
# them belonged to the first M style and nothing draws them now: they are
# packed for their place only (LEGACY) - no pixels, no metadata.
FROZEN = {
    # upright, for small readouts and labels
    "display": ("saira-latin-600-normal.ttf", DIGITS + "-.:/%°+", 0.0),
    "label": ("barlow-condensed-latin-600-normal.ttf",
              DIGITS + "ABCDEFGHIJKLMNOPQRSTUVWXYZ.:-/%+° ", 0.0),
    "labelL": ("barlow-condensed-latin-500-normal.ttf",
               DIGITS + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
               "abcdefghijklmnopqrstuvwxyz.:-/%+° ", 0.0),
    # inclined, for the dial itself
    "dial": ("saira-latin-500-normal.ttf", DIGITS, 11.0),
    "gear": ("saira-latin-700-normal.ttf", DIGITS + "PRNDSM", 17.0),
    "track": ("chakra-petch-latin-700-normal.ttf", DIGITS + "PRNDSM", 0.0),
    "mnum": ("saira-semi-condensed-latin-700-normal.ttf", DIGITS + "PRNDSM+-.", 0.0),
    # the start-up message: wide and geometric, as Lamborghini letters its cars
    "lambo": ("michroma-latin-400-normal.ttf",
              DIGITS + "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,'!?&-:+# ", 0.0),
}
LEGACY = ("labelL", "track", "mnum")
FROZEN_SIZE = 1024

# Faces added since, packed after the frozen block.
#
# The M View (docs/ref): its own figures and symbols, traced in
# tools/mglyphs.py - wide for the dials and readouts, narrower for the
# footer and the strips' labels. Its words (km/h, mph, pm ...) are Inter
# Tight, which sets them to the reference's widths within a pixel
# (docs/ref/MEASUREMENTS.md).
ADDED = {
    "mw": ("@mw", DIGITS + "PRNDSM", 0.0),
    "mn": ("@mn", DIGITS + ":.+-/", 0.0),
    "mi": ("@mi", "fromblscgte", 0.0),
    "ms": ("inter-tight-latin-400-normal.ttf",
           DIGITS + "abcdefghijklmnopqrstuvwxyzCFLIMT/°. ", 0.0),
    # the heavy capitals of the footer's panel: "WD", or the driving mode
    "mb": ("barlow-semi-condensed-latin-700-normal.ttf",
           DIGITS + "ABCDEFGHIJKLMNOPQRSTUVWXYZ+- ", 0.0),
}

# M Track Mode (docs/ref/m-track-reference.jpg), packed after those in turn,
# so nothing above moves: the symbols of its gauge rows, its gear letters
# (both traced in tools/mglyphs.py), and the two signs its rows' units need
# that "ms" does not have.
TRACK = {
    "mt": ("@mt", "uwoapvchm", 0.0),
    "mg": ("@mg", "PRNDSM", 0.0),
    "mx": ("inter-tight-latin-400-normal.ttf", "%V", 0.0),
}


# Marks, packed after M Track Mode's, so nothing above moves: drawn here, one
# cell each, and named in every upright face that sets figures (not the
# start-up words' own, "lambo") - "~" before an
# estimate (the electric range worked out from the charge, as Cluster Layouts
# shows it). `--marks` adds them to the atlas as it stands, for a machine
# without the fonts: the same bytes as the whole bake.
MARKS = {"mk": ("@mk", "~", 0.0)}
MARKED = ("display", "label", "mb", "mn", "ms", "mw")
# Symbols with a spot of their own: a hole the legacy faces' places leave in
# the frozen block (packed, never drawn: 106 x 106 from x 872, y 229), so
# nothing packed moves for them. (face, glyph, the cell's top left corner)
SPOTS = [("mt", "g", (878, 235))]            # M Track Mode: the gearbox oil (tools/mglyphs.py icon_gearbox)


# An electric car's B (0.30.3), packed after everything above, so nothing
# moves for it: in the M styles' faces drawn by tools/mglyphs.py, and in
# Toro's gear face made from that face's own D (its fonts are not needed: the
# D with a middle bar across its counter and a small notch at the waist).
# `--extra` adds them to the atlas as it stands.
EXTRA_DRAWN = [("mw", "B"), ("mg", "B")]
EXTRA_MADE = [("gear", "B", "D")]


def b_from_d(cell, slant):
    """A B from a D's distance field (atlas texels): its middle bar across the
    counter, the slant's lean kept, and a notch at the waist on the right."""
    import math
    d = cell.astype(np.float32)
    h, w = d.shape
    k = 127.5 / SPREAD
    t = math.tan(math.radians(slant))
    inked = d > 127.5
    rows = np.nonzero(inked.any(axis=1))[0]
    top, foot = rows.min(), rows.max()
    # the bars' thickness: the D's top bar, down its middle column
    mid = inked[:, (np.nonzero(inked.any(axis=0))[0].min() + np.nonzero(inked.any(axis=0))[0].max()) // 2]
    bar = np.nonzero(mid)[0]
    thick = (bar[bar < (top + foot) / 2].max() - top + 1) if (bar < (top + foot) / 2).any() else (foot - top) * 0.17
    ym = (top + foot) / 2.0
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    xs = xx + (yy - ym) * t                         # each row moved back by the lean, as the middle row stands
    row = inked[int(round(ym))]
    cols = np.nonzero(row)[0]
    gaps = [c for c in range(cols.min(), cols.max()) if not row[c]]
    x0, x1 = (min(gaps), max(gaps)) if gaps else (cols.min(), cols.max())
    across = np.minimum(k * (thick / 2.0 - np.abs(yy - ym)) + 127.5, k * np.minimum(xs - x0 + 1, x1 + 1 - xs) + 127.5)
    out = np.maximum(d, across)
    right = cols.max()
    notch = np.where(xs > right - 2.5, k * (np.abs(yy - ym) * 0.9 - 3.0) + 127.5, 255.0)
    out = np.minimum(out, np.maximum(notch, 0.0))
    return np.clip(out, 0, 255).astype(np.uint8)


def add_extra(atlas, meta, free):
    """EXTRA_DRAWN and EXTRA_MADE packed from row `free`, each only if its face
    has not got it yet. Returns the next free row."""
    size = atlas.shape[0]
    cells, new = [], {}
    for face, ch in EXTRA_DRAWN:
        if face in meta and ch not in meta[face]["glyphs"]:
            cell, m = drawn_glyph(face, ch)
            cells.append((face, ch, cell))
            new[(face, ch)] = m
    for face, ch, src in EXTRA_MADE:
        if face in meta and ch not in meta[face]["glyphs"]:
            g = meta[face]["glyphs"][src]
            cell = b_from_d(atlas[g["v"]:g["v"] + g["th"], g["u"]:g["u"] + g["tw"]], meta[face]["slant"])
            cells.append((face, ch, cell))
            new[(face, ch)] = {k: g[k] for k in ("adv", "w", "h", "bx", "by")}
    if not cells:
        return free
    packed = pack(cells, size, free)
    if packed is None:
        # (the rows under the others are nearly full: a row of them where no glyph's cell is and no pixel is)
        packed = in_a_gap(atlas, meta, cells)
    if packed is None:
        sys.exit("the extra glyphs do not fit (from row %d of %d, nor in a gap)" % (free, size))
    for face, ch, cell in cells:
        meta[face]["glyphs"][ch] = new[(face, ch)]
    put(atlas, meta, cells, packed[0])
    return max(free, packed[1])


def in_a_gap(atlas, meta, cells):
    """cells side by side in the first place, top to bottom and left to right, where no glyph's cell (and a texel
    round it) and no pixel is -> ({(face, ch): (x, y)}, the row under them) or None"""
    size = atlas.shape[0]
    used = atlas > 0
    for f in meta.values():
        for g in f["glyphs"].values():
            if g.get("th"):
                used[max(0, g["v"] - 1):g["v"] + g["th"] + 1, max(0, g["u"] - 1):g["u"] + g["tw"] + 1] = True
    h = max(c[2].shape[0] for c in cells) + 2
    w = sum(c[2].shape[1] + 1 for c in cells) + 1
    for y in range(1, size - h):
        band = used[y:y + h].any(axis=0)
        run = 0
        for x in range(size):
            run = 0 if band[x] else run + 1
            if run >= w:
                x0, placed = x - w + 2, {}
                for face, ch, cell in cells:
                    placed[(face, ch)] = (x0, y + 1)
                    x0 += cell.shape[1] + 1
                return placed, y + h
    return None


def mark_glyph(ch):
    """A mark of this file's own hand: "~", a stroke one period of a sine wave
    long, about the figures' middle height."""
    em = RASTER * SUPER
    pad = (PAD + 2) * DOWN * SUPER
    adv, x0, x1, mid, amp, stroke = 0.62, 0.07, 0.55, 0.36, 0.07, 0.09
    w, h = int(em * adv) + pad * 2, int(em * 1.2) + pad * 2
    ox, oy = pad, int(h - pad - em * 0.1)
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    pts = [(ox + em * (x0 + (x1 - x0) * i / 96.0),
            oy - em * (mid + amp * math.sin(2 * math.pi * i / 96.0))) for i in range(97)]
    r = em * stroke / 2
    d.line(pts, fill=255, width=int(round(em * stroke)), joint="curve")
    for (x, y) in (pts[0], pts[-1]):
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return cell_from_image(img, ox, oy, adv)


def glyph_sdf(path, ch, slant_deg):
    """Rasterise one glyph (optionally sheared about its baseline) and return
    (sdf cell, metrics). Metrics come from the drawn pixels, not the font's
    own box, so a sheared glyph measures correctly."""
    em = RASTER * SUPER
    font = ImageFont.truetype(str(path), em)
    advance = font.getlength(ch) / em

    k = math.tan(math.radians(slant_deg))
    pad = (PAD + 2) * DOWN * SUPER
    lean = int(abs(k) * em * 1.4)
    w = int(font.getlength(ch)) + pad * 2 + lean * 2 + em
    h = int(em * 2.6) + pad * 2
    ox, oy = pad + lean, int(h - pad - em * 0.6)      # pen on the baseline

    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).text((ox, oy), ch, font=font, fill=255, anchor="ls")
    if k:
        # output(x, y) samples input(x + k*y - k*oy): the top leans right.
        img = img.transform((w, h), Image.AFFINE, (1, k, -k * oy, 0, 1, 0),
                            resample=Image.BICUBIC)

    return cell_from_image(img, ox, oy, advance)


def cell_from_image(img, ox, oy, advance):
    """An alpha image drawn at RASTER * SUPER px per em, its pen at (ox, oy),
    -> (sdf cell, metrics). Shared by the fonts and the drawn glyphs."""
    em = RASTER * SUPER
    w, h = img.size
    small = img.resize((w // SUPER, h // SUPER), Image.LANCZOS)
    a = np.asarray(small, dtype=np.float32) / 255.0
    inside = a > 0.5
    if not inside.any():
        return None, {"adv": advance, "w": 0, "h": 0, "bx": 0, "by": 0}

    ys, xs = np.nonzero(a > 0.02)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    p = PAD
    x0, y0 = max(0, x0 - p), max(0, y0 - p)
    x1 = min(a.shape[1], x1 + p)
    y1 = min(a.shape[0], y1 + p)
    cell = inside[y0:y1, x0:x1]

    d_out = distance_transform_edt(~cell)
    d_in = distance_transform_edt(cell)
    sd = np.clip(((d_in - d_out) / DOWN) / SPREAD, -1.0, 1.0)
    img8 = ((sd * 0.5 + 0.5) * 255.0).astype(np.uint8)
    img8 = np.asarray(Image.fromarray(img8).resize(
        (max(1, img8.shape[1] // DOWN), max(1, img8.shape[0] // DOWN)),
        Image.LANCZOS))

    emS = em / SUPER
    return img8, {
        "adv": advance,
        "w": (x1 - x0) / emS, "h": (y1 - y0) / emS,
        "bx": (x0 - ox / SUPER) / emS, "by": (y0 - oy / SUPER) / emS,
    }


def drawn_glyph(face, ch):
    """A glyph of tools/mglyphs.py: a figure of the M View's own hand, or one
    of its symbols."""
    if face == "mk":
        return mark_glyph(ch)
    import mglyphs
    assert mglyphs.EM == RASTER * SUPER
    if face == "mi":
        img, ox, oy, adv = mglyphs.icon_glyph(ch)
    elif face == "mt":
        img, ox, oy, adv = mglyphs.track_icon_glyph(ch)
    elif face == "mg":
        img, ox, oy, adv = mglyphs.gear_glyph(ch)
    else:
        img, ox, oy, adv = mglyphs.figure_glyph(mglyphs.FIGURES[face][0], ch)
    return cell_from_image(img, ox, oy, adv)


def bake(faces):
    cells, meta = [], {}
    for face, (fname, chars, slant) in faces.items():
        path = FONTS / fname
        meta[face] = {"source": fname, "slant": slant, "glyphs": {}}
        for ch in chars:
            if fname.startswith("@"):
                cell, m = drawn_glyph(fname[1:], ch)
            else:
                cell, m = glyph_sdf(path, ch, slant)
            if cell is not None:
                cells.append((face, ch, cell))
            meta[face]["glyphs"][ch] = m
    cells.sort(key=lambda c: -c[2].shape[0])
    return cells, meta


def pack(cells, size, y0):
    """shelves of cells from row y0 down -> ({(face, ch): (x, y)}, next free row) or None"""
    placed, x, y, shelf = {}, 1, y0, 0
    for face, ch, cell in cells:
        ch_h, ch_w = cell.shape
        if x + ch_w + 1 > size:
            x, y, shelf = 1, y + shelf + 1, 0
        if y + ch_h + 1 > size:
            return None
        placed[(face, ch)] = (x, y)
        x += ch_w + 1
        shelf = max(shelf, ch_h)
    return placed, y + shelf + 1


def put(atlas, meta, cells, placed):
    for face, ch, cell in cells:
        x, y = placed[(face, ch)]
        ch_h, ch_w = cell.shape
        atlas[y:y + ch_h, x:x + ch_w] = cell
        g = meta[face]["glyphs"][ch]
        g["u"], g["v"], g["tw"], g["th"] = x, y, ch_w, ch_h


def add_marks(atlas, meta, free):
    """MARKS packed from row `free`, each named in the MARKED faces (their own
    face is not kept). Returns the next free row."""
    size = atlas.shape[0]
    cells, mk_meta = bake(MARKS)
    packed = pack(cells, size, free)
    if packed is None:
        sys.exit("the marks do not fit under the others (from row %d of %d)" % (free, size))
    put(atlas, mk_meta, cells, packed[0])
    for face in MARKED:
        for g in mk_meta.values():
            meta[face]["glyphs"].update({ch: dict(m) for ch, m in g["glyphs"].items()})
    return packed[1]


def add_spots(atlas, meta):
    """SPOTS drawn at their places, each checked empty first: no glyph's cell over it, no pixel in it."""
    for face, ch, (x, y) in SPOTS:
        if ch in meta[face]["glyphs"]:
            continue
        cell, m = drawn_glyph(face, ch)
        h, w = cell.shape
        if y + h > atlas.shape[0] or x + w > atlas.shape[1] or atlas[y:y + h, x:x + w].any():
            sys.exit("the spot for %s %r is not empty" % (face, ch))
        for f, fm in meta.items():
            for c, gm in fm["glyphs"].items():
                if gm.get("tw") and not (gm["u"] + gm["tw"] <= x or x + w <= gm["u"] or gm["v"] + gm["th"] <= y or y + h <= gm["v"]):
                    sys.exit("the spot for %s %r is under %s %r" % (face, ch, f, c))
        atlas[y:y + h, x:x + w] = cell
        m["u"], m["v"], m["tw"], m["th"] = x, y, w, h
        meta[face]["glyphs"][ch] = m


def write(atlas, meta, rows):
    size = atlas.shape[0]
    Image.fromarray(atlas, "L").save(OUT / "atlas.png", optimize=True)
    with gzip.GzipFile(str(OUT / "atlas.r8.gz"), "wb", compresslevel=9, mtime=0) as f:
        f.write(atlas.tobytes())
    (OUT / "atlas.json").write_text(json.dumps(
        {"size": size, "spread": SPREAD, "emPx": RASTER // DOWN, "faces": meta},
        separators=(",", ":"), sort_keys=True))
    used = int((atlas > 0).sum()) / (size * size) * 100
    print("atlas %dx%d  %.0f%% covered  rows used %d  png %d KB  r8.gz %d KB"
          % (size, size, used, rows,
             (OUT / "atlas.png").stat().st_size // 1024,
             (OUT / "atlas.r8.gz").stat().st_size // 1024))


def marks_only():
    """--marks: the marks and the spots added to the atlas as it stands (no
    fonts needed), each only if it is not there yet. M Track Mode's faces are
    the last packed: the free row is under their last shelf, as the whole bake
    has it."""
    meta = json.loads((OUT / "atlas.json").read_text())["faces"]
    atlas = np.array(Image.open(OUT / "atlas.png").convert("L"))
    cells = [g for f in TRACK for g in meta[f]["glyphs"].values() if g.get("th")]
    last = max(g["v"] for g in cells)
    free = last + max(g["th"] for g in cells if g["v"] == last) + 1
    if not any("~" in meta[f]["glyphs"] for f in MARKED):
        add_marks(atlas, meta, free)
    add_spots(atlas, meta)
    write(atlas, meta, max(g["v"] + g["th"] + 1 for f in meta.values() for g in f["glyphs"].values() if g.get("th") and g["v"] >= free))


def extra_only():
    """--extra: the B glyphs (EXTRA_DRAWN, EXTRA_MADE) added to the atlas as it
    stands (no fonts needed), under the last row anything uses."""
    meta = json.loads((OUT / "atlas.json").read_text())["faces"]
    atlas = np.array(Image.open(OUT / "atlas.png").convert("L"))
    free = max(g["v"] + g["th"] for f in meta.values() for g in f["glyphs"].values() if g.get("th")) + 1
    rows = add_extra(atlas, meta, free)
    write(atlas, meta, rows)


def main():
    if "--marks" in sys.argv[1:]:
        return marks_only()
    if "--extra" in sys.argv[1:]:
        return extra_only()
    if not FONTS.is_dir():
        sys.exit("run tools/fetch-fonts.sh first")
    OUT.mkdir(parents=True, exist_ok=True)

    size = FROZEN_SIZE
    old_cells, meta = bake(FROZEN)
    packed = pack(old_cells, size, 1)
    if packed is None:
        sys.exit("the frozen faces no longer fit %d: the fonts have changed" % size)
    placed, free = packed

    new_cells, new_meta = bake(ADDED)
    packed = pack(new_cells, size, free)
    if packed is None:
        sys.exit("the added faces do not fit under the frozen block (from row %d of %d)" % (free, size))
    placed.update(packed[0])
    meta.update(new_meta)

    track_cells, track_meta = bake(TRACK)
    free = packed[1]
    packed = pack(track_cells, size, free)
    if packed is None:
        sys.exit("M Track Mode's faces do not fit under the others (from row %d of %d)" % (free, size))
    placed.update(packed[0])
    meta.update(track_meta)

    for face in LEGACY:
        del meta[face]
    cells = [c for c in old_cells if c[0] not in LEGACY] + new_cells + track_cells
    atlas = np.zeros((size, size), dtype=np.uint8)
    put(atlas, meta, cells, placed)
    rows = add_marks(atlas, meta, packed[1])
    add_spots(atlas, meta)
    rows = add_extra(atlas, meta, max(g["v"] + g["th"] for f in meta.values() for g in f["glyphs"].values() if g.get("th")) + 1)
    write(atlas, meta, rows)


if __name__ == "__main__":
    main()
