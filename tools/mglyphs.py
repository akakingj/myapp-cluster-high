#!/usr/bin/env python3
"""
The M View's own lettering and symbols, drawn here because no font has them.

The reference frame (docs/ref/m-view-reference.jpg) letters its dials in
wide, squared figures with rounded outer corners and square counters, and
its footer and strip labels in a narrower cut of the same hand. Both are
traced below as outlines built from bars and rounded boxes, to the stroke
widths measured off the photograph (docs/ref/MEASUREMENTS.md):

  face  figure W/H  upright stroke  level stroke   used for
  mw    1.265       0.34            0.19           dial numerals, speed, gear
  mn    0.935       0.255           0.17           clock, range, temperature, strip labels

and the symbols (face "mi") from the same crops: fuel pump, oil-temperature
can, the outlined M mark, the range arrow, and the lamps of the reference
fixture (parking brake, side lights, seat belt, LIMIT, the car seen from
above).

M Track Mode (docs/ref/m-track-reference.jpg) adds two faces more, traced
off its own frame the same way (docs/ref/M-TRACK-MEASUREMENTS.md):

  mt    the symbols of its four gauge rows - turbocharger, coolant, oil
        temperature, charge air - and, in the same hand, the ones for the
        other readings a row can be given (oil pressure, the 12 V battery,
        a drive battery's charge and its temperature)
  mg    its gear letters: the frame's D has an upright only three quarters
        as heavy as its bowl and a round counter, which the dials' D
        ("mw") does not

Everything is drawn as boolean rasters at 1024 px per em (figures: one em
is the figure height / 0.70, like the baked fonts, so layout treats all
faces alike) and handed to tools/bake-atlas.py, which turns them into the
same signed-distance cells as the font glyphs.

  python3 tools/mglyphs.py sheet.png     a proof sheet of every glyph
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

EM = 1024                 # px per em while drawing
CAP = 0.70                # a figure's height, in em


class Ink:
    """A boolean drawing in glyph units (x right, y down, origin top-left of the
    figure box). `unit` is how many px one unit is; `pad` units of margin."""

    def __init__(self, w, h, unit, pad=0.5):
        self.unit, self.pad = unit, pad
        self.W = int(math.ceil((w + 2 * pad) * unit))
        self.H = int(math.ceil((h + 2 * pad) * unit))
        self.m = np.zeros((self.H, self.W), dtype=bool)

    def _p(self, x, y):
        return ((x + self.pad) * self.unit, (y + self.pad) * self.unit)

    def _draw(self, fn):
        img = Image.new("1", (self.W, self.H), 0)
        fn(ImageDraw.Draw(img))
        return np.array(img, dtype=bool)

    # --- shapes: each returns a mask the size of the drawing
    def rect(self, x0, y0, x1, y1):
        a, b = self._p(x0, y0), self._p(x1, y1)
        return self._draw(lambda d: d.rectangle([a[0], a[1], b[0] - 1, b[1] - 1], fill=1))

    def rrect(self, x0, y0, x1, y1, r, corners=(1, 1, 1, 1)):
        """corners: top-left, top-right, bottom-right, bottom-left"""
        a, b = self._p(x0, y0), self._p(x1, y1)
        rr = r * self.unit
        if rr < 0.75:
            return self.rect(x0, y0, x1, y1)
        return self._draw(lambda d: d.rounded_rectangle(
            [a[0], a[1], b[0] - 1, b[1] - 1], radius=rr, fill=1,
            corners=tuple(bool(c) for c in corners)))

    def poly(self, pts):
        q = [self._p(x, y) for x, y in pts]
        return self._draw(lambda d: d.polygon(q, fill=1))

    def disc(self, cx, cy, r):
        c = self._p(cx, cy)
        rr = r * self.unit
        return self._draw(lambda d: d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], fill=1))

    def stroke(self, pts, w, closed=False, cap=True):
        """a line of width w through pts, round joins (and round ends unless cap is False)"""
        q = [self._p(x, y) for x, y in pts]
        if closed:
            q = q + [q[0]]
        ww = max(1, int(round(w * self.unit)))
        rr = ww / 2.0

        def fn(d):
            d.line(q, fill=1, width=ww, joint="curve")
            ends = q if cap else q[1:-1]
            for (x, y) in ends:
                d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=1)
        return self._draw(fn)

    def arc(self, cx, cy, r, a0, a1, w):
        """a circular arc (degrees, clockwise from +x with y down) as a stroke"""
        n = max(8, int(abs(a1 - a0) / 4))
        pts = [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
                cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
        return self.stroke(pts, w)

    def corner_cut(self, x, y, r, which):
        """the sliver outside a quarter circle of radius r at the corner (x, y) of a
        shape: subtract it to round that corner. which: 'tl' 'tr' 'br' 'bl'."""
        sx = 1 if which in ("tl", "bl") else -1
        sy = 1 if which in ("tl", "tr") else -1
        sq = self.rect(min(x, x + sx * r), min(y, y + sy * r), max(x, x + sx * r), max(y, y + sy * r))
        return sq & ~self.disc(x + sx * r, y + sy * r, r)


# ------------------------------------------------------------------ the figures

class Face:
    def __init__(self, W, sv, sh, r, ri, lb, rb, one_w, four_w, seven):
        self.W, self.sv, self.sh, self.r, self.ri = W, sv, sh, r, ri
        self.lb, self.rb = lb, rb
        self.one_w, self.four_w = one_w, four_w
        # the 7's leg: its level width, how far down the bar's squared right
        # end it leaves from, and where its left edge meets the foot
        self.seven = seven


WIDE = Face(W=1.265, sv=0.34, sh=0.19, r=0.155, ri=0.035, lb=0.1025, rb=0.1025, one_w=0.77, four_w=1.36,
            seven=(0.345, 0.25, 0.205))
NORM = Face(W=0.935, sv=0.255, sh=0.17, r=0.125, ri=0.03, lb=0.075, rb=0.075, one_w=0.60, four_w=1.03,
            seven=(0.275, 0.25, 0.175))


def figure(F, ch):
    """-> (Ink, mask, width, left bearing, right bearing), units of the figure height"""
    W, sv, sh, r, ri = F.W, F.sv, F.sh, F.r, F.ri
    m0, m1 = 0.5 - sh / 2, 0.5 + sh / 2          # the middle bar
    lb, rb = F.lb, F.rb
    w = W
    if ch == "1":
        w = F.one_w
    elif ch == "4":
        w = F.four_w
    elif ch == "M":
        w = W * 1.18
    elif ch in ":.":
        w = 0.22
    elif ch in "+-":
        w = 0.58
    elif ch == "/":
        w = 0.62
    k = Ink(w, 1.0, EM * CAP, pad=0.25)
    R, RR, P = k.rect, k.rrect, k.poly

    if ch == "0":
        g = RR(0, 0, W, 1, r) & ~RR(sv, sh, W - sv, 1 - sh, ri)
    elif ch == "8":
        g = RR(0, 0, W, 1, r) & ~RR(sv, sh, W - sv, m0, ri) & ~RR(sv, m1, W - sv, 1 - sh, ri)
    elif ch == "1":
        g = RR(w - sv, 0, w, 1, r * 0.6, (0, 1, 0, 0)) | R(0, 0, w - sv + 0.02, sh)
        lb = -0.05
    elif ch in "25S":
        # the upper half turns one way, the lower the other
        top = RR(0, 0, W, m1, r, (0, 1, 1, 0)) & ~R(-1, sh, W - sv, m0) & ~R(-1, m0, r, m1 + 1)
        bot = RR(0, m0, W, 1, r, (1, 0, 0, 1)) & ~R(sv, m1, W + 1, 1 - sh) & ~R(W - r, m0 - 1, W + 1, m1)
        g = top | bot
        if ch != "2":
            g = g[:, ::-1]                       # the same shape, mirrored
    elif ch == "3":
        g = RR(0, 0, W, 1, r, (0, 1, 1, 0)) & ~R(-1, sh, W - sv, m0) & ~R(-1, m1, W - sv, 1 - sh)
        g &= ~R(-1, m0, W * 0.30, m1)
    elif ch in "69":
        g = RR(0, 0, W, 1, r, (1, 0, 1, 1)) & ~R(sv, sh, W + 1, m0) & ~RR(sv, m1, W - sv, 1 - sh, ri)
        g &= ~k.corner_cut(W, m0, r, "tr")
        if ch == "9":
            g = g[::-1, ::-1]
    elif ch == "7":
        # The bar runs the full width and ends square on the right; the leg
        # hangs from that end - leaving it a little below the bar - and
        # leans back to a level foot. (It was first drawn from the top
        # corner, which stood it too upright and too far left.)
        dw, yj, foot = F.seven
        lean = (foot + dw - W) / (1.0 - yj)      # x per unit down
        g = R(0, 0, W, sh) | P([(W - dw - yj * lean, 0), (W, 0), (W, yj), (foot + dw, 1), (foot, 1)])
        g &= ~k.corner_cut(W, 0, r * 0.45, "tr")
        lb = lb * 0.5
    elif ch == "4":
        xs = w * 0.615                           # the stem
        yc = 0.615                               # the crossbar
        dw = sv * 0.80
        g = R(xs, 0, xs + sv, 1) | R(0, yc, w, yc + sh)
        g |= P([(xs - dw * 0.15, 0), (xs + sv * 0.6, 0), (dw, yc + sh * 0.5), (0, yc + sh * 0.5), (0, yc)])
    elif ch == "P":
        yb = 0.648
        g = R(0, 0, sv, 1) | (RR(0, 0, W, yb, r, (0, 1, 1, 0)) & ~RR(sv, sh, W - sv, yb - sh, ri))
    elif ch == "R":
        yb = 0.60
        g = R(0, 0, sv, 1) | (RR(0, 0, W, yb, r, (0, 1, 1, 0)) & ~RR(sv, sh, W - sv, yb - sh, ri))
        g |= P([(W * 0.42, yb - sh), (W * 0.42 + sv * 1.05, yb - sh), (W, 1), (W - sv * 1.05, 1)])
    elif ch == "D":
        g = RR(0, 0, W, 1, r * 1.5, (0, 1, 1, 0)) & ~RR(sv, sh, W - sv, 1 - sh, ri * 2, (0, 1, 1, 0))
    elif ch == "B":
        # an electric car's B (0.30.3): the upright, a bowl a little narrower above the middle bar and one below
        wt = W * 0.94
        g = R(0, 0, sv, 1) | (RR(0, 0, wt, m1, r, (0, 1, 1, 0)) & ~RR(sv, sh, wt - sv, m0, ri, (0, 1, 1, 0)))
        g |= RR(0, m0, W, 1, r * 1.2, (0, 1, 1, 0)) & ~RR(sv, m1, W - sv, 1 - sh, ri * 1.4, (0, 1, 1, 0))
    elif ch == "N":
        dw = sv * 0.98
        g = R(0, 0, sv, 1) | R(W - sv, 0, W, 1) | P([(0, 0), (dw, 0), (W, 1), (W - dw, 1)])
    elif ch == "M":
        dw = sv * 0.9
        g = R(0, 0, sv, 1) | R(w - sv, 0, w, 1)
        g |= P([(0, 0), (dw, 0), (w / 2 + dw / 2, 0.78), (w / 2 - dw / 2, 0.78)])
        g |= P([(w, 0), (w - dw, 0), (w / 2 - dw / 2, 0.78), (w / 2 + dw / 2, 0.78)])
    elif ch == ":":
        g = R(0, 0.22, w, 0.43) | R(0, 0.61, w, 0.82)
    elif ch == ".":
        g = R(0, 0.76, w, 1)
    elif ch == "+":
        t = sh * 0.92
        g = R(0, 0.5 - t / 2, w, 0.5 + t / 2) | R(w / 2 - t / 2, 0.5 - w / 2, w / 2 + t / 2, 0.5 + w / 2)
    elif ch == "-":
        t = sh * 0.92
        g = R(0, 0.5 - t / 2, w, 0.5 + t / 2)
    elif ch == "/":
        dw = sv * 0.72
        g = P([(w - dw, 0), (w, 0), (dw, 1), (0, 1)])
    else:
        raise KeyError(ch)
    return k, g, w, lb, rb


def figure_glyph(F, ch):
    """-> (alpha image at EM px/em, pen x, pen y (baseline), advance in em)"""
    k, g, w, lb, rb = figure(F, ch)
    img = Image.fromarray((g * 255).astype(np.uint8), "L")
    unit = k.unit                                  # px per figure height
    pen_x = k.pad * unit - lb * unit               # the pen sits a left bearing before the ink
    pen_y = (k.pad + 1.0) * unit                   # the baseline: the figure's foot
    advance = (lb + w + rb) * CAP                  # em
    return img, pen_x, pen_y, advance


# ------------------------------------------------------------------ the symbols
#
# Each is drawn in the reference frame's own pixels, in a box measured off
# it; one em is ICON_EM of those pixels. Its pen origin is the box's
# top-left corner, so a layer places it by the box.

ICON_EM = 32.0            # artboard px per em: two texels a pixel in the atlas


def _icon(w, h):
    return Ink(w, h, EM / ICON_EM, pad=3.0)


def icon_pump():
    """the fuel pump of the strip, with its arrow: box 455,443 32x24"""
    k = _icon(32, 24)
    g = k.rrect(0.6, 0.5, 12.8, 23.0, 1.4, (1, 1, 0, 0)) & ~k.rect(2.7, 2.3, 10.9, 8.2)
    g |= k.rect(0.0, 21.6, 13.8, 23.0)
    g |= k.stroke([(12.8, 11.8), (14.6, 12.2), (15.6, 14.0), (15.9, 19.4), (17.0, 21.3), (18.6, 21.3),
                   (19.4, 19.4), (18.9, 8.6), (16.2, 4.6)], 1.5)
    g |= k.poly([(23.2, 6.6), (30.2, 10.8), (23.2, 15.0)])
    return k, g, 32, 24


def icon_range():
    """the range's arrow into a pump: box 339,560 32x25"""
    k = _icon(32, 25)
    g = k.rrect(11.6, 1.6, 23.4, 24.0, 1.4, (1, 1, 0, 0)) & ~k.rect(13.5, 3.5, 21.5, 9.2)
    g |= k.rect(11.0, 22.6, 24.2, 24.0)
    # the arrow, cut clear of the pump by a dark margin
    arrow = k.rect(0.8, 13.0, 6.4, 16.6) | k.poly([(5.6, 10.2), (11.8, 14.8), (5.6, 19.4)])
    halo = k.poly([(4.4, 8.2), (14.2, 14.8), (4.4, 21.4)]) | k.rect(0, 11.8, 7, 17.8)
    g = (g & ~halo) | arrow
    g |= k.stroke([(23.4, 12.4), (25.2, 12.8), (26.1, 14.6), (26.4, 20.2), (27.5, 22.0), (29.0, 22.0),
                   (29.8, 20.2), (29.3, 9.4), (26.7, 5.6)], 1.5)
    return k, g, 32, 25


