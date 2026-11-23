# BMW M View — Performance Telemetry Cluster
## Reference-Faithful, 1:1 Implementation Specification for a Coding AI

**Target reference:** `IMG_9533.jpeg`  
**Reference image dimensions:** **1582 × 579 px**  
**Design variant:** Wide blue BMW M performance/engine-monitoring panel, central `D` and `0 km/h`, diagonal red tachometer, right-side temperature and fuel gauges.  
**Document version:** 2.0 — left-icon correction, feathered left-navigation variant, M3 LCI cross-check, and implementation test contract.  
**Relationship to previous guide:** Use the same tracing/verification discipline, but **none of the old cluster's graphics or coordinates**.

---

## 0. Paste this assignment into the coding AI first

> Build a faithful, functional, vector-based replica of the exact attached BMW M View instrument-cluster image `IMG_9533.jpeg`. Use the photo itself as the highest visual authority. It is **1582 × 579 pixels**. Recreate the blue segmented performance telemetry body, four precisely aligned three-value monitoring scales, four white vehicle/engine pictograms, the large white `D`, the unusual small boxed `0 km/h`, the narrow cyan trim, the tall straight red tachometer with pink digits `8` through `0`, two **separate angled** oil-temperature and fuel bars, green/yellow lighting telltales, parking-sensor pictogram, BMW M outline, `19:02`, `402 km`, circular red-bordered `70` traffic sign, segmented blue bottom decoration, and `+21.0°C`. Every path, numeral and segmented bar should be authored and compared at native source coordinates. This is a measurement and vector-tracing task, **not an opportunity to reimagine the design**. Build a state-driven implementation, but ship a deterministic zero-motion fixture which matches the provided frame exactly. Before calling the job complete, export the rendered frame, a 50% original-versus-render overlay, edge and color error maps, and a list of every remaining mismatch.

### Nonnegotiable rules

1. **Use only `IMG_9533.jpeg` for this theme.** The previous reference `IMG_9460(2).jpeg` and its guide are for a different M View variant. This theme has no left-side 330-km/h scale, no left V-shaped cyan speedometer, no earlier five SPORT PLUS setup rows, no top-down car at the bottom, no `4WD` label, no parked `P`, no `LIMIT` circle, and no `12:04 pm` / `207 km` footer.
2. **Reference-coordinate canvas = `1582 × 579`.** This is the resolution of the supplied photo, not a verified factory screen resolution. Preserve its aspect ratio (`1582/579 ≈ 2.7323`). Uniformly scale to the output display; never independently scale x and y.
3. Render the **actual typography outlines** as accurately as the panel edges. Approximate default fonts are useful only during blockout. For accepted delivery, trace the squared BMW-M-styled display digits and `D`/`0` glyphs or use fonts/assets the project is licensed to use.
4. There are **four horizontally oriented monitoring rows** and **two diagonally oriented auxiliary gauges**. They are different instruments with different geometry. Never reuse the same generic progress-bar component unchanged.
5. All numerical readouts, warning icons and bar indicators must be separate state-driven primitives. Do not bake a JPEG into the background and call it an implementation.
6. The visual success standard is side-by-side image evidence, a transparent-blink comparison, and independently measured edge registration. Do not claim pixel-perfect completion based on resemblance at a small zoom.
7. No new branding, no RGB racing-game effects, no glass cards, no boxes around the gauges, no shadowed widgets, no extra charts, no fictional warning lights. Every visible thing must have a corresponding pixel feature in the photo.

## 1. Image provenance, interpretation and coordinate convention

- The file supplied with this request is named `IMG_9533.jpeg`; its actual dimensions are **1582 px width × 579 px height**.
- For reference integrity, its measured SHA-256 is **`3da2af13c7240ee01fd40fc5a528486f2d73694ebe10b49165933716673f88de`**. The implementation team must check this digest before treating a differently cropped/recompressed image as the same master.
- Origin `(0,0)` is at the upper-left of the **provided JPEG**. Positive X runs right; positive Y runs down. All coordinates in this document refer to that image, **not** to a 12.3-inch physical display, a browser viewport, or the previous 1726×612 artwork.
- The image is a photographic/screenshot reference with JPEG compression, slight glow, lens/capture artifacts, dark borders, and potentially antialiasing from an upstream display. Therefore, the landmark values supplied here are **close first-pass measured anchors**, not access to OEM CAD, a factory framebuffer dump, proprietary font files, or exact material color specifications.
- "1:1" in this document means **image-registered to the supplied frame** at the source pixel coordinate system. Physical 1:1 dimensions on BMW hardware cannot be validated until the actual target LCD active area, native resolution, optical safe zone, firmware variant, and camera alignment are known.
- Do not assume the screenshot's exact BMW vehicle model, MY2024 firmware revision, or Road/Sport/Track menu identity has been externally authenticated. Name the work `Reference-Matched BMW M View Performance Cluster` until such provenance is available.

### Mandatory magnification and inspection set

Inspect the *original* image, not a previous rendering, in the following crops. Save original, 3× bicubic, and 6× nearest-neighbor views:

| Crop | Source rectangle `(x,y,w,h)` | What to analyze |
|---|---|---|
| A — left lights / vehicle | `(48,130,150,275)` | Parking-assistance top-view car/sensor icon; upper small amber spot; lime position-lamp and headlamp pictograms; shapes at the leftmost edge of blue panel |
| B — full telemetry | `(170,95,410,360)` | Four distinct icons; every label, four bar segments per row, secondary underlines, temperature suffixes, teal/red micro-accents |
| C — central blue body | `(465,60,550,440)` | Overlapping blue plates, black horizontal gear-band cutout, right chevron, giant `D`, squared small `0`, vertical/diagonal black separators |
| D — full tachometer | `(900,45,395,460)` | Upper line and label, burgundy wedge, thin left contour, large red right rail, short ticks, pink values `8..0`, bottom red step |
| E — oil and fuel | `(1120,304,300,177)` | Separate temperature and fuel strips, actual discontinuities, endpoint caps, icons, pale labels |
| F — footer | `(118,426,1445,153)` | White outline M, `19:02`, pump/range, speed-limit sign `70`, cyan hook, red lower rail, multi-pane blue wing, ambient `+21.0°C` |

For every crop, record: (a) silhouette/path boundaries, (b) character outlines/baselines, (c) bar start/end and dark separator widths, (d) highlight width/falloff, (e) uncertain photographic blur. Overlay crosshairs and trace **at least 100 verified path landmarks** before finalizing code.

## 2. Whole-screen composition: where the eye should go

The image is a wide, immersive, almost bezel-free black-glass instrument surface. A **large left-center blue M performance ribbon** occupies most of `x≈114..997, y≈102..443`. The separate **diagonal red tachometer** dominates the center-right from `x≈917..1254, y≈78..481`. Two smaller **white/steel slanted gauges** live farther right `x≈1133..1394, y≈323..466`. The bottom footer is a loose strip of independent glowing items around `y≈456..550`; it is **not** a card or toolbar.

The asymmetry is essential. This is *not* a mirrored pair of left/right dial outlines. The speedometer is **inside the central blue polygon**, and the tachometer is a **single high sloping red instrument**.

### Anchor map / design bounding boxes

| Object | Approximate bounds `(x_min,y_min)-(x_max,y_max)` | Priority |
|---|---|---|
| Entire artwork | `(0,0)-(1582,579)` | Fixed root |
| Deep-blue main silhouette | `(113,102)-(998,443)` | Critical |
| Four horizontal monitor rows | `(210,163)-(543,379)` | Critical |
| Central gear/velocity region | `(633,192)-(890,367)` | Critical |
| Top cyan accent | `(556,73)-(610,99)` | High |
| Bottom cyan hook | `(605,448)-(692,477)` | High |
| Tach upper header | `(1057,54)-(1256,85)` | Critical |
| Tach full red channel | `(917,77)-(1255,480)` | Critical |
| Left auxiliary temp strip | `(1131,323)-(1283,466)` | Critical |
| Right auxiliary fuel strip | `(1265,324)-(1394,466)` | Critical |
| Left status/telltales | `(66,148)-(116,354)` | High |
| Footer M outline/time/range | `(131,453)-(462,541)` | High |
| 70 speed-limit sign | `(529,480)-(590,541)` | High |
| Bottom blue segmented wing | `(610,481)-(980,539)` | High |
| Outside temperature | `(1427,520)-(1540,548)` | High |

Keep 10–30 pixels of source-specific negative space between unrelated elements. Do not normalize, evenly distribute, center or justify these objects using generic layout systems.

## 3. Colors, dark glass, photographic texture and emission

The large black areas are **near-black**, with weak blue and wine illumination around graphic objects. The blue is deep cobalt/navy, with electric-blue diagonal M stripes. The red is vivid hot scarlet at the tach rail and lower step, set over a translucent dark-maroon interior. Glyphs are cool-white; tach digits are lightly pink-tinted. Parking/headlights at the left are pale lime/yellow-green.

Sampled RGB landmarks from the **compressed reference** (context-dependent, not official palette values):

| Region / sample position | Photo RGB | Approximate hex | Implementation note |
|---|---|---|---|
| Black void `(1500,40)` | `(3,4,6)` | `#030406` | Screen black, very low luminance |
| Black void `(1350,260)` | `(4,5,9)` | `#040509` | Very slight cold cast |
| Left panel body `(280,300)` | `(25,48,89)` | `#193059` | Deep cobalt/navy |
| Upper blue panel `(300,128)` | `(34,66,139)` | `#22428B` | Cooler/brighter upper region |
| Bright M stripe `(459,156)` | `(32,63,153)` | `#203F99` | Luminous blue accent |
| Center top panel `(770,141)` | `(47,82,172)` | `#2F52AC` | Peak mid-blue field |
| Center lower blue `(722,368)` | `(38,71,152)` | `#264798` | Mid-to-deep blue face |
| Right blue chevron `(937,289)` | `(33,63,127)` | `#213F7F` | Blue reduced by angle |
| Tach maroon interior `(1090,245)` | `(68,30,43)` | `#441E2B` | Wine fill, not pure red |
| Tach lower step `(938,450)` | `(232,65,73)` | `#E84149` | Bright saturated red |
| Footer blue pane `(820,516)` | `(27,40,93)` | `#1B285D` | Deep blue strip |
| Left lime telltale `(90,327)` | `(231,253,178)` | `#E7FDB2` | Pale yellow-green lamp |

