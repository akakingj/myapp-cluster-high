#!/usr/bin/env python3
"""The app's 140x140 iDrive tile: the dial's sweep, its stepped contour and a
hollow red P on a dark plate, drawn from the same geometry as the cluster.
Deterministic.

The plate stands SAFE px in from the tile's edge all round, the corners of
the tile clear. The first icon's plate filled all 140 x 140: the menu draws
its highlight behind and round a tile's icon, so under a plate that covered
the whole tile nothing of it showed, and the selector seemed not to land on
the app (the same menu lights BeeM-Flash's tile, whose plate stops short of
the edge). Nothing here comes nearer the edge than SAFE, and the script
refuses to write an icon that does.
"""
import math, pathlib, sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

S = 4                      # supersample
T = 140                    # the tile
SAFE = 10                  # px of the tile kept clear all round: where the menu's highlight shows
P = T - 2 * SAFE           # the plate
W = P * S
art = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(art)

plate = Image.new('L', (W, W), 0)
ImageDraw.Draw(plate).rounded_rectangle([0, 0, W - 1, W - 1], radius=24 * S, fill=255)
art.paste(Image.new('RGBA', (W, W), (7, 11, 17, 255)), (0, 0), plate)

cx, cy, r = W / 2, W * 0.86, W * 0.62
a0, a1 = -178 + 17.2, -178 + 172.0          # the brief's sweep, degrees
def pt(deg, rr):
    return (cx + rr * math.cos(math.radians(deg)), cy + rr * math.sin(math.radians(deg)))

for i in range(0, 41):
    a = a0 + (a1 - a0) * i / 40
    major = i % 5 == 0
    col = (255, 38, 61, 255) if i > 34 else (232, 240, 246, 255)
    d.line([pt(a, r), pt(a, r - (12 if major else 7) * S)], fill=col, width=int((3 if major else 2) * S / 2 + S / 2))
prev = None
for i in range(0, 161):
    t = i / 160.0
    f = (t * 8) % 1.0
    up = min(1, max(0, (f - 0.12) / 0.10)); dn = min(1, max(0, (f - 0.68) / 0.12))
    p = pt(a0 + (a1 - a0) * t, r * 0.80 + r * 0.035 * (up - dn))
    if prev:
        d.line([prev, p], fill=(255, 38, 61, 255) if t > 0.84 else (164, 178, 189, 255), width=S + 2)
    prev = p

font_path = pathlib.Path(__file__).resolve().parent.parent / 'build' / 'fonts' / 'saira-latin-700-normal.ttf'
if not font_path.exists():
    sys.exit('fonts missing: run tools/fetch-fonts.sh first (the P is Saira 700)')
font = ImageFont.truetype(str(font_path), 62 * S)
glyph = Image.new('L', (W, W), 0)
ImageDraw.Draw(glyph).text((W * 0.5, W * 0.66), 'P', font=font, fill=255, anchor='ms')
lean = math.tan(math.radians(12))
glyph = glyph.transform((W, W), Image.AFFINE, (1, lean, -lean * W * 0.66, 0, 1, 0), resample=Image.BICUBIC)
inner = glyph.filter(ImageFilter.MinFilter(4 * S + 1))
ring = Image.fromarray(np.clip(np.asarray(glyph, 'int16') - np.asarray(inner, 'int16'), 0, 255).astype('uint8'))
art.paste(Image.new('RGBA', (W, W), (255, 38, 61, 255)), (0, 0), ring)

# nothing outside the plate's own outline: its rounded corners stay clear too
art.putalpha(ImageChops.multiply(art.getchannel('A'), plate))

icon = Image.new('RGBA', (T, T), (0, 0, 0, 0))
icon.paste(art.resize((P, P), Image.LANCZOS), (SAFE, SAFE))
a = np.asarray(icon)[..., 3]
ys, xs = np.nonzero(a > 0)
box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
if box[0] < SAFE or box[1] < SAFE or box[2] > T - SAFE or box[3] > T - SAFE:
    sys.exit('the icon reaches %s: outside the %d px it must keep from the tile\'s edge' % (box, SAFE))
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'app/icon.png')
icon.save(out, optimize=True)
print('wrote', out, 'plate', box, 'the tile\'s edge clear by', SAFE, 'px; %.0f %% of the tile opaque' % (100.0 * (a > 250).mean()))