def icon_oil():
    """oil temperature: the can, a thermometer over it: box 1319,440 42x28"""
    k = _icon(42, 28)
    t = 1.7
    # the can: spout, body, the handle's rise on the right
    g = k.stroke([(8.4, 18.9), (2.2, 13.6), (5.8, 11.4), (9.7, 14.7), (8.7, 19.6), (9.3, 23.8), (25.0, 23.8),
                  (33.4, 13.2), (37.2, 13.2)], t)
    # the oil's level, two short waves
    g |= k.stroke([(12.6, 11.4), (18.6, 11.4)], t * 0.9) | k.stroke([(11.9, 14.3), (17.9, 14.3)], t * 0.9)
    # the thermometer
    g |= k.stroke([(23.6, 2.3), (23.6, 16.6)], t) | k.disc(23.6, 17.4, 2.0)
    for y in (4.9, 7.5, 10.1):
        g |= k.stroke([(23.6, y), (27.3, y)], t * 0.85)
    g |= k.disc(36.4, 20.6, 1.5)
    return k, g, 42, 28


def icon_m():
    """the outlined M mark: three leaning bars and the letter: box 157,496 80x28"""
    k = _icon(80, 28)
    t = 1.35
    top, bot, lean = 1.4, 25.4, 12.6            # the bars lean by `lean` over their height
    g = np.zeros_like(k.m)
    for x in (1.2, 10.6, 20.0):                 # the three bars, as outlines sharing edges
        g |= k.stroke([(x, bot), (x + lean, top), (x + lean + 9.4, top), (x + 9.4, bot)], t, closed=True)
    x = 29.4
    g |= k.stroke([(x, bot), (x + lean, top), (x + lean + 9.6, top), (x + lean + 13.0, 14.6),
                   (x + lean + 21.4, top), (x + lean + 30.0, top), (x + lean + 30.0, bot),
                   (x + lean + 21.4, bot), (x + lean + 21.4, 13.4), (x + lean + 14.6, bot),
                   (x + lean + 8.2, bot), (x + lean + 5.4, 12.6), (x + 9.0, bot)], t, closed=True)
    g |= k.disc(77.4, 20.4, 0.9)
    return k, g, 80, 28


