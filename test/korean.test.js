'use strict';
/*
 * The Store builds the app in Korean (mgu-repo.json: --language ko), from kit/runtime/locales/ko.json, which
 * kit/tools/sync_locales.py makes from ko.tsv. Every name and choice of the app's settings has its Korean
 * there (figures and units aside), and ko.json is what ko.tsv makes.
 *   node --test test/korean.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const spec = require('../app/app.base.json');
const ko = require('../kit/runtime/locales/ko.json');
const plain = (t) => !t || /^[0-9 ,.\-–°CFkmh/%x]+$/.test(t);

test('every setting\'s name and choice is in Korean', () => {
    const missing = [];
    const need = (t, where) => { if (!plain(t) && !Object.prototype.hasOwnProperty.call(ko, t)) missing.push(where + ': ' + t); };
    need(spec.title, 'title');
    for (const s of spec.settings) {
        need(s.label, s.key);
        (s.options || []).forEach((o) => need(o[1], s.key));
        Object.keys(s.labels || {}).forEach((k) => need(s.labels[k], s.key));
    }
    assert.deepStrictEqual(missing, []);
});

test('ko.json is what ko.tsv makes (python3 kit/tools/sync_locales.py ko)', () => {
    const rows = fs.readFileSync(path.join(ROOT, 'kit/runtime/locales/ko.tsv'), 'utf8').split('\n')
        .map((l) => l.split('\t')).filter((p) => p.length >= 2 && p[0] && p[0].charAt(0) !== '#');
    const stale = rows.filter((p) => ko[p[0]] !== p[1].replace(/\\n/g, '\n')).map((p) => p[0]);
    assert.deepStrictEqual(stale, []);
});