Do not use one flat blue fill. Recreate multi-stop gradients, mild directional illumination and darker edge falloff, **clipped within each exact panel silhouette**. Use narrow, subtle outer glows on the cyan/red luminous paths. White glyphs should be rendered near `#F1F5FF` to `#FFFFFF` with optical blooming only after shape matching. Limit bloom so that it does not double the source pixel width of a stroke.

Some isolated yellow or soft-blue dots visible in this photograph may be reflections, image artifacts, or compression. Reproduce only **repeatable graphic structure**, not every camera flare. Keep an optional disabled `photoGrainMatch` diagnostic layer separate from the production graphic layers.

## 4. The enormous blue M-performance body — **do not simplify it**

This is the defining visual difference from the previous design. It is composed of **overlapping angular plates with black cuts**, dark-to-electric blue gradients, narrow geometric crossing lines, and one warm burgundy stripe descending through the left half. It is **not** a hexagon, ordinary rounded rectangle, or flat rectangular telemetry card.

### 4.1 Outer left wing silhouette

- The visible blue top-left begins around **`(222,102)`** and runs nearly horizontally to the first major seam near `x≈685, y≈106`.
- The upper-left edge slopes down-left from `(222,102)` toward roughly `(115,303)`.
- At approximately `(113,310)` the outer wing makes a **sharp pointed elbow**; it then slopes down-right toward `(193,431)`.
- Lower-left corner has a short soft rounding around `(201,440)`, then the bottom edge runs horizontally from about `(202,442)` toward `(496,443)`.
- The right boundary of this left wing is **a descending-to-left black seam**: near `(688,105)` down to `(494,443)`, about 5–9 px wide depending on section. The seam is intentionally tilted; it is not a vertical division.
- The left blue wing is a composite of dark cobalt around its lower-left side and brighter middle blue around `x≈400..540`; it gets subtly darker by the bottom edge.

### 4.2 Diagonal three-color M bands inside the left wing

Measure and trace from the photo; initial bounding traces:

1. A narrow broad blue stripe descends diagonally **top-right to bottom-left**, crossing the panel from approximately `x≈421..484` at `y≈103` toward `x≈254..330` at `y≈443`. It is visibly brighter than the wing behind it.
2. A second mid/royal blue region between approximately `x≈482..549` along the top transitions into a darker blue region lower down.
3. A magenta/burgundy stripe runs from around `x≈544..606` near the top (`y≈106`) to approximately `x≈369..421` around the bottom (`y≈443`). It is thin enough to read as the M graphic and **must remain behind all four telemetry rows**.
4. Thin gray-blue diagonal strokes cross the band fields in the background, often at low opacity. They are *structural hairlines*, not illuminated progress bars.

The M bands have sharp diagonal sides and transparent-looking color mixing at overlaps. Trace their clipped quadrilaterals individually and preserve their intersection with the row scales. Never draw large free-floating red/blue ribbons outside the parent blue wing.

### 4.3 Central right blue chevron / speed body

The blue structure continues across the seam as a wide angular loop:

- Main upper face approximately `(694,108) → (919,108) → (995,256) → (884,439)`.
- Outer right edge slopes outward toward **`(994,256)`**, then sharply slopes down-left to about `(885,438)`; bottom-right corner is softly rounded.
- A **black oblique separator** descends from the upper central junction near `(688,107)` toward `(497,443)`.
- A **second black oblique separator** runs from around `(940,161)` downward toward `(773,443)`. It isolates a relatively narrow blue right ribbon from the central speed panel.
- The **upper black gear band** starts around `y≈193–197` and creates a large open black trapezoid around the `D`, bounded by blue faces above and below. It is *not* a separate card with a border.
- A broader lower blue face occupies roughly `(573,301)` to `(868,442)`. The right-ribbon/chevron remains visible beyond it to `(995,256)`.
- Top center face is brighter royal blue; lower face is mid-blue with dark navy at its left cut; far-right sloping ribbon is deeper royal/cobalt.

Create the blue panel using **multiple hand-traced SVG `path` elements with gradients and dark masking slices**, not one polygon. Use explicitly ordered black separators so the contours remain crisp at the junctions. Important negative-space gaps and blue plate edges must pass overlay comparison at ≥300% zoom.

### 4.4 Architectural hairlines and near-invisible crossings

Visible thin pale blue/gray diagonals cross the blue fields: roughly from an upper junction around `(567,66)` toward lower `(310,543)`, from `(879,109)` toward `(1120,545)`, plus other oblique linework and faint horizontal strokes near `y≈217` and `y≈299`. Their precise paths should be **traced after** the major slab geometry. Use approx. `0.6–1.3 px`, low alpha, and extremely restrained glow. They should not visually compete with any number or bar.

## 5. Four performance-monitoring rows — exact labels, bars and icon relationships

Each row has **one distinct white technical pictogram on the left**, **three large BMW-style numerical *scale labels***, **a tiny unit on the right when applicable**, and **two closely stacked horizontal strokes**: an upper segmented rail and a lower fine white/colored active rail. Their position and spacing must be copied, not evenly distributed by CSS Grid.

### 5.1 Complete monitoring-row matrix

| Row | Icon / visual identity | Numeric labels in image | Right-side unit | Approx. number top | Upper segmented bar | Lower line |
|---|---|---|---|---|---|---|
| 1 — turbo/boost | Turbine snail glyph with detailed radial vanes | **`0.0`**, **`0.9`**, **`1.9`** | **`bar`** | `y≈166` | `x≈281..502, y≈189..195` | `x≈281..503, y≈197..200`; thin extension toward `x≈541` |
| 2 — coolant | Vertical thermometer above two wave strokes | **`70`**, **`100`**, **`130`** | **`°C`** | `y≈227` | `x≈281..504, y≈247..253` | `x≈282..503, y≈256..259`; extension to `x≈541` |
| 3 — engine oil | Oil-pan/can with curved spout and integrated thermometer | **`50`**, **`100`**, **`150`** | **`°C`** | `y≈285` | `x≈281..502, y≈307..313` | `x≈282..502, y≈315..320`; cyan at left, red at right |
| 4 — lower temperature | Mechanical reservoir/heat-exchanger outline with thermometer, layered lower rim | **`−20`**, **`15`**, **`50`** | **`°C`** | `y≈344` | `x≈282..502, y≈366..372` | `x≈282..503, y≈374..378`; right hairline to `≈541` |

**Crucial:** These are the **visible scale markings**, not four separate current numerical readings. Do not treat `0.9` as the live boost pressure merely because it is centered, or `100` as the currently measured coolant/oil temperature. A current-value marker/animation may be data-driven later, but the photo alone does not unambiguously specify its active position.

### 5.2 Labels: accurate glyph, spacing and alignment

All main row numbers use blocky square-corner digital glyphs with unusually wide stems and flat counters, approximately **18–22 px in source scale**. White with a very thin dark edge caused by antialiasing. Their baselines align *within each row* despite different digit counts. Initial anchors:

| Row | Label 1 anchor | Label 2 anchor | Label 3 anchor | Unit anchor |
|---|---|---|---|---|
| Turbo | `(280,166)` for `0.0` | `(371,166)` for `0.9` | `(468,167)` for `1.9` | `(508,175)` `bar` |
| Coolant | `(280,225)` `70` | `(370,225)` `100` | `(464,225)` `130` | `(520,227)` `°C` |
| Oil | `(280,285)` `50` | `(370,285)` `100` | `(462,285)` `150` | `(519,285)` `°C` |
| Lower temp | `(280,342)` `−20` | `(378,341)` `15` | `(471,343)` `50` | `(520,346)` `°C` |

Treat each label's X and width as independently tuneable; do not derive its baseline from font metrics or interpolate its X from three equal columns. For example, row four's minus sign is a short *thick horizontal dash* integrated with the `20`, not a normal thin en dash.

### 5.3 Upper rail — four slanted, individually separated pieces

Most upper rows visually have four white/light-silver horizontal pieces. Their cuts lean **from lower-left toward upper-right**, so the breaks look like short diagonal slits, not vertical black slots. Approximate initial pieces:

```text
segment A: x=283..335
segment B: x=338..391
segment C: x=394..446
segment D: x=449..503
upper y varies by row; individual piece height ≈ 5–7 px
slot gap ≈ 2–4 px and tilted ≈ 2–5 px
```

Draw each as a four-corner slanted quadrilateral (`path`) with calibrated end caps and softened emitted edge. The piece geometry should be **row-specific**; do not literally duplicate a shape four times if the image reveals length or corner differences. Beneath it sits a white thin continuous (or partly interrupted) luminous line ~3–4 px thick with its own stroke. At the **right end**, a very thin ~1.5–2 px line continues toward the units/end mark near `x≈540` on some rows.

The third row's lower line is visually special: a cyan/teal left segment `x≈283..338`, a long pale center section and a red/salmon end cap `x≈457..503`. The other rows are predominantly white. This red/cyan trim is **not** a button, temperature warning, or huge multicolor meter background.

### 5.4 Four icon reconstructions (no emojis)

Each monochrome technical symbol must be its **own path group**, not a borrowed web emoji or unrelated generic UI icon:

