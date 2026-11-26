#!/usr/bin/env node
/*
 * Draws the app's own page - what MGU Styles shows on the iDrive screen -
 * to a PNG, off the car.
 *   node tools/page-shot.js out.png [key=value ...]
 * e.g. node tools/page-shot.js build/page.png style=mplus pCentre=camera @settings=M%20Sport%20Plus
 *
 * The staged app (apps/akakingj_cluster_id8/main.js) is run as it is, with the
 * kit's own recorder and software canvas (kit/runtime/record.js, canvas.js:
 * what the head unit falls back to without its GPU renderer), and stand-ins
 * for what only the car can give: the settings store, and a cluster service
 * that says it is on the cluster. Settings start at the app's defaults
 * (apps/akakingj_cluster_id8/app.json); key=value changes them.
 *
 * What is drawn (the words that start with @ are for this tool, not settings),
 * the app's 1600 x 520 (the kit's header and bar round it are not drawn here):
 *   @own=1 (default)  as the kit runs it on the car; @own=0 as the HMI shows
 *                     it without the renderer
 *   @logs=<n>         Logs pressed n times (1: its first page)
 *   @settings=<group> the kit's settings list over the page: its top (top),
 *                     or a group opened (General, Toro, M Sport ...; %20 a space)
 *   @press=<key>      press a place first (place:mCentre opens its list)
 *   @held=<keys>      the settings the Car profile holds (units,rpmRedline ...): shown as set there
 *   @centre=...       what the stand-in service reports (waze, camera, idle)
 *   @mode=sport|eco   the drive mode's kind the stand-in service reports (Style in Sport / in ECO PRO)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Harness = require('./page-harness.js');
const { Recorder, play } = require(path.join(Harness.KIT, 'record.js'));
const { ScaledCanvas } = require(path.join(Harness.KIT, 'canvas.js'));
const themes = require(path.join(Harness.KIT, 'themes.js'));
const Sheet = require(path.join(Harness.KIT, 'sheet.js'));

const out = process.argv[2] || 'build/page.png';
const spec = JSON.parse(fs.readFileSync(path.join(Harness.APP, 'app.json'), 'utf8'));
const defaults = {};
(spec.settings || []).forEach((s) => { defaults[s.key] = s.default; });
const values = {};
const tool = { own: '1', logs: '', settings: '', press: '', centre: '', held: '', mode: '' };
for (const kv of process.argv.slice(3)) {
    const i = kv.indexOf('=');
    const k = kv.slice(0, i), v = kv.slice(i + 1);
    if (k.charAt(0) === '@') { tool[k.slice(1)] = decodeURIComponent(v); continue; }
    values[k] = v === 'true' ? true : v === 'false' ? false : (v !== '' && !isNaN(Number(v)) && typeof defaults[k] === 'number' ? Number(v) : v);
}
const own = tool.own !== '0';
const page = Harness.open({ values, own, centre: tool.centre, held: tool.held ? tool.held.split(',') : [], mode: tool.mode || null });

for (let n = Number(tool.logs) || 0; n > 0; n--) page.click('BTN_LOGS');
if (own && tool.press) page.run(tool.press);

const shot = page.shot();
let sheet = page.sheet();
if (tool.settings) {
    /* the kit's settings list (kit/runtime/mgu.js, BTN_SETTINGS) */
    sheet = Sheet.listSheet(page.settings, null, { version: spec.version, extra: () => page.rows });
    if (tool.settings !== 'top') sheet.group = tool.settings;
}
const W = shot.w, H = shot.h;
const cv = new ScaledCanvas(W, H, 1);
const theme = themes.theme(page.values.theme, page.values.skin);
if (sheet) {
    /* the kit's list over the page, as display.js draws it */
    const r = new Recorder(W, 520);
    sheet.controller = true;
    sheet.draw(r, theme);
    play(r.words(), cv);
} else play(shot.words(), cv);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, cv.canvas.png());
const style = page.values.style;
console.log('wrote', out, cv.canvas.w + 'x' + cv.canvas.h, '(' + style + (style === 'toro' ? ', ' + page.values.background : '') +
    ', ' + (tool.settings ? 'settings: ' + tool.settings : tool.logs ? 'Logs' : own ? 'the page' : 'the HMI\'s page') + ')');
