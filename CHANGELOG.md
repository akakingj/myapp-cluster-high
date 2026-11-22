# Releases

`main` is the current release; the Store installs whatever `main` holds.
Each earlier release is kept on a branch of its own name. To go back to
one: `git checkout <branch>`, or point the Store's source at that branch.

## Beta 6 — `main`, app version 0.9.2

**0.9.2: electric range, for plug-in hybrids and electric cars** — asked
for by their owners, and **off unless turned on**, because it has never
been on such a car. *GENERAL → Electric range*: *Plug-in hybrid* (the
electric range as well as the fuel's) or *Electric car* (in place of it).

- Toro: it takes one side gauge's place — oil pressure on a hybrid, the
  fuel gauge on an electric car, or the one you choose. The bar is the
  drive battery's charge, the figure the range.
- M Sport and M Sport Plus: two new footer readings, *Electric range* and
  *Drive battery charge*; on an electric car the footer's own range place
  carries the electric range and the fuel strip the battery's charge.
- Read from two signals the cluster is sent, as Vizualyse/idrive-apps reads
  them. Their scaling is unconfirmed upstream and here: a figure that does
  not match BMW's own is to be reported, not trusted. A head unit without
  the signals installs and runs as before.
- The page's title follows the app's name, and a public release can carry
  a name of its own (`npm run release -- --name ...`); the app's id, and so
  its settings and updates, stay the same.
- 190 tests (4 more).


**0.9.1, for the public release:** the start-up message is now part of how
the app comes. A new install shows ***MGU Styles an app by #tunedbywali***
for ten seconds at each start and fades into the cluster; *GENERAL →
Start-up message* turns it off, and *Start-up message: words* still offers
every other set — the dedication, the four greetings, your own from a USB
stick. An install that is already set up keeps what it has. (The message's
typeface gained the `#`, so the glyph atlas was baked again: every glyph
is the same shape, some stand elsewhere in it. Toro's reference frames
come out as before to within one level of brightness on at most 15 pixels
of each - nothing an eye can find - apart from the frame that shows the
message, whose words are the new ones.)


**The second drive, answered.** Beta 4 came back from the car as "overall
very good", with the strip's fix confirmed (no black box) and three things
asked for (2026-11-22). Beta 5's BeeM-Flash switch had not been tried yet
and is unchanged here. None of this has been back on the car.

- **Hide it now hides the driving mode's last letter.** With BMW's strip
  hidden, the T of COMFORT still showed beside the gear. BMW writes the
  mode's name *towards* the gear (from about x 1224: "SPORT" ends at 1310,
  "COMFORT" at about 1354, a longer name right against the gear), and the
  cover stopped at x 1340. It now runs to **x 1384, one column short of
  the gear's window** (x 1385 – 1462), as the trim above it has always
  stopped one row short. Nothing is ever drawn over that window; the
  simulated car now holds every rectangle the renderer is given against
  it, shake included.
  - The gap from before is kept as a second choice, **Hide it, a wider gap
    left beside the gear** (x 1340, the only gap that has been driven on
    this car). The window's edges were measured by others, on another car;
    this car's own strip agrees with them in every way that has been seen,
    but if a black box ever appears in the rev dial with *Hide it*, choose
    the wider gap, let the car sleep once, and say so.
  - An install that has *Hide it* saved gets the closer cover by itself.
- **More of the picture, per style** (*how much shows*, on each style's
  tab; *Standard* is what it was, and what an update keeps):
  - **Toro**: *More* and *Most* open **the inside of the dial** — a dome of
    map under the rev band, about 1.7 and 2.1 times as much of it seen
    clearly as the standard lens. They end at the dial's own circle, so
    the band and its numbers keep the dark they are drawn on, and above
    the G meter, so the boost, the speed and the G figures do too — by day
    as well as by night. They follow the dial when it is made larger or
    nudged up.
  - **M Sport**: *More* is the same V, clear almost to its edge, **and a
    band across the top over the plate above the speed and the plate above
    the gear**.
  - **M Sport Plus**: *More* is the same band **at full strength to its
    edges** and well into the plates by the gear, **and the plate above
    the speed**.
  - In both M styles the black bars the speed and the gear are written in
    stay shut, and the rule is still that no readout stands where the
    picture shows — checked in both units, for each thing the gear's place
    can show, and with the scale's numbers grown or not.
  - The standard windows are drawn by the same shaders as before, byte for
    byte; the larger ones have their own.
