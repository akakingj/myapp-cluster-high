# Releases

`main` is the current release; the Store installs whatever `main` holds.
Each earlier release is kept on a branch of its own name. To go back to
one: `git checkout <branch>`, or point the Store's source at that branch.

**The stable beta is Beta 6 (0.9.6), on the branch `beta-6`.** It is the
release before this one, and the last that has been on cars; Beta 7 adds
a good deal that has not been yet. If anything in 0.10.0 misbehaves on
your car, `beta-6` is the one to go back to: in the MGU Store, add the
repository as a source and choose the branch **beta-6** where it asks
what to follow, in place of **main**.

Branches: `main` is what the Store installs; `test` is worked on, checked on the car, then moved to `main`.

## AK 0.20.0

- **A style for each drive mode, as AK Cluster Layouts' layout for each.** Settings → Display: **Style in Sport** and
  **Style in ECO PRO**, a design each (or *Same as Style*, as it comes). Every Sport mode takes Style in Sport (Sport+,
  Sport Individual, Track, a plug-in hybrid's Sport and XtraBoost), ECO PRO (+, Individual) and a plug-in hybrid's
  Electric take Style in ECO PRO, the rest Style; the cluster changes once the mode has held 1.5 s. In such a mode the
  page shows its design, names the setting, and a card picks it there.
- **Every drive mode by its own name.** Sport+, Sport Individual, Comfort+, Comfort Individual, ECO PRO+ and ECO PRO
  Individual were read as Sport, Comfort or ECO PRO; BMW's names now show each (*SPORT+*, *SPORT INDIVIDUAL*, *ECO PRO
  INDIVIDUAL* ...). The mode is read from the HMI's switch field, the one BMW's cluster names, first; the Sport
  Display's only while that has said nothing for a minute (as Cluster Layouts reads it): the two could disagree and the
  last one won.
- **Toro's mode names are Lamborghini's, and a plug-in hybrid's the same as a petrol car's of their kind.**
  *CITTA* (ECO PRO, Electric, Hybrid ECO PRO), *STRADA* (Comfort, Adaptive, Hybrid), *SPORT*, *CORSA* (Sport+,
  XtraBoost), *RECHARGE* (Battery Control); an Individual mode its kind's with Lamborghini's EGO (the driver's own
  set-up) after it: *STRADA EGO* (Comfort Individual), *CITTA EGO* (ECO PRO and Electric Individual), *SPORT EGO*
  (Sport Individual), set smaller to RECHARGE's width where longer, clear of the dial's inner edge. ECO PRO was
  STRADA.
- **On / off under the design's picture again**, as AK Cluster Layouts' under its cards: the status's dot and what a
  press does, the same as the bar's button, which is now *Show on the cluster*, as Layouts' (it was *Cluster on / off*).
- **Fuel economy unit: km/L, L/100km, mpg (US) or mpg (UK)**, as AK Cluster Layouts': every fuel use unit of the Car
  profile is taken (its mpg (UK) was not). *With the speed unit* (Auto) is gone: a saved one, or none saved, becomes the
  unit it gave - mpg (US) with mph, km/L with km/h - once.
- **AK Cluster Layouts and this app take turns, both ways.** The one that came up first keeps the cluster, the other
  waits (before, this one always stepped aside and Layouts never did); each page says *Waiting: AK Cluster Layouts / ID8
  is on the cluster*. Each also keeps a file of its own with when it came up (presence.js); an older Layouts, with
  none, is waited for as before.
- **The Car profile's G meter size, too-hot figures and electric range when full, as Layouts follows them.**
  Readouts and gauges: *Toro: G meter size* (1.0 - 2.0 g; 1.5 as it comes, as Layouts', G-Force's and M Vitals' - it was 1.2), *Oil / Coolant / Gearbox is too hot at* (130,
  118, 115 C as Layouts': Toro's gauges and its oil and coolant figures, M Track Mode's rows and M Sport's oil strip
  red from them - they were 150 / 115 / 120, 134 / 122 / 120 and 138 C - and the oil blue up to *Oil is warm at*, 80 C,
  where M Track and M Sport had 66 and 61). Car: *Electric range when full* (50 km as Layouts', in miles with mph:
  31 mi): a plug-in hybrid's battery gauge against it (it was 80 km) and its range estimated from the charge while the car gives none,
  shown with "~" before it (~39) as Layouts shows an estimate: the atlas has the mark now, one cell under M Track
  Mode's faces, named in every upright face that sets figures (tools/bake-atlas.py MARKS; `--marks` adds it to the
  atlas as it stands, without the fonts, the same bytes as the whole bake).
- **Toro's G meter's dot moves as the driver feels the load**, as Layouts' G meter and the G-Force app: right in a left
  bend, up braking, down accelerating (it went with the car's acceleration, the other way).
- **The start-up message in your own words, typed.** Settings → **Start-up words** opens the head unit's own keyboard
  (BMW's speller, in the car's language: Hangul on a Korean car); OK makes them the message (*Your own words*, which
  was a text file on a USB stick - still read while nothing is typed). Letters the message's face has not, Korean among
  them, come from the head unit's own Korean font (Noto Sans CJK KR, a Korean package's): only the message's own
  letters, as distance fields under the cluster's glyph atlas (a few rows more), and only while the message needs them.

## AK 0.19.1

- **Settings as AK Cluster Layouts'.** On / off and the style at the top, then Layouts' sections in its order -
  **Display**, **Readouts and gauges**, **Red zone and shift**, **Units and clock**, **Car** - then the style in use's
  own. What both apps have is in the same section under the same name: *Yellow light at*, *Red light at (the red
  zone)*, *Gauge goes up to*, *Engine's top rpm (redline)* (were Shift lights from, Redline, Tach scale, Limiter),
  *Clock*, *Speedometer up to*; the skin is in *Display*, as Layouts'.
