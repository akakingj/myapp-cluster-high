# M Track Mode: how the reference frame was measured

The style is traced off one photograph,
[m-track-reference.jpg](m-track-reference.jpg), to the guide in
[M-TRACK-SPEC.md](M-TRACK-SPEC.md). This is the working: what was done to
the photograph before anything was measured, what was measured, where the
figures went (`src/theme/tgeom.js`, which the shaders, the layout and the
comparison tool all read), what the frame does not say, and how close the
result is.

| | |
|---|---|
| File | `docs/ref/m-track-reference.jpg` (`IMG_9533.jpeg`), 1582 × 579, SHA-256 `3da2af13c7240ee01fd40fc5a528486f2d73694ebe10b49165933716673f88de` (the digest the guide names) |
| State shown | 0 km/h, D, 840 rpm, 19:02, 402 km of range, +21.0 °C outside, fuel a little over half, oil about 75 °C; the boost row's mark at 0.0 |
| Not the style's | the three lamps at the left edge (parking sensors, side lights, dipped beam) and the speed limit sign: the car's own. The lamps are never drawn; the sign only in the reference fixture |

## 1. The photograph is rectified first

It is a photograph of a curved display, taken a little from one side.
Level lines in it bow and tilt by up to 8 px, uprights lean by up to 3°,
and the picture is 1.7 % larger at its top than at its foot — more than
the 1 – 2 px the guide's own tolerances allow for. Tracing it as it stands
would have built that distortion into the style. So two maps were fitted,
and everything was measured in the frame they produce:

1. **Level.** `y_f = y − T(x, y)`, with `u = (x − 791) / 800`,
   `v = (y − 289.5) / 300`, `w = max(0, (700 − x) / 600)` and

   `T = 7.5015 u + 1.5784 u v − 0.2128 u² + 4.6449 w² + 32.9769 w² v + 1.1571 w² v² − 2.8757 w³ − 24.9147 w³ v`

   fitted to 28 edges that are level in the design (the body's top and
   foot, the black band's two edges, the four gauge rails, the rev
   counter's top line, the strips' ends, the footer panel): **rms
   0.14 px**. It is a turn of about half a degree everywhere and, left of
   x = 700, a perspective that closes the lines up.
2. **Square.** `q = 1 + C (y_f − 289.5)`, `x_d = X0 + (x − X0) / q`,
   `y_d = 289.5 + (y_f − 289.5) / q`, with `C = −7.917e−5` and
   `X0 = 564.4`, fitted to 15 diagonals and 6 uprights (the gear's and the
   figures' stems): the photograph's scale at each height.

In the rectified frame the four gauge rows are evenly spaced (56.9, 56.8,
57.05 apart), uprights are upright, and the diagonals — which lean both
ways — all have one slope. `tools/mt-compare.py` carries both maps and
writes the rectified frame (`reference.png`) beside the photograph.

What the two maps leave: about 1 px along the longest edges, and up to
3 px in the footer's corners, where nothing level was there to fit (the
outside temperature stands 3 px lower in the frame than the time; the
style sets all three on one line).

## 2. One lean

Rectified, the slopes of every diagonal measured (x per unit down):

| Line | Slope | Line | Slope |
|---|---|---|---|
| wing, upper left edge | −0.591 | rev counter, contour | −0.5855 |
| wing, lower left edge | +0.586 | rev counter, face's edge | −0.5854 |
| first seam, left side | −0.5845 | rev counter, rail (both edges) | −0.5861 |
| upper plate, left edge | −0.577 | oil ladder | −0.586 |
| lower plate, left edge | −0.593 | fuel ladder | −0.581 |
| second seam, right side | −0.5775 | ribbon, outer edge above its point | +0.586 |
| lower plate, right edge | −0.569 | ribbon, outer edge below it | −0.576 |

They run 0.569 – 0.593; the rev counter's three long lines, the best
measured, 0.5854 – 0.5861. The style sets **every diagonal on 0.5855**
(`T.K`), each through its own measured middle. Checked edge by edge
against the rectified frame afterwards, none stands more than 1.8 units
from where the frame has it, and most within 0.5.

A line leaning "/" is written by its constant `u = x + K y`, one leaning
"\" by `w = x − K y`.

## 3. The body

| | |
|---|---|
| Top, foot | y 111.6, 444.5 |
| The black band the gear stands on | y 194.4 – 300.05 |
| Wing | (223.7, 111.6) → (685.8, 111.6) → (490.8, 444.5) → (191.5, 444.5), radius 30 → the point (110.1, 305.6), radius 19 |
| First seam | u 751.1 – 756.1 (5 units of black) |
| Upper plate | (690.8, 111.6) → (909.8, 111.6) → (939.2, 161.8) → (920.2, 194.4) → (642.3, 194.4), all sharp |
| Lower plate | (580.4, 300.05) → (858.3, 300.05) → (773.7, 444.5) → (495.8, 444.5) |
| Second seam | u 1034.0 – 1039.5 |
| Ribbon | (942.0, 166.5) → its point (995.2, 257.4) → (885.7, 444.5), radius 26 → (779.2, 444.5) |

