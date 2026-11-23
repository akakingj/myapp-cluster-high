#!/usr/bin/env node
/*
 * M Track Mode's control points: where its lines turn, end and meet, in
 * the reference frame's own coordinates, rectified
 * (docs/ref/m-track-reference.jpg through tools/mt-compare.py's two maps;
 * 1582 x 579). Every one is worked out from src/theme/tgeom.js - the
 * numbers the shaders draw from - so this list cannot drift from the
 * render.
 *
 *   node tools/mt-points.js            a Markdown table (docs/ref/M-TRACK-MEASUREMENTS.md)
 *   node tools/mt-points.js --json     for tools/mt-compare.py, which marks them
 *                                      on the overlay and measures how far the
 *                                      photograph's picture at each sits from ours
 *
 * kind: 'edge'   the point lies on a visible edge;
 *       'line'   on the centre of a fine stroke;
 *       'anchor' a place something is set from (not itself on an edge).
 */
'use strict';
const T = require('../src/theme/tgeom.js');

const pts = [];
const add = (group, id, x, y, kind, what) => pts.push({ group, id, x: +x.toFixed(1), y: +y.toFixed(1), kind, what });
const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * (t === undefined ? 0.5 : t), a[1] + (b[1] - a[1]) * (t === undefined ? 0.5 : t)];

/* ---- the body: each plate's corners and the middle of each edge ---- */
function plate(group, tag, P, names) {
    const k = P.v.length;
    P.v.forEach((v, i) => {
        if (!P.r[i]) add(group, `${tag}.${names[i]}`, v[0], v[1], 'edge', `${names[i]} corner`);
        const m = mid(v, P.v[(i + 1) % k]);
        add(group, `${tag}.e${i}`, m[0], m[1], 'edge', `edge ${names[i]} - ${names[(i + 1) % k]}, its middle`);
    });
}
plate('wing', 'wing', T.WING, ['top-left', 'top-right', 'foot-right', 'foot-left', 'point']);
plate('upper plate', 'up', T.PLATES.upper, ['top-left', 'top-right', 'right', 'foot-right', 'foot-left']);
plate('lower plate', 'low', T.PLATES.lower, ['top-left', 'top-right', 'foot-right', 'foot-left']);
plate('ribbon', 'rib', T.PLATES.ribbon, ['top', 'point', 'foot-right', 'foot-left']);

/* ---- the M bands, at two heights ---- */
for (const y of [140, 240]) {
    for (const [name, b] of Object.entries(T.BANDS)) {
        add('bands', `band.${name}.l${y}`, T.slash(b.u[0], y), y, 'edge', `${name} band, left edge`);
        if (name === 'red') add('bands', `band.${name}.r${y}`, T.slash(b.u[1], y), y, 'edge', `${name} band, right edge`);
    }
}
/* ---- the fine lines, a third and two thirds along ---- */
for (const [id, L] of Object.entries(T.HAIRLINES)) {
    for (const t of [0.33, 0.67]) {
        const m = mid([L[0], L[1]], [L[2], L[3]], t);
        add('fine lines', `hair.${id}.${t === 0.33 ? 'a' : 'b'}`, m[0], m[1], 'line', `fine line ${id}`);
    }
}

/* ---- the gauge rows ---- */
const R = T.ROWS;
for (let i = 0; i < R.n; i++) {
    const top = T.rowTop(i), g = `row ${i + 1}`;
    add(g, `row${i + 1}.rail.start`, T.rowX(0, R.railH / 2), top + R.railH / 2, 'edge', 'the rail\'s left end');
    add(g, `row${i + 1}.rail.end`, T.rowX(1, R.railH / 2), top + R.railH / 2, 'edge', 'the rail\'s right end');
    R.cuts.forEach((x, j) => add(g, `row${i + 1}.cut${j + 1}`, x - T.K * R.railH / 2, top + R.railH / 2, 'line', `cut ${j + 1} in the rail`));
    add(g, `row${i + 1}.rail.top`, 370, top, 'edge', 'the rail\'s top edge');
    add(g, `row${i + 1}.line.foot`, 425, top + R.lineDy + R.lineH, 'edge', 'the fine line\'s lower edge');
    add(g, `row${i + 1}.line.end`, T.rowX(1, R.lineDy + R.lineH / 2), top + R.lineDy + R.lineH / 2, 'edge', 'the fine line\'s right end');
    add(g, `row${i + 1}.label`, R.labelX[1], top + R.labelDy - R.labelH / 2, 'anchor', 'the middle figure');
    add(g, `row${i + 1}.icon`, R.iconX, top + R.iconDy, 'anchor', 'the symbol\'s middle');
}