- **Car → Engine has the Car profile's five choices, as Layouts':** *Auto (from the car)*, *Diesel*, *Petrol*,
  *Petrol, M car* and *Plug-in hybrid (petrol)*. A Car profile on *Auto* or *Plug-in hybrid* is now followed (before,
  Auto was not one of this app's and the app's own choice stayed). *Auto*: a petrol car, a plug-in hybrid once the car
  shows it is one. *Electric range* is gone with it (a plug-in hybrid is Engine's; *Fully electric* went, never run
  on a car): a saved *Plug-in hybrid* on a petrol car moves to Engine *Plug-in hybrid* once.
- **BMW's bottom strip is On or Off, as AK Cluster Layouts'.** *On* (as it comes) shows the strip with 18 px trimmed
  off its top edge; *Off* hides it but BMW's gear letter. A test on a car (photos, 2026-11-26): the trims of 6 and
  12 px left pieces of BMW's own dials at the sides, and the wider gap beside the gear showed the T of COMFORT. A
  choice saved before goes to *On* (show all of it, any trim) or *Off* (either way to hide it).
- **BETA: lower and enlarge the cluster is gone from Settings.** On the same car 40 px and more cut the top of M Sport's
  speedometer (its 260) and brought Toro's boost reading under the seat belt light, and 20 px (3 % larger) is hardly
  told apart from *BMW's bottom strip: Off*, which hides the strip as well. A saved choice is not read any more: every
  style is drawn at its own size.

## AK 0.19.0

- **The app's menu, as AK Cluster Layouts'.** The page sits in the kit's frame: its header, with *Settings*, and the
  bar, with **Cluster on / off** and **Logs**. The page holds what CLUSTER did: the design on the cluster, what each
  of its places shows, and a card for each design. Settings goes a step at a time, as the head unit's own: on / off,
  the style and the skin at its top, then **General**, then the style in use's own (**Toro**,
  **M Sport**, **M Sport Plus** or **M Track**; another style's once it is chosen). **Logs** shows its codes in the
  page's place; pressed again, the next page, and past the last the page again. The page's own tabs, its way out and
  the bar's *Design* and *Centre picture* are gone: a design is its card, the centre picture its place.
- **Show on the cluster as AK Cluster Layouts': *On* or *Off (stock cluster)*, and no *Start at every startup*.** On
  stays on at every start until it is turned off; off stays off. A switch saved before is carried over as it was.
- **The KOMBI's warning lights along the glass's sides** are kept clear as the tyre pressure and parking brake lights
  were: brakes, ABS and DSC on the left, Auto Hold and steering on the right, each as its shape (a round symbol, Auto
  Hold's words), placed from BMW's guide to the G-series cluster (TE18-0859) and a photo of a G20's cluster. Every
  style was clear of them already but M Sport's holiday tree, now a little lower. The lane departure light is not
  among them yet: the guide puts it on the "180" of BMW's own M view, so its place waits for a photo of it lit.

## AK 0.18.0

- **No Car to choose on GENERAL; its figures are GENERAL's, as AK Cluster Layouts has them.** The tach scale, redline,
  limiter, shift lights, *Shift now warning at*, **Speedometer up to** and **Boost gauge up to** (now in bar, its
  psi beside it) and the fuel tank are on GENERAL for every car, set there or by the Car profile app (1.8.0 sets the
  speedometer's and the boost gauge's ends too). **Engine** has *Petrol, M car*, as the Car profile's Engine: M Sport
  and M Track keep clear of the M display's two boxes, the speedometer reads to 330 km/h on *Automatic*, and the
  redline and limiter left to the car are an S58's. A plug-in hybrid's eDrive box is kept clear by *Electric range*
  (the Car profile's *Plug-in hybrid* sets it). A car chosen before - B48, B58, S58, Plug-in hybrid - has its figures
  put in GENERAL's settings once, at the first start, so the cluster reads as it did (a B48's boost gauge ends
  at 20 psi, the others' at 30); a boost top saved in psi reads as the gauge at or over it.
- **Boost gauge up to is set in the Car profile app** (not on GENERAL): a gauge below, or *Auto* - the car's own
  Sport Display's boost gauge end (FES displayMaximumValueBoostPressure, in the car's pressure unit), as the least
  gauge at or over it (within 5 %), kept for the next start; the kind of car's own until the car has sent it.
- **The Sport Display's boost in the car's pressure unit**: tenths of a psi on a car set to psi (as AK Cluster
  Layouts reads it), hundredths of a bar otherwise; before, a psi car's 20 psi read as 2.0 bar.
- **Boost gauge up to** is one of the car's own gauges: 15, 20 or 30 psi (in bar 2.0, in kPa 200) or 45 psi (3.0
  bar, 300 kPa) - the end in the unit shown. Every boost gauge ends there where it is set: Toro's wedge,
  its PRESS. TURBO gauges and M Track's boost row (the frame's own 1.9 bar, 28 psi on *Automatic*), numbered as the
  car's: 0 5 10 15, 0 10 20, 0 10 20 30, 0 15 30 45 psi; 0.0 1.0 2.0, 0.0 1.0 2.0 3.0 bar; 0 100
  200, 0 100 200 300 kPa, a mark at each: the PRESS. TURBO
  gauge's tall ticks, the M Track row's rail cut there; an M Track strip given boost has its end, half and 0.
- **A plug-in hybrid's drive modes on the cluster.** The mode word now names what BMW's own cluster does on a plug-in
  hybrid (*HYBRID*, *HYBRID ECO PRO*, *HYBRID COMFORT*, *ELECTRIC*, *ELECTRIC INDIVIDUAL*, *BATTERY CONTROL*, *SPORT*,
  *SPORT INDIVIDUAL*, *XTRABOOST*), whether the car sends it by name or by number; Toro names them as the Revuelto
  does (*CITTA* for electric, *STRADA* for hybrid, *RECHARGE* for battery control, *SPORT*, *CORSA* for XtraBoost).
  Where a plug-in hybrid's mode showed nothing, it shows its name.