**Light.** One fall of light by height serves every plate — bright at the
top, darkest behind the gear, lighter again to the foot (fitted per plate
to the frame, away from every figure and line; the fits agree to a few
levels):

| y | 112 | 200 | 280 | 340 | 444 |
|---|---|---|---|---|---|
| R, G, B | 46, 87, 190 | 38, 71, 146 | 33, 62, 126 | 35.5, 67.5, 139 | 45, 83, 178 |

The wing darkens to its left by 0.081 % a unit from x = 600 (its left
third is two thirds as bright as its right); the ribbon a little to its
right. The black band is (11, 13, 23), the ground (3, 4, 7).

**The M bands**, three slabs side by side on the lean, each 64 units
across: light blue (u 482.2 – 546.5), a deeper blue (546.5 – 610.3), red
(610.3 – 673.0). What each adds to the plate, and how strongly by height:

| Band | Adds (R, G, B) | Strength by height |
|---|---|---|
| light blue | +15, +29, +72 | 0.8 at the top, 1.0 at 215, 0.97 at 280, 0.2 at 330, gone by 360 |
| deeper blue | × 0.84, 0.90, 1.03 | whole to 330, half by the foot |
| red | +100, −11, −30 | 0.45 at the top, 1.0 at 175, 0.95 at 215, 0.71 at 274, 0.23 at 331, gone by 375 |

**The fine lines.** Found by taking the frame's local contrast (each pixel
less a wide blur of its surroundings) and following the ridges:

| Line | Runs | Strength |
|---|---|---|
| A | "/" at u 620.1, from over the wing (y 72) to under it (y 548) | 0.13 |
| H | level at y 218.0, from B to the first seam | 0.14 |
| B | "\" at w 366.1, from H down across the seam to D (y 412.8) | 0.20 |
| F | "\" at w 133.6, off A at y 414 and out through the wing's foot | 0.08 |
| U1 | "\" at w 819.0, from the upper plate's top through the ribbon and on to y 545 | 0.20 |
| D | "/" at u 849.9, down the lower plate and out | 0.10 |
| R1, R2 | "/" at u 1077.3 in the ribbon's foot, and level at y 414 off it | 0.10 |
| H2 | level at y 218.7, off U1 and away to x 1392, behind the rev counter | 0.12 |
| T5 | a short "\" by the rev counter's 5 | 0.07 |

Out on the black a line is far fainter than on a plate (about a twelfth of
white). A and U1 sit 3 – 5 px further out in the frame's footer than a
straight line puts them: the frame's leftover distortion there, not drawn.

## 4. The gauge rows

Four, 56.88 apart, the first rail's top at y 195.07. Each: a rail 4.1
tall in four pieces (cuts 2.6 wide at 340.95, 396.45 and 451.2), a fine
line 2.45 tall 6.0 below the rail's top, both from x 285.7 to 504.7 at
the rail's top and cut on the lean at each end; a stroke on to the unit
(x 506 – 540.5). Three figures over it (16.6 tall, the narrow face): the
first from x 279.85, the middle one about 393.3, the last ending at
504.5; the unit ending at 539.2; the symbol's middle at x 232.7, 2.6
above the rail's top.

| Row | Figures | Unit | Symbol | The line's colours |
|---|---|---|---|---|
| 1 | 0.0 · 0.9 · 1.9 | bar | turbocharger | one colour |
| 2 | 70 · 100 · 130 | °C | thermometer in waves | red for its last eighth (from about 122 °C) |
| 3 | 50 · 100 · 150 | °C | oil can, thermometer | blue to 0.16 (66 °C), red from 0.845 (134 °C) |
| 4 | −20 · 15 · 50 | °C | thermometer in stacked cores | one colour |

**How a row shows its reading is not in the frame.** All four rails are
whole and white, though the car is idling in D: so the rail is not lit up
to the reading, as the two ladders right of the rev counter are (theirs
show lit and unlit pieces in this same frame). What the frame does have is
a small block joining rail and line at the left end of the boost row
alone — 7 units wide, from the rail's top to the line's foot, starting
where the rail starts: where 0.0 bar is. The style takes that for the
reading's mark and slides it along the rail (`T.ROWS.markW`); the other
three rows show none in the frame, which a reading under its scale's
start, or none at all, would explain. That is a reading of one frame, not
knowledge of BMW's cluster, so there is a second way to show it in the
settings: the rail past the mark dimmed, which reads as a bar.

Row 4's symbol is taken for charge-air (intake) temperature: its scale is
an air temperature's.

## 5. The rev counter

