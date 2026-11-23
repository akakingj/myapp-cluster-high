#!/usr/bin/env node
/*
 * Makes the public release tree: what goes in the repository people
 * install from, when the source is kept private.
 *
 *   node tools/make-release.js [--out build/release] [--repo owner/name] [--name "shown name"]
 *   npm run release
 *
 * The app is JavaScript, and what runs on a head unit can be read on it:
 * nothing here makes copying impossible. What it does is leave out
 * everything that is not needed to install the app - the readable source,
 * the tests, the tools, the measurements, the previews - and hand over the
 * app's own files minified: no comments, no local names, one line each.
 *
 * In the tree:
 *   apps/mgustyles_toro/   the staged app (tools/stage-app.js), its own
 *                          modules minified
 *   kit/                   the MGU App Kit as it is (MIT): the Store builds
 *                          the package with it on the head unit
 *   mgu-repo.json          what the Store reads
 *   LICENSE, README.md, CHANGELOG.md, docs/IN-CAR-TEST.md, docs/PERFORMANCE.md, docs/screenshots/ (a few)
 *
 * Left as they are, because their own licences ask for it or there is
 * nothing to gain: cluster_render_client.js (MPL 2.0: its source is the
 * file), atlas_data.js (the baked glyphs: data), app.json, NOTICE, the
 * icon.
 *
 * The simulated car and the page simulator run the tree before it is
 * handed over: MGU_RELEASE_ROOT=build/release npm run car-sim.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ID = 'mgustyles_toro';
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const OUT = path.resolve(ROOT, opt('out', 'build/release'));
const REPO = opt('repo', '');
/* --name: what the release calls the app - in iDrive's menu, on its page and in the Store's list (its id stays) */
const NAME = opt('name', '');
const KEEP = ['cluster_render_client.js', 'atlas_data.js'];
const PICTURES = ['overview.png', 'toro-genuine.png', 'm-sport.png', 'm-sport-plus.png', 'toro-opening.png', 'toro-gear.png',
                  'm-centre-size.png', 'strip.png', 'app-page.png', 'startup-message.png', 'm-lines.png', 'diesel.png',
                  'm-track.png', 'm-track-rows.png', 'm-track-wing.png', 'lowered.png', 'm-widest.png',
                  'startup-sequence.png'];

let terser;
try { terser = require('terser'); } catch (e) {
    console.error('terser is not installed: npm install --no-save terser');
    process.exit(2);
}

function copyTree(from, to, skip) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        if (skip && skip(e.name)) continue;
        const a = path.join(from, e.name), b = path.join(to, e.name);
        if (e.isDirectory()) copyTree(a, b, skip);
        else if (e.isFile()) fs.copyFileSync(a, b);
    }
}