def icon_brake():
    """the parking brake lamp: (P) in a ring between brackets: box 68,475 46x40"""
    k = _icon(46, 40)
    cx, cy, t = 23.0, 20.0, 2.0
    g = k.arc(cx, cy, 11.6, 0, 360, t)
    g |= k.arc(cx, cy, 19.0, 142, 218, 3.4) | k.arc(cx, cy, 19.0, -38, 38, 3.4)
    g |= k.stroke([(19.4, 26.6), (19.4, 13.6), (24.0, 13.6), (26.4, 14.8), (27.0, 17.2), (26.4, 19.6),
                   (24.0, 20.8), (19.4, 20.8)], 2.1)
    return k, g, 46, 40


def icon_lights():
    """side lights: two lamps back to back with their rays: box 53,350 48x24"""
    k = _icon(48, 24)
    t = 2.3
    g = np.zeros_like(k.m)
    for sx, ox in ((1, 0.0), (-1, 48.0)):
        def X(x):
            return ox + sx * x
        g |= k.stroke([(X(14.6), 5.2), (X(19.4), 4.4), (X(22.4), 8.0), (X(23.2), 12.4), (X(22.2), 16.8),
                       (X(19.0), 19.8), (X(14.6), 19.0), (X(13.8), 12.0)], t, closed=True)
        for (y0, y1) in ((3.4, 6.6), (12.0, 12.0), (20.6, 17.4)):
            g |= k.stroke([(X(2.4), y0), (X(8.8), y1)], t)
    return k, g, 48, 24


