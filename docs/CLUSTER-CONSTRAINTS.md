# Cluster constraints (iDrive 7 / MGU)

Everything in this file is a **hard limit of the car**, not a style choice.
Breaking one of these does not look bad — it makes the KOMBI draw black
boxes over our artwork, refuse a shader, or drop the scene entirely.

Sources are named per rule. Findings marked **car-verified** were measured
on real vehicles by the upstream projects we build on; findings marked
*(unverified)* are reported but not reproduced.

---

## 1. The panel target

`cluster-render` exposes the whole instrument cluster as the `panel` target.

| | |
|---|---|
| Slot | `0x203` |
| Size | **1920 x 720** |
| Scene id | `0x010004f8` (falls back to `0x01000400`, the HUD's, if the KOMBI rejects it) |
| Draws | **over** the factory gauges |
| Drawn over us | factory telltales, warnings, the bottom strip |

Source: `robertnisipeanu/idrive-apps/native/cluster-render/README.md`,
`PROTOCOL.md`.

## 2. The bottom strip — the single most important rule

**Never cover BMW's gear display: `x 1385-1462, y 665-720`.**

The cluster's own bottom strip (range, clock, street, driving mode, gear,
outside temperature) lives in `y 646-720`, under our layers. If a panel
layer covers the gear's part of it, the KOMBI decides its gear readout has
been lost and draws a **fallback gear box over our layer** — a black
rectangle in the rev dial. Nothing we draw can fill or hide it, and it has
been seen to **persist after our layers are gone**, until the cluster
restarts.