- **Toro's gear numeral: three looks and three places.**
  - *Gear numeral*: **Outline** (as it comes), **Heavy outline**, **Bold,
    filled in colour**. A note on "it used to go bold": every release has
    drawn the gear as an outline — the bold setting there has been is *Rev
    number at the needle*, which is still there and still works. The very
    first versions of this style, before Beta 1, drew the gear with a
    stroke about twice as thick; *Heavy outline* is that, and *Bold* is
    new.
  - *Gear numeral's place*: **Middle of the dial, large** (as it comes),
    **Left corner** (above the boost gauge) or **Right corner** (above the
    speed) — half the height, which is the room there is between the
    mode's name and the boost and speed, and the same distance either side
    of the dial's axis. In a corner it leaves the whole middle to the
    picture. Checked clear of every other readout at every size, nudge,
    unit, gear and speed.
- The preview has a **daylight map** to try any of this on (`show=day`),
  since a white figure on a pale map is what goes wrong first, and its
  stand-in for BMW's strip names the driving mode (`bmwMode=`).
- Checked: 186 tests (11 more), every shader compiled including the seven
  new ones, the simulated car in 21 style, centre and option runs with the
  replay of what it drew, the BeeM-Flash situations, the page on the real
  kit runtime both ways; Toro as it comes is the same picture as before,
  and the M styles measure the same against their references.

Not yet on the car: see `docs/IN-CAR-TEST.md`, *Beta 6*.

**Also, for the public release:** `npm run release` (`tools/make-release.js`)
makes a tree to publish in place of the source — the app's own modules
minified, nothing of `src/`, `test/`, `tools/` or `preview/` — and the
simulated car and the page simulator can run that tree
(`MGU_RELEASE_ROOT=build/release`). The licence now speaks of built and
minified forms too. See `docs/RELEASING.md`.

## Beta 5 — branch `beta-5`, app version 0.8.0

**For cars without BeeM-Flash.** Not everyone has it, and three readings a
style can show came from nowhere else.

- **New setting, GENERAL → BeeM-Flash readings**: *Automatic* (as it
  comes), *On: BeeM-Flash only*, *Off: the engine unit only*.
- **The engine unit, read-only.** Where BeeM-Flash is not supplying them,
  MGU Styles asks the engine unit itself for **oil pressure** (Toro's left
  gauge), **intake air temperature** and **battery voltage** (an M style's
  footer) — and for **boost**, on a car whose Sport Display sends none
  (the README had long said it did; now it does).
  - Through the MGU App Kit's read-only link, which refuses everything but
    a read before it leaves the head unit.
  - Only with the engine running (or stopped at a light by auto
    start-stop), the car on and a style on the cluster: never parked,
    never with the ignition on and the engine off.
  - Only what the style on the cluster is showing, a few times a second at
    most; a reading that gets no answer is asked once a minute.
- **Only identifiers that are already published upstream.** Each one is in
  the open projects this app is built on, and
  [docs/ENGINE-READINGS.md](docs/ENGINE-READINGS.md) names the file it is
  in. Nothing BeeM-Flash has worked out for itself is used, and a test
  fails if the code asks for an identifier that table does not list.
- **BeeM-Flash users lose nothing and risk nothing.** On *Automatic* a
  head unit that has BeeM-Flash (feeding now, its folder there, or fed in
  the last two weeks) never has its engine unit asked by MGU Styles,
  feeding or not — so nothing of ours is on the link while BeeM-Flash uses
  it. *On* says the same outright. And **an install from before this
  setting is put on *On***: updating never starts asking a car anything by
  itself. Only a new install comes as *Automatic*.
- The page's *Readings* row says who is supplying them: *BeeM-Flash: 9
  channels*, *Engine unit: oil pressure, intake air*, *read while the
  engine runs*, *no answer*.