def icon_belt():
    """the seat-belt lamp: a seated figure with the belt across: box 1080,537 32x46"""
    k = _icon(32, 46)
    g = k.disc(15.6, 6.6, 4.3)
    g |= k.poly([(9.4, 13.6), (21.4, 13.6), (22.6, 27.0), (20.8, 43.4), (17.0, 43.4), (16.0, 31.8),
                 (14.8, 43.4), (11.0, 43.4), (9.6, 27.0)])
    g |= k.stroke([(8.4, 29.0), (3.6, 34.0)], 2.6) | k.stroke([(23.4, 29.0), (28.2, 34.0)], 2.6)
    belt = k.stroke([(24.4, 10.6), (8.0, 28.8)], 2.4) | k.stroke([(8.0, 29.4), (23.6, 29.4)], 2.2)
    g = (g & ~k.stroke([(24.4, 10.6), (8.0, 28.8)], 4.6) & ~k.stroke([(8.0, 29.4), (23.6, 29.4)], 4.2)) | belt
    return k, g, 32, 46


def _car(part):
    """the car seen from above, nose to the left: box 1116,533 134x54"""
    k = _icon(134, 54)
    body = k.rrect(2.0, 5.0, 132.0, 49.0, 15.0)
    body &= ~k.corner_cut(2.0, 5.0, 22.0, "tl") & ~k.corner_cut(2.0, 49.0, 22.0, "bl")
    screen = k.poly([(37.0, 9.6), (56.0, 12.0), (56.0, 42.0), (37.0, 44.4), (33.4, 27.0)])
    rear = k.poly([(100.0, 12.4), (116.0, 10.4), (119.0, 27.0), (116.0, 43.6), (100.0, 41.6)])
    mirrors = k.stroke([(46.0, 5.4), (50.0, 1.4)], 2.4) | k.stroke([(46.0, 48.6), (50.0, 52.6)], 2.4)
    seats = np.zeros_like(k.m)
    for (x, y) in ((63.0, 19.0), (63.0, 35.0), (85.0, 15.6), (85.0, 27.0), (85.0, 38.4)):
        seats |= k.rrect(x - 6.2, y - 5.0, x + 6.2, y + 5.0, 3.0)
    if part == "body":
        g = (body | mirrors) & ~screen & ~rear
    elif part == "glass":
        g = screen | rear
    elif part == "seats":
        g = seats
    else:  # the bright edge the light catches
        inner = k.rrect(4.4, 7.4, 129.6, 46.6, 13.0)
        inner &= ~k.corner_cut(4.4, 7.4, 20.0, "tl") & ~k.corner_cut(4.4, 46.6, 20.0, "bl")
        g = (body & ~inner) | k.stroke([(57.6, 12.4), (99.0, 12.8)], 1.2) | k.stroke([(57.6, 41.6), (99.0, 41.2)], 1.2)
        g |= k.stroke([(13.0, 23.0), (27.0, 23.0)], 1.0) | k.stroke([(13.0, 31.0), (27.0, 31.0)], 1.0)
    return k, g, 134, 54