| | |
|---|---|
| Contour's centre line | u 1172.85, 2.8 wide |
| Dark face | from the contour to u 1248.79; from 2.6 under the top line |
| Black strip with the ticks | 29 units, to the rail |
| Rail | u 1278.01 – 1290.35 |
| Level top line | y 78.5 – 81.2, from x 1047.5 to the rail's outer edge |
| The contour's turn | it hooks round into the top line's **left** end on a radius of 7 (the two are one stroke); the line runs on to the rail from there |
| Ticks | 21 long, ending 2.5 short of the rail |
| Marker | a level white bar 4.5 tall from the contour to 1.6 past the rail, its ends on the lean; 3 units of black either side |
| Lit band | under the marker, from the contour to the rail's outer edge, down to y 480.2; its right corner radius 27, its left edge turning on a radius of 19 into a rail (y 473.9 – 479.2) that runs back to x 744 |
| Red field | a strip 2.5 wide 3 inside the rail, from the top mark down to the redline, and the top mark's own tick heavier in its colour: the "7" under the frame's 8 (its field starts at about 7,600) |

**The scale is not even.** The ticks, measured:

| Mark | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| y measured | 417.40 | 371.99 | 326.01 | 279.89 | 233.61 | 190.56 | 147.53 |
| y drawn | 417.41 | 371.46 | 325.51 | 279.56 | 233.61 | 190.57 | 147.53 |

45.4 – 46.3 apart up to 5, then 43.05 and 43.03: a step, not a
distortion (the gauge rows beside it are even over the same heights). The
style draws 45.95 a thousand to 5,000 and 43.04 from there, and finds a
value between the two marks either side of it (`T.revY`); 0 is at y
463.36 and 8 at 104.49. The frame's marker stands at y 424.75: 840 rpm on
that scale.

The numerals are the dials' wide figures, 20 tall, each level with its
mark and starting about 20 right of the rail (a 4 starts 15.4, its foot
reaching left); the frame's nine are set where the frame has them. They
are all one pale pink — none is lit or larger at the marker.

A diesel's scale (0 – 6) is the same dial with seven marks spread evenly
over the same height.

## 6. Oil and fuel

Two ladders on the lean, y 320.3 – 463.0, cut at 355.1, 391.0 and 426.8:
each 12.75 wide, then 1.85 of black, then a fine line 4.4 wide. The oil's
left edge is at u 1263.4 + 322 K, the fuel's 113 further right. Unlit
pieces (123, 131, 154), lit (236, 239, 244); the fuel's last piece, lit,
is (161, 168, 190). The oil's line is red above y 338 (about 138 °C) and
blue below 446 (about 62 °C). In the frame the oil's ladder is lit to
its first cut (75 °C on 50 – 150) and the fuel's to y 385 (0.55).

## 7. The footer and the trims

| | |
|---|---|
| Four-pane panel | y 493.75 – 541.4; left edge x 701.8 → 674.5, right 982.1 → 955.8; cuts 3 wide at 744.5 → 771.9 (leaning the other way), 838.1 → 811.0, 920.1 → 892.8; (24, 46, 102) at its top to (47, 76, 146) at its foot |
| The light along its top | a fine bright edge y 487.3 – 489.0 over a band of colour to 493.7, from x 619 to 1009: blue from the left (whole to 648, gone by 722), red from the right (from 824, whole by 990); each end throws a leaning patch on the glass under it, fading down to y 514 |
| Hook | from (607, 453) down the lean, turning on a radius of 18 into a level stroke at y 476.6 that ends at x 691.5 |
| Bracket | a level stroke at y 81.3 from 567.5 to 606, its foot leaning to (555.3, 101.6); 3.2 wide |
| Speed limit sign | centre (560, 515), a white disc of radius 24.5 in a red ring to 30.5 (fixture only) |

The footer's figures are the narrow face, 22.4 tall, on y 538.6: the time
from x 124.7, the range from 352.3 after its symbol, the outside
temperature ending at 1526 before its unit.

## 8. Figures and symbols

- **The gear.** The frame's D is 95.7 × 80.0: an upright 0.262 of its
  height, a bowl 0.347, bars 0.187 and 0.200, the outer corners rounded by
  0.33 and the counter's by 0.20 — not the dials' D, whose upright is as
  heavy as its bowl. It has a face of its own (`mg`: P R N D S M, the five
  the frame does not show drawn in the same hand); a gear number is the
  dials' figure at the same height.
- **The speed** is the dials' wide figure, 37 tall, ending at x 831.8; its
  unit (Inter Tight, 22.2 to the em) starts at 840.2.
