#!/usr/bin/env node
/*
 * Draws the app's own page - what MGU Styles shows on the iDrive screen -
 * to a PNG, off the car.
 *   node tools/page-shot.js out.png [key=value ...]
 * e.g. node tools/page-shot.js build/page.png style=mplus pCentre=camera @tab=mplus
 *
 * The staged app (apps/akakingj_cluster_id8/main.js) is run as it is, with the
 * kit's own recorder and software canvas (kit/runtime/record.js, canvas.js:
 * what the head unit falls back to without its GPU renderer), and stand-ins
 * for what only the car can give: the settings store, and a cluster service
 * that says it is on the cluster. Settings start at the app's defaults
 * (apps/akakingj_cluster_id8/app.json); key=value changes them.
 *
 * What is drawn (the words that start with @ are for this tool, not settings):
 *   @own=1 (default)  the page as the kit runs it on the car: the whole
 *                     screen ("fill": the app's 1600 x 520 and the 80 rows
 *                     the 1920 x 720 display leaves below it), written at
 *                     the display's own size, 1920 x 720.
 *   @own=0            the page as the HMI shows it without the renderer:
 *                     1600 x 520, the HMI's own title and bar round it (not
 *                     drawn here).
 *   @tab=<id>         cluster (default), general, toro, msport, mplus or mtrack
 *   @focus=<key>      the controller on a place (tab:toro, show, set:accent,
 *                     centre:waze ...): the kit's ring is drawn round it
 *   @press=<key>      press a place first (set:accent opens its list)
 *   @scroll=<px>      a settings list scrolled that far
 *   @held=<keys>      the settings the Car profile holds (units,rpmRedline ...): shown as set there
 *   @centre=...       what the stand-in service reports (waze, camera, idle)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Harness = require('./page-harness.js');
const { Recorder, play } = require(path.join(Harness.KIT, 'record.js'));
const { ScaledCanvas } = require(path.join(Harness.KIT, 'canvas.js'));
const themes = require(path.join(Harness.KIT, 'themes.js'));

const out = process.argv[2] || 'build/page.png';
const spec = JSON.parse(fs.readFileSync(path.join(Harness.APP, 'app.json'), 'utf8'));
const defaults = {};
(spec.settings || []).forEach((s) => { defaults[s.key] = s.default; });
const values = {};
const tool = { own: '1', tab: 'cluster', focus: '', press: '', scroll: '', centre: '', held: '' };
for (const kv of process.argv.slice(3)) {
    const i = kv.indexOf('=');
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (k.charAt(0) === '@') { tool[k.slice(1)] = v; continue; }
    values[k] = v === 'true' ? true : v === 'false' ? false : (v !== '' && !isNaN(Number(v)) && typeof defaults[k] === 'number' ? Number(v) : v);
}
const own = tool.own !== '0';
const page = Harness.open({ values, own, centre: tool.centre, held: tool.held ? tool.held.split(',') : [] });

if (own && tool.tab !== 'cluster') page.run('tab:' + tool.tab);
if (own && tool.scroll) {
    /* a finger's drag up the list */
    const px = Number(tool.scroll) || 0;
    page.touch(1, 800, 500); page.touch(2, 800, 480); page.touch(2, 800, 480 - px + 20); page.touch(3, 800, 480 - px + 20);
}
if (own && tool.focus) page.focus(tool.focus);
if (own && tool.press) page.run(tool.press);

const shot = page.shot(), sheet = page.sheet();
const W = shot.w, H = shot.h, K = own ? 1.2 : 1;
/* at the display's own size: the page's 1600-wide units, 1.2 screen px each where it fills the screen */
const cv = new ScaledCanvas(W, H, K);
const theme = themes.theme(page.values.theme, page.values.skin);
if (sheet) {
    /* the kit's list over the page, as display.js draws it */
    const r = new Recorder(W, 520, { textScale: K });
    r.extra = own ? Harness.EXTRA : 0;
    sheet.controller = true;
    sheet.draw(r, theme);
    play(r.words(), cv);
} else {
    play(shot.words(), cv);
    const t = tool.focus && page.target(tool.focus);
    /* the ring the kit draws round the place the controller is on (display.js _drawChrome) */
    if (t && !(t.r < 0)) {
        cv.strokeRoundRect(t.x - 5 / K, t.y - 5 / K, t.w + 10 / K, t.h + 10 / K, (t.r != null ? t.r : t.h / 2) + 5 / K, 3 / K, theme.sel);
    }
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, cv.canvas.png());
const style = page.values.style;
console.log('wrote', out, cv.canvas.w + 'x' + cv.canvas.h, '(' + style + (style === 'toro' ? ', ' + page.values.background : '') +
    ', ' + (own ? 'the whole screen, tab ' + tool.tab : 'the HMI\'s page') + ')');