(async () => {
    cp.execSync('node tools/stage-app.js', { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', ID, 'app.json'), 'utf8'));
    if (path.relative(ROOT, OUT).startsWith('..') || OUT === ROOT) throw new Error('--out must be inside the repository');
    fs.rmSync(OUT, { recursive: true, force: true });

    /* ---- the app */
    const appFrom = path.join(ROOT, 'apps', ID), appTo = path.join(OUT, 'apps', ID);
    fs.mkdirSync(appTo, { recursive: true });
    const banner = '/* MGU Styles ' + spec.version + ' - (c) 2026 its author. Free for public testing, without its source: see LICENSE. */';
    let before = 0, after = 0;
    const small = [];
    for (const name of fs.readdirSync(appFrom).sort()) {
        const from = path.join(appFrom, name), to = path.join(appTo, name);
        if (!/\.js$/.test(name) || KEEP.indexOf(name) >= 0) { fs.copyFileSync(from, to); continue; }
        const code = fs.readFileSync(from, 'utf8');
        const r = await terser.minify({ [name]: code }, {
            ecma: 2015, compress: { passes: 2 }, mangle: true,
            format: { comments: false, preamble: banner }
        });
        if (!r.code) throw new Error('could not minify ' + name);
        fs.writeFileSync(to, r.code + '\n');
        before += code.length; after += r.code.length;
        small.push(name);
    }
    /* the package's notice names where it comes from: the release's own home, when given */
    const notice = path.join(appTo, 'NOTICE');
    if (fs.existsSync(notice)) {
        fs.writeFileSync(notice, fs.readFileSync(notice, 'utf8').replace(/^Source: .*$/m,
            REPO ? 'Releases and feedback: https://github.com/' + REPO : 'Published by its author; the source is not public.'));
    }

    /* ---- what the Store builds with, and reads */
    copyTree(path.join(ROOT, 'kit'), path.join(OUT, 'kit'), (n) => n === '__pycache__' || /\.pyc$/.test(n));
    const repo = JSON.parse(fs.readFileSync(path.join(ROOT, 'mgu-repo.json'), 'utf8'));
    if (NAME) {
        /* the name people see: the app's title and its screen's, and the Store's listing. The id is not
           touched: it is what an install, its settings and its updates hang on */
        const man = JSON.parse(fs.readFileSync(path.join(appTo, 'app.json'), 'utf8'));
        man.title = NAME;
        (man.screens || []).forEach((sc) => { sc.title = NAME; });
        fs.writeFileSync(path.join(appTo, 'app.json'), JSON.stringify(man, null, 2) + '\n');
        repo.components.forEach((c) => { if (c.id === ID) c.title = NAME; });
    }
    fs.writeFileSync(path.join(OUT, 'mgu-repo.json'), JSON.stringify(repo, null, 2) + '\n');

    /* ---- the papers */
    fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(OUT, 'LICENSE'));
    fs.copyFileSync(path.join(ROOT, 'CHANGELOG.md'), path.join(OUT, 'CHANGELOG.md'));
    let readme = fs.readFileSync(path.join(ROOT, 'docs', 'RELEASE-README.md'), 'utf8').replace(/\{version\}/g, spec.version)
        .replace(/\{name\}/g, NAME || 'MGU Styles');
    fs.writeFileSync(path.join(OUT, 'README.md'), readme);
    fs.mkdirSync(path.join(OUT, 'docs', 'screenshots'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'docs', 'IN-CAR-TEST.md'), path.join(OUT, 'docs', 'IN-CAR-TEST.md'));
    /* what a frame costs, measured: the changelog and the checklist point at it */
    fs.copyFileSync(path.join(ROOT, 'docs', 'PERFORMANCE.md'), path.join(OUT, 'docs', 'PERFORMANCE.md'));
    PICTURES.forEach((p) => fs.copyFileSync(path.join(ROOT, 'docs', 'screenshots', p), path.join(OUT, 'docs', 'screenshots', p)));
    fs.writeFileSync(path.join(OUT, '.gitignore'), 'dist/\nbuild/\n__pycache__/\n*.pyc\n');

    /* ---- held to account: nothing of the source tree, no comment of ours, and every module still loads */
    const problems = [];
    ['src', 'test', 'tools', 'preview', 'app', 'assets'].forEach((d) => { if (fs.existsSync(path.join(OUT, d))) problems.push(d + '/ is in the release'); });
    for (const name of small) {
        const code = fs.readFileSync(path.join(appTo, name), 'utf8');
        if (/\/\*(?! MGU Styles )/.test(code.replace(/'[^'\n]*'|"[^"\n]*"/g, ''))) problems.push(name + ' still carries a comment');
        if (code.split('\n').length > 4) problems.push(name + ' is not minified');
    }
    for (const name of small) {
        if (/^(main|service)\.js$/.test(name)) continue;          /* these need the head unit's SDK: the simulators run them */
        try { require(path.join(appTo, name)); } catch (e) { problems.push(name + ' does not load: ' + e.message); }
    }
    const files = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(f); } }(OUT));
    console.log('release ' + spec.version + ' in ' + path.relative(ROOT, OUT) + '/: ' + files.length + ' files; ' + small.length +
        ' modules minified, ' + Math.round(before / 1024) + ' KB -> ' + Math.round(after / 1024) + ' KB');
    if (problems.length) { console.error('NOT FIT TO RELEASE:\n  ' + problems.join('\n  ')); process.exit(1); }
    console.log('next: MGU_RELEASE_ROOT=' + path.relative(ROOT, OUT) + ' npm run car-sim   (runs this tree, not the source)');
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