1. **Turbo glyph:** centered near `(232,185)`, overall approximately `(215,171)..(251,201)`. White outer snailshell/charger housing, a circle of approximately 8–10 curved radial compressor vanes, tangential outer scroll, and a square-cropped right/top extension. Preserve the visible circular "flower" within the housing.
2. **Coolant thermometer:** `(215,228)..(250,257)` with a narrow upright stalk and small horizontal projections; lower bulb is integrated into **two separate short wavy lines**. It must clearly be a thermometer over fluid waves, not a thermometer in a rounded box.
3. **Oil icon:** `(211,284)..(253,321)` with a tilted spout, open/closed oil-pan silhouette, narrow temperature stalk and tiny end droplet/angled cut. It is denser and wider than the coolant glyph.
4. **Lower temperature/reservoir icon:** `(218,343)..(249,375)`. An upright scale rises out of a rectangular reservoir-like box with **two nested lower/right frames**; there are no two fluid waves beneath it. Its actual vehicle-system semantics may be clarified later, but trace the photo geometry first instead of inventing a warning meaning.

Measure the **stroke weight** of each icon, typically white cores around `2–4 px` with small anti-alias glow. Draw microdetails with Bézier paths so they remain recognizable at native size.

## 6. Central gear and digital speed — exact optical construction

### 6.1 The giant `D` on the black gear band

- Main `D` spans approximately **`(754,203)` to `(858,290)`**, optical center near `(805,247)`. The shape is about 82–100 px wide depending on glow, very tall and strong.
- It is **a white filled BMW-style block capital D**: vertical thick stem, flat top and bottom, slightly slanted/curved right bowl, large squared internal black counter. Unlike a standard font `D`, the outside right curve is swollen and the internal counter has a straight-ish left wall.
- It sits directly on the dark/black gear band between the upper and lower blue panels. **Do not draw a bordered rectangle, tile, glass panel or button behind it.**
- The black counter must remain true black relative to the white outline, not a dark blue with a border. Slight glow is permissible but must not blur the inner opening.
- Dynamic gear labels `P/R/N/D` should be independently fitted to the same optical anchor, **without reusing `D`'s width for narrower characters**.

### 6.2 Small digitally boxed `0` and `km/h`

- The actual speed is a thick outlined white **squared digital `0`**, not a thin round zero, occupying approximately `(781,328)..(832,366)`.
- Keep a very rectangular black center opening. The top/bottom are strongly flat; corners are small-radius or chamfered rather than circular.
- The `km/h` label begins near `(838,349)` with cool off-white/blue-gray narrow lettering and height about `16–20 px`. It is horizontally aligned around the lower half of the `0`, **not centered underneath it**.
- `0 km/h` is therefore a compact *single line* near the lower-right of the blue panel. Do not confuse this with the previous image's enormous `0` above `km/h` and separate `0 mph` underneath.
- No `mph` secondary speed value is visible in this reference.

### 6.3 Main blue-panel negative space

The large white `D` and small `0 km/h` are placed within the broad blue body, but **the `D` itself reads against a black horizontal cutout**. Do not fill this region with light blue. There are faint geometric hairlines through the lower blue band. Make sure black separators don't cover the small speed glyph at `(800,348)`.

## 7. Cyan trim — two unrelated accents, both precisely shaped

This theme **does not have the old massive cyan V-speedometer rail**. It has two isolated cyan trim objects:

1. **Top small angular bracket:** luminous ice-blue line from roughly `(554,97)` upward-right to `(567,74)` and then horizontally to `(608,75)`. The bend is angular (slight rounded join), path thickness approximately 3–4 px, subtle halo. The long diagonal guide line beneath it is much dimmer and is a distinct asset.
2. **Lower cyan hooked end:** near `(606,451)`, a thin cyan slash slopes to `(616,467)` then makes a soft forward curve ending horizontally around `(691,475)`. Core width ≈ 4–5 px with controlled electric-blue fringe. The rest of the bottom edge near it stays dark. **Do not join this to the red rail.**

They should be separate paths and Z-order layers. Do not substitute an illuminated frame wrapping the whole screen or entire blue body.

## 8. The tall diagonal red tachometer — the dominant right-side instrument

This isn't the previous outer V-shaped mirror. The visible tachometer is a **single straight steeply sloped, parallel-sided burgundy ribbon with a red rail along the right edge** and a separate bright red base step. Exact diagonal angle, strip width and number positions drive the whole composition.

### 8.1 Upper line / label

- Top label **`1/min x 1000`** (letter `x` as shown in the photo; match spacing) centered above the red top edge, approximately `(1118,54)..(1239,74)`.
- Header line begins near **`(1056,79)`** and ends at **`(1254,79)`**. Very thin pale pink/salmon luminous stroke, ~2 px with slight soft glow.
- At its left-middle, around `(1127,81)`, a brief curved transition descends into the **thin inner left contour** of the burgundy panel. That contour is salmon-pink and much finer than the thick right red rail.

### 8.2 Burgundy face and pair of long edges

- Approximate outer face top: from `(1132,82)` to `(1231,82)`.
- Approximate lower face: from `(921,419)` to `(1010,421)`.
- Main fill: deep wine/maroon around `#441E2B` at its center, with a dark purple/black inward gradient. This is **not** bright pink throughout.
- Thin left contour: `M 1127 81 C 1130 88 1130 95 1125 102 L 917 420` (approximate first-pass curve; optically trace).
- Very bright outer right rail: near `(1250,82)` slanting down-left to around `(1032,422)`; locally **6–10 px** wide at full-size, hot coral/red with a vivid core and subtle black separation from the pale numbers.
- On the **inside** of this right rail there is a narrow near-black strip hosting tiny short coral tick marks. Do not put all ticks on top of the red bright rail.
- At lower y≈420, a short **bright white horizontal cap** runs from roughly `(919,421)` to `(1038,429)` and visually separates the diagonal gauge from the large bright red lower step. A reddish black separator/inner bevel sits just below/alongside it.

### 8.3 Tachometer values: unusual descending straight scale

The scale is **`8, 7, 6, 5, 4, 3, 2, 1, 0`**, descending from top-right to bottom-left. Each number is wide, pale pink, block-digit, approximately 26–31 px tall except lower `0`, and follows the diagonal but remains *horizontally upright*. Do **not** rotate the labels parallel to the rail.

| Scale text | Approx. top-left `(x,y)` | Where it sits |
|---|---|---|
| **8** | `(1258,94)` | Immediately to right of top of the rail |
| **7** | `(1232,137)` | Right side of red rail |
| **6** | `(1203,182)` | Right side of red rail |
| **5** | `(1175,228)` | Right side of red rail |
| **4** | `(1145,273)` | Right side of red rail |
| **3** | `(1117,319)` | Right side of red rail |
| **2** | `(1087,365)` | Right side of red rail |
| **1** | `(1057,410)` | Beside white lower cap |
| **0** | `(1029,452)` | Beside lower red step |

Label style is pale pink `#F7CDD6` to warm white, with large flat counters and squared glyph ends. Anchor each numeral *by image measurement*; do not use an automatic circular arc or fixed step computed only from `rpm`.

### 8.4 Seven/eight short red scale ticks

The thin black strip just left of the bright diagonal rail contains short nearly **horizontal** glowing red tick marks at approximately:

```text
(1202,119), (1175,149), (1152,193), (1125,237),
(1101,283), (1077,328), (1049,374), (1028,420)
```

These are initial positions to calibrate. The ticks have a red core of about 2–4 px and length about 15–22 px; some are partially occluded or fainter because of the underlying strip. They are not triangular pointers and they do not project into the large black space to the right.

### 8.5 Lower red elbow and return line

- Bright bottom horizontal line starts approximately `(742,472)` and runs toward `(877,473)`.
- Then the line merges into a thick luminous scarlet **ramped toe** beginning around `(890,472)`, turning/curving upward through `(912,433)` toward `(921,422)`.
- Large red lower step/ribbon extends from around `(918,429)` to `(1037,430)` and widens back toward the lower horizontal rail: visible broad bright wedge around `(890,477)..(999,479)`. The toe at `x≈1004` is softly rounded; lower edge lies near `y≈480`.
- The white transverse cap near `y≈424` must remain a visible white divider *over* this red face.
- Under it, a subtle red reflection continues around `y≈484..501`, strongest toward the right end. It is **not a second full-intensity horizontal tach rail**.

The red base must align against the blue wing footer without colliding with the cyan hook around x606–692; an intentional black gap separates them.

## 9. Right-side pair of diagonally segmented auxiliary gauges

The oil-temperature and fuel bars **are independent narrow, straight angled strips** to the right of the tach. Their angles are similar; heights and tick labels differ. They are not mirrored and must not be joined by a background container.

### 9.1 Oil / thermal strip (left of pair)

- Top around `(1269,324)` and bottom around `(1194,466)`. The visible white/silver segmented rail leans up-right; left scale-label region is around `x≈1134..1226`.
- Top label **`150`** near `(1200,323)`, below/next to it small **`°C`** near `(1198,355)`.
- Middle **`100`** around `(1158,385)`.
- Bottom **`50`** around `(1133,448)`.
- Small oil-can/thermometer white glyph around `(1154,414)..(1191,440)`; do not use the generic row-three pictogram unchanged—the reference icon details and scale differ.
- Rail is approximately 8–11 px wide with a narrow brilliant-white edge on the right and a muted slate/silver-gray **stepped segment face** toward the left. Segment boundaries lie diagonally across the strip; black separators ~2 px.
- The high end has a short warm-red cap `(1274,326)..(1281,343)`. The low end has a saturated cyan-blue accent near `(1192,462)..(1208,465)`. The central parts transition silver gray to white.

### 9.2 Fuel strip (right of pair)