ICONS = {
    # glyph -> (maker, what it is)
    "f": (icon_pump, "fuel pump with its arrow"),
    "r": (icon_range, "range: an arrow into a pump"),
    "o": (icon_oil, "oil temperature"),
    "m": (icon_m, "the outlined M mark"),
    "b": (icon_brake, "parking brake lamp"),
    "l": (icon_lights, "side lights lamp"),
    "s": (icon_belt, "seat-belt lamp"),
    "c": (lambda: _car("body"), "car from above: body"),
    "g": (lambda: _car("glass"), "car from above: glass"),
    "t": (lambda: _car("seats"), "car from above: seats"),
    "e": (lambda: _car("edge"), "car from above: lit edges"),
}


def icon_glyph(ch):
    """-> (alpha image at EM px/em, pen x, pen y, advance in em): the pen is the
    box's top-left corner"""
    k, g, w, h = ICONS[ch][0]()
    img = Image.fromarray((g * 255).astype(np.uint8), "L")
    return img, k.pad * k.unit, k.pad * k.unit, w / ICON_EM


# --------------------------------------------------- M Track Mode: the symbols
#
# Drawn in the track frame's own (rectified) pixels, each in a box whose
# top-left corner is the pen: the layout places a symbol by that corner.
# The first four are traced off the frame, enlarged thirty times
# (docs/ref/M-TRACK-MEASUREMENTS.md); the rest are not in it and are drawn
# to match: the same weight of line, the same thermometer.

def _thermo(k, x0, x1, top, foot, bulb, r, ticks, tick_x1, tick_h=1.9):
    """a thermometer: a stem from top to foot with a rounded head, a bulb at
    (its middle, bulb) of radius r, and ticks to its right at the heights given"""
    g = k.rrect(x0, top, x1, foot, (x1 - x0) * 0.42, (1, 1, 0, 0)) | k.disc((x0 + x1) / 2.0, bulb, r)
    for y in ticks:
        g |= k.rrect(x1 - 0.3, y - tick_h / 2.0, tick_x1, y + tick_h / 2.0, tick_h * 0.45, (0, 1, 1, 0))
    return g


def icon_turbo():
    """the turbocharger: the housing's snail with its outlet, the wheel in it: box 215,178 36x30"""
    k = _icon(36, 30)
    cx, cy = 19.4, 15.4
    g = k.disc(cx, cy, 12.0)
    g |= k.rrect(cx, 3.4, 34.2, 12.4, 1.3, (0, 1, 1, 0))          # the outlet, away to the right
    g |= k.rect(2.2, 25.4, cx, 27.4) | k.rrect(2.2, 18.6, 7.8, 27.4, 0.8, (1, 0, 0, 1))   # the foot and its flange
    # the gap round the wheel
    g &= ~(k.disc(cx, cy, 9.95) & ~k.disc(cx, cy, 8.85))
    # the blades: ten slits from the hub to the rim, swept a little
    slits = np.zeros_like(k.m)
    for i in range(10):
        a0 = math.radians(i * 36.0 + 6.0)
        pts = []
        for j in range(7):
            t = j / 6.0
            rr = 3.3 + (8.25 - 3.3) * t
            a = a0 + math.radians(13.0) * t * t
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        slits |= k.stroke(pts, 0.9, cap=False)
    g &= ~slits
    g &= ~k.disc(cx, cy, 1.15)
    return k, g, 36, 30


def icon_coolant():
    """coolant temperature: a thermometer standing in two waves: box 215,233 36x33"""
    k = _icon(36, 33)
    g = _thermo(k, 15.0, 21.6, 2.6, 21.0, 20.9, 3.7, (7.5, 12.3, 16.9), 25.6, 2.2)

    def wave(y):
        pts = [(x / 2.0, y - 0.8 * math.cos((x / 2.0 - 7.0) * 2.0 * math.pi / 10.6)) for x in range(8, 64)]
        return k.stroke(pts, 3.1)
    g |= wave(23.5) | wave(28.5)
    # the black between the two waves, and under the bulb
    def gap(y):
        pts = [(x / 2.0, y - 0.8 * math.cos((x / 2.0 - 7.0) * 2.0 * math.pi / 10.6)) for x in range(0, 72)]
        return k.stroke(pts, 1.5, cap=False)
    g = (g & ~gap(26.0)) | wave(28.5)
    return k, g, 36, 33


