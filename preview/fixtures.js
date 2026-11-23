(function (root) {
    'use strict';
    /*
     * Preview-only stand-ins for what other apps put under the Track theme's
     * window, drawn where they land on the car: BMW's map window, panel
     * (416,120 1088x480). Demonstration content, not a real source.
     *   1 a night map (roads, water, a route)
     *   2 a camera test grid with contrast markers (TBW brief section 5)
     *   3 flat magenta (the brief's first hardware check)
     *   4 the same map by day: pale ground, white roads - the hardest
     *     thing a white readout can be asked to stand on
     */
    var fixture = [
        'uniform float u_kind;',
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }',
        'float line(vec2 p, vec2 a, vec2 b, float w) { return 1.0 - smoothstep(w - 0.8, w + 0.8, sdSegment(p, a, b, 0.0)); }',
        'void main() {',
        '  vec2 p = px();',
        '  vec2 n = p / u_size;',
        '  vec3 col;',
        '  if (u_kind > 2.5 && u_kind < 3.5) { col = vec3(1.0, 0.0, 1.0); }',
        '  else if (u_kind > 1.5 && u_kind < 2.5) {',
        '    vec2 g = mod(p, 64.0);',
        '    float grid = step(min(g.x, g.y), 1.5);',
        '    vec2 cell = floor(p / 64.0);',
        '    float chk = mod(cell.x + cell.y, 2.0);',
        '    col = mix(vec3(0.20), vec3(0.32), chk);',
        '    col = mix(col, vec3(0.95), grid);',
        '    float cx = 1.0 - step(2.0, min(abs(p.x - u_size.x * 0.5), abs(p.y - u_size.y * 0.5)));',
        '    col = mix(col, vec3(1.0, 0.1, 0.1), cx);',
        '  } else {',
        '    float day = step(3.5, u_kind);',
        '    col = mix(vec3(0.05, 0.16, 0.32) + vec3(0.0, 0.05, 0.10) * n.y, vec3(0.93, 0.91, 0.86), day);',
        '    float water = smoothstep(0.02, 0.0, length((p - vec2(300.0, 210.0)) / vec2(220.0, 60.0)) - 1.0);',
        '    col = mix(col, mix(vec3(0.10, 0.42, 0.62), vec3(0.62, 0.80, 0.93), day), water * 0.8);',
        '    vec2 b = mod(p, vec2(46.0, 38.0));',
        '    float streets = step(min(b.x, b.y), 1.2 + day) * step(0.45, hash(floor(p / vec2(46.0, 38.0))));',
        '    col = mix(col, mix(vec3(0.55, 0.68, 0.82), vec3(1.0), day), streets * mix(0.55, 1.0, day));',
        '    float road = line(p, vec2(0.0, 150.0), vec2(u_size.x, 250.0), 2.5 + 2.0 * day);',
        '    road = max(road, line(p, vec2(560.0, 0.0), vec2(520.0, u_size.y), 2.0 + 2.0 * day));',
        '    col = mix(col, mix(vec3(0.85, 0.90, 0.95), vec3(1.0, 0.86, 0.45), day), road);',
        '    float route = line(p, vec2(540.0, u_size.y), vec2(552.0, 0.0), 5.0);',
        '    col = mix(col, mix(vec3(0.92, 0.95, 1.0), vec3(0.25, 0.55, 0.98), day), route);',
        '    float car = 1.0 - smoothstep(6.0, 8.0, length(p - vec2(541.0, 380.0)));',
        '    col = mix(col, vec3(0.95, 0.20, 0.25), car);',
        '  }',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
    ].join('\n');
    /*
     * The rows between a style's last (645) and the strip's own figures
     * (from about 666): on the car whatever is left of BMW's own cluster
     * shows there. What that is differs by car and view, so it is marked,
     * not imitated: a faint hatch, there to show what a trim of the strip
     * covers.
     */
    var stripband = [
        'void main() {',
        '  vec2 p = px();',
        '  float h = step(0.5, fract((p.x + p.y) / 12.0));',
        '  float edge = 1.0 - smoothstep(u_size.y - 3.0, u_size.y, p.y);',
        '  gl_FragColor = vec4(vec3(0.20, 0.23, 0.27) * (0.45 + 0.55 * h) * edge, 1.0);',
        '}'
    ].join('\n');
    root.MGUShadersFixture = { fixture: fixture, stripband: stripband };
    root.MGUFixtureLayer = function (kind) {
        return { id: 'fixture', z: -1, shader: 'fixture', x: 416, y: 120, w: 1088, h: 480,
                 uniforms: function () { return { u_kind: kind }; } };
    };
    /*
     * BMW's own bottom strip as this car shows it (placed off photographs
     * of the cluster, 2026-11-21): range, clock, street, driving mode, gear
     * and outside temperature, and above them the rows where the rest of
     * BMW's cluster shows (hatched: see stripband). Drawn under everything
     * of ours, so what a "BMW's bottom strip" setting leaves of it can be
     * seen. A stand-in in our own faces, for the preview only: nothing like
     * it goes to the car.
     *
     * The driving mode is written from x 1224 towards the gear, which is
     * why a long one matters: "SPORT" ends at 1310, "COMFORT" at about
     * 1354 - its T is what a gap left open from 1340 showed. opts.mode
     * names it (bmwMode= in the preview; COMFORT unless said).
     */
    root.MGUStripFixture = function (atlas, TextLayers, opts) {
        var mode = String((opts && opts.mode) || 'COMFORT').toUpperCase().slice(0, 12);
        var layers = [{ id: 'bmwStripBand', z: -3, shader: 'stripband', x: 0, y: 646, w: 1920, h: 20,
                        uniforms: function () { return {}; } }];
        var TL = TextLayers.create(atlas, layers, { text: [0.92, 0.93, 0.95], muted: [0.92, 0.93, 0.95] });
        var box = { x: 0, y: 650, w: 1920, h: 70 };
        function put(id, face, size, items) {
            TL.statics(id, -2, box, { face: face, size: size, align: 'left', color: [0.92, 0.93, 0.95] }, items);
        }
        put('bmwStripA', 'label', 40, [{ str: '161', x: 186, y: 700 }, { str: '12:46', x: 350, y: 700 },
                                       { str: '+37 °F', x: 1548, y: 700 }]);
        put('bmwStripMode', 'label', 39, [{ str: mode, x: 1224, y: 698 }]);
        put('bmwStripB', 'ms', 34, [{ str: 'mi', x: 262, y: 700 }, { str: 'pm', x: 468, y: 700 },
                                    { str: 'Main street', x: 878, y: 700 }]);
        put('bmwStripGear', 'gear', 44, [{ str: 'P', x: 1392, y: 701 }]);
        layers.forEach(function (L) { L.belowCut = true; });
        return layers;
    };

    /* sample maneuvers, as Turn View's tool reports them */
    root.MGUSampleTurns = {
        left: { kind: 'intersection', angle: 90, side: -1, exit: 0, text: '0.3 mi' },
        right: { kind: 'intersection', angle: 90, side: 1, exit: 0, text: '500 ft' },
        bear: { kind: 'intersection', angle: 30, side: 1, exit: 0, text: '1.2 mi' },
        sharp: { kind: 'intersection', angle: 135, side: -1, exit: 0, text: '200 ft' },
        uturn: { kind: 'intersection', angle: 180, side: -1, exit: 0, text: '0.1 mi' },
        roundabout: { kind: 'roundabout', angle: 90, side: 1, exit: 2, text: '0.4 mi' },
        keep: { kind: 'branch', angle: 30, side: -1, exit: 0, text: '2 mi' },
        straight: { kind: 'intersection', angle: 0, side: 1, exit: 0, text: '3 mi' },
        dest: { kind: 'destination', angle: 0, side: 1, exit: 0, text: '0.2 mi' }
    };
}(typeof self !== 'undefined' ? self : this));