- A layout that ends at `y = 646` and leaves the strip to the car gets no
  boxes. **Car-verified** on multiple vehicles (Cluster Layouts 0.14-0.17;
  `bimmer-lab/apps` #1, #5; `ALMSTRA/idv7lol` cuts every layer at 646 by
  default after issue #7 on a G82 M4).
- Narrower measurement: only the gear window **`x 1385-1462, y 665-720`**
  actually triggers it. White drawn over all of `y 0-665`, and over the rest
  of the strip, brought no box, and the telltales still drew over the
  cover. **Car-verified** (`Vizualyse/idrive-apps/knowledge/cluster-and-hud.md`,
  2026-11-14). The same note gives how the edges were found: first
  `x 1366-1462` was left open (white round it, no box), later that was
  narrowed to `1385-1462` (black round it, "so the drive mode word left of
  the gear ... is covered: still no box"), and "the window narrowed from
  either side brought it". So a cover that ends at `x = 1385` is exactly
  what was run there, and one that reaches into the window brings the box.
- **Seen on this project's car** (X3 M40i, photographs of 2026-11-21): with
  the background run 24 px below the cut (`y 646-670`, five rows into the
  gear's window) the box stood at about **`x 1407-1595, y 337-419`**, over
  the top of M Sport's oil strip, and was still there in a later photograph
  with other settings. Where the box lands differs by car (others report
  `x 1490-1652, y 271-442`); `FALLBACK_GEAR_BOX` in `src/geometry/panel.js`
  records this car's.
- **Driven on this car** (Beta 4, reported 2026-11-22): the background to
  `y = 664` right across, and the two covers `x 0-1340` and `x 1500-1920`
  from there to the screen's edge. **No box.** So this car's window does
  not begin above row 665 (and 24 px, to row 670, had brought it), which
  is what the measurement above says.
- **Where this car's strip writes things** (two photographs of 2026-11-21,
  laid on the panel; good to about 5 px in that corner): the driving
  mode's name starts at about `x 1224` and is written *towards* the gear —
  "SPORT" is `x 1224-1310` — and the gear letter starts at about `x 1392`,
  7 px inside the window's left edge. In the strip's lettering "COMFORT"
  and "ADAPTIVE" then end at about `x 1350-1362`, and "SPORT PLUS" at
  `1382-1385`: right against the window. With `x 1340-1385` left open, the
  T of COMFORT showed on the car.

What this project does with it (`src/theme/strip.js`, one rule for every
style, set by *BMW's bottom strip*):

| Setting | What is drawn below `y = 646` |
|---|---|
| Show all of it (default) | nothing: every style ends at 646 |
| Trim its top edge: 6, 12 or 18 px | the style's background runs on that far, right across, fading to black. 18 covers rows 646-663 and stops a row short of the gear's window: **no trim can reach it** (`STRIP_TRIM_MAX`) |
| Hide it, a wider gap left beside the gear | the trim at its most, and from `y = 664` to the screen's edge two plain black covers, `x 0-1340` and `x 1500-1920` (`GEAR_KEEP_WIDE`: the gear's window with 45 and 38 px to spare). What *Hide it* was up to Beta 5, and the gap that has been driven on this car. The end of a long mode name shows in it |
| Hide it | the same with the left cover run on to **`x 1384`: one column short of the gear's window**, as the trim is one row short of it (`GEAR_KEEP`, `x 1384-1500`). The columns between are never drawn on, so **BMW's own gear letter stays**; it is all that is left of the strip. Not yet driven: if a box appears, the wider gap is the answer, and the measurement above does not hold for this car |

The covers and the backgrounds are marked `still`, so the limiter's shake
(§9) never carries one over the gear. `test/strip.test.js` holds every
value, including the ones older versions saved (24 becomes 18; 48 and 74
become *hide*), to the rule in every style; and the simulated car
(`tools/car-sim.js`) holds every rectangle the renderer is ever given — a
new layer, or one the shake has moved — against the window, and reports
how near anything came (1 px above, 1 px to its left, 38 px to its right
with *Hide it*). The shake moves a layer down by 5 px at its hardest, so
the lowest it carries anything is `y = 651`, 14 rows above the window.

Everything else of ours — every reading, line and figure — still ends at
`y = 646`: `BOTTOM_CUT` in `src/geometry/panel.js`.

**The one exception, a BETA and off as it comes** (*BETA: lower and
enlarge the cluster*, `Strip.lower*` in `src/theme/strip.js`): with the
strip hidden, the style itself may be drawn into the strip's rows — its
foot `d` px below the cut (`d` up to 74), the whole of it larger by
`(646 + d) / 646` about the top of the screen's middle. What it rests on
is the measurement above and nothing new: only the gear's window brings
the box, and the two covers already stand on every other part of the
strip. So the rule it keeps is the covers' own, for every layer:

- **nothing in the gear's columns from `y = 664` down** (`x 1384 – 1500`;
  `x 1340 – 1500` with the wider gap). A layer's rectangle either ends
  above row 664 or lies wholly to one side of those columns;
- for a layer the limiter's shake moves (Toro: up to 10 px sideways, 5 px
  down), the same with that much to spare, so no jolt carries it in;
- what lies over the whole style — the limiter's flash, the start-up
  message's veil — is three rectangles, not one: the whole width down to
  row 664, then one each side of the gear's columns to the style's foot;