- Top near `(1388,327)` and bottom near `(1300,466)`, with independent steel-gray/white slanted segmented face and bright thin right edge.
- Markings: **`1`** near `(1350,326)`, **`1/2`** near `(1282,388)`, and **`0`** near `(1266,447)`.
- White fuel-pump pictogram with small rightward triangle/chevron at about `(1278,416)..(1317,439)`.
- Upper half of the bar is medium gray-blue, lower-middle turns pale gray, lower part near `1/2` features several white step segments. Unlike the oil strip, there is **no red top oil-temperature tip**; do not color the top red.
- All segments follow the same diagonal baseline but must have **separate exact polygon corners**, not a single continuous white rectangle or a broad gradient. Preserve the black 1–2 px dividers.

### 9.3 Why this matters

At native display scale the two gauges can appear like two ordinary slashes. At 300% zoom the photo clearly reveals their **multiple differently shaded bars, individual segment cuts, separate strong white edges, and different tiny icons**. A one-line SVG stroke, stock ProgressBar, or emoji will fail. Build each segment as a discrete path with independent luminance and active-state mapping.

## 10. Left-side warning, lighting and parking-assistance symbols

These icons float on the black glass left of the blue wing; the panel **must not cover them**.

1. Upper parking-assist/vehicle pictogram at `(69,149)..(113,197)`: white top-down *small car* with dark windshield and rear window. Two tiny radar arcs are off the car's lower-right quarter. A **separate white obstacle/receiver symbol** sits beyond the arcs at about `(100..113,187..197)`. This is **three distinct unjoined elements**: car, arcs, obstacle. **Absolutely no line, tail, hooked neck, dangling extrusion, ribbon, antenna or white bridge may connect the car to the receiver.** Preserve a visible black gap at every zoom level. Trace it, do not substitute a full vehicle silhouette.
2. A faint yellow-green circular glow/spot near `(110,207)` appears in the photograph. Treat it as **unverified photographic illumination**: omit from the clean reference vector until a second capture establishes it as a persistent screen icon.
3. Small lime/yellow-green parking/side-light symbol near `(67,288)..(104,309)`: two separate facing lamp lobes, not a solid oval or connected peanut. A dark vertical slot separates the lobes; each has three detached rays (upper slanted, middle horizontal, lower slanted). Place the symbol's *top* around `y=288` and move it **5 px higher than the initial vector build** to regain optical breathing room above the headlamp. The last lit pixels of the lower rays should end around `y=309`.
4. Larger dipped/main-beam-like headlight symbol `(69,314)..(114,353)`: outlined D-shaped lamp facing right, **five diagonal bright rays** to the left, luminous pale yellow-green. The headlight begins around `y=314`, leaving approximately **5 px of true black separation between the lower parking-light rays and the top headlight stroke** at native rendering scale. Check that the two lime marks read as **independent controls** at 100%, not a single fused glyph. This symbol's ray angle, count, and flat bottom are conspicuous; generic icon libraries are usually wrong.

Icons may need a two-layer soft glow, but keep core strokes sharp and no cartoon outlines. Their alert/status meaning should come from an independent data model, not be inferred solely from color.

## 11. Footer: every object, true values, and microgeometry

The footer is integrated into the dark instrument surface. It contains no continuous housing border or top/bottom toolbar line. Item order and values are **exactly those in the photo**:

### 11.1 White outline M emblem

- BMW M-style **outline-only** emblem around `(157,456)..(221,478)`.
- Three forward-slanted narrow stripes at left; outlined stylized `M` at right. White thin perimeter with hollow black interior and specific thin diagonal separators. Not the fully colored official M-logo variant, not a generic italic `M`, and not a solid gray stamp.
- Use an authorized asset or accurately trace the visible outline. Do not write ordinary text `M` as a substitute.

### 11.2 Time / range

- Time **`19:02`** at approximately `(133,509)..(226,539)`; squared extra-bold digital numerals with visible flat-cut counter shapes and a small rectangular colon. **It is 24-hour time**, not `7:02 pm` or `19:02 pm`.
- To its right, fuel pump with **left-pointing arrow** around `(318,512)..(348,538)`; tiny white pump pictogram and black cutouts.
- Range **`402`** starts near `(357,507)`, with smaller `km` following around `(427,514)`; group ends around `x≈464`. The `402` itself is heavier, taller and more blocky than the suffix.
- Maintain independent baseline adjustments. Units should not be typeset at the main number's full height.

### 11.3 Circular speed-limit `70` sign

- Center around **`(561,510)`** with white circular face diameter about `47–51 px`, saturated red border approximately `5–7 px`, and faint red halo to an outer visual diameter about `58–62 px`.
- Text **`70`** is **black** relatively ordinary sans numerals centered inside the white face (not the white blocky BMW status font). Start from `(546,497)`; adjust optical centering to match.
- Unlike the previous image, it is **not** a white `LIMIT` badge. It is a recognized speed-limit road sign graphic with visible red perimeter.
- The reference does not confirm whether the sign came from a camera, traffic sign recognition, or an external map. In the data model call it `displayedSpeedLimitKmh: 70`; don't fabricate provenance.

### 11.4 Segmented blue M-style bottom wing and reflection

- Overall visual strip spans approximately `(609,482)..(1011,539)`.
- A brighter royal-blue **top-left flap** begins around `(624,482)`, slopes left to `(608,511)`, and falls off; it is *not* a fifth identical blue segment.
- The main lower blue platform begins around `(676,492)` and extends rightward to `(979,492)`; its visible bottom is near `y≈536`.
- The platform is subdivided into approximately **four broad diagonal trapezoidal blue panes**, with narrow **dark right-leaning separators**. Representative upper separator X coordinates around `≈740, 822, 902`, lower intersections around `≈761, 842, 918`—trace actual edges before finalizing.
- Stronger blue glow is along its top edge, with very dark cobalt at its lower/left face. Fine near-horizontal specular blue streaks are permitted as seen in source, but no animated equalizer effect.
- A **thin red glow/triangular cap** occurs at the far upper-right around `(979,482)..(1009,507)`, directly beneath the tach's lower step. Do not mistake it for a fifth pane or a car warning symbol.

### 11.5 Exterior temperature

- Right-aligned **`+21.0°C`** around `(1430,523)..(1539,548)`.
- The `+21.0` part is bright thick squared digital numerals about 26–30 px tall; `°C` is smaller, thin, lifted and close to the last `0`. Keep its vertical alignment as shown.
- Do not display `+32.0°C`, `+12.5°C`, or another prior-reference value. Do not omit the plus sign.

## 12. Font engineering and exact optical digit tracing

The image's typography is a major identity cue. At minimum the implementation needs:

```text
Big gear glyph:          D (and separately fitted P, R, N for live use)
Digital-speed glyph:     0 1 2 3 4 5 6 7 8 9
Monitoring-row numerals: 0 1 2 3 4 5 6 7 8 9 . −
Tach numerals:           0 1 2 3 4 5 6 7 8 9
Footer numerals:         0 1 2 3 4 5 6 7 8 9 : . +
Small labels:            km/h, bar, °C, km, 1/min x 1000, 1/2
Road sign:               independently traced black '70'
```

- Trace each glyph using vector masks from the source at 6× magnification. Flat tops/bottoms, slightly rounded/chamfered joins, square counters, and **wide horizontal proportions** are signature features.
- Do not blindly apply an electronic "seven-segment" font: the source has connected shapes, nuanced contours and non-seven-segment lowercase labels. The giant `D` in particular is **not** a seven-segment character.
- The row `70`, `100`, `130`, etc., and footer `19:02`/`402` share a broadly related angular visual language but **may not be the exact same optical cut and thickness**. Treat font weights as per-component overrides.
- Tach `8..0` are salmon-pink and slightly lighter/thinner than some of the white digital footer numbers.
- The handwritten effect of JPEG bloom must **not** be replaced by a fake heavy text shadow. Derive stroke outlines first, then apply limited tiny emission.
- Required optical checks include the inner counter of the large `D`, the rectangular counter of speed `0`, the bottom of `2`, the width of `1`, the minus sign in `−20`, the diagonal of `7`, and tach `8`'s two enclosed openings.

## 13. Layering and masks — exact render stack

Draw these layers back to front:

1. **Black display surface**, restrained vignette/near-black color noise, no bezel/card.
2. Optional **fine background hairlines** that pass behind all blue/red plates.
3. Base **left blue wing silhouette** and gradients.
4. Individually clipped bright blue/magenta/royal-blue **diagonal M stripes**.
5. Central blue chevron's upper and lower fields; negative black diagonal seams and open gear cutout; all blue hairlines.
6. Thin background structural lines crossing the blue faces at low opacity.
7. Burgundy **tach ribbon fill**, thin salmon left contour, black tick strip, hot-red outer rail.
8. Tach top line, tiny rail tick marks, white lower dividing cap, red stepped base and its reflection.
9. Four **monitor icon groups**, main row labels, individual white segmented bars, thin bars and colored micro-accents.
10. Main `D`, squared `0`, and `km/h` label.
11. Isolated upper/bottom **cyan trim hooks**, preserving intended cutouts.
12. Pink tach digits and its `1/min x 1000` text.
13. Right-side **temperature and fuel slanted segment paths**, their labels and pictograms.
14. Far-left parking/lights telltales.
15. Footer M outline, time, pump/range, white/red `70`, four-pane blue platform, and outdoor temperature.
16. In the final production stage only: controlled optical glow, antialias smoothing and optional photo-texture simulation for the screenshot-matching fixture.

Use clipping/masking at each plate's boundaries; do not allow gradients/stripes to bleed into true-black recesses. Some bottom illumination appears both above and below the footer panes: layer it intentionally instead of applying one large global Gaussian blur.

## 14. Software component tree and source-file breakdown

Suggested portable structure (Qt Quick / Skia / Canvas / SVG / WebGL all acceptable, provided actual vector geometry is preserved):

