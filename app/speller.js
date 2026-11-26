'use strict';
/*
 * Words typed on the head unit's own keyboard: the HMI's free-text speller, the
 * use case 02076b22-d19b-4aef-9e8c-0d7305d8b88c the OAP SDK's use case factory
 * opens (the kit declares the use case proxies every app needs:
 * kit/tools/build.py PLATFORM_PROXIES). It is BMW's own full-screen keyboard,
 * in the car's language: on a Korean car its Hangul keys put syllables
 * together as BMW's own screens do.
 *
 *   type(app, 'Start-up words').then((text) => ...)
 *
 * Resolves with the words confirmed with OK, or null when the speller was left
 * without them; rejects when it could not be opened. The title shows at most
 * 22 characters. The speller tells its text with every key (interaction
 * parameter 102) and that OK was pressed (105).
 */
const USE_CASE = '02076b22-d19b-4aef-9e8c-0d7305d8b88c';
const TITLE = 4, TEXT = 102, OK = 105;
const OVER = ['ABORTED', 'FAILED', 'COMPLETED'];
const OPEN_MS = 10000;

function type(app, title) {
    return new Promise((resolve, reject) => {
        let use = null, sub = null, text = '', over = false, timer = null, up = false;
        const end = (err, words) => {
            if (over) return;
            over = true;
            clearTimeout(timer);
            Promise.resolve()
                .then(() => (use && sub !== null ? use.proxy.notify.unsubscribe(sub) : undefined))
                .catch(() => { /* gone with the speller */ })
                .then(() => (err ? reject(err) : resolve(words)));
        };
        timer = setTimeout(() => { if (!up) end(new Error('the speller did not open')); }, OPEN_MS);
        Promise.resolve()
            .then(() => app.getUseCaseFactory())
            .then((factory) => factory.create(USE_CASE))
            .then((made) => { use = made; return use.proxy.init(); })
            .then(() => use.proxy.waitUntilAvailable())
            .then(() => use.proxy.notify.subscribe((n) => {
                /* (a Map, or something with its has / get) */
                const p = n && n.interactionParameters;
                const has = (k) => !!p && typeof p.has === 'function' && p.has(k);
                if (has(TEXT)) text = String(p.get(TEXT));
                if (has(OK)) end(null, text);
                else if (n && OVER.indexOf(n.interactionState) >= 0) end(null, null);
            }))
            .then((id) => {
                sub = id === undefined ? null : id;
                if (over) return undefined;
                return Promise.resolve(use.proxy.interactionState.getValue()).then((state) => {
                    if (state !== 'READY') throw new Error('the speller is ' + state);
                    up = true;
                    return use.proxy.start({ token: use.token, startParameters: new Map([[TITLE, String(title || '').slice(0, 22)]]) });
                });
            })
            .catch((err) => end(err));
    });
}

module.exports = { type, USE_CASE };