- nothing leaves the screen: a style takes only as much as it has room
  for (Toro 58 px, where its side gauges reach the screen's sides).

`theme.foot` (646 + d) is where the driver now cuts a layer that strays
(`u_keep`, §4): as a style comes that is still 646. `test/lower.test.js`
holds every style at every amount to this, shaken positions included, and
the simulated car holds every rectangle the renderer is ever sent to it.
**Not yet driven.**

## 3. Keep-clear zones

| Zone | Rect | Applies to | Why |
|---|---|---|---|
| The gear's display | `1385,665 77x55` (kept clear with *Hide it*: `1384,664 116x56`; with the wider gap: `1340,664 160x56`) | all | §2: never covered, whatever the setting |
| Bottom strip | `0,646 1920x74` | all | §2: nothing of ours but the background's trim and the *hide* covers |
| Top-left corner | triangle `(0,190)-(325,0)-(0,0)` | all | glass is cut on a diagonal; pixels there are not visible |
| Top-right corner | triangle `(1650,0)-(1920,200)-(1920,0)` | all | same |
| Tyre telltale | ~`40,260` | all | KOMBI draws over us |
| Parking brake telltale | ~`1840,245` | all | KOMBI draws over us |
| Brakes, ABS, DSC telltales | round, ~`94,248`, `80,366`, `73,424` | all | KOMBI draws over us (BMW's guide TE18-0859, unverified) |
| Auto Hold, steering telltales | `1784,228 100x38`; round ~`1888,349` | all | KOMBI draws over us (Auto Hold: a G20's photo) |
| eDrive box | `1770,170 150x95` | hybrids | KOMBI draws over us |
| M box A | `793,289 246x92` | M cars | KOMBI draws over us |
| M box B | `1223,328 171x78` | M cars | KOMBI draws over us |

Corners and telltale positions: **car-verified** by calibration grid
(`Vizualyse`, 2026-11-14). eDrive and M boxes: reported by
`eroobeeroo/idrive7-cluster-info` `layout_common.js` *(unverified here)*.

The bottom corners are slightly rounded. All of `1920x720` is otherwise
visible, including the top edge in the middle.

## 4. Shader limits (effect layers)

Effect layers are GLSL ES 1.00 fragment shaders compiled **by the unit's own
glslang**, which is stricter than a desktop browser.

- **Reserved uniform names.** `u_mvp`, `u_mv`, `u_m`, `u_v`, `u_p`,
  `u_normal` are reserved and must be `mat4` if declared at all. Declaring
  `vec4 u_v` makes the unit refuse the layer ("effect did not compile")
  while WebGL accepts it happily. **Car-verified** (`Vizualyse`).
- **Uniform budget: 48 vectors max** per shader, counted the way GLSL ES
  counts them. A shader of ~70 vectors **restarted a G21's KOMBI**.
  **Car-verified** (`ALMSTRA/idv7lol`).
- **No `break` out of a loop.** Suspected of the same KOMBI restart.
- Keep loops short and bounded; the unit unrolls them.

## 5. Asset limits

- **16 assets per client, refused after the fact.** Past the limit the
  client still returns a ref and the server silently refuses it, so layers
  bound to it draw *nothing* with no error. Always drop assets you are
  replacing *before* creating the new ones. **Car-verified** (`Vizualyse`).

## 6. Upload budget

- One shared link to the KOMBI for every head-unit participant. Ceiling
  **5500 KB/s**, floor 2000, stepping down 500 at a time on congestion.
- A full 1920x720 RGBA frame is **5.5 MB** — about 1 fps. Pushing pixels for
  animation is not viable.
- **Effect (GLSL) layers upload nothing per frame.** Animation comes from
  uniform updates, which cost bytes in the tens (§9). This is why this
  project is built on effect layers rather than a software rasteriser.

## 7. Layer stack

Bottom to top: class (`ambient`, `content`, `overlay`, `alert`), then the
client's `z`, then newest. The KOMBI still draws its own warnings, the
navigation direction list and parts of the panel **above everything** we do.
Nothing can be drawn above those — by design, and we do not try.

## 8. Lifecycle

- The car's own safety display always wins. We never cover warnings.
- Keep off the cluster while the car is off or switching on/off.
- On renderer restart, clients reconnect and resend their layers.

## 9. Time and animation: the renderer's clock does not run

`cluster-render` can feed a layer's `u_time` itself (`"time": 1`) and play
keyframes (`animate`): both are animations the instrument cluster runs on
its own clock (RAMSES `AnimationSystemRealTime`). **On this project's car
that clock does not advance**: two photographs six minutes apart show the
holiday snow in exactly the same places, and nothing else that moved by it
had moved either — the limiter's flash, the shift lights' strobe, a gauge's
alarm, the limiter's shake. Uniforms sent from the head unit do arrive (the
needles move).

So nothing here asks the renderer for time or an animation
(`test/clock.test.js` fails if a layer does):

- **`u_time` is a uniform we send**, from the head unit's clock, only to
  layers that are animating at that moment (`src/engine/clock.js`: the list
  of shaders that read it and the uniform that says each is running). It
  runs 0 to 9 s and round again; every cycle the shaders make of it fits a
  whole number of times, so the turn-over is not seen.
- **The snow** gets how far each of its three depths has fallen, 30 times a
  second (`src/theme/overlays.js`).
- **The limiter's shake** moves every layer but those marked `still` with
  `set` (`x`, `y`), whole pixels, a step per frame (`src/car/cluster.js`).

A quiet cluster still sends nothing: a parked car with no extras costs no
bytes at all, and the holiday theme about 3 KB/s of the 5500 available.

## 10. The map slot

The cluster has one place for a picture in its middle: the map slot,
`416,120 1088x480` of the panel, **under** every panel layer. BMW's own map
view draws there (the car's *Instrument cluster > Central display area* on
*Map view*), and so do *Maps on cluster* (the phone's map, target `map`)
and *Turn View* (the front camera) when they take the slot.

An effect-layer app shows whatever holds the slot by leaving its own
layers see-through over it; it cannot move, scale or reorder the picture.
(`host`, which places another target's picture inside a scene, is for
RAMSES scene files only: PROTOCOL.md, "Hosting another target".) Each style
therefore opens a window in its background over part of the slot, and
`src/car/centre.js` decides only when that window is open.

**How large a window can be** is set by what stands on it, not by the
slot. The picture is whatever the car has there — and a map by day is
pale, so a white figure over it is lost. So a window may take in anything
that is not a white readout or the dark it is drawn on:

| Style | Standard | The larger setting(s) | What stops it |
|---|---|---|---|
| Toro | a long hexagon behind the gear, `530,206 860x310`, fading in over 120 px | *More*, *Most*: the same hexagon grown to the slot's width and cut by a circle a little inside the dial's inner contour — the inside of the dial | above and beside: the rev band, its numbers and contour (white on the background); below: the G meter's top figure, the first white thing under the dial (the opening's foot follows it when the dial is made larger or nudged up) |
| M Sport | a V between the two plate groups, in over 44 units | *More*: the V in over 18 units, joined to a band across the top over the plate above the speed and the plate above the gear | the black bars the speed and the gear are written in; the lower plates, which carry the second speed and the units |
| M Sport Plus | a band across the centre plate, fading out a long way at both ends | *More*: the same band in over 12 – 100 units, and the whole plate above the speed. *Fullest*: one smooth field across the middle, with a pad round the speeds and one round the gear | the line the owner marked (it keeps the picture off the two speeds), the black between the plates, the oil gauge's figures |
| Both M styles | | *Widest* (0.10.0): **the slot itself** - its whole rectangle down to artboard row 530, in over 88 units at the sides, 48 at the top and 46 at the foot - with the plates taken away while it is open | nothing of the style's shape: only the readouts, each on a soft-edged pad of dark glass no larger than its figures (the speeds, the gear's place, the fuel strip, the oil strip), and the footer, which the picture's foot stops above |
| M Track Mode | the left wing, from where the slot begins | *The whole wing* (0.10.0, as it comes with a picture chosen): the style itself stands 193 px further right, so the wing's point is at `x 416` and the window is the wing's own outline | the slot's left edge - there is no picture left of `x 416`, which is why it is the style that moves; the gear and everything right of the first seam |

**A window with no outline of its own takes the plates with it.** The
other windows are shapes in the style, and a plate thins out along the
shape's edge. *Widest* is the slot's rectangle: thinned by that, the
plates were left as fragments along its edges and inside every pad, so
there they go altogether as the picture comes up, and are not drawn at all
once it is open (`src/theme/track.js`: a layer whose uniforms are null is
hidden, the same way a turn card is).

Red on a pale map still reads, which is why Toro's gear and its mode's
name may stand on the picture and nothing white may. `test/theme.test.js`
and `test/track.test.js` hold every readout to this for every size; the
preview's `show=day` is the pale map to look at it on.

*Maps on cluster* is read, never commanded: its status file
(`/run/waze-on-cluster/status.json`, written once a second) says whether
the phone's map is on the cluster. Its control socket belongs to its own
app (a second connection is told `busy`), and its current version has no
command that moves the map into the panel; earlier versions of this
project sent one and waited for an answer that never came.