```text
src/cluster/
  Scene1582x579
  palette/PhotoSampledThemeColors
  background/BlackInstrumentGlass
  blue/LeftWingOuterSilhouette
  blue/MStripeElectricBlue
  blue/MStripeBurgundy
  blue/CentralUpperPlate
  blue/CentralLowerPlate
  blue/CentralRightChevron
  blue/BlackCutoutAndSeams
  blue/StructuralHairlines
  telemetry/TurboBoostRow
  telemetry/CoolantTempRow
  telemetry/EngineOilTempRow
  telemetry/LowerThermalRow
  telemetry/FourSegmentRail
  telemetry/SeparateActiveRail
  symbols/TurboGlyph
  symbols/CoolantGlyph
  symbols/OilTempGlyph
  symbols/ReservoirTempGlyph
  gear/DriveModeLetter
  gear/SmallDigitalSpeed
  cyan/TopBracket
  cyan/BottomHook
  tach/BurgundyDiagonalFace
  tach/ScarletRightRail
  tach/TickMarks
  tach/TachNumerals
  tach/WhiteCrossCap
  tach/RedLowerToeAndReflection
  aux/OilTemperatureDiagonalSegments
  aux/FuelDiagonalSegments
  indicators/ParkingSensorsTelltale
  indicators/PositionLightsTelltale
  indicators/HeadlightsTelltale
  footer/MOutline
  footer/DigitalClock
  footer/FuelRange
  footer/SpeedLimitCircle
  footer/BlueFourPaneWing
  footer/OutdoorTemperature
  typography/TracedBlockNumericAtlas
  typography/TracedGearGlyphs
  typography/SmallUITypeface
  state/ClusterState
  state/ReferenceScreenshotFixture
  state/ReadOnlyTelemetryAdapter
  qa/OverlayBlinkComparator
  qa/EdgeAndColorDiff
  qa/ControlPointRegistry
  qa/ImageArtifactWriter
```

Make each module accept numbers/state and return immutable paths/shapes. All positional data should live in **reference pixel coordinates**, not scattered CSS media-query values.

### Minimal renderer contract

```ts
type ReferencePoint = { x: number; y: number };

type RenderOptions = {
  viewportWidth: number;
  viewportHeight: number;
  sourceWidth: 1582;
  sourceHeight: 579;
  preserveAspectRatio: true;
  showReferenceRegistrationGrid?: boolean;
  suppressPhotographicTexture?: boolean;
  fixtureMode?: 'IMG_9533_ZERO_MOTION' | 'LIVE';
};

function renderBMWMPerformanceCluster(
  state: MPerformanceClusterState,
  options: RenderOptions
): RenderedFrame;
```

For a web/SVG prototype begin with `viewBox="0 0 1582 579"` and `preserveAspectRatio="xMidYMid meet"`; handle letterboxing at the **outer viewport**, never by distorting the internal blueprint.

## 15. Live state model — make the scene functional without corrupting the screenshot

```ts
type MPerformanceClusterState = {
  // Primary core data
  speedKmh: number;                  // screenshot: 0
  gear: 'P' | 'R' | 'N' | 'D' | string; // screenshot: 'D'
  engineRpm: number | null;          // photographic tick state unresolved

  // Four left telemetry instruments; numeric tick labels stay constant
  turboBoostBar: number | null;
  coolantTempC: number | null;
  engineOilTempC: number | null;
  lowerThermalTempC: number | null;  // device/semantics must be verified

  // Two right-side gauges
  rightOilTempC: number | null;
  fuelFraction: number | null;       // 0 to 1

  // Telltales
  parkingAssistActive: boolean;
  positionLampsActive: boolean;
  headlampsActive: boolean;

  // Footer
  displayedClockHHMM: string;        // screenshot: '19:02'
  remainingRangeKm: number | null;   // screenshot: 402
  displayedSpeedLimitKmh: number | null; // screenshot: 70
  outsideTemperatureC: number | null;   // screenshot: +21.0

  // Live-platform reliability
  dataFresh: boolean;
  warningIds: string[];
  appearanceMode: 'PHOTO_MATCH' | 'LIVE_M_VIEW';
};
```

### Deterministic screenshot fixture

```ts
export const IMG_9533_ZERO_MOTION: Partial<MPerformanceClusterState> = {
  speedKmh: 0,
  gear: 'D',
  displayedClockHHMM: '19:02',
  remainingRangeKm: 402,
  displayedSpeedLimitKmh: 70,
  outsideTemperatureC: 21.0,
  parkingAssistActive: true,
  positionLampsActive: true,
  headlampsActive: true,
  appearanceMode: 'PHOTO_MATCH',
  dataFresh: true,
};
```

**Do not invent photo-unreadable live values.** The picture shows *printed tick labels* at four monitoring rows and a tach scale; it does **not** reveal definitive instantaneous pressure/temperature values or an exact RPM. In screenshot-fixture mode, hold the traced illuminated segment appearance exactly as photographed and keep underlying telemetry fields null/indeterminate where appropriate. In live mode, connect actual data and separately design/validate how each active fill/marker responds.

### Behavior rules

- Speed display stays `0 km/h` in the reference fixture even though the gear letter is `D`. Do not switch the fixture to `P` because that seems more intuitive.
- Render RPM via the correct slanted tach progress/marker technique **only if the true state semantics can be measured**; no fictional scale needle is visible in this frame.
- Keep scale tick labels static while monitored values update. Use clipping and fixed segment boundaries to reveal progress, not dynamic bar resizing that changes the segment silhouettes.
- Null/stale data should visibly degrade safely in live testing. Never synthesize or reuse old safety-critical data without an explicit defined treatment.
- Keep functional safety telltales always on top of decorative geometry. Do not obscure warnings, gear, speed or instrument measurements with any optional custom overlay.
- Target responsive 60 fps where hardware allows; frame rate is an implementation goal, not an official BMW-spec claim.
- Any live in-vehicle installation must remain read-only to vehicle telemetry unless separately engineered and validated; the replica must never replace or suppress an OEM safety-critical instrument display without formal HMI/safety work.

## 16. Rendering precision, gradients and shape construction

- **Preferred primitives:** GPU paths or SVG Bézier polygons, per-piece linear gradients, narrow emissive strokes, masks, small local blur kernels. Avoid DOM text wherever contour matching matters.
- **Antialias:** Tune source-pixel edge behavior. A 1.5–2 px path with no antialiasing does not look like the photo; an 8 px glow makes the hairlines too fat. Evaluate core width and corona separately.
- **Panel gradients:** Clip to individual blue shapes so the bright-center field doesn't wash across the black diagonal separators.
- **Tach face:** Burgundy gradient must be dark at the center with very thin salmon left outline and thicker hot-red right edge.
- **Tiny row bars:** Draw as actual white polygon fills and separate dark masks between segments; no CSS `border-bottom: dashed` approximation.
- **Auxiliary slashes:** Each white/gray slab is an independent polygon with its own luminance and narrow gap; preserve the changing segment brightness along length.
- **Black region:** Do not let the entire canvas turn blue-black. Source near-black patches still measure close to RGB 3–9 per channel.
- **Scaling:** Uniform coordinate transform; keep glyphs anchored to exact reference coordinates. For physical framebuffer integration, apply a separately measured perspective/crop transform rather than guessing factory pixels.

## 17. Image QA: the required path to the "1:1" claim

### 17.1 Automatic output set for every build iteration

Output these artifacts as part of the coding project:

```text
qa/output/
  01_source_IMG_9533_native_1582x579.png
  02_render_native_1582x579.png
  03_original_render_50_percent_overlay.png
  04_alternating_blink_comparison.gif
  05_edge_error_colormap.png
  06_color_difference_colormap.png
  07_glyphs_at_600_percent.png
  08_row_segment_telemetry_at_600_percent.png
  09_tach_and_right_slashes_at_600_percent.png
  10_footer_at_600_percent.png
  11_measured_control_points.json
  12_mismatch_log.md
```

### 17.2 Control-point registration

Record at least **100 explicit annotated landmarks** as source `(x,y)` → implementation `(x,y)`. The dataset must span:

- 12+ major left-wing corners/seams, 12+ central chevron/gear-band boundaries.
- At least 4 locations for **each** of the four telemetry rows' segmented rails, plus row icons and endpoints.
- `D` outer and inner counter corners, speed `0` inner/outer corners, `km/h` baseline.
- Top cyan bracket, bottom cyan hook, red tach right/left edges, eight-ish red tick positions, 9 tach label anchors.
- Slanted oil/fuel strips including top/bottom segment breaks and four label/icon anchors each.
- All footer items: M logo, `19:02`, `402 km`, `70` circle, blue pane separators, `+21.0°C`.

Primary test: **corresponding edges should land within ±1–2 source pixels** once the source capture's imaging artifacts are correctly handled. This is a target threshold, **not** a claim that the first pass already achieves it.

### 17.3 Difference methodology

1. Keep `IMG_9533.jpeg` unchanged as the reference. Record its dimensions, orientation and SHA-256. Convert to uncompressed PNG **without resizing**.
2. Render the vector scene at exactly `1582 × 579`, with the identical color-management policy and no viewport letterboxing.
3. Compare source/render after estimating any strictly necessary photographic warp **on a separate diagnostic version**; do not stretch the final design to camouflage path errors.
4. Inspect the **50% overlay**: each mismatched line will appear as doubled edges. Repair highest-contrast silhouette junctions first.
5. Inspect **edge maps** to detect panel offsets without penalizing naturally different photographic grain; inspect color maps separately for gradient mismatch.
6. Analyze **regions independently**: left telemetry, central gear, tach, right slanted bars, far-left telltales and footer. Global MAE alone can hide a grossly incorrect tiny icon.
7. Use a **blind blink comparator** toggling 0.5–1 Hz between frames; if bars, letter outlines or diagonal seams appear to jump, they are not registered.
8. Re-export and repeat after *every* adjustment batch. Keep the original unchanged and a small versioned changelog.