- **The rows' four symbols** were each traced from a thirty-times
  enlargement and checked against the frame by correlation, blurred to the
  photograph's softness and searched over a quarter-pixel grid: turbo 0.87,
  coolant 0.89, oil 0.92, charge air 0.89, the M mark 0.73 (its letter is
  the M View's, set heavier). The four for the other readings a row can
  show (oil pressure, the 12 V battery, a drive battery's charge and
  temperature) are not in the frame and are drawn to match.
- The fuel pump, the range's pump, and the strips' oil can are the M
  View's (`mi`), at 1.065, 1.0 and 0.94 of their size there.

All of it is in the atlas after everything that was there (rows 867 – 980
of 1024): no glyph the other styles draw moved, and the atlas's first 866
rows are byte for byte what they were.

## 9. The fit to the panel

`PANEL_FIT = { s: 1.17, ox: 86, oy: 8 }`: uniform, the footer's figures
ending three rows above the car's own strip (y 646).

The guide's own fit for a 1920 × 720 screen would be 1.2137 from the left
edge. This one is 3.6 % smaller and 86 px further right, for one reason:
the picture a map or a camera brings is drawn by the car at 416,120
1088×480 and nowhere else, and at this fit that slot's left edge falls at
frame x 282 — where the gauge rows begin — so the picture that replaces
the rows replaces all of them. At the guide's fit it would begin a
quarter of the way along the rails. It also keeps the rev counter's
numerals clear of an M car's right-hand box.

**A second fit, for the whole wing** (0.10.0; `tgeom.js`: `wholeFit`).
Asked for: the picture should run to the wing's point, not begin at a
straight edge part way along it. The slot has nothing left of panel x 416
and the wing's point is at frame x 113 (panel x 218 at the fit above), so
with a picture chosen the fit is `{ s: 1.17, ox: 279.5, oy: 8 }`: the same
scale and height, 193.5 px further right, which stands the window's own
point - where its two left edges meet, each 6 units inside the wing's:
frame x 117 - half a pixel inside the slot's edge. The window is then the wing's outline: the
upper-left and lower-left edges each `insetL` (6) inside the wing's and in
over `featherL`, in place of the upright edge at the slot's side. At this
fit the fuel ladder ends at panel x 1913 and the wing shows 30 % of the
slot's picture (21 % at the fit above), its middle included. It is used
only with a picture chosen, not lowered, and not where an M car's boxes
would land on the gear or the speed (`mCarS58`); *Left wing: how much of
it a picture takes → The style stays where it is* keeps the fit above.

## 10. What the frame does not say

- **How a gauge row marks its reading** (section 4).
- **Anything that moves.** The marker's travel, the lit band following it,
  the red field's length, the ladders' levels are the frame's shapes put
  to the readings; the limiter's flash is the M View style's.
- **The wing with a picture in it.** The guide's own (its section 23), not
  BMW's: the wing and nothing else, soft at every edge, the rows gone, the
  bands and the fine lines kept over it at a third of their strength.
  The guide's fade (full to x 386, gone by 620) assumes a picture that can
  be put anywhere; the car's slot starts at x 282, so with the style where
  the frame has it the picture is whole from x 319 to 22 units inside the
  seam - and with the second fit of section 9, from the wing's own two
  left edges.
- **A gear number**, other units, a diesel's scale, an electric car's
  rows: built from the frame's own pieces.

## 11. How close it is

`python3 tools/mt-compare.py` renders the reference fixture
(`preview/index.html?fixture=mt`) on the frame's own artboard, one render
pixel a frame unit, and compares it with the rectified frame. As built:

| Region | Mean colour difference (of 255) | The photograph's edges with one of ours within 2 px | Ours with one of the photograph's |
|---|---|---|---|
| the whole frame | 7.80 | 98.1 % | 98.9 % |
| A: the wing and its gauge rows | 10.68 | 97.9 % | 99.0 % |
| B: the plates, the gear and the speed | 6.50 | 96.6 % | 99.9 % |
| C: the rev counter | 10.01 | 98.9 % | 99.3 % |
| D: oil and fuel | 14.74 | 99.7 % | 100.0 % |
| E: the footer, left and middle | 10.44 | 97.1 % | 98.6 % |
| F: the footer, right | 8.96 | 96.5 % | 94.9 % |

At the control points (section 12: 183 lie on an edge or a line, and 182
of those could be measured), the photograph's picture sits within 1 px of
ours at **161**, within 2 px at **177**, 0.64 px apart on average and
3.61 px at worst. Beyond 2 px: `wing.top-left` 2.2 px, `hair.R2.b` 3.0 px,
`hair.T5.b` 3.6 px, `fuel.ladder.l445` 2.2 px, `foot.panel.tl` 3.0 px.
Those five were left as they are. Each is a corner, the far end of a fine
line or a ladder's foot - where, as far as could be told, either the
rectification is at its weakest or the photograph's own edge is two pixels
of blur - and moving any of them to fit would move neighbours that
measure better.

The numbers cannot reach zero: the photograph has grain, a bloom round
every bright figure and the dark halo a phone's sharpening leaves beside
it, none of which is drawn. They are for holding one build against the
next. Nothing here is a claim that the style is BMW's cluster pixel for
pixel; it is a reconstruction from one frame, measured.

## 12. The control points

From `node tools/mt-points.js`: every one worked out from
`src/theme/tgeom.js`.

| Point | x | y | Kind | What |
|---|---|---|---|---|
| `wing.top-left` | 223.7 | 111.6 | edge | wing: top-left corner |
| `wing.e0` | 454.7 | 111.6 | edge | wing: edge top-left - top-right, its middle |
| `wing.top-right` | 685.8 | 111.6 | edge | wing: top-right corner |
| `wing.e1` | 588.3 | 278 | edge | wing: edge top-right - foot-right, its middle |
| `wing.foot-right` | 490.8 | 444.5 | edge | wing: foot-right corner |
| `wing.e2` | 341.1 | 444.5 | edge | wing: edge foot-right - foot-left, its middle |
| `wing.e3` | 150.8 | 375.1 | edge | wing: edge foot-left - point, its middle |
| `wing.e4` | 166.9 | 208.6 | edge | wing: edge point - top-left, its middle |
| `up.top-left` | 690.8 | 111.6 | edge | upper plate: top-left corner |
| `up.e0` | 800.3 | 111.6 | edge | upper plate: edge top-left - top-right, its middle |
| `up.top-right` | 909.8 | 111.6 | edge | upper plate: top-right corner |
| `up.e1` | 924.5 | 136.7 | edge | upper plate: edge top-right - right, its middle |
| `up.right` | 939.2 | 161.8 | edge | upper plate: right corner |
| `up.e2` | 929.7 | 178.1 | edge | upper plate: edge right - foot-right, its middle |
| `up.foot-right` | 920.2 | 194.4 | edge | upper plate: foot-right corner |
| `up.e3` | 781.2 | 194.4 | edge | upper plate: edge foot-right - foot-left, its middle |
| `up.foot-left` | 642.3 | 194.4 | edge | upper plate: foot-left corner |
| `up.e4` | 666.5 | 153 | edge | upper plate: edge foot-left - top-left, its middle |
| `low.top-left` | 580.4 | 300.1 | edge | lower plate: top-left corner |
| `low.e0` | 719.4 | 300.1 | edge | lower plate: edge top-left - top-right, its middle |
| `low.top-right` | 858.3 | 300.1 | edge | lower plate: top-right corner |
| `low.e1` | 816 | 372.3 | edge | lower plate: edge top-right - foot-right, its middle |
| `low.foot-right` | 773.7 | 444.5 | edge | lower plate: foot-right corner |
| `low.e2` | 634.8 | 444.5 | edge | lower plate: edge foot-right - foot-left, its middle |
| `low.foot-left` | 495.8 | 444.5 | edge | lower plate: foot-left corner |
| `low.e3` | 538.1 | 372.3 | edge | lower plate: edge foot-left - top-left, its middle |
| `rib.top` | 942 | 166.5 | edge | ribbon: top corner |
| `rib.e0` | 968.6 | 212 | edge | ribbon: edge top - point, its middle |
| `rib.point` | 995.2 | 257.4 | edge | ribbon: point corner |
| `rib.e1` | 940.5 | 351 | edge | ribbon: edge point - foot-right, its middle |
| `rib.e2` | 832.5 | 444.5 | edge | ribbon: edge foot-right - foot-left, its middle |
| `rib.foot-left` | 779.2 | 444.5 | edge | ribbon: foot-left corner |
| `rib.e3` | 860.6 | 305.5 | edge | ribbon: edge foot-left - top, its middle |
| `band.light.l140` | 400.2 | 140 | edge | bands: light band, left edge |
| `band.mid.l140` | 464.5 | 140 | edge | bands: mid band, left edge |
| `band.red.l140` | 528.3 | 140 | edge | bands: red band, left edge |
| `band.red.r140` | 591 | 140 | edge | bands: red band, right edge |
| `band.light.l240` | 341.7 | 240 | edge | bands: light band, left edge |
| `band.mid.l240` | 406 | 240 | edge | bands: mid band, left edge |
| `band.red.l240` | 469.8 | 240 | edge | bands: red band, left edge |
| `band.red.r240` | 532.5 | 240 | edge | bands: red band, right edge |
| `hair.A.a` | 486 | 229.1 | line | fine lines: fine line A |
| `hair.A.b` | 391.2 | 390.9 | line | fine lines: fine line A |
| `hair.H.a` | 537.1 | 218 | line | fine lines: fine line H |
| `hair.H.b` | 580.9 | 218 | line | fine lines: fine line H |
| `hair.B.a` | 531.4 | 282.3 | line | fine lines: fine line B |
| `hair.B.b` | 570.2 | 348.5 | line | fine lines: fine line B |
| `hair.F.a` | 394.9 | 446.3 | line | fine lines: fine line F |
| `hair.F.b` | 414.4 | 479.7 | line | fine lines: fine line F |
| `hair.U1.a` | 968.2 | 254.9 | line | fine lines: fine line U1 |
| `hair.U1.b` | 1054.4 | 402.1 | line | fine lines: fine line U1 |
| `hair.D.a` | 639.5 | 359.4 | line | fine lines: fine line D |
| `hair.D.b` | 603.6 | 420.6 | line | fine lines: fine line D |
| `hair.R1.a` | 820.2 | 439.1 | line | fine lines: fine line R1 |
| `hair.R1.b` | 805.1 | 464.9 | line | fine lines: fine line R1 |
| `hair.R2.a` | 857.1 | 414 | line | fine lines: fine line R2 |
| `hair.R2.b` | 881.9 | 414 | line | fine lines: fine line R2 |
| `hair.H2.a` | 1093.9 | 218.7 | line | fine lines: fine line H2 |
| `hair.H2.b` | 1245.2 | 218.7 | line | fine lines: fine line H2 |
| `hair.T5.a` | 1199.3 | 266.1 | line | fine lines: fine line T5 |
| `hair.T5.b` | 1211.5 | 286.9 | line | fine lines: fine line T5 |
| `row1.rail.start` | 284.5 | 197.1 | edge | row 1: the rail's left end |
| `row1.rail.end` | 503.5 | 197.1 | edge | row 1: the rail's right end |
| `row1.cut1` | 339.7 | 197.1 | line | row 1: cut 1 in the rail |
| `row1.cut2` | 395.2 | 197.1 | line | row 1: cut 2 in the rail |
| `row1.cut3` | 450 | 197.1 | line | row 1: cut 3 in the rail |
| `row1.rail.top` | 370 | 195.1 | edge | row 1: the rail's top edge |
| `row1.line.foot` | 425 | 203.5 | edge | row 1: the fine line's lower edge |
| `row1.line.end` | 500.5 | 202.3 | edge | row 1: the fine line's right end |
| `row1.label` | 393.3 | 182.2 | anchor | row 1: the middle figure |
| `row1.icon` | 232.7 | 192.5 | anchor | row 1: the symbol's middle |
| `row2.rail.start` | 284.5 | 254 | edge | row 2: the rail's left end |
| `row2.rail.end` | 503.5 | 254 | edge | row 2: the rail's right end |
| `row2.cut1` | 339.7 | 254 | line | row 2: cut 1 in the rail |
| `row2.cut2` | 395.2 | 254 | line | row 2: cut 2 in the rail |
| `row2.cut3` | 450 | 254 | line | row 2: cut 3 in the rail |
| `row2.rail.top` | 370 | 251.9 | edge | row 2: the rail's top edge |
| `row2.line.foot` | 425 | 260.4 | edge | row 2: the fine line's lower edge |
| `row2.line.end` | 500.5 | 259.2 | edge | row 2: the fine line's right end |
| `row2.label` | 393.3 | 239.1 | anchor | row 2: the middle figure |
| `row2.icon` | 232.7 | 249.3 | anchor | row 2: the symbol's middle |
| `row3.rail.start` | 284.5 | 310.9 | edge | row 3: the rail's left end |
| `row3.rail.end` | 503.5 | 310.9 | edge | row 3: the rail's right end |
| `row3.cut1` | 339.7 | 310.9 | line | row 3: cut 1 in the rail |
| `row3.cut2` | 395.2 | 310.9 | line | row 3: cut 2 in the rail |
| `row3.cut3` | 450 | 310.9 | line | row 3: cut 3 in the rail |
| `row3.rail.top` | 370 | 308.8 | edge | row 3: the rail's top edge |
| `row3.line.foot` | 425 | 317.3 | edge | row 3: the fine line's lower edge |
| `row3.line.end` | 500.5 | 316.1 | edge | row 3: the fine line's right end |
| `row3.label` | 393.3 | 296 | anchor | row 3: the middle figure |
| `row3.icon` | 232.7 | 306.2 | anchor | row 3: the symbol's middle |
| `row4.rail.start` | 284.5 | 367.8 | edge | row 4: the rail's left end |
| `row4.rail.end` | 503.5 | 367.8 | edge | row 4: the rail's right end |
| `row4.cut1` | 339.7 | 367.8 | line | row 4: cut 1 in the rail |
| `row4.cut2` | 395.2 | 367.8 | line | row 4: cut 2 in the rail |
| `row4.cut3` | 450 | 367.8 | line | row 4: cut 3 in the rail |
| `row4.rail.top` | 370 | 365.7 | edge | row 4: the rail's top edge |
| `row4.line.foot` | 425 | 374.2 | edge | row 4: the fine line's lower edge |
| `row4.line.end` | 500.5 | 372.9 | edge | row 4: the fine line's right end |
| `row4.label` | 393.3 | 352.8 | anchor | row 4: the middle figure |
| `row4.icon` | 232.7 | 363.1 | anchor | row 4: the symbol's middle |
| `rev.top.start` | 1047.5 | 79.8 | edge | rev counter: the level top line, its left end |
| `rev.top.mid` | 1080 | 79.8 | line | rev counter: the level top line (left of the title, which stands right over it) |
| `rev.top.end` | 1243.6 | 79.8 | edge | rev counter: the level top line, where the rail ends it |
| `rev.con.130` | 1096.7 | 130 | line | rev counter: the fine contour |
| `rev.face.130` | 1172.7 | 130 | edge | rev counter: the dark face's right edge |
| `rev.railL.130` | 1201.9 | 130 | edge | rev counter: the rail, left edge |
| `rev.railR.130` | 1214.2 | 130 | edge | rev counter: the rail, right edge |
| `rev.con.200` | 1055.8 | 200 | line | rev counter: the fine contour |
| `rev.face.200` | 1131.7 | 200 | edge | rev counter: the dark face's right edge |
| `rev.railL.200` | 1160.9 | 200 | edge | rev counter: the rail, left edge |
| `rev.railR.200` | 1173.3 | 200 | edge | rev counter: the rail, right edge |
| `rev.con.270` | 1014.8 | 270 | line | rev counter: the fine contour |
| `rev.face.270` | 1090.7 | 270 | edge | rev counter: the dark face's right edge |
| `rev.railL.270` | 1119.9 | 270 | edge | rev counter: the rail, left edge |
| `rev.railR.270` | 1132.3 | 270 | edge | rev counter: the rail, right edge |
| `rev.con.340` | 973.8 | 340 | line | rev counter: the fine contour |
| `rev.face.340` | 1049.7 | 340 | edge | rev counter: the dark face's right edge |
| `rev.railL.340` | 1078.9 | 340 | edge | rev counter: the rail, left edge |
| `rev.railR.340` | 1091.3 | 340 | edge | rev counter: the rail, right edge |
| `rev.con.400` | 938.6 | 400 | line | rev counter: the fine contour |
| `rev.face.400` | 1014.6 | 400 | edge | rev counter: the dark face's right edge |
| `rev.railL.400` | 1043.8 | 400 | edge | rev counter: the rail, left edge |
| `rev.railR.400` | 1056.1 | 400 | edge | rev counter: the rail, right edge |
| `rev.tick1` | 1020.6 | 417.4 | line | rev counter: the mark at 1 |
| `rev.tick2` | 1047.5 | 371.5 | line | rev counter: the mark at 2 |
| `rev.tick3` | 1074.4 | 325.5 | line | rev counter: the mark at 3 |
| `rev.tick4` | 1101.3 | 279.6 | line | rev counter: the mark at 4 |
| `rev.tick5` | 1128.2 | 233.6 | line | rev counter: the mark at 5 |
| `rev.tick6` | 1153.4 | 190.6 | line | rev counter: the mark at 6 |
| `rev.tick7` | 1178.6 | 147.5 | line | rev counter: the mark at 7 |
| `rev.tick8` | 1203.8 | 104.5 | line | rev counter: the mark at 8 |
| `rev.marker.left` | 922.5 | 424.8 | edge | rev counter: the marker, its left end (840 rpm) |
| `rev.marker.right` | 1043.3 | 424.8 | edge | rev counter: the marker, its right end |
| `rev.marker.mid` | 985 | 422.5 | edge | rev counter: the marker, its top edge |
| `rev.lit.top` | 975 | 430 | edge | rev counter: the lit band's top edge |
| `rev.lit.foot` | 950 | 480.2 | edge | rev counter: the lit band's foot |
| `rev.lit.right` | 1026.9 | 450 | edge | rev counter: the lit band's right edge |
| `rev.lit.left` | 910.9 | 445 | edge | rev counter: the lit band's left edge |
| `rev.base.top` | 820 | 473.9 | edge | rev counter: the rail under the body, top edge |
| `rev.base.foot` | 820 | 479.2 | edge | rev counter: the rail under the body, bottom edge |
| `rev.base.end` | 745.6 | 476.5 | edge | rev counter: the rail under the body, its left end |
| `rev.num0` | 1051.1 | 463.4 | anchor | rev numerals: numeral 0 |
| `rev.num1` | 1078 | 417.4 | anchor | rev numerals: numeral 1 |
| `rev.num2` | 1104.9 | 371.5 | anchor | rev numerals: numeral 2 |
| `rev.num3` | 1131.8 | 325.5 | anchor | rev numerals: numeral 3 |
| `rev.num4` | 1158.7 | 279.6 | anchor | rev numerals: numeral 4 |
| `rev.num5` | 1185.6 | 233.6 | anchor | rev numerals: numeral 5 |
| `rev.num6` | 1210.8 | 190.6 | anchor | rev numerals: numeral 6 |
| `rev.num7` | 1236 | 147.5 | anchor | rev numerals: numeral 7 |
| `rev.num8` | 1261.2 | 104.5 | anchor | rev numerals: numeral 8 |
| `oil.ladder.l338` | 1254 | 338 | edge | oil strip: the ladder, left edge |
| `oil.line.r338` | 1273 | 338 | edge | oil strip: the fine line, right edge |
| `oil.ladder.l373` | 1233.5 | 373 | edge | oil strip: the ladder, left edge |
| `oil.line.r373` | 1252.5 | 373 | edge | oil strip: the fine line, right edge |
| `oil.ladder.l409` | 1212.5 | 409 | edge | oil strip: the ladder, left edge |
| `oil.line.r409` | 1231.5 | 409 | edge | oil strip: the fine line, right edge |
| `oil.ladder.l445` | 1191.4 | 445 | edge | oil strip: the ladder, left edge |
| `oil.line.r445` | 1210.4 | 445 | edge | oil strip: the fine line, right edge |
| `oil.cut1` | 1250.4 | 355.1 | line | oil strip: cut 1 |
| `oil.cut2` | 1229.4 | 391 | line | oil strip: cut 2 |
| `oil.cut3` | 1208.4 | 426.8 | line | oil strip: cut 3 |
| `oil.top` | 1270.8 | 320.3 | edge | oil strip: the ladder's top |
| `oil.foot` | 1187.2 | 463 | edge | oil strip: the ladder's foot |
| `fuel.ladder.l338` | 1367 | 338 | edge | fuel strip: the ladder, left edge |
| `fuel.line.r338` | 1386 | 338 | edge | fuel strip: the fine line, right edge |
| `fuel.ladder.l373` | 1346.5 | 373 | edge | fuel strip: the ladder, left edge |
| `fuel.line.r373` | 1365.5 | 373 | edge | fuel strip: the fine line, right edge |
| `fuel.ladder.l409` | 1325.4 | 409 | edge | fuel strip: the ladder, left edge |
| `fuel.line.r409` | 1344.4 | 409 | edge | fuel strip: the fine line, right edge |
| `fuel.ladder.l445` | 1304.3 | 445 | edge | fuel strip: the ladder, left edge |
| `fuel.line.r445` | 1323.3 | 445 | edge | fuel strip: the fine line, right edge |
| `fuel.cut1` | 1363.3 | 355.1 | line | fuel strip: cut 1 |
| `fuel.cut2` | 1342.3 | 391 | line | fuel strip: cut 2 |
| `fuel.cut3` | 1321.4 | 426.8 | line | fuel strip: cut 3 |
| `fuel.top` | 1383.7 | 320.3 | edge | fuel strip: the ladder's top |
| `fuel.foot` | 1300.2 | 463 | edge | fuel strip: the ladder's foot |
| `foot.panel.tl` | 701.8 | 493.8 | edge | footer: the panel, top left |
| `foot.panel.bl` | 674.5 | 541.4 | edge | footer: the panel, foot left |
| `foot.panel.tr` | 982.1 | 493.8 | edge | footer: the panel, top right |
| `foot.panel.br` | 955.8 | 541.4 | edge | footer: the panel, foot right |
| `foot.panel.foot` | 840 | 541.4 | edge | footer: the panel's foot |
| `foot.sep1` | 758.2 | 517.6 | line | footer: the cut between panes 1 and 2 |
| `foot.sep2` | 824.5 | 517.6 | line | footer: the cut between panes 2 and 3 |
| `foot.sep3` | 906.5 | 517.6 | line | footer: the cut between panes 3 and 4 |
| `foot.bar.blue` | 660 | 488.1 | line | footer: the light along the panel's top, its blue end |
| `foot.bar.red` | 940 | 488.1 | line | footer: the light along the panel's top, its red end |
| `hook.top` | 607 | 453 | edge | trims: the hook, where it starts |
| `hook.level` | 660 | 476.6 | line | trims: the hook, its level stroke |
| `hook.end` | 691.5 | 476.6 | edge | trims: the hook, its end |
| `bracket.level` | 586.8 | 81.3 | line | trims: the bracket, its level stroke |
| `bracket.end` | 606 | 81.3 | edge | trims: the bracket, its right end |
| `bracket.foot` | 555.3 | 101.6 | edge | trims: the bracket, its foot |
| `limit.sign` | 590.5 | 515 | edge | trims: the speed limit sign, its ring's right side |
| `gear.right` | 854.6 | 247 | edge | figures: the gear, its right side |
| `gear.foot` | 800 | 286.9 | edge | figures: the gear, its foot |
| `gear.top` | 800 | 206.9 | edge | figures: the gear, its top |
| `gear.left` | 758.9 | 247 | edge | figures: the gear, its left side |
| `speed.right` | 831.8 | 347 | edge | figures: the speed, its right side |
| `speed.foot` | 808 | 365.2 | edge | figures: the speed, its foot |
| `speed.unit` | 863 | 357 | anchor | figures: the speed's unit |
| `title` | 1166 | 66 | anchor | figures: the rev counter's title |
| `clock` | 170 | 527 | anchor | figures: the time |
| `range` | 387 | 527 | anchor | figures: the range |
| `outside` | 1486 | 529 | anchor | figures: the outside temperature |
| `mMark` | 184.2 | 467.9 | anchor | figures: the M mark |

206 points, 183 of them on an edge or a line.
