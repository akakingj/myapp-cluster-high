#!/usr/bin/env python3
"""
Bake app/previews_data.js: each design's picture for the app's page (app/previews.js), as the cluster
draws it in the preview (tools/shot.js, preview/index.html) with BMW's strip under it, 600 x 225, deflated
RGB as base64. Run it after a change to how a design looks:

    python3 tools/make-previews.py

Needs Node with playwright (as tools/shot.js) and Pillow.
"""
import base64, os, subprocess, sys, tempfile, zlib
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 600, 225
# the designs as the page lists them (app/entry.js DESIGNS), each with the preview's query
DESIGNS = [
    ('toro_genuine', 'style=toro&background=genuine'),
    ('toro_modern', 'style=toro&background=modern'),
    ('toro_revuelto', 'style=toro&background=revuelto'),
    ('track', 'style=track'),
    ('mplus', 'style=mplus'),
    ('mtrack', 'style=mtrack'),
]

def main():
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        for key, q in DESIGNS:
            png = os.path.join(tmp, key + '.png')
            subprocess.run(['node', os.path.join(ROOT, 'tools', 'shot.js'), png,
                            't=6&freeze=1&' + q + '&units=metric&bmwStrip=on'], check=True, cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            im = Image.open(png).convert('RGB').resize((W, H), Image.LANCZOS)
            out[key] = base64.b64encode(zlib.compress(im.tobytes(), 9)).decode('ascii')
            print(key, len(out[key]))
    lines = ["'use strict';",
             '/* Made by tools/make-previews.py: each design\'s picture, %d x %d, deflated RGB as base64. */' % (W, H),
             'module.exports = {', '    w: %d, h: %d,' % (W, H), '    designs: {']
    lines += ["        %s: '%s'," % (k, out[k]) for k, _ in DESIGNS]
    lines += ['    }', '};', '']
    with open(os.path.join(ROOT, 'app', 'previews_data.js'), 'w') as f:
        f.write('\n'.join(lines))

if __name__ == '__main__':
    sys.exit(main())