def _can(k, thermo):
    """the oil can: handle to the left, the lid's two bars, the spout up to the
    right with a drop under it. thermo: where a thermometer stands in it, cut clear."""
    # the left wall with the handle's point, and the slot in it
    g = k.poly([(2.0, 15.6), (8.2, 11.8), (11.4, 11.8), (13.8, 14.4), (13.8, 27.4), (8.8, 27.4), (8.8, 21.4)])
    g &= ~k.stroke([(8.5, 15.3), (10.4, 18.3)], 1.25)
    g |= k.rect(8.8, 24.7, 31.6, 27.4)                                  # the foot
    # the lid: a bar, its stem, the can's own top
    lid_x1 = 24.3 if thermo else 28.0
    g |= k.rect(12.6, 11.6, lid_x1, 13.6) | k.rect(19.0, 13.6, 20.8, 15.5) | k.rect(13.8, 15.5, lid_x1 + 0.3, 17.6)
    # the spout: up from the foot's right end, then level to its lip
    g |= k.stroke([(30.6, 26.0), (38.4, 15.2), (43.0, 14.5)], 2.7)
    g |= k.stroke([(28.0 if not thermo else 31.5, 16.5), (37.4, 16.5)], 2.3)
    # the drop
    g |= k.disc(41.9, 21.9, 2.45) | k.poly([(39.2, 18.3), (43.3, 19.8), (40.0, 22.6)])
    return g


def icon_oil_temp():
    """oil temperature, as the gauge row has it: the can, a thermometer standing in it: box 210,292 48x30"""
    k = _icon(48, 30)
    g = _can(k, True)
    halo = k.rrect(23.6, 0.0, 31.0, 17.0, 2.0) | k.disc(27.3, 19.6, 4.7)
    g = (g & ~halo) | _thermo(k, 24.7, 29.9, 2.2, 18.0, 19.6, 3.55, (6.5, 10.4, 14.1), 33.3, 1.9)
    return k, g, 48, 30


def icon_oil_press():
    """oil pressure: the same can without the thermometer (not in the frame): box 48x30"""
    k = _icon(48, 30)
    return k, _can(k, False), 48, 30


def icon_air():
    """charge-air temperature: a thermometer in the first of three stacked cores: box 215,346 38x34"""
    k = _icon(38, 34)
    t = 2.3
    # the front core: a frame with a bar across it
    g = (k.rrect(1.6, 10.8, 27.6, 24.4, 2.6) & ~k.rrect(1.6 + t * 1.75, 10.8 + t * 1.2, 27.6 - t * 1.25, 24.4 - t, 1.0))
    g |= k.rect(6.6, 15.6, 24.6, 18.1)
    # the two behind it, each showing its right side and its foot
    for (dx, dy) in ((3.3, 3.0), (6.6, 6.2)):
        back = k.rrect(1.6 + dx, 10.8 + dy, 27.6 + dx, 24.4 + dy, 2.6)
        inner = k.rrect(1.6 + dx - 2.2, 10.8 + dy - 2.0, 27.6 + dx - 2.2, 24.4 + dy - 2.0, 2.2)
        cover = k.rrect(1.6 + dx - 3.3 - 0.9, 0.0, 27.6 + dx - 3.3 + 0.9, 24.4 + dy - 3.1 + 0.9, 3.2)
        g |= back & ~inner & ~cover
    # the thermometer, cut clear of the frame it stands in
    halo = k.rrect(11.9, 0.0, 19.0, 15.0, 1.6) | k.disc(15.5, 17.0, 4.0)
    g = (g & ~halo) | _thermo(k, 13.2, 17.7, 2.8, 15.6, 17.0, 2.95, (6.5, 9.6), 20.9, 1.8)
    return k, g, 38, 34


def icon_battery():
    """the 12 V battery (not in the frame): its case, two posts, minus and plus: box 36x28"""
    k = _icon(36, 28)
    t = 2.3
    g = k.rrect(2.0, 8.0, 32.0, 26.0, 2.2) & ~k.rrect(2.0 + t, 8.0 + t, 32.0 - t, 26.0 - t, 0.8)
    g |= k.rrect(6.4, 4.4, 12.4, 8.2, 0.8, (1, 1, 0, 0)) | k.rrect(21.6, 4.4, 27.6, 8.2, 0.8, (1, 1, 0, 0))
    g |= k.rect(7.0, 16.0, 12.6, 18.0)                                               # minus
    g |= k.rect(21.2, 16.0, 27.8, 18.0) | k.rect(23.5, 13.7, 25.5, 20.3)             # plus
    return k, g, 36, 28


def _cell(k, x0, y0, x1, y1):
    """a drive battery lying on its side: a rounded case with its tip to the right"""
    t = 2.3
    g = k.rrect(x0, y0, x1, y1, 2.4) & ~k.rrect(x0 + t, y0 + t, x1 - t, y1 - t, 0.9)
    ym = (y0 + y1) / 2.0
    return g | k.rrect(x1 - 0.3, ym - 3.4, x1 + 2.6, ym + 3.4, 1.0, (0, 1, 1, 0))


def icon_charge():
    """a drive battery's charge (not in the frame): the cell with a flash in it: box 38x26"""
    k = _icon(38, 26)
    g = _cell(k, 2.0, 5.0, 32.4, 22.0)
    g |= k.poly([(19.4, 7.9), (12.0, 14.4), (16.4, 14.4), (14.6, 19.1), (22.2, 12.5), (17.7, 12.5)])
    return k, g, 38, 26