### 17.4 Acceptance checklist by component

| Component | Explicit pass/fail condition |
|---|---|
| Outer blue body | Pointed left vertex, top/bottom edges, seam angle, central right chevron all overlay closely with reference |
| M stripes | Visible blue/royal/magenta diagonal bands occupy same paths and opacity as photo |
| Four telemetry rows | Correct icon, correct **exact 3-label sequences**, bar lengths, count, breaks and colors; consistent y placement |
| Large `D` | White contour width, inner cutout, band placement and optical center match |
| `0 km/h` | Small rectangular zero, suffix placement and baseline match; no added mph |
| Cyan trim | Only the two short cyan accents; no giant speedometer frame |
| Tach | Burgundy face, thin left boundary, bright right rail, ticks, text label and 8–0 numbers align |
| Red lower step | White cross-cap, upturned toe, lower red reflection and cyan-hook separation match |
| Oil strip | Slanted individual steps, red upper tip, blue lower tip, `150/100/50 °C`, oil icon match |
| Fuel strip | Distinct `1`, `1/2`, `0`, pump/arrow glyph, stepped silver/white diagonal bars match |
| Far-left indicators | Correct vehicle/parking-sensor icon and two pale-lime light symbols |
| Footer | `M` outline, `19:02`, `402 km`, red-bordered `70`, four blue panes, `+21.0°C` correctly positioned |
| Background | Still nearly black; no faux bezel, cards, extra status, or unwanted bloom |
| Live mode | Dynamic fields update without geometry reflow, warning suppression, lagged display or stale-value fabrication |

Final approval must require sign-off against the **source-image zoom crops**. A preview that looks "BMW-like" at 25% size is not sufficient.

## 18. Common failure patterns — reject immediately

- **Recycling the prior reference:** old blue V-speed gauge, big `P`, `4WD`, LIMIT badge, `207 km`, `12:04 pm`, previous panel M slabs, or five `SPORT PLUS` menu rows.
- **Generic game dashboard:** perfectly symmetric dials, circular speed rings, a fake carbon-fiber backdrop, large decorative BMW roundel, neon bloom, bright 3D perspective bezel.
- **Blue hexagon:** collapsing the elaborate central blue panel into a generic six-sided polygon or evenly divided rectangular card.
- **Wrong center:** putting a large `0` where the huge `D` belongs, using a rounded `D`, omitting the black gear band, or moving `0 km/h` to the footer.
- **One generic progress bar:** replacing each telemetry row with unsegmented solid white/blue lines, hiding slanted gaps, or losing the short colored cyan/red lower stroke on row 3.
- **Wrong values:** writing `0.0 0.9 1.9` as live readings; replacing `−20 15 50` with a standard Celsius scale; dropping `bar`/`°C` suffixes.
- **Incorrect tach:** a mirrored V, a circular arc, rotated numerals, `0` at the top, 7 instead of 8 as the top number, or a fully bright red rectangular wedge.
- **Right gauge collapse:** one long continuous white slash instead of the separate slanted oil-temperature and fuel ladders.
- **Incorrect footer:** a LIMIT badge instead of a red ring `70`, `19:02 pm`, old values, a text `M` in place of a traced outline, solid rather than four-segment blue panel.
- **Font substitution:** ordinary Helvetica/Arial `D`, zero, `2` and `8`; thin seven-segment arcade glyphs; inconsistent character baselines.
- **False precision:** labeling approximate landmark guides as factory CAD values; stating `pixel-perfect` with no overlay/difference evidence.

## 19. Coding AI delivery contract

Produce the following **in this order**:

1. **Source inventory:** all input images, original dimensions, checksum and identification of this reference as the sole visual authority.
2. **Landmark sheet:** image overlay showing ≥100 control points and an editable JSON coordinate file.
3. **Clean vector build:** full 1582×579 source scene; each glyph, icon, bar and colored plate as independent editable elements.
4. **Static reference fixture:** `D`, `0 km/h`, printed turbo/coolant/oil/lower thermal scale values, `19:02`, `402 km`, speed-limit `70`, and `+21.0°C` with the **exact photographed appearance**.
5. **Interactive state plumbing:** strongly typed state object, read-only adapter, deterministic fixture mode and safe unavailable-data behavior.
6. **Visual QA package:** original, render, 50% overlay, color difference, edge difference, blink comparator, close-up glyph/segment sheets and mismatch log.
7. **Acceptance report:** what passed, what remains approximate, the largest positional/shape deviations, and a strict declaration of whether "1:1 compared to `IMG_9533.jpeg`" has **actually been verified**.

### Final instruction to the coding AI

**Zoom into the photo and trace what is there.** Recreate the unusual pointed blue left wing, differentiated blue/magenta M bands, four bespoke multi-segment telemetry scales, *black gear cutout with white D*, compact rectangular speed zero, isolated cyan bracket/hook, steep red-and-burgundy 8-to-0 tach, separate two slanted oil/fuel strip ladders, pale-lime left telltales, and the exact 19:02 / 402 km / 70 / +21.0°C footer. Preserve every visible angled edge and the weight/spacing of every numeral. If a specific shape cannot yet be matched, label it unresolved and keep refining; **do not silently replace it with a generic symbol**.

---

### Authenticity and legal scope

This document describes a **reference-image reconstruction** for design and software-development use. It does not imply BMW approval, a verified OEM asset license, access to proprietary factory graphics, or certification for replacing a safety-critical instrument cluster. Recreate visible shapes through authorized tracing or use properly licensed source assets. Do not present the exact photographic capture dimensions or uncertain component semantics as official BMW engineering specifications.

## 20. Post-implementation supplement — delivered vector and visual validation

A new independent editable SVG and complete comparison bundle have now been produced from `IMG_9533.jpeg`. This section supersedes the earlier **future-tense** delivery checklist where an actual verified result is now available; the remaining precision work still applies.

| Deliverable | Exact filename |
|---|---|
| Editable reference-coordinate vector | `BMW_M3_Performance_Telemetry_Cluster_1582.svg` |
| Native render | `BMW_M3_Performance_Telemetry_Cluster_1582.png` |
| 2× and 4× renders | `BMW_M3_Performance_Telemetry_Cluster_2x.png`, `BMW_M3_Performance_Telemetry_Cluster_4x.png` |
| Visual registration overlay | `BMW_M3_Performance_Overlay_50pct.png` |
| Color and edge error maps | `BMW_M3_Performance_Pixel_Difference.png`, `BMW_M3_Performance_Edge_Difference.png` |
| Source/vector side-by-side and blink | `BMW_M3_Performance_Source_vs_Vector.png`, `BMW_M3_Performance_Blink_Comparison.gif` |
| Close-up inspection evidence | `BMW_M3_Performance_Telemetry_Zoom_Comparison.png`, `BMW_M3_Performance_Tach_Zoom_Comparison.png` |
| Interactive fully offline demonstration | `BMW_M3_Performance_Cluster_Standalone.html` |
| Source-level HTML controller and tests | `BMW_M3_Performance_Cluster_Live_Demo.html`, `BMW_M3_Performance_Cluster_Demo_Test.js` |
| Full result accounting | `BMW_M3_Performance_Cluster_QA_Report.md` |

**Actual current QA result:** Source/reference both 1582×579; vector XML parsed and exported; normalized RGB MAE improved from `0.0569037` (first vector baseline) to `0.0545742` after color/glyph adjustments; grayscale 1-pixel edge-map difference `0.0392389`. Custom glyphs replace the ordinary font in the main value scales. The controller passed deterministic tests for fixture mode, live/demo mode, speed, gear, boost, telltales, overlay and reset. The standalone HTML also passed controller tests, but a desktop browser smoke test remains pending because Chromium launch was blocked in the build environment.

**Open fidelity requirements:** Correct row-specific segmented-bar corners, exact proprietary numeric contours, tiny warning icon shapes, auxiliary slanted-bar cuts, nuanced panel gradients and photographic bloom. The render is materially closer to the supplied target than a generic dashboard, but **not a verified pixel-perfect reproduction**. See the QA report and zoom comparisons for exact outstanding components; do not silently mark this project as 1:1 complete.

---

## 21. LCI G80 M3 verification and the boundary between factory evidence and authored artwork

**The display must be technically honest about its origin.** `IMG_9533.jpeg` is the absolute visual authority for **the four-gauge photo fixture**; it is not an authenticated uncompressed M3 LCI TRACK-mode framebuffer. The user's 2024 iDrive 8 description and the 2025 G80 LCI operating-system designation are related, but **not interchangeable software specifications**.

BMW's official May 28, 2024 announcement of the **2025 M3 G80 LCI** specifically identifies BMW Operating System **8.5**, a **12.3-inch information display** and a **14.9-inch control display**, both under BMW Curved Display, with M-specific graphics. The physical 12.3-inch diagonal does **not** authorize treating this 1582×579 cropped photo as the native LCD raster. Source: [BMW Group Press: The new 2025 BMW M3](https://www.press.bmwgroup.com/usa/article/detail/T0442408EN_US/the-new-2025-bmw-m3?language=en_US).