/* ---- the rev counter ---- */
const G = T.TACH, marks = T.revMarks();
const conY = (G.top.y0 + G.top.y1) / 2;
add('rev counter', 'rev.top.start', G.top.x0, conY, 'edge', 'the level top line, its left end');
add('rev counter', 'rev.top.mid', 1080, conY, 'line', 'the level top line (left of the title, which stands right over it)');
add('rev counter', 'rev.top.end', T.slash(G.railR, conY), conY, 'edge', 'the level top line, where the rail ends it');
for (const y of [130, 200, 270, 340, 400]) {
    add('rev counter', `rev.con.${y}`, T.contourX(y), y, 'line', 'the fine contour');
    add('rev counter', `rev.face.${y}`, T.slash(G.face, y), y, 'edge', 'the dark face\'s right edge');
    add('rev counter', `rev.railL.${y}`, T.slash(G.railL, y), y, 'edge', 'the rail, left edge');
    add('rev counter', `rev.railR.${y}`, T.railX(y), y, 'edge', 'the rail, right edge');
}
marks.forEach((y, k) => {
    if (k === 0) return;                          /* under the photograph's marker: covered by the lit band */
    add('rev counter', `rev.tick${k}`, T.slash(G.railL - G.tick.gap - G.tick.len / 2, y), y, 'line', `the mark at ${k}`);
});
const ym = T.revY(840, marks);
add('rev counter', 'rev.marker.left', T.slash(G.con - G.conW / 2 - 0.3, ym), ym, 'edge', 'the marker, its left end (840 rpm)');
add('rev counter', 'rev.marker.right', T.slash(G.railR + 1.6, ym), ym, 'edge', 'the marker, its right end');
add('rev counter', 'rev.marker.mid', 985, ym - G.mark.h, 'edge', 'the marker, its top edge');
add('rev counter', 'rev.lit.top', 975, ym + G.mark.h + G.mark.gap, 'edge', 'the lit band\'s top edge');
add('rev counter', 'rev.lit.foot', 950, G.base.foot, 'edge', 'the lit band\'s foot');
add('rev counter', 'rev.lit.right', T.railX(450), 450, 'edge', 'the lit band\'s right edge');
add('rev counter', 'rev.lit.left', T.slash(G.con - G.conW / 2, 445), 445, 'edge', 'the lit band\'s left edge');
add('rev counter', 'rev.base.top', 820, G.base.railTop, 'edge', 'the rail under the body, top edge');
add('rev counter', 'rev.base.foot', 820, G.base.railBottom, 'edge', 'the rail under the body, bottom edge');
add('rev counter', 'rev.base.end', G.base.railLeft + (G.base.railBottom - G.base.railTop) * T.K / 2, (G.base.railTop + G.base.railBottom) / 2, 'edge', 'the rail under the body, its left end');
marks.forEach((y, k) => add('rev numerals', `rev.num${k}`, T.railX(y) + 32, y, 'anchor', `numeral ${k}`));

/* ---- the strips ---- */
const S = T.STRIP;
for (const [name, at] of [['oil', S.oil], ['fuel', S.fuel]]) {
    const g = `${name} strip`;
    for (const y of [338, 373, 409, 445]) {
        add(g, `${name}.ladder.l${y}`, T.slash(at, y), y, 'edge', 'the ladder, left edge');
        add(g, `${name}.line.r${y}`, T.slash(at, y) + S.ladderW + S.gap + S.lineW, y, 'edge', 'the fine line, right edge');
    }
    S.cuts.forEach((y, j) => add(g, `${name}.cut${j + 1}`, T.slash(at, y) + S.ladderW / 2, y, 'line', `cut ${j + 1}`));
    add(g, `${name}.top`, T.slash(at, S.top) + S.ladderW / 2, S.top, 'edge', 'the ladder\'s top');
    add(g, `${name}.foot`, T.slash(at, S.bottom) + S.ladderW / 2, S.bottom, 'edge', 'the ladder\'s foot');
}