- **The fuel gauge reads as AK Cluster Layouts' does**, in every style: the engine unit's own tank level (OBD PID 0x2F,
  `DID F42F`, then `OBD 2F`; a diesel too: it is a standard PID), asked every 10 s while a fuel gauge or place is
  shown and the engine runs, kept a minute; otherwise, and before the engine has answered, the car's litres over the
  tank's size. *GENERAL → Fuel % from*, as Layouts' setting: *Engine unit (OBD tank level)* (as it comes) or
  *Litres / tank size*, which never asks. The Car profile app's *Fuel % from* (Car profile 1.8.0) sets it for this
  app and Layouts at once.
- **Fuel tank size takes every size the Car profile app gives** (42, 46, 66, 69, 83, 85 and 90 L as well): before,
  one of those set there was left at this app's own.
- **Toro's fuel gauge says GASOLIO on a diesel** (BENZINA on a petrol car).
- **LOGS** carry the litres in the tank as the car gives them and the engine unit's level, beside the fuel gauge's
  percentage and which of the two it is.

## AK 0.17.0

- **A LOGS tab**, as AK Cluster Layouts' Logs: what's needed to find a problem (the settings, the service's state, the
  engine unit's readings, the readings now, the cluster-render log and this app's) as QR codes to photograph, three a
  page (*Previous*, *Next*, *Make again*), and the whole as a file in the app's data folder and on a USB stick. The
  same codes as Layouts' (`tools/decode_logs.py` puts them back together).
- **Settings named and set as Cluster Layouts' where they are the same**: *Shift now warning at*, *Cold engine: shift
  point with the oil at 30 °C*, *Cold engine: oil warm at*; *Cold engine: lower the shift point and red zone* on by
  default with Layouts' words for its choices; the clock 12-hour first and by default; the fuel tank 59 L by default.
  (The Car profile app sets each of them for both apps where it is used.)
- **Every reading the car gives, the same set as AK Cluster Layouts' places.** A footer place (M Sport, M Sport Plus,
  M Track Mode) offers the rpm, the speed in the other unit, the gear (D4), boost, the **boost target** and this
  drive's **peak boost**, engine power and this drive's **peak power**, torque, oil temperature and **oil pressure**,
  coolant, gearbox oil, intake air, **pedal**, **throttle**, **ignition timing**, the **fuel rail's and the supply's
  pressures**, the battery's voltage, the **fuel**, a drive battery's charge, temperature and **power**, the electric
  range, the trip computer, the odometer, the **0-60 mph (0-100 km/h) time** and the **last upshift's rpm**. Toro's
  side gauges and M Track Mode's gauge rows and strips offer every one of them with a scale (the **engine's power
  and torque**, the **fuel pressures**, the **fuel** and the **drive battery** among them).
- **The readings' places are set on the CLUSTER page alone**: the footers, Toro's side gauges, M Track Mode's rows and
  strips are no longer rows of the style tabs nor of the head unit's settings list.
- **At start-up the style comes straight in after BMW's own cluster, with no black between**, as Cluster Layouts': it
  goes up once the car has been on for 1.2 s without a break, its layers made hidden, and shows whole on its first
  frame, once every layer has its values. Made visible one by one, the full-screen background stood alone (the
  cluster black) while the rest had nothing to draw yet.
- The engine unit is asked for the boost target (`4AB0`, `F470`, `OBD 70`), the fuel rail (`F423`, `F459`, `OBD 23`)
  and the supply (`F40A`, `F422`, `OBD 0A`, `OBD 22`) only while a place shows them, as Cluster Layouts reads them
  (docs/ENGINE-READINGS.md); a diesel the standard forms alone.

## AK 0.16.1

- **GENERAL → Car → Plug-in hybrid is a plug-in hybrid's Electric range too** while that is on *Automatic*, as Cluster
  Layouts' *Vehicle → Plug-in hybrid* is: the electric range, Power % and CHARGE without waiting for the car to show
  it. Electric range chosen by hand (Off, Plug-in hybrid, Fully electric) stays as chosen.
- **The plug-in hybrid's rev figures are GENERAL's**, as Cluster Layouts': Redline, Limiter, Shift lights from,
  Shift now at, Tach scale, the speedometer's top and the fuel tank show for it as for *Car profile values*, set
  there or by the Car profile app (on Auto / From the car: red from 6,000, limiter 6,500). It had fixed ones.

## AK 0.16.0

- **A plug-in hybrid's Power % in the rev counter's place**, as Cluster Layouts and BMW's own cluster show it
  (*GENERAL → Electric range → Plug-in hybrid*; always on an *Electric car*): in its electric and hybrid modes Toro's
  dial, M Sport's and M Sport Plus's rev dial and M Track Mode's rev bar read the accelerator's demand, 0 - 100, from
  a 0 a quarter up (0, 50 and 100 on the marks they fall on); off the pedal, the battery taking the regeneration,
  they light green below the 0 (CHARGE, to -100). Their name reads POWER (Toro: POWER %), or CHARGE in green. The
  rev counter again in SPORT, XTRABOOST and with the lever in S or M; no red zone, shift lights or limiter flash
  while Power % shows. No more layers than before but Toro's two.
- The battery's power and its limits from eDrive Live, through the folder Cluster Layouts and Cluster Info read
  (`src/car/providers.js`: a `wanted-akakingj_cluster_id8.json` of its own while Power % can show, gone when not);
  the plug-in hybrid's own mode names (PHEV_ELECTRIC_…, PHEV_HYBRID_…, XTRABOOST) from FES; the pedal from the
  engine unit all the while such a car is in drive readiness (docs/ENGINE-READINGS.md).