def icon_cell_temp():
    """a drive battery's temperature (not in the frame): a thermometer before the cell: box 42x28"""
    k = _icon(42, 28)
    g = _cell(k, 13.6, 8.0, 36.6, 23.4)
    halo = k.rrect(1.6, 0.0, 9.4, 20.0, 1.6) | k.disc(5.5, 21.6, 4.5)
    g = (g & ~halo) | _thermo(k, 3.2, 7.8, 2.4, 20.0, 21.6, 3.3, (6.6, 10.6, 14.6), 11.0, 1.8)
    return k, g, 42, 28


def icon_m_track():
    """the outlined M mark as the track frame has it - heavier of line than the M View's, and
    leaning with the frame's own diagonals: box 150,455 68x26"""
    k = _icon(68, 26)
    t = 1.85
    top, bot, lean = 2.6, 23.2, 12.3
    g = np.zeros_like(k.m)
    for x in (2.6, 10.7, 18.8):                 # the three bars, as outlines sharing edges
        g |= k.stroke([(x, bot), (x + lean, top), (x + lean + 8.1, top), (x + 8.1, bot)], t, closed=True)
    x, f = 26.9 + lean, 0.886                   # the letter: the M View's, to this mark's size
    g |= k.stroke([(x - lean, bot), (x, top), (x + 9.6 * f, top), (x + 13.0 * f, 13.9),
                   (x + 21.4 * f, top), (x + 30.0 * f, top), (x + 30.0 * f, bot),
                   (x + 21.4 * f, bot), (x + 21.4 * f, 12.9), (x + 14.6 * f, bot),
                   (x + 8.2 * f, bot), (x + 5.4 * f, 12.2), (x - lean + 7.7, bot)], t, closed=True)
    return k, g, 68, 26


def icon_gearbox():
    """the gearbox oil's temperature (not in the frame): a thermometer before a cog, as the drive
    battery's temperature stands before its cell: box 42x28"""
    k = _icon(42, 28)
    cx, cy, ro, rb, rh = 27.6, 14.0, 12.4, 9.4, 3.9
    g = k.disc(cx, cy, rb)
    for i in range(8):                          # eight teeth, flat-topped, a little narrower outside
        a = math.radians(i * 45.0 + 22.5)
        ca, sa = math.cos(a), math.sin(a)
        def at(r, w):
            return (cx + r * ca - w * sa, cy + r * sa + w * ca)
        g |= k.poly([at(rb - 1.0, -2.6), at(ro, -1.9), at(ro, 1.9), at(rb - 1.0, 2.6)])
    g &= ~k.disc(cx, cy, rh)                     # the hub's hole
    halo = k.rrect(1.6, 0.0, 9.4, 20.0, 1.6) | k.disc(5.5, 21.6, 4.5)
    g = (g & ~halo) | _thermo(k, 3.2, 7.8, 2.4, 20.0, 21.6, 3.3, (6.6, 10.6, 14.6), 11.0, 1.8)
    return k, g, 42, 28


TRACK_ICONS = {
    # glyph -> (maker, what it is)
    "u": (icon_turbo, "turbocharger: boost"),
    "w": (icon_coolant, "coolant temperature"),
    "o": (icon_oil_temp, "oil temperature"),
    "a": (icon_air, "charge-air temperature"),
    "p": (icon_oil_press, "oil pressure"),
    "v": (icon_battery, "the 12 V battery"),
    "c": (icon_charge, "a drive battery's charge"),
    "h": (icon_cell_temp, "a drive battery's temperature"),
    "m": (icon_m_track, "the outlined M mark"),
    # (in a spot of its own in the atlas, not in M Track Mode's block: tools/bake-atlas.py SPOTS)
    "g": (icon_gearbox, "the gearbox oil's temperature"),
}


def track_icon_glyph(ch):
    """as icon_glyph, for the M Track Mode symbols (face "mt")"""
    k, g, w, h = TRACK_ICONS[ch][0]()
    img = Image.fromarray((g * 255).astype(np.uint8), "L")
    return img, k.pad * k.unit, k.pad * k.unit, w / ICON_EM


# ---------------------------------------------- M Track Mode: the gear letters
#
# The frame's D, measured over its 80 px of height: 1.196 wide; the upright
# 0.262 and the bowl 0.347; the bar on top 0.187 and the one below 0.200;
# the outer corners on the right rounded by 0.33, the counter's by 0.20.
# P, R, N, S and M are not in the frame: they are drawn with the same
# strokes and the same corners, so the six read as one hand.

GEAR = dict(W=1.196, sl=0.262, sr=0.347, st=0.187, sb=0.200, ro=0.33, ri=0.20, lb=0.10, rb=0.10)