- The simulated car has a diagnostic service and an engine unit that
  answers, and runs six BeeM-Flash situations (none, feeding, installed
  but idle, turned off, required but absent, an updated older install): it
  fails on anything but a
  read, any unit but the engine's, a request outside the engine's running,
  a request with BeeM-Flash on the head unit, or the wrong source's figures
  on the cluster.
- Checked: 175 tests (18 more: the reader against the kit's real diagnostic
  stack, the three settings through the service, auto start-stop, the feed
  turned off and BeeM-Flash detected, the identifiers against their table);
  every shader
  compiled; the simulated car, the fourteen style-and-centre runs and the
  BeeM-Flash situations; the page on the real kit runtime both ways.
- Also: a `LICENSE` (the code may be read, installed and run, and nothing
  else), for when the repository is opened.

Not yet on the car: see `docs/IN-CAR-TEST.md`, *Beta 5*.

## Beta 4 — branch `beta-4`, app version 0.7.0

**The first drive with all three styles, answered.** Beta 3 came back from
the car with three photographs and a list (2026-11-21); this is what was
found and what was done. None of it has been back on the car yet.

- **The snow did not fall, and neither did anything else move by time.**
  Two photographs six minutes apart show every flake in the same place:
  the renderer's own clock, which animated layers ran on, does not advance
  on this car. The limiter's flash, the shift lights' strobe, the gauges'
  alarms and the limiter's shake ran on it too. Now **the time is sent
  from the head unit** (`src/engine/clock.js`), only to layers that are
  animating; the shake moves the layers itself. The snow is redrawn as
  plain soft flakes in three depths (the old ones were rings: "bubbles")
  and falls slowly, 10 to 24 px a second, with a slow sway.
- **Waze never showed.** MGU Styles asked *Maps on cluster* to draw inside
  the panel and waited for it to say so; that app has no such command any
  more, so the window never opened in any style. Now nothing is asked of
  it: its status is read, and the style's window opens over the cluster's
  own map slot **while the phone's map is on the cluster**. (The car's
  *Central display area* must be on *Map view*, as Maps on cluster itself
  needs.)
- **BMW's own map** is a new choice of centre picture: the window stays
  open, and whatever the cluster has in its slot shows — the factory map
  with the phone's map off, the phone's when it takes over.
- **Toro opens for the camera too.** Its background opened only for a map
  it never got; it now opens for the phone's map, BMW's map and Turn
  View's camera alike.
- **M Sport opens as a V.** Only the black field between the plates used
  to open, and too little came through: the two plates in that field now
  thin out with it, so the picture shows from the full width at the top
  down to the foot, the two centre lines still over it.
- **M Sport Plus shows more, with softer ends.** The picture is a band
  right across the centre plate and on through the two plates by the
  gear, fading over 96 units on the left and 240 on the right (it was an
  outline inside the centre plate with a 40-unit fade).
- **BMW's bottom strip: finer steps, and it can be hidden.** *Show all of
  it*, *Trim its top edge* by 6, 12 or 18 px, or *Hide it*. Hiding covers
  everything in the strip **except BMW's own gear letter**, which cannot
  be covered: do so and the cluster draws a black box in the rev dial —
  the box in both photographs, most likely brought by Beta 3's *A little*
  (24 px), which reached five rows into the gear's window. No setting can
  reach that window now; a saved *A little* becomes 18 px, *More* and
  *All of it* become *Hide it*. A box that is already there may stay until
  the cluster has restarted.
- **Nothing told twice in the M styles.** Each of the footer's three
  places takes any reading or nothing: time, range, fuel economy (the trip
  computer's average), outside temperature, intake air temperature, engine
  speed in figures, oil, coolant, boost, battery voltage. The gear's place
  can show the gear, the revs as a figure, or nothing — BMW's gear letter
  being the one that has to stay. Intake air and battery voltage come from
  BeeM-Flash's feed (`iat` or `chargeAirTemp`, `battery`).
- **Each style has its own settings.** The centre picture, the footer's
  places, the gear's place, the footer panel and the growing numbers are
  kept apart for M Sport and for M Sport Plus, and Toro has its own map
  opening: setting up one never changes another.
- **The app's page is the whole screen, with tabs.** CLUSTER (the style,
  its switch, what everything is doing, the five designs, the centre
  picture), GENERAL, TORO, M SPORT, M SPORT PLUS — a style's settings only
  ever on its own tab. Controller and touch. The page had kept the head
  unit's title and bar round it; the kit's whole-screen mode is the one
  BeeM-Flash uses, brought over. Without the Store's renderer the plain
  page still works.
