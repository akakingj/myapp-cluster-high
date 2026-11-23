#!/usr/bin/env node
/*
 * What one frame costs to draw. The preview's own frame, driven flat out in a browser whose GL is a
 * software rasteriser (SwiftShader), so the time is the fragment shaders' work on every pixel the
 * layers cover - which is what the car's GPU does too, far faster. Not the car's timing: a
 * like-for-like measure of one version's drawing against another's, or of one option against none.
 *
 *   node tools/perf-draw.js                          this tree, each style as it comes and with a picture
 *   node tools/perf-draw.js ../some-checkout          another checkout of it
 *   node tools/perf-draw.js . name=query ...          the preview's own queries (see the README)
 *
 *   PERF_LAYERS=1 node tools/perf-draw.js . name=query   ... and where the time goes: each layer's own
 *                                                     share (its rectangle on the panel, its milliseconds)
 *
 * It moves a few per cent from run to run; the median of five batches of sixty frames is printed.
 * docs/PERFORMANCE.md has what was measured.
 */
const { chromium } = require('playwright');
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
function serve() {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            const rel = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
            fs.readFile(file, (err, buf) => {
                if (err) { res.writeHead(404); res.end('no'); return; }
                res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
                res.end(buf);
            });
        });
        srv.listen(0, '127.0.0.1', () => resolve(srv));
    });
}
(async () => {
    const srv = await serve();
    const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    const out = [];
    const has = (f) => fs.existsSync(path.join(ROOT, f));
    const D = 'strip=off&t=4';
    const AS_IT_COMES = ['toro=' + D, 'toro-map=' + D + '&centre=waze&show=map',
        'msport=' + D + '&style=track', 'msport-map=' + D + '&style=track&centre=waze&show=map',
        'mplus=' + D + '&style=mplus', 'mplus-map=' + D + '&style=mplus&centre=waze&show=map']
        .concat(has('src/theme/mtrack.js') ? ['mtrack=' + D + '&style=mtrack', 'mtrack-map=' + D + '&style=mtrack&centre=waze&show=map'] : []);
    for (const arg of (process.argv.length > 3 ? process.argv.slice(3) : AS_IT_COMES)) {
        const label = arg.slice(0, arg.indexOf('=')), query = arg.slice(arg.indexOf('=') + 1);
        const page = await browser.newPage({ viewport: { width: 1920, height: 720 }, deviceScaleFactor: 1 });
        await page.addInitScript(() => {
            const orig = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, attrs) {
                const gl = orig.call(this, type, attrs);
                if (/webgl/.test(type) && gl) window.__gl = gl;
                return gl;
            };
            /* the page asks for its next frame; we hold the request and call it ourselves */
            window.requestAnimationFrame = (cb) => { window.__cb = cb; return 1; };
            /* for the per-layer count: each layer is one viewport and one draw */
            window.__per = null;
            const vp = WebGLRenderingContext.prototype.viewport, da = WebGLRenderingContext.prototype.drawArrays;
            let rect = '', px = new Uint8Array(4);
            WebGLRenderingContext.prototype.viewport = function (x, y, w, h) { rect = [x, 720 - y - h, w, h].join(','); return vp.call(this, x, y, w, h); };
            WebGLRenderingContext.prototype.drawArrays = function (a, b, c) {
                if (!window.__per) return da.call(this, a, b, c);
                const t0 = performance.now();
                da.call(this, a, b, c);
                this.readPixels(0, 0, 1, 1, this.RGBA, this.UNSIGNED_BYTE, px);
                window.__per[rect] = (window.__per[rect] || 0) + performance.now() - t0;
            };
        });
        await page.goto('http://127.0.0.1:' + srv.address().port + '/preview/index.html?' + query, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 30000 }).catch(() => {});
        const err = await page.evaluate(() => window.__error);
        if (err) { console.log(label + '\tPAGE ERROR ' + String(err).slice(0, 120)); await page.close(); continue; }
        const batches = await page.evaluate(async () => {
            const gl = window.__gl, px = new Uint8Array(4);
            let t = performance.now();
            const run = (n) => {
                const t0 = performance.now();
                for (let i = 0; i < n; i++) {
                    const cb = window.__cb; window.__cb = null;
                    cb(t += 16.7);
                    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);      /* wait for the drawing itself */
                }
                return (performance.now() - t0) / n;
            };
            run(30);                                  /* settle: programs linked, the drive under way */
            const res = [];
            for (let b = 0; b < 5; b++) res.push(run(60));
            return res;
        });
        batches.sort((a, b) => a - b);
        out.push({ label, ms: batches[2], best: batches[0] });
        console.log(label + '\t' + batches[2].toFixed(1) + ' ms a frame (best ' + batches[0].toFixed(1) + ', worst ' + batches[4].toFixed(1) + ')');
        if (process.env.PERF_LAYERS) {
            const per = await page.evaluate(() => {
                window.__per = {};
                let t = performance.now();
                const N = 20;
                for (let i = 0; i < N; i++) { const cb = window.__cb; window.__cb = null; cb(t += 16.7); }
                const res = Object.keys(window.__per).map((k) => [k, window.__per[k] / N]);
                window.__per = null;
                return res;
            });
            per.sort((a, b) => b[1] - a[1]);
            const all = per.reduce((n, r) => n + r[1], 0);
            per.slice(0, 14).forEach((r) => console.log('    ' + r[0].padEnd(20) + r[1].toFixed(1).padStart(7) + ' ms  ' + (100 * r[1] / all).toFixed(0).padStart(3) + ' %'));
        }
        await page.close();
    }
    await browser.close();
    srv.close();
    if (process.env.GPU_JSON) fs.writeFileSync(process.env.GPU_JSON, JSON.stringify(out, null, 1));
})();