def gear_figure(ch):
    """-> (Ink, mask, width, left bearing, right bearing), units of the letter's height"""
    G = GEAR
    W, sl, sr, st, sb, ro, ri = G["W"], G["sl"], G["sr"], G["st"], G["sb"], G["ro"], G["ri"]
    w = W * 1.22 if ch == "M" else W
    k = Ink(w, 1.0, EM * CAP, pad=0.25)
    R, RR, P = k.rect, k.rrect, k.poly
    if ch == "D":
        g = RR(0, 0, W, 1, ro, (0, 1, 1, 0)) & ~RR(sl, st, W - sr, 1 - sb, ri, (0, 1, 1, 0))
        g &= ~k.corner_cut(0, 0, 0.03, "tl") & ~k.corner_cut(0, 1, 0.03, "bl")
    elif ch == "P":
        yb = 0.640
        rc = min(ri * 0.8, (yb - 2 * st) * 0.42)         # the counter's corners: never more than its height allows
        g = R(0, 0, sl, 1) | (RR(0, 0, W, yb, ro * 0.82, (0, 1, 1, 0)) & ~RR(sl, st, W - sr, yb - st, rc, (0, 1, 1, 0)))
        g &= ~k.corner_cut(0, 0, 0.03, "tl")
    elif ch == "R":
        yb = 0.600
        rc = min(ri * 0.8, (yb - 2 * st) * 0.42)
        g = R(0, 0, sl, 1) | (RR(0, 0, W, yb, ro * 0.82, (0, 1, 1, 0)) & ~RR(sl, st, W - sr, yb - st, rc, (0, 1, 1, 0)))
        g |= P([(W * 0.40, yb - st), (W * 0.40 + sr * 1.02, yb - st), (W, 1), (W - sr * 1.04, 1)])
        g &= ~k.corner_cut(0, 0, 0.03, "tl")
    elif ch == "B":
        # an electric car's B (0.30.3), in the same strokes: the upright, two bowls on a middle bar, the upper narrower
        m0, m1, wt = 0.5 - st / 2, 0.5 + st / 2, W * 0.94
        g = R(0, 0, sl, 1)
        rc = min(ri * 0.8, (m0 - st) * 0.42)              # the counters' corners: never more than their height allows
        g |= RR(0, 0, wt, m1, ro * 0.7, (0, 1, 1, 0)) & ~RR(sl, st, wt - sr, m0, rc, (0, 1, 1, 0))
        g |= RR(0, m0, W, 1, ro * 0.8, (0, 1, 1, 0)) & ~RR(sl, m1, W - sr, 1 - sb, rc, (0, 1, 1, 0))
        g &= ~k.corner_cut(0, 0, 0.03, "tl") & ~k.corner_cut(0, 1, 0.03, "bl")
    elif ch == "N":
        dw = sr * 0.98
        g = R(0, 0, sl, 1) | R(W - sl, 0, W, 1) | P([(0, 0), (dw, 0), (W, 1), (W - dw, 1)])
    elif ch == "M":
        dw = sr * 0.86
        g = R(0, 0, sl, 1) | R(w - sl, 0, w, 1)
        g |= P([(0, 0), (dw, 0), (w / 2 + dw / 2, 0.80), (w / 2 - dw / 2, 0.80)])
        g |= P([(w, 0), (w - dw, 0), (w / 2 - dw / 2, 0.80), (w / 2 + dw / 2, 0.80)])
    elif ch == "S":
        # a 2 turned about: the upper half open to the right, the lower to the left
        m0, m1 = 0.5 - st / 2, 0.5 + st / 2
        r = ro * 0.6
        top = RR(0, 0, W, m1, r, (0, 1, 1, 0)) & ~R(-1, st, W - sr, m0) & ~R(-1, m0, r, m1 + 1)
        bot = RR(0, m0, W, 1, r, (1, 0, 0, 1)) & ~R(sr, m1, W + 1, 1 - sb) & ~R(W - r, m0 - 1, W + 1, m1)
        g = (top | bot)[:, ::-1]
    else:
        raise KeyError(ch)
    return k, g, w, G["lb"], G["rb"]


def gear_glyph(ch):
    """-> (alpha image at EM px/em, pen x, pen y (baseline), advance in em)"""
    k, g, w, lb, rb = gear_figure(ch)
    img = Image.fromarray((g * 255).astype(np.uint8), "L")
    unit = k.unit
    return img, k.pad * unit - lb * unit, (k.pad + 1.0) * unit, (lb + w + rb) * CAP


FIGURES = {
    "mw": (WIDE, "0123456789PRNDSMB"),
    "mn": (NORM, "0123456789:.+-/"),
}
GEAR_LETTERS = "PRNDSMB"


def proof(out):
    """every glyph, small, on one sheet"""
    tiles = []
    for face, (F, chars) in FIGURES.items():
        for ch in chars:
            img, _, _, _ = figure_glyph(F, ch)
            tiles.append(img.resize((img.size[0] // 6, img.size[1] // 6), Image.LANCZOS))
    for ch in ICONS:
        img, _, _, _ = icon_glyph(ch)
        tiles.append(img.resize((img.size[0] // 6, img.size[1] // 6), Image.LANCZOS))
    for ch in TRACK_ICONS:
        img, _, _, _ = track_icon_glyph(ch)
        tiles.append(img.resize((img.size[0] // 6, img.size[1] // 6), Image.LANCZOS))
    for ch in GEAR_LETTERS:
        img, _, _, _ = gear_glyph(ch)
        tiles.append(img.resize((img.size[0] // 6, img.size[1] // 6), Image.LANCZOS))
    W = 1800
    x = y = row = 0
    pos = []
    for t in tiles:
        if x + t.size[0] > W:
            x, y, row = 0, y + row + 6, 0
        pos.append((x, y))
        x += t.size[0] + 6
        row = max(row, t.size[1])
    sheet = Image.new("L", (W, y + row + 6), 30)
    for t, p in zip(tiles, pos):
        sheet.paste(t, p)
    sheet.save(out)


if __name__ == "__main__":
    proof(sys.argv[1] if len(sys.argv) > 1 else "build/mglyphs.png")