- **The app's tile lights up.** Its plate filled the whole tile, so the
  menu's highlight, drawn behind and round the icon, could not be seen;
  the plate now stands 10 px in from the edge.
- Tools: the simulated car stands in for Maps on cluster as it is now and
  for a Turn View camera that can be switched on, runs every style with
  every centre it offers, and checks the clock, the shake and the window;
  `tools/page-harness.js` drives the app's page off the car (tabs, the
  controller, touch, lists); `tools/page-sim.js` runs the built package's
  page on the kit's real runtime, with and without the renderer, and works
  it with the controller and a finger.
- Checked: 157 tests (38 more than Beta 3: the clock and the shader list it is held to,
  the strip's rule for every value in every style, the read-only Maps on
  cluster, the V and the band, the footer's places and the gear's, each
  style's own settings through the service, the whole-screen layout, the
  page with controller and touch); every shader compiled in WebGL 1; the
  simulated car, fourteen style-and-centre runs, and the page on the real
  kit runtime both ways; the M styles against
  their references, unchanged (mean colour difference 8.5, 137 of 143
  control points within 2 px; the Plus middle 97 %); Toro's eight frames
  against Beta 1: six identical, the limiter and the holiday frame
  different, as meant.

Not yet on the car: see `docs/IN-CAR-TEST.md`, *Beta 4*.

## Beta 3 — branch `beta-3`, app version 0.6.0

**M Sport, and a second M style beside it.** Toro is exactly as it was.

- **M Sport** is the M View of Beta 2 under its new name, with one
  correction: **the figure 7**. Its leg now hangs from the squared right
  end of its bar and leans back to its foot, as the photograph has it; it
  had been drawn from the top corner, which stood it too upright and too
  far left. Both cuts (the dials' and the footer's) are redrawn. Nothing
  else of M Sport changed: frames rendered from `beta-2` and from here
  differ only where a 7 is.
- **M Sport Plus** (new, style `mplus`): a clone of M Sport with only the
  middle different — the centre of the M setup screen
  (`docs/ref/m-plus-reference.jpg`): seven plates on one lean with the
  light-blue and red M stripes across the wide centre one, a lattice of
  fine lines, and the lower rails meeting in the middle.
- **Waze inside the centre plate**, in the area marked on that picture
  (`docs/ref/m-plus-waze-area.jpg`). The plate thins out into the map over
  40 units on a curve with no corner at either end, so the map has no
  edge: it comes up through the blue. It keeps clear of both speeds, and
  the stripes stand back when a turn card is shown over them.
- **The numbers grow as the needle passes** — a fifth bigger with the
  marker level, settling as it goes by. On in M Sport Plus, off in M Sport;
  new setting *M / Numbers at the needle* for either.
- The iDrive page steps through five designs; the style setting lists
  three. Saved settings keep working (`track` is M Sport).
- Tools: `tools/m-plus-compare.py` lays the picture's middle over ours
  (plate or not agrees on 97 % of its unshadowed half).
- Checked: 119 tests (9 new: the clone differs only in its middle, its
  plates and window, the fade's curve, nothing of the map past the plate
  or under a reading, growing numerals against the rim and the
  tyre-pressure telltale, the 7's shape, and that every uniform is sent
  in the shape its shader declares), every shader compiled in WebGL 1,
  all three styles through the simulated head unit, Toro pixel-identical
  to Beta 1.