- **GENERAL → Electric range: Automatic** as it comes (once, for a saved Off too): a plug-in hybrid once the car
  shows it is one - its own plug-in hybrid drive modes, or eDrive Live sharing its battery's power - as Cluster
  Layouts finds one; kept from then on (vehicle.json). A petrol or diesel car stays as it was. A Car profile set to a
  plug-in hybrid turns it on as before; a fully electric car is chosen by hand.
- `test/power.test.js`; the preview's `phev=electric|hybrid|sport&kw=&pedal=`.

## AK 0.15.0

- **GENERAL > Car: B48, B58, S58 (M car), Plug-in hybrid, Car profile values.** Each engine has its own figures
  (`src/geometry/panel.js` rev): the most it revs (the limiter; the tach to the thousand at or over it), the red
  zone, where to shift (Shift now: the shift lights flash, the speed and the gear blink), the yellow, the
  speedometer's top - B48 7,000 / red 6,000 / shift 6,500, 260 km/h; B58 7,500 / 6,500 / 7,000, 260 km/h; S58
  8,000 / 7,000 / 7,500, yellow 6,500, 330 km/h (the M dial's amber from there, the speedometer to 330). With
  one chosen, GENERAL's Redline, Limiter, Shift lights from, Shift now at and Tach scale are not used: they show,
  with the speedometer's top, Toro's boost gauge top and the fuel tank, for *Car profile values* only (set there
  or by the Car profile app). The X3 M40i is gone (a saved one reads as the B48, as it comes now). Each car's
  tank turns the fuel's litres into the gauge's level (the X3 M40i's 65 L was taken for any car left as it came).
- **TORO > Gear: D1, S1, M1** as it comes - the gear with the gearbox's programme (MDrive.dataDisplayGearbox, as
  Cluster Layouts reads it), the pair smaller than a single figure; or the figure alone, as a Lamborghini.
- **More readings, as Cluster Layouts has them**: the gearbox oil (BasicDataSet), the engine's torque and power
  (FES statusActualValueTorque2; GENERAL > Torque unit, Power unit, the Car profile's), the trip computer's
  distance and driving time (KombiIF statusBordcomputerTravelData), the odometer - in every M style's footer
  places, and the gearbox oil in M Track Mode's gauge rows (its word, TRANS, where a symbol would be). In Korean
  "Oil temperature" and "Oil pressure" read 엔진오일 온도 and 오일 압력.
- **The accelerator pedal, the throttle's opening and the ignition angle**, from the engine unit as Cluster
  Layouts reads them (5814 / 480B / OBD 49, 4600 / 5858 / OBD 11, 59FA / OBD 0E: Live Data's, listed in
  docs/ENGINE-READINGS.md), in M Track Mode's rows and strips and Toro's side gauges; asked only while one shows.
- **M TRACK > Strip right of the rev counter, left / right**: the two strips right of the tach show any reading a row can, the fuel, or
  nothing - the oil and the fuel as they come. The fuel strip fills from the bottom (its lowest piece in the
  warning colour only once it is all that is left).
- **TORO > Left upper / Left lower / Right upper / Right lower gauge**: each side gauge any reading or nothing;
  *As the style has it* keeps its own (the oil, oil or turbo pressure, the fuel, the coolant, and an electric
  car's as before). The ESC block under the gear's right is gone: the drive mode's name stands once, on the left.
- The page's words stay within the head unit's 1,024 strings (`test/page.test.js` runs the kit's builder).

## AK 0.14.1

- **Korean for 0.14.0's settings.** *Shift now at*, *Cold engine*, *Cold rev limit*, *At the limiter* and their
  choices were in ko.tsv but not in ko.json, which the build reads (`python3 kit/tools/sync_locales.py ko`);
  `test/korean.test.js` now holds every setting's name and choice to ko.json, and ko.json to ko.tsv.
- **The page's design pictures** (`app/previews_data.js`, `tools/make-previews.py`) drawn again: the M styles'
  speedometer to 260 km/h, as the cluster has it since 0.13.0. The README's screenshots likewise.
- Toro's *Shift lights* choice says it bursts at the limit or from *Shift now at*.
- `tools/page-sim.js` works the page as it is: the design cards and each style's places on its picture on
  CLUSTER (it still looked for the arrows and centre buttons the page had before), and *Shift now at* where it
  asked about the BeeM-Flash setting (gone in 0.13.0). It passes again, with the renderer and without.
- docs/IN-CAR-TEST.md: S1 - S4, Shift now, the cold engine and the Car profile.
- **BeeM-Flash as 0.13.0 left it, everywhere.** Toro's *Colour → Match the interior light* is gone: its colour came
  on BeeM-Flash's feed, which the app no longer reads (a saved choice is read as Arancio, `aliases`).
  docs/ENGINE-READINGS.md and IN-CAR-TEST's E rows say the engine unit is asked on every head unit, with no
  setting; `tools/car-sim.js`'s BeeM-Flash runs are none, feeding and idle, each asking the engine unit (its
  on / off / upgrade runs set a setting the app no longer has). The comments that named
  docs/BEEM-FLASH-FEED.md (never in this repository) name src/car/feed.js.
- **Leftovers of the author's public release.** docs/RELEASE-README.md and `MGU_RELEASE_ROOT` (for
  `tools/make-release.js`, left out in AK 0.11.0) are gone; test/diesel.test.js holds README.md to the diesel's
  figures instead. package.json has no version of its own (it said 0.11.0).
- **The screenshots the docs show, and no others.** `tools/screenshots.py` draws, as it comes, the pictures
  README.md and docs/*.md show; `--gallery` the whole set with docs/GALLERY.md and docs/img, for looking at.
  The five pictures nothing showed (app-page, m-sport, m-sport-plus, startup-message, toro-genuine) are gone.
- README: Redline and Limiter from 3,000 and 4,000.

## AK 0.14.0

- **The shift lights with the Car profile.** Every rev setting the Car profile sets is followed, at every value
  it has: Red light at (Auto: the red zone at its redline, *At the limiter* here), Engine's top rpm (the Limiter;
  Auto: the car's), Yellow light at (Shift lights from, 2,000 and 2,500 too), Gauge goes up to.
- **Shift now at** (GENERAL; the Car profile's Shift now warning at): off as it comes, Auto (300 under the
  redline) or an rpm. From there the shift lights flash (Toro; full at the shift point), and the speed and the
  gear blink red four times a second in every style (`src/engine/state.js` shiftPoint, `palette.js` blinkOn).
- **Cold engine** (GENERAL; the Car profile's Cold-engine rev guard, Cold rev limit, Oil is warm at): off as it
  comes. On, the shift point comes down to the cold rev limit with the oil at 30 °C and climbs back as the oil
  warms, the red zone keeping its distance to it, on every style's rev dial. Costs: docs/PERFORMANCE.md.

## AK 0.13.0

- **The readings the bus does not carry come from the engine unit.** Intake air, battery voltage, oil pressure
  and the rest are asked of the engine unit (read only) on every head unit; the "BeeM-Flash readings" setting is
  gone, and an earlier install is no longer kept to BeeM-Flash only (it was, and asked the engine unit nothing).
  Their names no longer say "needs BeeM-Flash".
- **The M styles' scales.** M Sport and M Sport Plus's speedometer reads to 260 km/h (160 mph), as Cluster
  Layouts' dials; the tach of every style follows GENERAL > Tach scale (0 - 6,000 to 0 - 10,000; a diesel's
  0 - 6,000), which was Toro's alone (its own shader for each scale: `mgauge7` ... `mtgauge10`).

## AK 0.12.1

- **A changed setting no longer makes the whole cluster again.** Where the layers stay as they were (their
  shader, place and order: a colour, a background, a scale, a reading), the next driver takes them over as
  they are and sends their uniforms again (`src/car/cluster.js` adopt / handOver); nothing is dropped, made or
  uploaded, so the change shows at once instead of after the renderer has built some 40 layers again. A
  uniform the new settings no longer send goes back to 0 on the first frame, as on a layer made new. Another
  style (other layers) is still built new, after the old layers are handed back.

## AK 0.12.0

- **Korean.** The Store builds the app in Korean (`mgu-repo.json`: `--language ko`): the iDrive
  screens, the settings and their choices, the CLUSTER page and its status lines in Korean
  (`kit/runtime/locales/ko.tsv`, then `python3 kit/tools/sync_locales.py ko`; the page's words
  go through the kit's catalogue, `app/entry.js` tr). The styles' names, the units and the
  start-up message's words stay as they are, and the cluster itself stays in its own lettering.
  The Korean glyph atlas (`kit/localization/fonts/korean.json`, Noto Sans KR, SIL OFL 1.1) is
  AK Cluster's. A Korean build keeps the plain version (`kit/tools/localize.py`), so the Store
  finds `dist/akakingj_cluster_id8@<version>.tgz`.

## AK 0.11.2

- **The page's pictures on the Store's renderer.** The kit (`kit/runtime/record.js`,
  `renderd.js`) sends a pixel image as an mgu-render/1 picture (message 10, premultiplied,
  the version before dropped with 11) and names it in the native `OP_IMAGE`, as AK Cluster
  Layouts' kit does since its 0.36.5. Before, on that renderer (the car's, and the MGU demo's)
  the CLUSTER page's design pictures and cards were empty, and the preview showed only its
  red frame once the cluster was on.
- **Start-up message off as the app comes** (GENERAL > Start-up message turns it on), and
  turned off once on a car that had it on (`reset`).

## AK 0.11.1

- The tile's icon: ID8 in white, in Michroma (thickened, SIL OFL 1.1, as
  AK Cluster Layouts' Sport face), drawn from Layouts' baked atlas
  (`app/icon.png`).

## AK 0.11.0 — the app AK Cluster ID8 (`akakingj_cluster_id8`)

A personal modification of 0.10.0, installed beside the original as an app
of its own, from this branch's `mgu-repo.json` in the Store. The four
styles are all there, with AK Cluster Layouts' settings:

- **The CLUSTER page as Layouts' page**: the design's picture as the
  cluster draws it (baked by `tools/make-previews.py`), on / off under it,
  a cell for each of the style's places - its centre picture, gear place,
  second speed, footers, panel, M Track Mode's wing and gauge rows,
  Toro's gauges and lights - each a press to change, and a card for each
  design along the foot.
- **Skin** (General, or the Car profile's): Classic, or iDrive 7 - the
  head unit's own look, near-black with flat rows, check boxes and the
  orange focus, on the page and on the kit's lists.
- **Units as Layouts has them**: Speed, Temperature, Pressure (psi, bar,
  kPa, or with the speed unit) and Fuel economy (km/L, L/100km, mpg, or
  with the speed unit), each on its own, for every figure, scale and unit
  word of the four styles.
- **The Car profile** (the Car profile app of akakingj/myapp-id7): the
  units, Skin, Clock, Engine and Electric range, Redline (its red light),
  Limiter (its redline, the fuel cut), Dial scale (its gauge top) and the
  new *Shift lights from* (where Toro's shift lights begin; its yellow
  light). A setting the profile sets shows its value with "Car profile"
  beside it and is changed there; one it leaves to each app is this
  app's own.
- **Clear of the driver camera's cowl** (top middle of the glass): Toro
  comes at 0.9 of its size (Fill the screen: "Clear of the driver's
  camera"), so its rev numbers stand below the cowl, and its shift lights
  stand either side of it, above the turn signal arrows at its lower
  corners - the Lamborghini blades closing in on an empty middle, the GT3
  LEDs and the single blade in two halves, left then right.
- **Taking turns with the AK Cluster apps**: it says it is on the cluster
  as AK Cluster Layouts does, so AK Cluster Centre steps aside for it, and
  it steps aside while Layouts is on the cluster.
- **The figures as the car's own cluster keeps them**: the speed's digits
  move on once the reading is 0.75 past them, the engine speed's once it is
  15 rpm past (shown to the nearest ten), so they no longer flick between
  two figures.

## Beta 7 — `main`, app version 0.10.0

**A fourth style: M Track Mode.** BMW M's track view, rebuilt for the
iDrive 7 panel from a photograph of it and a written guide, the way M
Sport was. *GENERAL → Style → M Track Mode (BMW M's track view)*.

- **What it draws**: a pointed blue wing with the three M bands and four
  gauge rows; the gear large on a black band, with one speed under it; a
  leaning red rev counter hung from a level line, a white marker across it
  and the band lit red beneath; oil temperature and fuel as two ladders
  beside it; and a footer of three readings round a four-pane panel.
  **Everything on it is the car's live figures**, in the units chosen. The
  photograph's own values (0 km/h, D, 840 rpm, 19:02, 402 km, +21.0 °C)
  are only its reference fixture, `preview/index.html?fixture=mt`.
- **The four rows are BMW's as they come** - turbo boost, coolant, oil
  temperature, intake air - **and each is yours to choose**: *M TRACK →
  Gauge row 1 (top)* … *Gauge row 4 (bottom)*. Also oil pressure, battery
  voltage, a drive battery's charge and temperature, or nothing (the row
  is left out). A car set as fully electric gets charge and battery
  temperature. Each reading brings its own scale and its own too-cold and
  too-hot ends, in bar and °C or psi and °F.
- **A reading shows as a mark on its rail.** That is as much as one frame
  with the car idling gives away: all four rails are whole and white in
  it, and the one mark stands at 0.0 bar. *Gauge rows: the reading shows
  as → A bar* dims the rail past the mark instead, for anyone who finds
  the marks too small to read driving.
- **The left wing can hold a picture**: *M TRACK → Left wing shows*: the
  four gauges (as it comes), the phone's map, BMW's own map, or Turn
  View's camera. The rows fade out and the picture shows in the wing and
  nowhere else - soft at every edge, the M bands and the fine lines kept
  faintly over it - and nothing right of the first seam changes, as the
  guide asks.
- **The picture fills the wing, to its point.** Asked for: as first built
  the window began at a straight edge part way along the wing, because the
  car's picture begins there - its slot (416,120 1088×480) cannot be moved
  and has nothing left of x 416. So with a picture chosen it is the style
  that moves: **193 px further right**, the same size at the same height,
  which puts the wing's point on the picture's left edge. The window is
  then the wing's own outline, its two leaning edges meeting at the point.
  The wing shows 44 % more of the picture (30 % of it, from 21 %), and the
  picture's middle - where a phone's map has the car - is now inside the
  wing. With the gauges the style is where the frame has it. *M TRACK →
  Left wing: how much of it a picture takes → The style stays where it is*
  is the earlier arrangement, and what a lowered cluster and an M car get
  (there the move would put the gear under one of those cars' own boxes).
- **The rev counter follows the car**: the red field starts at the
  redline, the limiter flashes it, and a diesel (*GENERAL → Engine*) gets
  seven marks to 6,000, as in the other styles.
- **Its figures and symbols were drawn for it**: the gear's letters,
  traced off the frame's own D, and nine symbols (turbo, coolant, oil
  temperature, oil pressure, intake air, battery, charge, cell
  temperature, the M mark). They are packed into the atlas after
  everything that was there: every earlier glyph is where it was, byte for
  byte.
- **Measured, not eyeballed.** The photograph is of a curved display,
  taken from one side, so it is rectified first (two fitted maps) and
  every line is measured in the frame that gives: `src/theme/tgeom.js`,
  with the working in `docs/ref/M-TRACK-MEASUREMENTS.md`.
  `tools/mt-compare.py` holds the render against it: 98.1 % of the
  photograph's edges have one of ours within 2 px, and of 182 control
  points the photograph's picture sits within 1 px of ours at 161 and
  within 2 px at 177. It is a reconstruction from one frame, and makes no
  claim to be BMW's cluster pixel for pixel.
- **The other styles look exactly as they did.** Toro, M Sport and
  M Sport Plus draw the same pictures as in 0.9.6: 26 preview frames
  across the three, every one pixel for pixel. What a footer place can
  show moved into a table of its own (`src/theme/readings.js`), now shared
  by all three M styles.
- The app's page has a sixth design and an **M TRACK** tab. Every setting
  is on iDrive; none is on the cluster.

**BETA: the whole cluster lowered, and larger by as much.** Asked for:
with BMW's strip hidden, the rows it stood in held nothing but black.
*GENERAL → BETA: lower and enlarge the cluster* — **off as it comes**.

- **20, 40, 58 or 74 px lower, and 3, 6, 9 or 11 % larger**: the scale is
  the amount, (646 + d) / 646, about the top of the screen's middle. The
  top stays where it is, the foot goes d rows lower, and it is the same
  picture, bigger - nothing is stretched or moved about. It hides the
  strip itself; BMW's gear letter stays, as ever.
- **Every style, each as far as it has room for**: the M styles to the
  screen's edge; Toro 58 px, where it stands at the size the brief drew
  it and its side gauges are 13 px off the screen's sides.
- **Nothing of ours in the gear's columns** (`x 1384 – 1500` from `y 664`
  down), lowered or shaken: the same rule *Hide it* drives on. Toro's
  speed, which then stands beside BMW's gear letter, is set as far left as
  keeps its unit clear under the limiter's hardest jolt. The limiter's
  flash and the start-up message's veil are drawn round the columns, in
  three pieces, so they still take in the whole style.
- **The picture in the middle does not grow** (the car draws it where it
  always does): a style's window is larger round it, M Sport Plus's glass
  is held to the picture's own edge where a larger window could pass it,
  and M Track Mode's wing begins its window where the picture begins.
- Off, nothing is different: the same layers, in the same places, sending
  the same figures - and the pictures compared with 0.9.6 are the same
  pixel for pixel.
- To know: lowered, an M style's speed scale reaches the place the tyre
  pressure lamp lights (the lamp is drawn over it); a style's background
  still ends where the strip began. **Not yet on a car.**

**The widest picture, in M Sport and M Sport Plus.** Asked for: "an even
broader view … within very nice transparent edges fading out". *M SPORT*
and *M SPORT PLUS → Centre picture: how much shows → Widest*. The other
sizes are as they were, and *Standard* is still what a style comes with.

- **All of the car's picture, not a shape cut in the style.** The glass
  opens over the picture's whole rectangle - 1088 px across, from its top
  edge to just under the rails - and fades out at all four edges: over 90
  px at the sides, about 50 at the top and the foot. It shows **55 % of
  the picture**, strength for strength, where M Sport's *More* shows 36 %
  and M Sport Plus's *Fullest* 48 %.
- **The plates make way.** They go altogether as the picture comes up, and
  M Sport's two lines with them (unless kept). The first cut thinned them
  by the same field as the glass, as the other windows do, and was looked
  at: with no outline of its own for a plate to end on, it left fragments
  of plate along the picture's edges and inside every pad. What stands
  round the picture is the dials, the strips, the rails, the figures and
  the footer - which stays shut.
- **Every figure keeps dark glass under it**: a soft-edged pad round the
  speeds, one round the gear's place, and one along each of the fuel and
  oil strips, leaning as the strip leans. Each is its figures' own reach
  at their widest value and no more, and smaller when less is shown: with
  one speed and nothing in the gear's place the picture is 61 % seen.
- **With no picture the style is whole**, exactly as with any other size:
  the centre closed, a turn card, the phone's map not on the cluster.
- **It stays on the picture.** The field is told where the car's picture
  is, so a lowered cluster (BETA), which is larger than the picture it
  stands round, keeps the window on it.
- It asks less of the renderer than the standard window: once the picture
  is open the plates are not drawn at all (see below).

**The start-up message comes up on the dark.** Asked: is the message
still fading in and out as it did, and not standing over the cluster as a
picture of it showed?

- **It is as it was, frame for frame - with one slip, now gone.** The
  message was drawn at fifteen moments in this version and in 0.9.6: the
  same pictures, pixel for pixel, before the change below.
- **The slip was real, and was there from the first version of it**: the
  dark behind the words was whole for the first 0.6 s, fell clear in one
  frame, and closed again over the next 1.2 s. So for about a second at
  every start the cluster stood behind the half-faded words - which is
  what that picture had caught. The dark is now whole from the first frame
  until the words have come up. Three of the fifteen moments differ from
  0.9.6, all in that second; the rest are the same pixels.
- The end is unchanged: the words fade over 2.8 s and the dark thins
  1.2 s after them, so the cluster comes up through the last of the
  words - "fading slowly into the cluster", as the setting says.

**Nothing has slowed down, measured - and a frame now asks less.** Asked
for: with everything added since the first public release, is the cluster
still as light as it was? `docs/PERFORMANCE.md` has the figures, 0.9.1
against this version.

- **Toro, M Sport and M Sport Plus, as they come, ask what they asked in
  0.9.1**: the same layers (43, 39, 39), the same messages and bytes a
  frame to the byte, the same processor time within the measurement's
  noise, and 44 of their 46 shaders byte for byte the same (the other two
  are M Sport Plus's glass, 151 characters longer). Parked, a style still
  sends nothing at all.
- Two things that had crept into every frame since then are out again
  (each a fraction of a microsecond, found by looking): two empty gauge
  objects a frame that the electric gauges made for every car, and M Track
  Mode's readings-as-numbers made for every style.
- **The renderer has less to draw than it had.** The limiter's flash lay
  over the whole style and was drawn on every frame, lit or not: a quarter
  to a third of every pixel the renderer filled. It is now drawn only as
  the limiter nears - hidden the way a turn card is when there is no turn.
  Pixels filled in an ordinary frame: Toro −22 %, M Sport −31 %, M Sport
  Plus −32 %; the M styles draw about 10 % faster for it. Nothing looks
  different.
- **M Track Mode is the lightest style to draw.** As first built its
  labels stood in boxes many times their size; each now has a box of its
  own. 47 % faster to draw than it was, and about a quarter faster than
  M Sport.
- **The package is 13 % larger than 0.9.6** (407 KB against 361 KB to
  fetch): M Track Mode's code, shaders and symbols. Read once at start-up;
  a style that is not on the cluster costs a frame nothing.
- **The lowered cluster costs what its size costs**, and only when turned
  on: 8 % more to draw for Toro, about 20 % for the M styles.
- **Held from now on**: `test/budget.test.js` fails the build if a style
  as it comes has more layers, covers more of the screen or sends more
  than these figures - none of which may exceed 0.9.1's. `npm run perf`
  and `npm run perf-draw` measure any checkout the same way.
- These are measurements on a computer, not on the car: they compare one
  version with another. Toro is three times the M styles to draw and
  always was (its dial's numerals are half of it); it was left exactly as
  it has been driven.

**Checked**: 267 tests (54 more than 0.9.6); every shader compiled, in 36
preview frames; the simulated car in 46 runs with the replay of what it
drew - 25 of the three styles and their options (four with the widest
picture), 11 of M Track Mode (its wing's pictures in both arrangements,
its rows, a diesel, with and without BeeM-Flash), 10 lowered - and the
release tree itself in 11 more, with the page on the kit's real runtime;
the three styles' pictures against 0.9.6, 26 frames, pixel for pixel;
M Track Mode with the style kept in place against its first build, 8
frames, pixel for pixel; the start-up message at fifteen moments against
0.9.6 (twelve the same pixels, the three in the mended second not); the
widest picture's glass as rendered against the geometry's own sums, seven
renders, every pixel (never any picture where the sums have none); M Track
Mode against its photograph; and what a frame costs, against 0.9.1.

**Not yet on a car**: M Track Mode and its picture over the whole wing,
the lowered cluster, the M styles' widest picture, the start-up message's
mended second, and the flash that is no longer drawn when idle - see
`docs/IN-CAR-TEST.md` (*M Track Mode*, *Lowered and larger*, *The widest
picture*, *The start-up message*, *As smooth as it was*). To know before
it is: in M Track Mode a picture in the wing stands the whole style 193 px
further right (its fuel ladder then ends 7 px inside the screen's edge),
and on an M car the lower part of its gear may stand under one of the
boxes those cars draw over any style; lowered, an M style's speed scale
reaches the tyre pressure lamp's place; and with the widest picture the
blue plates are gone while a picture shows.

## Beta 6 — branch `beta-6`, app version 0.9.6

**0.9.6: diesels, and M Sport's two lines off the map.** Both from testers.

- **A diesel has its own rev range**: *GENERAL → Engine → Diesel*. Petrol
  as it comes; nothing changes for a petrol car, and nothing is detected or
  switched by itself. A tester's diesel "could not see the revs rev up".
  The car sends a diesel's engine speed exactly as a petrol's - the same
  signal, read the same way by the open projects that were written on
  diesels - so there was nothing to read differently. What was wrong was
  the range: on a petrol dial with petrol limits a diesel lives in the
  bottom half, with the red field, Toro's shift lights and the limiter's
  flash all out of its reach. With *Diesel*:
  - **the rev counter reads 0 – 6,000 in every style.** Toro's dial is
    marked 1 to 6. The M styles' dial has seven numerals over the same
    height, a third further apart, so the marker travels the whole dial.
  - **Red from 4,500, the limit at 5,000**, and the red field, the shift
    lights (from 3,200) and the flash follow. *Redline* and *Limiter* now
    go down to 4,000 and 4,500 for an engine that wants other figures; a
    petrol figure left in them is not taken for a diesel's.
  - **The engine unit is asked only the standard identifiers** (where
    BeeM-Flash is not supplying the readings). BMW's own belong to the
    petrol engine units, and nobody has published what a diesel's answers
    to them mean. There is no standard one for oil pressure, so a diesel is
    not asked for it: Toro's left gauge shows turbo pressure, as on any car
    with nothing to read oil pressure from.
  - The figures are upstream's: a scale to 6,000 with seven numerals and
    red from 4,500, as NamelsMissing/mgu-apps' cluster - written on a
    diesel - draws it; 5,000 as the limit, as the MGU App Kit's diesel
    profile has it. **None of it has been on a diesel car.**
- **M Sport: the two centre lines fade out where a picture shows.** They
  ran straight across the map (a tester's photograph has them over Waze).
  They now thin out with the window exactly as the plates under them do:
  gone from the picture, their feet under it still running into the rails -
  for the phone's map, BMW's map and the camera, in both window sizes.
  *M SPORT → Centre picture: the two lines across it → Keep them over the
  picture* brings them back. With the centre closed, or a turn card,
  nothing is different.
- The petrol dial, its numerals and every other shader are byte for byte
  what they were: the diesel dial, its numerals and the fading lines are
  shaders of their own, sent only to a car that is set to use them.
- 213 tests (18 more); the simulated car can be a diesel
  (`CAR_SIM_DIESEL=1`), with an engine unit that answers BMW's petrol
  identifiers with figures that are not readings - which must never be
  asked for, and are not.


**0.9.5: M Sport Plus, *Centre picture: how much shows → Fullest*.** Asked
for from a picture of *More*: the spot between its open areas was shut,
and its top and foot ended on a short fade.

- **One blended picture.** The picture's strength is a single smooth field
  over the middle: the glass thins by it everywhere - the black between
  the plates too - and a plate is gone once the picture is at three tenths
  of its strength. The plate above the speed, the strip of the centre
  plate beside it and the cut between them are one picture now, fading out
  to the left as the right side fades.
- **Softer at the top and the foot, and further down.** In over 28 units
  from the top (12 before), out over 66 down to 59 units under the plates'
  foot, above the footer. Not further up: the picture's own top edge is
  where the plates begin, and there is none above it.
- **The speeds and the gear keep their own ground**: a soft-edged pad round
  each, sized to what is shown there - smaller with one speed, none with
  the gear's place empty. No readout stands on the picture, as before.
- Standard and More are untouched; M Sport has no such setting.
- 195 tests (2 more).


**0.9.4.**

- **A new install trims 18 px of BMW's bottom strip**, in every style: the
  most a trim can be, which hides whatever of BMW's own cluster shows
  between a style and the strip's figures. An install that is already set
  up keeps what it has; *Show all of it* is still there.
- **One speed or two in the M styles.** The M View shows both, mph and
  km/h; *Second speed underneath → One speed only* leaves the one in the
  units chosen - km/h alone with *Units* on km/h. Each M style has its own.
- 193 tests (1 more).


**0.9.3: from the first plug-in hybrid.** A tester's photographs showed
the electric range right (21 mi beside BMW's own 34 km), and asked for
two things.

- **Fully electric cars get their own gauges.** With *Electric range* on
  *Fully electric*: Toro's fuel gauge is the electric range and its oil
  temperature gauge the **drive battery's temperature**; the M styles' fuel
  strip is the charge and their oil strip the battery's temperature (−10
  to 60 °C), without the pump and the oil can. A footer place can show
  *Drive battery temperature* on any car with the setting on. Hybrids and
  everything else are as they were.
- **Cover the speed limit sign's edge in BMW's strip** (GENERAL, off as it
  comes). With Speed Limit Info showing, the top of BMW's sign stood up out
  of the strip under the style; this covers that spot alone - 90 px right
  of the clock, down to the row above the strip's figures - and nothing
  else of the strip. Placed from one photograph.
- 192 tests (2 more).


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