BMW's official [2025 M3 instrument-cluster FAQ](https://faq.bmwusa.com/s/article/BMW-M3-Sedan-and-BMW-M3-Touring-2025-BMW-iDrive-OS85-Displays-Instrument-cluster-MY25-Jo0LE) confirms that the instrument graphics respond to M MODE and that configurable widget choices include **Setup, Engine, Tires, G-Meter, Media/Radio and Sport displays**. Its [M MODE FAQ](https://faq.bmwusa.com/s/article/BMW-M3-Sedan-2024-life-cycle-impulse-Driving-dynamics-M-MODE-Use-MY25-Mp3Jf) confirms ROAD/SPORT/TRACK availability according to equipment and that TRACK requires **M Drive Professional**. BMW's [M MODE explainer](https://www.bmw-m.com/en/topics/magazine-article-pool/bmw-m3-m4-m-mode.html) says infotainment is deactivated in TRACK to focus the driver, and BMW's [track-setup guide](https://www.bmw-m.com/en/topics/magazine-article-pool/how-to-get-ready-to-race-with-m-setup.html) similarly describes distraction-reduction. Accordingly, **do not label our custom active navigation takeover as a measured, factory-authenticated TRACK framebuffer**.

| Design fact | Status | Required behavior |
|---|---|---|
| `IMG_9533.jpeg` geometry, numerals, warning pictograms, four left telemetry rows, red tach | Directly visible in user-supplied photo | Reconstruct to coordinates, compare pixel-for-pixel against the photo |
| OS8.5 and M-specific 12.3-in instrument screen for MY2025 LCI | Verified BMW documentation | Use terminology accurately; do not claim exact raster resolution |
| Configurable M widgets and mode-dependent layout | Verified BMW FAQ | Preserve a separate state for selected content and M mode |
| Three named BMW M modes, TRACK equipment gating | Verified BMW FAQ | Do not imply every G80 has TRACK available |
| Soft-edged left-wing map that replaces four engine gauges in this exact wedge | **Custom requested graphic; not OEM-verified** | Render as `NAV_MAP_LEFT` and call it BMW-*inspired*, not an OEM screenshot |
| Exact factory font files, LCD pixel pitch, color LUT, blur easing, left map split position | **Not supplied** | Keep all as editable approximations with QA gates; never assert official values |

**Reference precedence when assets conflict:** (1) for the still telemetry mode, the exact supplied photograph; (2) for authenticated 2025 LCI features, BMW technical sources; (3) for the bespoke map concept, the user's requested blend behavior; (4) design conjecture *only* if explicitly labeled as such. Never quietly blend the appearance of two model-year software versions and call the product "OEM exact."

## 22. Revised pixel-level icon construction: no dangling car, more light spacing

Use the following **corrected** source-coordinate geometry. It supersedes the initial first-pass interpretation of the far-left warning stack.

### 22.1 Park-assist mini-car and independent receiver

- In the production SVG, `parkingAssistLamp` has `transform="translate(71 150)"`. The white vehicle body starts at local `(0,0)` and ends around `(17,32)`. Its windshield and lower window are **dark knockout shapes** inside the vehicle; do not use thin separate outlines for the windows.
- The two radar sweeps are **open white arcs** only: `M19 27 Q25 29 25 33` and `M18 33 Q24 35 25 39`. Stroke around `2.8 px`, rounded caps. Neither wave extends to the receiver.
- Receiver silhouette, separate path: `M33 37 H38 Q42 37 42 42 V47 H29 V43 Q29 37 33 37 Z`; white fill, no stroke. Dark inset: `M33 42 H39 V45 H33 Z`. On the full artboard these are around `x100–113, y187–197`.
- **Negative-space test:** inspect a 10× nearest-neighbor crop with transparency/black background. A black gap must visibly separate the vehicle from the wave strokes and the wave strokes from the receiver; no hanging arm. At 1×, the receiver reads as an isolated roadside object, *not a towed tag or connection extending off the car.*
- A tiny amber/yellow blot near this stack in the JPEG is not established as instrument artwork. Preserve only persistent structured pixels, not camera flare.

### 22.2 Two pale-green indicators with independent visual silhouettes

- Position lamp (`positionLamp`): origin `(67,288)`, two facing curved white-green **lobes**, one at local `x10..17`, one at `x21..28`; a black slot local `x17..21` keeps them visibly separate. Six outward rays are unconnected to each other. Narrow core stroke `2.8 px` with pale yellow-green `#E7F7A4` before optical tuning.
- Headlamp (`headlamp`): origin `(69,314)`, **round-shouldered** D-shaped main perimeter from roughly local `(16,2)` to `(45,36)`; trace `M28 2 C38 2 45 11 45 20 C45 30 38 36 28 36 H18 Q16 36 16 33 V6 Q16 2 18 2 Z` rather than a square-cornered generic capital D. Core stroke `3.5 px`; five diagonals from local `x0..9` at y≈`3,10,17,24,31` to endpoints around y≈`9,16,23,30,37`; first/last rays are **not joined to create a comb**.
- Native gap from position rays to headlamp: roughly `5 px`, with at least one completely black raster row between glow halos at standard brightness. Check physical gap *after* antialias and glow, not only using path bounds. If highlights fuse, reduce glow and optionally offset the top icon another `1–2 px` upward rather than shrinking either correct contour.
- Optical alignment: left ray column `x≈67–80`, lamp head around `x≈86–113`. Neither touches the blue polygon, which does not start until about `x113` at its pointed apex. The left stack should read as independent telltales against continuous black glass.
- **Do not add** a yellow dot, an extra lamp icon, dashboard label, connecting wire, secondary shadow symbol, or duplicate car. Clean path edit > global sharpening for these tiny forms.

The revised side-by-side crop is `BMW_M3_Left_Telltales_After.png`; keep an inspection crop of the unmodified JPEG available when judging it. The explicit changes made to the vector are car/receiver separation, reworked two-lobed upper lamp, shifted 5-pixel upper-lamp position, and individually spaced five headlight rays.

## 23. Left navigation takeover — exact custom clip, feather, and road-map layer

This section is a **buildable visual design contract** for the user-requested navigation variation. It is not a claim that BMW ships this precise blend or map split in the 2025 G80 TRACK view. The current implementation deliberately preserves **everything to the right of the left wing** as it replaces the four engine gauges. This makes it possible to transition between the photo fixture and a realistic BMW-styled map view without redrawing the tachometer.

### 23.1 Coverage and shape — the map is *not* a rectangle

Native coordinate system: 1582×579. The map is allowed within the **left M wing only**; approximate bounds `x112..632`, `y102..446`, but the actual path mask is the **entire original pointed left silhouette**:

```svg
<clipPath id="leftWingClip">
  <path d="M222 102 H685 L494 442 H208 Q197 442 189 430 L116 324 Q111 315 117 300 Z"/>
</clipPath>
```

Within that silhouette, use a map viewport **`x=111,y=103,width=520,height=344`**. Keep the silhouette edges at the original source coordinates: a long horizontal upper edge from `(222,102)`, the sharp left-point elbow at `(113,310)`, and a lower edge around `(202..494,442)`. **Do not** add a floating map card, outer border, black rounded rectangle, side pane, or standard phone-navigation UI. The map should feel like information *inside the graphic panel itself*.

All of the following remain untouched across a navigation switch:

1. Center black gear band with enormous white `D` at `x≈754..858`, and squared `0 km/h` near `x≈783..882`.
2. Center/outer blue chevron structure and its black oblique seams at `x≈496` and `x≈773`.
3. Diagonal burgundy/red 0–8 tachometer, exact pink numbers, separate oil/fuel ladders, tiny left headlight indicators, and footer outline M/time/range/ambient temperature.
4. Top cyan bracket and lower cyan hook, and the four-segment blue footer wing.

Only the internal content group `telemetry` (four gauge rows and their pictograms) fades out, while the group `navigationMapLayer` fades in. The original blue M bands and linework remain visible at reduced strength through the navigation overlay. The **photo fixture** never displays the navigation layer; it is a distinct variant.

### 23.2 Alpha math: two independent soft edges, never a blocky wipe

Use two `userSpaceOnUse` luminance masks so the map both enters and exits the existing blue wing without square edges:

| Axis | Start / end | Stops `(offset, luminance)` | Visual purpose |
|---|---|---|---|
| Horizontal | x=112..620 | `0.000→0`, `.075→1`, `.540→1`, `.720→.843`, `.880→.278`, `1.000→0` | Gentle left entry; strong blue M stripe return beyond x≈385, dissolving by x≈620 |
| Vertical | y=103..444 | `0.000→0`, `.075→1`, `.870→1`, `1.000→0` | Avoid pasted-in horizontal hard edges against top/bottom plate contours |

Group order / alpha application:

```svg
<g id="navigationMapLayer" opacity="0"
   clip-path="url(#leftWingClip)" mask="url(#navXMask)">
  <g mask="url(#navYMask)">
    <g id="navIllustration"> ...author map vector... </g>
    <image id="navExternalFrame" x="111" y="102"
           width="520" height="344" preserveAspectRatio="xMidYMid slice"
           opacity="0"/>
  </g>
</g>
<g id="telemetry" opacity="1"> ...four monitor rows... </g>
```

In a shader-based renderer, implement the equivalent:

```text
mapOpacity(x,y,t) = navigationModeOpacity(t)
                    * wingSilhouetteMask(x,y)
                    * featherX(x)
                    * featherY(y)
                    * userMapStrength
composite = mapOpacity * navigationPixel + (1 - mapOpacity) * originalWingPixel
```

The masks are **multiplicative**, which makes the map translucent close to a diagonal edge while leaving the central roads legible. Alpha fading is the primary blend; where a soft optical blur is requested, add only a small **1–2.5 source-pixel edge blur** in the feather region, not a full-map Gaussian blur that smears lane geometry and labels. Keep the center route and location arrow crisp. Require the map to vanish without a visible straight border around `x≈600`.

### 23.3 Map aesthetics and density

- Base map: nearly black navy `#09192B` at about 94% internal opacity over the left cobalt; uneven low-contrast building/land-use shapes around `#152B46` at about 80%. Streets should be blue-gray, **not white**, with differentiated widths (major 9–14 px; minor 3–8 px; alleys 1 px) and capped intersections.
- Route: thin blue track beneath a brighter cyan path, **not the tach's red**. Use softly glowing cyan `#1CB8FF` / `#53DAFF` around 3.2–4 px core and subtle 2–3 px halo. Don't draw a neon saturated snake that overpowers the giant `D`.
- Orientation marker: tiny triangular blue/cyan arrow with black shadow around `(≈317,≈325)`, angled along the route. No oversized Google/Apple navigation pin, speedometer, POI card, arrival-time box, lane guidance, or branding watermark.
- Labels: if mock data are used, tiny uppercase `PARK AVE`, `MAIN ST`, `RIVER RD` in muted blue-gray, opacity around 60–65%, 12–14 px. These are **synthetic placeholder names**; do not imply the displayed road geometry is an actual location. A real screenshot may replace the map only with user-supplied or legally integrated navigation pixels.
- Diagonal structural lines and blue/red M bands must still show through the faded region; preserve their continuity where navigation dies into the original wing. Never flatten the wing into a homogeneous black map viewport.
- Road texture has subtle feathering *where it joins the blue body*. Do not confuse the optical JPEG softness in the supplied gauge photo with a design mandate to blur all map streets, digits, icons or tach lines.
- The map must have a distinct lower-left and central-right legibility hierarchy; do **not** place text beneath the original left warning lamps at x≈67..114 or beneath the central `D`. Place the route wholly in the masked blue left wing.

### 23.4 External map-frame adapter

The standalone demo offers a user-selected local map screenshot. It is inserted as `navExternalFrame` with `preserveAspectRatio="xMidYMid slice"`; the exact same wing clipping and two feather masks apply, and the built-in placeholder map (`navIllustration`) becomes invisible. This image is **not** embedded in the master SVG and is loaded only from the user's selected local file. In a production implementation, replace it with an authorized **read-only map-tile composition or navigation-renderer frame**.

Requirements:

1. Accept a local image frame and validate decoded format and dimensions; reject missing, malformed or extreme-size images without affecting the normal gauge fixture.
2. Fit via aspect-preserving center crop; avoid `preserveAspectRatio="none"` which would shear street angles and label glyphs.
3. Paint inside `leftWingClip`, apply `navXMask × navYMask`, set a safe maximum brightness and desaturate or tint the external map toward midnight-blue. Do not globally blur a supplied navigation screenshot, only its entering/exiting contours.
4. For true dynamic maps, update a read-only raster/vector texture under the same mask. Map pan/rotate/zoom and navigation instructions belong to the separate navigation application; this cluster graphic only consumes its output.
5. If no valid map frame exists, fall back to the synthetic road illustration or to the **exact gauge mode**. Never leave an empty blue wing unintentionally during a live switch.
6. Do not expose or render private location information in exported fixture images by default. The built-in illustration is generic and not geographically meaningful.

### 23.5 State transitions, modes, safety, and screen-space lock

Treat `MMode` (BMW DRIVE UI setting, if supplied by a real car) as a **separate axis** from `leftContent`: never infer one from the other. A robust state model uses:

```ts
type LeftContent = 'ENGINE_GAUGES' | 'NAV_MAP_LEFT';
type VisualPreset = 'PHOTO_FIXTURE' | 'SPORT_INSPIRED' | 'TRACK_INSPIRED';
type MapFeed = {kind: 'PLACEHOLDER'} | {kind: 'USER_IMAGE'; frameUrl: string};

interface ViewState {
  preset: VisualPreset;
  leftContent: LeftContent;
  mapStrength: number; // [0.4, 1.0] configured for legibility, not OEM-calibrated
  mapFeed: MapFeed;
  navigationModeOpacity: number; // animated 0→1
  // current gear/speed/RPM/status are independent of content selection
}
```

| Event | Telemetry group | Map group | Other elements | Duration |
|---|---:|---:|---|---|
| Load `PHOTO_FIXTURE` | 1.0 | 0 | All photo-matched objects shown | 0 ms, deterministic |
| Choose `NAV_MAP_LEFT` | Fade 1→0 | Fade 0→strength | All gear/tach/footer objects **unchanged** | 480 ms smoothstep/cubic-ease (design choice) |
| Choose `ENGINE_GAUGES` | Fade 0→1 | Fade strength→0 | All gear/tach/footer objects **unchanged** | 480 ms |
| Choose `TRACK_INSPIRED` | As chosen left content | As chosen left content | Optionally hide **only** demo speed-limit sign; preserve warning lamps | 0–480 ms |
| Reset/reference fixture | 1.0 | 0 | Restore all text/numbers, icon states and speed sign | Immediate deterministic state |

`TRACK_INSPIRED` is an **illustration preset**, not an assertion of BMW's actual 2025 TRACK screen. The speed-limit icon removal is consistent with the focus principle, but exact OEM omission must be independently confirmed on hardware. Real critical warning and telltale visibility has higher priority than decoration; never bury fault lights, vehicle speed, gear, fuel or temperature under the map. If implementing this on non-simulated hardware, obey OEM safety/interface requirements and do not replace a certified cluster UI with this prototype.

The map and telemetry layer must share **exactly the same 1582×579 root coordinate system**. Drive transitions with opacity or masked shader compositing; never animate widths, change the tach's X position, recenter the `D`, rescale the blue polygon, or change the footer layout. Source-to-destination transform should be a single uniform scale `s=min(viewportW/1582,viewportH/579)` plus centering/letterboxing, with no nonuniform stretching.

## 24. Production-quality visual verification — required for every coding-AI iteration

**Photo fixture acceptance** and **custom map acceptance** are two separate tracks. A precise gauge reconstruction does not prove the map mode is OEM, and a beautiful map does not excuse wrong source-gauge bars.

**Track A — supplied still photograph:**

1. Check the exact SHA-256 and dimensions, then compare only to `BMW_M3_Performance_Telemetry_Cluster_1582.png`, rendered with telemetry opacity 1 / map 0 and source text values unchanged.
2. Export SVG at source, 2×, 4×. Use a deterministic renderer and log its version; avoid letting a different browser font substitute for the traced display numerals.
3. Create native overlay at 50% original/50% SVG, side-by-side, high-contrast absolute RGB difference and 1-pixel grayscale edge difference. Archive the MAE but **never convert it into a misleading similarity percentage**.
4. Pixel-zoom individual masks: `(65,145,54,55)` for car/radar/obstacle, `(60,281,60,75)` for the two green lights, `(210,160,350,225)` for four scales and `(1050,70,350,410)` for tach and right ladders. At 6–10× use nearest-neighbor; check black gaps are **actually black**.
5. Reject immediately if the car has any dangling connection, if upper and lower light logos fuse, if the map bleeds into the PHOTO fixture, or if any debug marker/overlay exports by default.

**Track B — user-requested navigation variant:**

1. Render `BMW_M3_Performance_Cluster_Navigation_Left.svg` and its native plus 2× PNGs. Inspect whether the road map is visible only inside the pointed wing and gently returns to blue near the right-hand seam; check top/bottom alpha feathers are present.
2. Validate pixels at outside-wing coordinates (`x≈80,250`, `x≈705,310`, `x≈1040,250`, `x≈1360,350`): **zero map contribution**. At a selected inner point such as `(300,300)`, confirm visible blue route and road contrast; near `(598,300)`, confirm the original blue plates dominate.
3. Toggle content at least ten times, interrupt halfway, and ensure the final state matches the selected button, with no stale half-opacity layer or flicker. Verify external image crop and fallback on decoding failure.
4. Switch `PHOTO_FIXTURE`, `SPORT_INSPIRED`, `TRACK_INSPIRED`, engine gauges and map independently. Confirm **all right-half numerals, red rail, fuel and temperature bars remain in identical pixel positions** across the content switch. Validate no custom map route covers statutory alerts.
5. Real LCI pixel parity for this map is **not testable without an authenticated 2025 G80 LCI frame** of the desired content mode. If subsequently supplied, archive capture provenance, calibrate perspective/crop and LED exposure, then create a new map-specific overlay/error sheet and adjust the masked geometry from measured landmarks.

**Final delivered asset families:**

| Base / variant | Source | Native preview | High-density preview | Intended purpose |
|---|---|---|---|---|
| Reference-engine gauges | `BMW_M3_Performance_Telemetry_Cluster_1582.svg` | `BMW_M3_Performance_Telemetry_Cluster_1582.png` | `BMW_M3_Performance_Telemetry_Cluster_4x.png` | Matches photo values, test baseline |
| Left navigation takeover | `BMW_M3_Performance_Cluster_Navigation_Left.svg` | `BMW_M3_Performance_Cluster_Navigation_Left.png` | `BMW_M3_Performance_Cluster_Navigation_Left_2x.png` | New custom map + feather design |
| TRACK-inspired reduction | `BMW_M3_Performance_Cluster_Track_Inspired.svg` | `BMW_M3_Performance_Cluster_Track_Inspired.png` | Re-export on demand | Non-authenticated demonstration |
| Interactive and external map | `BMW_M3_Performance_Cluster_Standalone.html` | Live browser | Full-size SVG export | Switch, fade, load user map image |
| Visual QA | `BMW_M3_Performance_Overlay_50pct.png` | `BMW_M3_Performance_Source_vs_Vector.png` | `BMW_M3_Left_Telltales_After.png` | Geometry and far-left microdetail audits |

**Final directive:** The result must have BMW-grade restraint and reference tracing, but **visual similarity is not proof of OEM authorship**. Perfect the detached white vehicle symbol, black spacing between yellow-green light pictograms, soft map-to-M-blue transition, four precisely different horizontal rails, giant block `D`, separate slanted right gauges, pink 8→0 tach numerals, and original values. Keep the photo-matched still vector and custom navigation demo explicitly separate. Claim literal *factory* 1:1 only after genuine OEM source and display calibration support that claim.