- **Pictures of everything** (added after the release; the app itself is
  unchanged): `docs/screenshots/` and [docs/GALLERY.md](docs/GALLERY.md)
  show all five designs, Waze and the turn card in each style, Toro's
  colours and shift lights, the holiday theme, the start-up message, the
  M footer panel and the app's page on iDrive for each design.
  `npm run screenshots` makes all of them afresh, identically every time;
  `tools/page-shot.js` draws the app's page off the car. The README's Toro
  pictures dated from before the wedge gauges and blade shift lights and
  are replaced, with the text beside them. The Store listing now names all
  three styles.

On the car, 2026-11-21: what came back is Beta 4's list.

## Beta 2 — branch `beta-2`, app version 0.5.0

**The M style, rebuilt to look like the real thing.** Toro is exactly as
it was in Beta 1.

- **M** is now BMW M's iDrive 8 *M View*, traced from the owner's
  reference photograph (`docs/ref/m-view-reference.jpg`) to its guide
  (`docs/ref/M-VIEW-SPEC.md`): the two angular dials with a level marker
  and a filling band, the eight dark-blue plates, the cyan and red centre
  lines, both speeds, fuel and oil as leaning strips, and the footer with
  clock, range, the 4WD panel and outside temperature.
- **Measured, not eyeballed.** Every line is a fit to the photograph, kept
  in the photograph's own coordinates. `npm run m-compare` renders the
  photograph's state 1:1 and compares: mean colour difference 29.8 → 8.5;
  the photograph's edges with one of ours within 2 px 26 % → 98.7 %; 137 of
  143 control points within 2 px (mean 0.72 px). Details and what is still
  off: `docs/ref/MEASUREMENTS.md`.
- **Its own figures and symbols**, drawn from the photograph's strokes
  (`tools/mglyphs.py`): two cuts of the squared numerals, the fuel pump,
  oil can and M mark. Words in Inter Tight; `WD` in Barlow Semi Condensed.
- **Both speeds at once** (mph over km/h or the reverse), oil marked in
  °F or °C at true heights, am / pm with the 12-hour clock.
- **The clock is the car's own**, read from the instrument cluster rather
  than the head unit (which runs on UTC). Until the cluster has sent it,
  no clock is shown.
- **New setting, *M: footer panel shows***: 4WD, 2WD, the driving mode, or
  nothing. (*M: colours* night / day is gone: the M View has one look.)
- **Waze and Turn View** show in the black field between the plates,
  feathered in from the plates' edges, the centre lines still over them.
- **Never an imitation warning lamp.** The lamps in the photograph are the
  car's; ours exist only in the comparison fixture.
- **Toro: untouched.** Its sources are unchanged, its 133 glyphs are the
  same pixels in the atlas, and eight fixed frames render identically to
  Beta 1 (`tools/toro-regress.sh`, `tools/img-same.py`).
- Tools: `tools/m-compare.py` (overlay, edge map, colour map, blink GIF,
  400 % crops, control points), `tools/m-points.js`, `tools/m-zoom.py`,
  `tools/m-near.py`.
- Removed: `docs/M-IDRIVE8-BRIEF.md` (the earlier brief; it is still on
  `beta-1`).

Not yet on a car: see `docs/IN-CAR-TEST.md`, *M style*.

## Beta 1 — branch `beta-1`, app version 0.4.0

The Toro (Lamborghini) style as approved, with everything around it.

- **Toro**: the Huracán dial with 60 Hz gliding needles; hanging-wedge side
  gauges (oil temperature and pressure left, fuel and coolant right); boost
  level with the speed; the G meter with its point and peak hold; three
  backgrounds (genuine, modern hex lattice, Revuelto); accents incl. magenta
  and *match the interior light*; outline or filled rev number at the needle.
- **Shift lights**: Lamborghini blades with bursts and a screen shake at the
  limiter, GT3 LEDs, single blade.
- **Extras**: holiday theme, start-up message (own words from a USB text
  file), start at every startup, refresh rate and needle smoothing.
- **Waze** on the cluster in either style; Turn View's camera in M.
- **BeeM-Flash** feed: oil pressure, G and the interior light's colour.
- **iDrive page**: full screen with `mgu-render`, design arrows, one
  Cluster on / off button.
- **M**: the first iDrive 8 M-style attempt (replaced in Beta 2).
