(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        /* each style's builder read the first time it is built (0.23.1): at a start, the style in use alone - 55 KB
           of the three's 165 - and the others when the drive mode or the owner asks for them */
        module.exports = factory({
            toro: function () { return require('./lambo.js'); },
            track: function () { return require('./track.js'); },
            mtrack: function () { return require('./mtrack.js'); }
        }, require('./overlays.js'));
    } else {
        root.MGUThemes = factory({
            toro: function () { return root.MGUTheme; },
            track: function () { return root.MGUTrack; },
            mtrack: function () { return root.MGUMTrack; }
        }, root.MGUOverlays);
    }
}(typeof self !== 'undefined' ? self : this, function (load, Overlays) {
    'use strict';

    /*
     * The cluster's styles. settings.style picks one (not "theme": the app
     * kit keeps that name for its own screen theme and resets it); each builds the same
     * shape: { id, name, layers, settings, ... } (src/theme/lambo.js).
     */
    /* track: M Sport (the id it has always had in saved settings);
       mplus: M Sport Plus, the same style with the other middle;
       mtrack: M Track Mode, BMW M's track view */
    var FILE = { toro: 'toro', track: 'track', mplus: 'track', mtrack: 'mtrack' };
    var read = {};
    function builder(id) {
        var f = FILE[id];
        if (!read[f]) read[f] = load[f]();
        return id === 'mplus' ? read[f].plus : read[f];
    }
    /* (each style's builder as a getter: its file read when first asked for) */
    var THEMES = {};
    Object.keys(FILE).forEach(function (id) {
        Object.defineProperty(THEMES, id, { enumerable: true, get: function () { return builder(id); } });
    });
    /* a style's builder read now, to have it at hand (the drive mode's own style, read after the first frame) */
    function preload(id) {
        if (Object.prototype.hasOwnProperty.call(FILE, id)) builder(id);
    }
    /* the styles' files read so far, for the tests */
    function loaded() { return Object.keys(read); }

    function idOf(settings) {
        var t = settings && settings.style;
        return Object.prototype.hasOwnProperty.call(THEMES, t) ? t : 'toro';
    }

    /*
     * Each style has its own adjustments: what its middle shows and how
     * much of it, and for the M styles the footer's panel and readouts and
     * the growing numerals. They are kept under the style's own names in the app's
     * settings (so setting up one never changes another) and handed to the
     * style's builder under the one name it reads. A set of settings that
     * names none of a style's own - a test, the preview's address - is
     * used as it is.
     */
    var OWN = {
        toro: { centre: 'tCentre', centreSize: 'tCentreSize' },
        track: { centre: 'mCentre', centreSize: 'mCentreSize', speed2: 'mSpeed2', mPanel: 'mPanel', mPop: 'mPop', mGear: 'mGear',
                 stripL: 'mStripL', stripR: 'mStripR', footL: 'mFootL', footM: 'mFootM', footR: 'mFootR' },
        mplus: { centre: 'pCentre', centreSize: 'pCentreSize', speed2: 'pSpeed2', mPanel: 'pPanel', mPop: 'pPop', mGear: 'pGear',
                 stripL: 'pStripL', stripR: 'pStripR', footL: 'pFootL', footM: 'pFootM', footR: 'pFootR' },
        /* M Track Mode: what its left wing holds, its four gauge rows, how a row marks its reading, its footer */
        mtrack: { centre: 'kCentre', wing: 'kWing', row1: 'kRow1', row2: 'kRow2', row3: 'kRow3', row4: 'kRow4', rowMark: 'kRowMark',
                  stripL: 'kStripL', stripR: 'kStripR',
                  footL: 'kFootL', footM: 'kFootM', footR: 'kFootR', mPanel: 'kPanel' }
    };
    function has(v) { return v !== undefined && v !== null && v !== ''; }
    function forStyle(settings) {
        settings = settings || {};
        var own = OWN[idOf(settings)], out = {}, k;
        for (k in settings) if (Object.prototype.hasOwnProperty.call(settings, k)) out[k] = settings[k];
        for (k in own) {
            if (Object.prototype.hasOwnProperty.call(own, k) && has(settings[own[k]])) out[k] = settings[own[k]];
        }
        return out;
    }
    /* the name a style keeps one of its own adjustments under (the app's page writes there) */
    function keyFor(style, name) {
        var own = OWN[Object.prototype.hasOwnProperty.call(THEMES, style) ? style : 'toro'];
        return own[name] || name;
    }

    function build(atlas, profileId, settings) {
        var theme = THEMES[idOf(settings)].build(atlas, profileId, forStyle(settings));
        /* the holiday dressing and the start-up message, over either style */
        return Overlays.add(theme, atlas, theme.settings, theme.settings.colours);
    }

    /* how far a style can be lowered into a hidden strip's rows (BETA, src/theme/strip.js): px */
    function lowerMost(style) {
        var most = (THEMES[style] || THEMES.toro).LOWER_MOST;
        return typeof most === 'number' ? most : 0;
    }

    return { build: build, idOf: idOf, THEMES: THEMES, OWN: OWN, forStyle: forStyle, keyFor: keyFor, lowerMost: lowerMost,
             preload: preload, loaded: loaded };
}));