/* ---- the footer and the trims ---- */
const F = T.FOOT, P = F.panel;
add('footer', 'foot.panel.tl', P.left[0], P.top, 'edge', 'the panel, top left');
add('footer', 'foot.panel.bl', P.left[1], P.bottom, 'edge', 'the panel, foot left');
add('footer', 'foot.panel.tr', P.right[0], P.top, 'edge', 'the panel, top right');
add('footer', 'foot.panel.br', P.right[1], P.bottom, 'edge', 'the panel, foot right');
add('footer', 'foot.panel.foot', 840, P.bottom, 'edge', 'the panel\'s foot');
F.seps.forEach((s, j) => {
    const m = (P.top + P.bottom) / 2;
    add('footer', `foot.sep${j + 1}`, (s[0] + s[1]) / 2, m, 'line', `the cut between panes ${j + 1} and ${j + 2}`);
});
add('footer', 'foot.bar.blue', 660, (F.bar.y0 + F.bar.y1) / 2, 'line', 'the light along the panel\'s top, its blue end');
add('footer', 'foot.bar.red', 940, (F.bar.y0 + F.bar.y1) / 2, 'line', 'the light along the panel\'s top, its red end');
add('trims', 'hook.top', F.hook.p0[0], F.hook.p0[1], 'edge', 'the hook, where it starts');
add('trims', 'hook.level', 660, F.hook.y, 'line', 'the hook, its level stroke');
add('trims', 'hook.end', F.hook.x1, F.hook.y, 'edge', 'the hook, its end');
add('trims', 'bracket.level', (F.bracket.x0 + F.bracket.x1) / 2, F.bracket.y, 'line', 'the bracket, its level stroke');
add('trims', 'bracket.end', F.bracket.x1, F.bracket.y, 'edge', 'the bracket, its right end');
add('trims', 'bracket.foot', F.bracket.foot[0], F.bracket.foot[1], 'edge', 'the bracket, its foot');
add('trims', 'limit.sign', F.limit.x + F.limit.ring, F.limit.y, 'edge', 'the speed limit sign, its ring\'s right side');

/* ---- the figures ---- */
add('figures', 'gear.right', 854.6, 247, 'edge', 'the gear, its right side');
add('figures', 'gear.foot', 800, 286.9, 'edge', 'the gear, its foot');
add('figures', 'gear.top', 800, 206.9, 'edge', 'the gear, its top');
add('figures', 'gear.left', 758.9, 247, 'edge', 'the gear, its left side');
add('figures', 'speed.right', 831.8, 347, 'edge', 'the speed, its right side');
add('figures', 'speed.foot', 808, 365.2, 'edge', 'the speed, its foot');
add('figures', 'speed.unit', 863, 357, 'anchor', 'the speed\'s unit');
add('figures', 'title', 1166, 66, 'anchor', 'the rev counter\'s title');
add('figures', 'clock', 170, 527, 'anchor', 'the time');
add('figures', 'range', 387, 527, 'anchor', 'the range');
add('figures', 'outside', 1486, 529, 'anchor', 'the outside temperature');
add('figures', 'mMark', 184.15, 467.9, 'anchor', 'the M mark');

if (process.argv.indexOf('--json') >= 0) {
    console.log(JSON.stringify(pts));
} else {
    console.log('| Point | x | y | Kind | What |');
    console.log('|---|---|---|---|---|');
    pts.forEach((p) => console.log(`| \`${p.id}\` | ${p.x} | ${p.y} | ${p.kind} | ${p.group}: ${p.what} |`));
    console.log('\n' + pts.length + ' points, ' + pts.filter((p) => p.kind !== 'anchor').length + ' of them on an edge or a line.');
}
