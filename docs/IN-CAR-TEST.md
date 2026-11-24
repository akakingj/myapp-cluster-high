# In-car test checklist

Every version is run end to end against a simulated car (`npm run car-sim`)
before it goes out. This list is what the simulation **cannot** prove. Do
the parked steps first; do the driving steps on a quiet road or with a
passenger watching the cluster.

**What has not come back from a car yet comes first**, below: **M Track
Mode** and the BETA that **lowers and enlarges the cluster** (both Beta 7,
new and never on a car), the M styles' **widest picture** and the
**start-up message** (also Beta 7), then Beta 6's checks for the
three things Beta 4's drive asked for (Beta 6 runs on its owner's car -
"all themes work" - but these have not been answered one by one), the
diesel setting and M Sport's lines (0.9.6), electric range, then Beta 5's
readings without BeeM-Flash. Beta 4's table follows (it has been
driven: "overall very good", B4 – B6 confirmed); the older tables after it
still stand, except where a newer check says otherwise.

## Before you start

- Head unit rooted, MGU Store installed, `cluster-render` working (another
  cluster app has drawn on this car, or the Store reports it running).
- Install **MGU Styles** from the Store (see the README). It is **off**
  after install: nothing changes until you press the switch on the page's
  **CLUSTER** tab.
- To get out at any point: open MGU Styles and press that switch again
  (*ON THE CLUSTER – press to give BMW's back*). If iDrive is unreachable,
  a key-off hands the cluster back; a head-unit restart always does.
- For anything in the middle (a map, the camera): the car's **Instrument
  cluster > Central display area** on **Map view**.

## Cars, the gear, more readings, the strips and gauges (AK 0.15.0)

| # | Do | Look for |
|---|---|---|
| C1 | GENERAL → *Car*: B48, then B58, then S58 (M car) | The tach ends at 7 / 8 / 8 (thousand), red from 6,000 / 6,500 / 7,000; revved past 6,500 / 7,000 / 7,500 the speed and the gear blink and Toro's shift lights flash. S58: the M dials amber from 6,500 and the speedometer to 330 km/h. Redline, Limiter, Shift lights from, Shift now at and Tach scale are not on GENERAL |
| C2 | *Car → Car profile values* | Those rows come back, with the speedometer's top, the boost gauge's top and the fuel tank |
| C3 | Toro, in D, then S, then M (manual) | D1 … / S1 … / M1 … beside the gear's figure, the pair a little smaller; *TORO → Gear → The figure alone, as a Lamborghini* shows 1 … as before |
| C4 | M Track: rows and footer places set to *Gearbox oil temperature*, *Torque*, *Odometer*, *Trip* | TRANS (row), TQ, ODO, TRIP with sensible figures; the gearbox oil climbs slower than the engine oil after a cold start |
| C5 | M TRACK → *Strip right of the rev counter, left* / *… right*: e.g. gearbox oil and coolant, then *Nothing* | Each strip, its three figures, unit and symbol follow; *Nothing* leaves the place empty. As they come: the oil and the fuel, the fuel strip lit from the bottom up to the level, its lowest piece orange only when nearly empty |
| C6 | TORO → *Left upper gauge* … *Right lower gauge*: e.g. gearbox oil, intake air, battery voltage, oil pressure | Each gauge relabels (TEMP. CAMBIO, TEMP. ARIA, BATTERIA V, PRESS. OLIO) with its own scale and red end; *Nothing* leaves it empty; *As the style has it* puts the original back. No ESC block right of the gear |
| C7 | M Track rows or strips / Toro gauges set to *Accelerator pedal*, *Throttle*, *Ignition timing*, engine running | PEDAL and THR follow your foot (0 – 100 %), IGN moves with load (a few degrees to about 40). The CLUSTER tab's *Readings* row names them. **If any stays at dashes, say which** |

## Shift now, the cold engine and the Car profile (AK 0.14.0)

With GENERAL → *Car → Car profile values* (the other cars bring their own figures: C1).

| # | Do | Look for |
|---|---|---|
| S1 | Car profile: set *Red light at*, *Engine's top rpm*, *Yellow light at*, *Shift now warning at*, *Gauge goes up to* | Within a few seconds GENERAL shows each as *Redline*, *Limiter*, *Shift lights from*, *Shift now at*, *Tach scale* with "Car profile" beside it, and they can't be changed here. *Red light at → Auto* shows *At the limiter* |
| S2 | *Shift now at* set (or Auto), rev past it, parked | The speed and the gear blink red, four times a second, in every style; in Toro the shift lights are full at the shift point and flash from there. Under it, nothing blinks |
| S3 | *Shift now at → Off* | Nothing blinks at the shift point; Toro's shift lights flash at the limiter, as before |
| S4 | Car profile *Cold-engine rev guard → On* (or GENERAL → *Cold engine* on), a cold start | The red field of the rev counter starts low (about the cold rev limit plus 300) and climbs to the redline as the oil reaches *Oil is warm at*; the shift point (S2) goes with it |

## M Track Mode (Beta 7, 0.10.0)

A fourth style: BMW M's track view, rebuilt from one photograph
(`docs/ref/m-track-reference.jpg`). Choose it on the page's CLUSTER tab
(◀ ▶ to *M Track Mode*) or under *GENERAL → Style*. It has not been on a
car: a photograph of the cluster with it on is worth more than any line
below.

| # | Do | Look for |
|---|---|---|
| T1 | Parked, engine running, in P | The style as in the photograph: the pointed blue wing on the left with the light blue and red **M bands** and four gauge rows, the **gear** large on a black band with the **speed** under it, the leaning red **rev counter** on the right with oil and fuel as ladders beside it, the footer. Nothing of BMW's own gauges shows anywhere above its strip |
| T2 | The edges of the screen | The wing's point stands clear of the tyre-pressure light's place on the left; the title *1/min x 1000* and the 8 are whole at the top right (the glass is cut at that corner); the outside temperature is whole at the bottom right. **If anything is cut off or under one of the car's own lamps, say what** |
| T3 | Rev gently | The white marker climbs the leaning scale and the band under it fills red, down to its foot. The fine pale strip beside the rail near the top is the red field: it runs from the top of the scale down to your redline (6,750 on the X3 M40i). Level with each numeral there is a tick; the marker is level with 3 at 3,000 |
| T4 | The four gauge rows, engine warm | Top to bottom: turbo boost (psi or bar), coolant, oil temperature, intake air. On each a **small block joining the rail and the fine line under it** stands at the reading — at the left end for boost at idle, moving right as you accelerate. **Say whether you can read them at a glance.** If not: M TRACK → *Gauge rows: the reading shows as → A bar*, which dims the rail past the mark |
| T5 | Compare each row with what you know | Coolant near the middle of its row when warm (about 100 °C / 210 °F is the middle figure); oil temperature the same figure as the ladder right of the rev counter shows; intake air a little above the outside temperature when moving. Boost and intake air need the car to supply them: **a row with no mark at all has no reading — say which** (intake air comes from BeeM-Flash or the engine unit, as in the M styles' footer) |
| T6 | M TRACK → *Gauge row 1 … 4*: give a row *Oil pressure*, *Battery voltage*, *Nothing* | The row's figures, unit, symbol and mark change to the reading chosen; *Nothing* leaves the row out and the others stay where they are |
| T7 | M TRACK → *Left wing shows* → **Phone map (Waze)**, phone navigating | **As you choose it, the whole style moves about a tenth of the screen to the right** (193 px; the same size, at the same height) - that is meant: it puts the wing's point on the left edge of the car's picture. Then, within a second or two of the map being there, the four rows fade out and **the map fills the left wing, right to its point**, and shows nowhere else: soft at every edge and along the wing's two leaning sides, the M bands and the fine lines still over it, everything right of the black seam - gear, speed, rev counter - as before. Stop navigating: the gauges come back (the style stays where it is until you choose *The four gauges* again). **Say how much of your map you can use like this** |
| T7a | With the map in the wing: the right edge of the screen | The **fuel ladder** right of the rev counter ends just inside the screen (7 px), all of it showing; the outside temperature at the bottom right is whole. **If the screen's edge or its cut corner takes anything, say what** - and use T7b meanwhile |
| T7b | M TRACK → *Left wing: how much of it a picture takes* → **The style stays where it is** | The style goes back to where it stands with the gauges and does not move for a picture; the map then starts part way along the wing, on a soft upright edge, with the wing's point plain blue |
| T8 | *Left wing shows* → **BMW's own map**, then **Turn View camera** | The same wing over BMW's map (open all the time), and over the camera (Turn View switches on by itself, and off again when you leave the setting) |
| T9 | Drive | The gear is the frame's large letter (P, R, N) or the engaged gear's number; the speed one figure in your units, flush right before *mph* / *km/h*. BMW's head-up display agrees |
| T10 | Fuel and oil ladders | Fuel lit from the foot to the tank's level (half a tank: two pieces, the last one a shade dimmer). Oil rises from the foot as it warms: its fine line is blue at the foot (cold) and red at the top |
| T11 | Rev to the limiter, parked | The lit band flashes, and the screen's edges with it (*GENERAL → Limiter flash*) |
| T12 | M TRACK → *Footer, left / middle / right*; GENERAL → *BMW's bottom strip* | As in the M styles: each place takes any reading or nothing; the strip can be trimmed or hidden, BMW's gear letter always left |
| T13 | An **M car** (if yours is one) | The car may draw two boxes of its own over a cluster app. The lower part of the large gear is under the left one on the car this was measured from; the rev counter's numerals should all be clear of the right one. **Say what the car puts where** |
| T14 | A diesel: *GENERAL → Engine → Diesel* | The rev counter reads **0 to 6**, seven numerals spread evenly over the same height, red from 4,500 |

## Lowered and larger (BETA, 0.10.0)

Off as it comes: *GENERAL → BETA: lower and enlarge the cluster*. It draws
the whole style further down, into the rows BMW's strip leaves when it is
hidden, and larger by as much. **Start parked, and start small.** The one
thing to watch for above all is BMW's **black box in the rev dial**: it
means something of ours stood over the gear's window. The option is built
never to do that (it keeps to the columns *Hide it* already drives on),
but no car has run it yet.

| # | Do | Expect |
|---|---|---|
| W1 | Any style on the cluster. *BETA: lower and enlarge the cluster* → **20 px lower** | Within half a second the style is a little larger and reaches further down. BMW's strip is gone but for its **gear letter**, which stands where it always does. **No black box** in the rev dial |
| W2 | The top of the style | Where it was: only the foot has moved. Nothing is stretched - circles are still circles |
| W3 | **40**, then **58**, then **74 px lower** | Larger each time (6, 9, 11 %). M Sport, M Sport Plus and M Track Mode go to the screen's edge at 74; **Toro stops at 58** and looks the same at 74 |
| W4 | Shift through P R N D S and M1 … at the largest setting | BMW's gear letter changes in its place and is never covered or cut. Still no black box |
| W5 | Toro at 58: the speed, bottom right | It stands just left of BMW's gear letter, and its unit (MPH or KM/H) does not touch the letter |
| W6 | Toro at 58, at the rev limiter with *Shake the screen* on **Hard** | The whole instrument shakes; BMW's gear letter does not, and nothing jumps over it. The red flash takes in the whole instrument, with a black gap where the gear letter is |
| W7 | An M style at 74: the footer (time, range, outside temperature) | All of it on the screen, on its last rows. Say if the screen's own edge cuts any figure |
| W8 | An M style, lowered: the speed scale's numerals on the left | They now reach the place the **tyre pressure lamp** lights. If that lamp is on, it is drawn over them - that is expected; say if it is a nuisance |
| W9 | A map or the camera in the middle, lowered | The picture is where it always is and the same size; the style's window round it is a little larger. Nothing of BMW's own cluster shows at the window's edges - look closely at M Sport Plus with *Centre picture: how much shows → More* and *Fullest* |
| W10 | M Track Mode at 74 with a map in the wing | The picture begins where it begins, on a soft edge, not a hard line |
| W11 | The start-up message (*GENERAL → Start-up message*), lowered | The whole style is dimmed behind it, the footer too |
| W12 | Set it back to **Off** | Exactly the style as it was, and *BMW's bottom strip* as you had it set |
| W13 | Lock the car, let it sleep, start again with it lowered | It comes up lowered, with no black box |

If the black box ever appears: set the option to **Off**, note which style
and amount, and report it. It can stay until the cluster has restarted
(lock the car and let it sleep).

## The widest picture, M Sport and M Sport Plus (0.10.0)

Off as it comes: *M SPORT* or *M SPORT PLUS → Centre picture: how much
shows → Widest*, with a picture chosen under *Centre picture* (the phone's
map, BMW's own, or the camera). It has not been on a car.

| # | Do | Expect |
|---|---|---|
| V1 | *Widest*, BMW's own map in the middle | **The map fills the whole middle between the two dials**: from its own top edge down to the two coloured rails, and almost from dial to dial. Its four edges fade out softly into black - no hard line anywhere, no corner |
| V2 | The blue plates | **Gone while the map shows** (that is meant), and M Sport's two fine lines with them. The dials, the fuel and oil strips, the rails and the footer are as ever |
| V3 | The speed, the gear, the fuel and oil strips, **by day** (a bright map) | Each stands on a soft patch of dark glass, **as easy to read as with no map**. Nothing white is on the bright map. Say if any figure is hard to read, or if a patch looks too large or too hard-edged |
| V4 | *Second speed underneath → One speed only*; *The gear's place shows → Nothing* | The patch under the speed is shorter; the one at the gear's place is gone and the map shows there |
| V5 | The phone's map: start navigating, then stop | The plates fade out as the map comes up, over about half a second, and come back as it goes. **No flash, no frame of plain black, no plate left half drawn** |
| V6 | *Centre picture → Next turn, as a card*, or *Closed* | The style whole, exactly as with any other size |
| V7 | Under the rails | The map ends there; the footer - time, range, the 4WD panel, outside temperature - is on black, untouched |
| V8 | Lowered (BETA) with *Widest* | The map is where it always is and the same size, soft at its edges, with the larger style round it. Nothing of BMW's own cluster shows at its edges |
| V9 | M Sport: *Centre picture: the two lines across it → Keep them over the picture* | The two lines stay, over the map; everything else as V1 |

## The start-up message (0.10.0)

*GENERAL → Start-up message* (on as it comes). One slip in it was put
right in 0.10.0; nothing else about it was changed.

| # | Do | Expect |
|---|---|---|
| U1 | Start the car with the app set to come up, and watch the first two seconds | **The screen is dark and the words fade in on the dark.** The cluster is **not** seen behind them as they appear (until 0.10.0 it showed through for about a second, then was covered again) |
| U2 | Keep watching | The words stand with the fine coloured line under them for the time set (10 s as it comes), then fade; **the cluster comes up through the last of them** and is clear about a second after they have gone |
| U3 | *Start-up message: how long* → 6 s, and 20 s | The same, sooner or later |

## As smooth as it was (0.10.0)

Nothing a style asks of the head unit has grown since the first public
release, and one thing has shrunk: the limiter's red flash, which used to
be drawn across the whole screen on every frame with nothing in it, is now
drawn only while the limiter is near (`docs/PERFORMANCE.md`). That was
measured on a computer. The car is what counts:

| # | Do | Expect |
|---|---|---|
| S1 | Each style in turn, a normal drive | As smooth as you remember it: the rev counter and the speed move without steps, nothing stutters when the map or the camera opens |
| S2 | Run to the limiter (any style, *Limiter flash* on) | The flash is there **at once** as the limiter nears, flashing as it always did - not a frame late, not missing its first beat |
| S3 | Lift off | The flash is gone at once. **Nothing is left behind**: no faint red at the screen's edges while driving normally afterwards |
| S4 | M Track Mode: the figures over its gauge rows, the rev counter's numerals, the 150 / 100 / 50 beside the oil strip | All there, whole and sharp, none cut off at an edge (each now has a box just its own size) |

If any style feels less smooth than it did, say which, with its settings
(above all: lowered or not, the centre picture, the holiday theme) and
what else the head unit was doing - navigation, CarPlay, a camera.

## Beta 6 — what Beta 4's drive asked for

Nothing changes until you choose it: after updating, every style looks as
it did — except that *Hide it*, if you had it chosen, now covers closer to
the gear (F1).

| # | Check | Expect |
|---|---|---|
| F1 | GENERAL → BMW's bottom strip → *Hide it*, in **COMFORT** | The T of COMFORT is gone: **only BMW's gear letter is left**, on black. **No black box in the rev dial.** Look through the other modes too (SPORT, SPORT PLUS, ECO PRO, ADAPTIVE) and through the gears (P, R, N, D1 …, S, M): the gear letter and its number must be whole, nothing of the mode's name beside them |
| F2 | If F1 brings a **black box in the rev dial** | Choose *Hide it, a wider gap left beside the gear* (the gap Beta 4 had, which you have driven), lock the car and let it sleep once, and **say so** — it would mean this car wants more room round the gear than the measured window. If instead a sliver of a long mode name still shows right against the gear, say which mode: the cover already stops one column short of the window, and cannot go further |
| F3 | TORO → Map opening on (phone map, BMW's map or the camera) → *Map opening: how much shows* → **More**, then **Most** | A dome of the picture fills the inside of the dial, to the band's inner edge; *Most* is larger and sharper-edged than *More*. The band's numbers, the gear, CORSA, the G meter, boost and speed all stay readable — **look at it with a map in daylight colours**. *Standard* is the lens as before. **Say which you keep, and if any figure is hard to read** |
| F4 | The same with *Fill the screen* larger / smaller and *Nudge up* | The dome moves and scales with the dial; nothing white ends up on the picture |
| F5 | M SPORT → Centre picture on → *Centre picture: how much shows* → **More** | The V is clear almost to its edge, and the picture also shows in a band across the top: over the plate above the speed and the plate above the gear. The speed, the gear and the fuel and oil figures have no picture behind them |
| F6 | M SPORT PLUS → the same → **More** | The picture is at full strength across the centre plate and well into the two plates by the gear, and shows in the plate above the speed. Both speeds, the gear and the oil figures have no picture behind them |
| F6b | M SPORT PLUS → the same → **Fullest** (0.9.5) | One picture across the middle: no shut strip between the plate above the speed and the centre, no black bars across it; it fades in softly from the top and a long way out at the foot, below the plates. The speeds and the gear stand on dark, soft-edged ground. **By day and by night: say whether any figure is hard to read, and whether the dark ground round the speed and the gear is too large or too small** |
| F7 | TORO → *Gear numeral* → **Heavy outline**, then **Bold, filled in colour** | The gear with a stroke about twice as thick; then solid. At the limiter both go white, as the outline does. (*Rev number at the needle → Bold* is the other bold setting, for the dial's numbers: unchanged) |
| F8 | TORO → *Gear numeral's place* → **Left corner**, then **Right corner** | The gear at half its height: on the left above the boost gauge, under the mode's name; on the right above the speed. Nothing overlaps it in any gear, at any speed or boost. The middle of the dial is empty — or, with a map opening, all picture |
| F9 | F8 with *Map opening: Most* | The combination these were asked for: the whole inside of the dial is the map's, the gear in its corner |

A photograph of the whole cluster for F1, F3 (*Most*), F5, F6 and F9 is the
most useful thing to send back.

## A diesel (0.9.6) — for a diesel car

Never run on a diesel: every line here is a question. Petrol as it comes;
*GENERAL → Engine → Diesel*.

| # | Check | Expect |
|---|---|---|
| D1 | *Engine* on **Petrol** (as it comes), a diesel idling | The rev counter shows the idle (about 750) low on a dial to 8,000. **If the needle or marker does not move at all when the engine is revved, stop here and say so**, with whether the speed and the gear show: that is not what the Diesel setting is for |
| D2 | *Engine* → **Diesel**, Toro | The dial is marked **1 to 6**. Idle sits a little before the 1; 3,000 rpm is half-way round |
| D3 | The same, M Sport and M Sport Plus | The rev dial has seven numerals, **0 to 6**, spread over its whole height, each level with its tick; the two beside the marker are lit. The title still reads *1/min x 1000* |
| D4 | Accelerate hard through a gear (or rev in P/N if the car allows it past 4,000) | Toro: the shift lights begin to come on a little above **3,200** and are full by 5,000; the dial is red from **4,500**. M styles: the pale field then the red one begin at 4,500. **Say where your engine actually changes up or stops revving**: if that is not near 5,000, set *Redline* and *Limiter* to suit and say what you chose |
| D5 | The limiter flash (dial and screen edges) | Only at the limit set: with 5,000 and a gearbox that changes up at 4,800 you may never see it. That is right; say if it flashes in ordinary driving |
| D6 | A diesel **without BeeM-Flash**, Toro | The lower left gauge reads **PRESS. TURBO**, not oil pressure. An M style's footer on *Intake air* or *Battery* shows figures if the engine unit answers the standard readings, `--` if it does not: **say which** |
| D7 | *Engine* back on **Petrol** | Everything as before the change |

A photograph of the whole cluster at D2, D3 and D4 is the most useful
thing to send back.

## M Sport's centre lines (0.9.6)

| # | Check | Expect |
|---|---|---|
| L1 | M SPORT → Centre picture on the phone's map (or BMW's map, or the camera), the picture showing | **Neither the pale blue line nor the red one crosses the picture.** Under the window their last short stretch still runs into the blue and the red rail. As the window opens and shuts they fade with it |
| L2 | The same with *Centre picture: how much shows → More* | The same: no line across the picture |
| L3 | *Centre picture: the two lines across it* → **Keep them over the picture** | Both lines across the picture, as before 0.9.6 |
| L4 | Centre picture → **Closed**, or **Next turn, as a card** | The two lines whole, as they have always been |

## Electric range (0.9.2) — for a plug-in hybrid or an electric car

Never run on such a car: every line here is a question. *GENERAL →
Electric range*: *Automatic* as it comes (on once the car shows it is a
plug-in hybrid), or chosen.

| # | Check | Expect |
|---|---|---|
| V1 | Setting off, or *Automatic* on a petrol or diesel car | Nothing different anywhere |
| V1b | Plug-in hybrid, *Automatic* (as it comes) | Within a few seconds of driving off, the electric range and (in HYBRID / ELECTRIC) Power % appear by themselves, and from the next start at once. **If they don't, say so** |
| V2 | Plug-in hybrid, *Plug-in hybrid*, Toro | The lower left gauge reads **ELETTRICO MI** (or KM): its figure the electric range, its bar the battery's charge. **Compare the figure with BMW's own electric range and say both numbers** |
| V3 | The same, M Sport, a footer place on *Electric range* and another on *Drive battery charge* | `EV 27 mi` and `CHARGE 78`, agreeing with BMW's own |
| V4 | Electric car, *Electric car* | Toro: the fuel gauge's place reads ELETTRICO. M styles: the footer's range is the electric range, the fuel strip the charge |
| V4b | Fully electric, Toro's upper left gauge and the M styles' right strip | **TEMP. BATT.** / a scale of 14 – 140 °F (−10 – 60 °C): the drive battery's temperature. **Say what it reads and whether that is believable** (near outside temperature after a night parked) |
| V6 | Speed Limit Info on, a limit showing, *Cover the speed limit sign's edge* on | The red arc right of the strip's clock is gone; the clock, and everything else in BMW's strip, is whole. **If the arc is elsewhere or still shows, a photograph** |
| V5 | Any of them showing `--` | Say which car and which reading: its cluster is not sent that signal, or sends it differently |
| V7 | Plug-in hybrid, *Plug-in hybrid*, eDrive Live running, HYBRID or ELECTRIC, each style | The rev counter reads **Power %**: 0 about a quarter up, 100 at the top, POWER (Toro: POWER %) as its name. On the pedal it lights from 0 up as far as you press; off the pedal while slowing it lights **green below 0** and the name reads **CHARGE**. **Say whether it moves with the pedal and with BMW's own Power %** |
| V8 | The same, then SPORT (or XTRABOOST, or the lever to S / M) | The rev counter again (figures, 1/min x 1000, red zone, shift lights); back to Power % when you leave it |
| V9 | eDrive Live not running | Power % still follows the pedal; nothing below 0 (the regeneration comes from eDrive Live) |

## Readings from the engine unit (Beta 5; on every head unit since AK 0.13.0)

The engine unit is asked on every head unit, BeeM-Flash or not; there is no setting for it. Nothing here
writes to the car: the app can only read (docs/ENGINE-READINGS.md).

| # | Check | Expect |
|---|---|---|
| E3 | Toro, engine running | Within a second or two the left gauge reads **PRESS. OLIO** with a figure that rises with the revs and agrees with what you would expect warm at idle and on the road. *Readings* says *Engine unit: oil pressure*. **Say what it reads at warm idle and at 3,000 rpm** |
| E4 | The same, ignition on, engine **not** running (before starting it) | PRESS. TURBO, no oil figure; *Readings* says *read while the engine runs*. The car is not asked with the engine off |
| E4b | Auto start-stop stops the engine at a light | The gauge stays PRESS. OLIO and falls to about 0; it rises again as the engine restarts. No flicker to PRESS. TURBO |
| E5 | M Sport, Footer left → *Intake air temperature*, middle → *Battery voltage*, engine running | Both show a figure within a few seconds (intake air a little above outside temperature when moving, the battery about 13.5 – 14.8 V with the engine running). **If either stays at `--`, say which**: this car's engine unit does not answer that identifier |
| E6 | Any style, a few minutes' drive | Nothing else changes: no warning, no message, nothing slower. **If anything at all seems off, say what it was** (a style showing none of these readings asks nothing) |
| E7 | Key off | The readings go with the cluster; nothing is asked of the car once the engine has stopped |

## Beta 4 — what Beta 3's drive asked for

After updating, **lock the car and let it sleep once** before judging B4 –
B6: the black box in the rev dial can outlive what caused it until the
cluster has restarted.

| # | Check | Expect |
|---|---|---|
| B1 | iDrive's menu: move the selector onto MGU Styles | The tile lights up like the others. **If it still does not, say so**: the fix is the icon's plate standing 10 px in from the tile's edge, reasoned from how the menu draws, not seen on the car |
| B2 | Open MGU Styles | The page fills the **whole screen**: no title above it, no bar of BMW's beside it; a bar of tabs along the top — CLUSTER, GENERAL, TORO, M SPORT, M SPORT PLUS. **If BMW's frame is still round it, say so** (and whether the Store shows *mgu-render* installed) |
| B3 | Controller: turn through the tabs and rows, press, back. Touch: tap a tab, a row, drag the GENERAL list | Every place can be reached both ways; a row opens its list of values; back on a settings tab returns to CLUSTER, back on CLUSTER leaves the app. A style's tab shows only that style's settings |
| B4 | GENERAL → BMW's bottom strip → *Show all of it*, then *Trim its top edge* 6, 12 and 18 px | Each trim hides a little more of what shows above the strip's figures; the figures themselves stay whole. **No black box in the rev dial at any of them.** Say which looks right |
| B5 | BMW's bottom strip → *Hide it* | BMW's range, clock, street name, driving mode and outside temperature are gone; **only BMW's gear letter is left**, on black. Warning lamps (seat belt and the rest) still show when lit. **No black box in the rev dial.** If a box appears with this setting, go back to *Show all of it* and say so — it would mean this car's gear window is wider than measured |
| B6 | Look at the top of M Sport's oil strip (`300 °F`) | Nothing over it. (In Beta 3's photographs a black box hid it: that was the cluster's fallback gear box) |
| B7 | M SPORT → Footer, left / middle / right: try *Engine speed*, *Fuel economy*, *Intake air temperature*, *Nothing* | Each place shows what was chosen, with its unit; *Nothing* leaves the place empty. With BMW's strip in view nothing need be told twice. Intake air and battery voltage show `--` unless BeeM-Flash is running and feeding them. **Compare the economy figure with BMW's own trip computer (average consumption) and say if it differs** |
| B8 | M SPORT → Footer panel shows → 4WD (or Nothing); The gear's place shows → *Engine speed* and *Nothing* | The panel no longer repeats the driving mode. In the gear's place the revs stand as a figure on the same black bar, or nothing does; BMW's gear letter below is then the only gear |
| B9 | M SPORT PLUS tab, with M Sport on the cluster | Its settings can be set, and nothing on the cluster changes until *USE THIS STYLE* is pressed. Changing M Sport's footer does not change M Sport Plus's |
| B10 | Holiday theme on, any style | **The snow falls**: slowly, near flakes larger and faster than far ones, drifting a little. Soft round flakes, no rings. The tree's lights twinkle. Nothing falls over a reading |
| B11 | Toro: rev to the limiter, parked | The shift lights **fire in bursts**, the screen's edges **flash**, and the whole cluster **shakes** and settles — none of which moved in Beta 3 (they ran on the same clock as the snow). BMW's strip and gear letter do not move |
| B12 | M Sport: rev to the limiter | The red band flashes (and the edges, if chosen) |
| B13 | With MGU Styles **off**: phone connected, navigating, Maps on cluster installed | The phone's map shows in the middle of BMW's own cluster. This is Maps on cluster's own job: if it does not show here it cannot show in a style (Central display area on Map view; in Maps on cluster, *Show on: Cluster*) |
| B14 | M SPORT PLUS on, Centre picture → *Phone map (Waze)*, phone navigating | The middle opens within a second or two and the map shows in a wide band across the centre plate, melting into the plates at both ends, no edge. The page's CLUSTER tab says *Phone map on the cluster*. Stop navigation or unplug the phone: the band closes, the stripes return |
| B15 | The same in M SPORT | The middle opens as a **V**, wide at the top; the cyan and red lines stay over the map; the speed and the gear have no map behind them |
| B16 | The same in TORO (Map opening → *Phone map (Waze)*) | A long soft opening behind the dial shows the map; dial, gear and gauges stay over it |
| B17 | Centre picture → *BMW's own map*, phone map off | The window is open all the time and BMW's own navigation map shows in it. **Say what shows when the car has no map up** |
| B18 | Centre picture → *Turn View camera*, in each style | Turn View switches on by itself; the camera shows in M Sport's V (more of it than in Beta 3), in M Sport Plus's band (wider, softer at both ends) and **in Toro**, where nothing showed before. Leaving the setting switches Turn View off again |
| B19 | Key off with a picture showing, then start again | BMW's cluster returns; next start the style and its picture come back by themselves. Maps on cluster is as you left it: MGU Styles sends it nothing |

A photograph of the whole cluster for B5, B14 – B16 and B18 is the most
useful thing to send back.

## Parked, engine off

| # | Check | Expect |
|---|---|---|
| 1 | Open MGU Styles on iDrive | The CLUSTER tab: the style, its switch, a sketch of the design. Status: *Off – BMW original cluster* |
| 2 | Press the switch with the ignition off | Status: *Waiting for the car to switch on*. Cluster unchanged |
| 3 | Ignition on (engine off), then start | Toro appears within about a second of drive readiness |
| 4 | Look at the bottom strip (BMW's bottom strip: *Show all of it*) | BMW's strip (location, time, gear, ranges) fully visible. **No black gear box drawn over the style** — if one appears, note it and switch the cluster off on the page |
| 5 | Look at the corners and warning lights | Tyre-pressure and parking-brake telltales visible; nothing clipped by the glass corners |
| 6 | Read the pods | Coolant and fuel plausible against BMW's own readings; oil pressure shows `--` (no source yet) |
| 7 | TORO → Background → Modern, then back | Cluster rebuilds in under a second each time |
| 8 | GENERAL → Limiter → 6,000, rev gently past 5,800 in P/N | Shift lights fill and the screen edges flash just below 6,000. Set it back to *From the car* |

## Driving

| # | Check | Expect |
|---|---|---|
| 9 | Pull away and accelerate | Band lights up from the left with the red needle at the tip; each numeral grows and turns the accent colour as it is reached |
| 10 | Compare speed with BMW's head-up display or GPS | Within 1–2 mph |
| 11 | Gear (D/M, paddles) | Large gear numeral matches the gear engaged; P/R/N shown when selected |
| 12 | Drive mode switch: Comfort → Sport → Sport+ | Label reads STRADA → SPORT → CORSA (or BMW's names if chosen) |
| 13 | Boost under load | Rises to roughly 15–20 psi on a B58 at full load; `--` or 0 at idle |
| 14 | Turn left / brake hard | G meter moves the right way. **If left/right or accel/brake are reversed, note which** — the sign convention is the one thing still unverified |
| 15 | Key off | Toro disappears and BMW's cluster returns, every time |
| 16 | Next start | Toro returns on its own (it starts with the car) |

## M Sport (BMW M View) — rebuilt in Beta 2

GENERAL → Style → M Sport, or step to it with ◀ ▶ on the CLUSTER tab.
For a picture in the middle see *Before you start* and B13 – B18 above
(M9 – M13 here are from Beta 2 and Beta 3, when the map was asked into the
panel; the Beta 4 checks replace them).

A photo of the whole cluster, parked, is the most useful thing to send
back: it can be compared with the reference frame the same way the preview
is.

| # | Check | Expect |
|---|---|---|
| M1 | Parked, engine running, centre *Nothing* | The M View as in `docs/ref/m-view-reference.jpg`: blue speed dial left, red rev dial right, the dark-blue plates, the cyan and red lines through the middle, big `0` and `P`. Nothing of BMW's gauges shows anywhere |
| M2 | Bottom strip and telltales | As items 4–5 above: all of BMW's visible. The tyre-pressure light, when lit, sits left of the speed scale and covers none of its numbers; the parking-brake light is well right of the rev scale |
| M3 | What is *not* there | No parking-brake, seat-belt, lights or LIMIT symbol of ours anywhere: those are the car's and only the car draws them. **If the car's own lamps land on top of something of ours, note which and where** |
| M4 | Rev gently in P | The white marker rises up the red dial, the band under it fills red, and the two numbers either side of the marker turn white. Near your redline a pale strip shows inside the rim |
| M5 | Drive: speed | The marker rises up the blue dial the same way; the big figure is your speed, the smaller one under it the other unit (mph ↔ km/h); both agree with BMW's head-up display |
| M6 | Fuel and oil strips | Fuel lit from the foot to the tank level (half a tank: two segments). Oil temperature rises from the foot as the engine warms; its marks are 120 / 210 / 300 °F (50 / 100 / 150 °C) |
| M7 | Footer | The clock shows **the car's own time**, turning over with the head unit's status-bar clock; range and outside temperature match BMW's. **If the clock is missing, say so**: it needs a signal from the cluster that has not been seen on this car yet (no clock is shown rather than a wrong one) |
| M8 | M SPORT → Footer panel shows | 4WD, 2WD, the driving mode (BMW's name, changing as you switch modes), or no panel |
| M9 | Centre picture → *Phone map (Waze)*, phone navigating | See B15. **Note anything of BMW's showing through inside the window** |
| M10 | Look at the window's edges | An even fade all round, no hard line, no map behind a figure |
| M11 | Centre picture → *Closed* | The window closes quickly. Speed, gear and the dials never flicker |
| M12 | Key off with a picture showing, then start again | See B19 |
| M13 | Centre picture → *Turn View camera* (front camera car) | See B18. **Note anything of BMW's drawn over the camera** |
| M14 | A route in BMW Maps or CarPlay, Centre picture → *Next turn, as a card* | Arrow, distance and instruction (TURN LEFT, EXIT 2…) between the plates as a turn comes up; gone when the route ends |
| M15 | Rev limiter, parked | The red band flashes (and the screen edges, if chosen); nothing else moves |
| M16 | Holiday theme on, in M | Snow falling down both sides outside the dials, the tree right of the rev scale; no number is snowed on |

## M Sport Plus — new in Beta 3

GENERAL → Style → M Sport Plus, or step to it with ◀ ▶. Everything in the
M Sport table above applies (same dials, figures, strips, footer); these
are the extra checks. A photo of the whole cluster with a map showing
would be the most useful thing to send back.

| # | Check | Expect |
|---|---|---|
| P1 | Parked, no map | The same dials as M Sport; in the middle one wide blue plate with a light-blue and a red stripe leaning across it, fine lines over the plates, and the blue and red rails along the bottom meeting in the middle (no cyan / red lines through the centre) |
| P2 | Rev gently in P, then drive | The number the marker is passing is clearly bigger than its neighbours, and shrinks back as the marker moves on; nothing jumps. **If a grown number touches the rim, or the tyre-pressure light when it is lit, say which** |
| P3 | M SPORT PLUS → Scale numbers at the needle → Stay the same size | The numbers only turn white, as in M Sport |
| P4 | Centre picture → *Phone map (Waze)*, phone navigating | See B14: the map in a band across the centre plate and the two plates right of it, melting into them, no line or box where it starts. **Note any hard edge, or any map in the black between the plates** |
| P5 | Look at the left of the map | It stops short of the speed, the second speed and their units: no figure has map behind it. The gear's black bar stays black |
| P6 | Centre picture → *Closed* | The plates, their stripes and their lines come back smoothly |
| P7 | Centre picture → *Next turn, as a card*, with a route | Arrow, distance and instruction at the top of the centre plate; the stripes dim behind them so they read |
| P8 | ◀ ▶ between M Sport and M Sport Plus | Only the middle changes; dials, numbers and footer do not move (unless their own settings differ) |

## New in 0.3

| # | Check | Expect |
|---|---|---|
| N1 | Open MGU Styles on iDrive | See B2 |
| N2 | Tap ◀ / ▶ beside the sketch, or turn the controller to them and press | Steps Toro genuine → modern → Revuelto → M Sport → M Sport Plus; the cluster follows within a second |
| N3 | Toro, side gauges | Two slanted bar gauges each side: TEMP. OLIO / PRESS. OLIO (or PRESS. TURBO) left, BENZINA / TEMP. ACQUA right; the red needle sits at the reading shown beside the label |
| N4 | Rev to the limiter, parked | See B11: Lamborghini shift lights close in from both ends, then fire in bursts with the screen flash; the whole cluster shakes in step and settles when the revs drop. BMW's bottom strip and telltales do not move |
| N5 | TORO → Shift lights GT3 / single blade, Shake off | Each looks as named; with shake off nothing moves |
| N6 | Holiday theme on | See B10 |
| N7 | Start-up message on, then key off and start again | The words show over black for the chosen time, then fade slowly into the cluster. Changing a setting while driving does not bring them back |
| N8 | Start at every startup off, key off, start again | BMW's own cluster; the switch on the CLUSTER tab brings MGU Styles up for this drive |

## New in 0.4

| # | Check | Expect |
|---|---|---|
| F1 | Drive with Refresh rate 60 and needles *Glide smoothly* | The dial, speed and gauges move continuously, no steps; a downshift's blip still shows at once. Try 30 and *Jump* to compare |
| F2 | Side gauges | Left pair reads left to right, right pair right to left; each wedge hangs from its scale, deepest at the high numbers |
| F3 | Boost under load | Level with the speed, left of the gear: the figure grows a step with each psi; the faint wedge to its right sweeps right to left |
| F6 | Toro, phone navigating, Map opening → *Phone map (Waze)* | See B16. The CLUSTER tab's *Phone map* row says what it is doing |
| F7 | Holiday theme on with a map showing | Snow falls down both sides but keeps off the gauges; nothing of it over the map |
| F5 | TORO → Rev number at the needle: Bold, filled | The number the needle is passing turns solid in the accent colour; Outline goes back to the hollow look |
| F4 | G meter in a right-hand bend, then braking | The point moves right in the bend and down under braking; the hardest load stays as a red line for about 3 s, then fades |

## Report back

For anything wrong, a phone photo of the cluster plus the item number is
enough. The app's log is in its data folder on the head unit
(`akakingj_cluster_id8.log`) and records every state change, which makes a
mismatch quick to trace.
