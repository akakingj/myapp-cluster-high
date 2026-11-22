# mgu-styles2

MGU Styles: custom instrument clusters for BMW iDrive 7 (MGU), an app by **#tunedbywali**.
Three styles you switch between on iDrive:

- **Toro** — after a modern Lamborghini: a wide rev band, a big gear
  numeral (outline, heavy or bold; in the middle or in a corner), wedge
  gauges, boost, a G meter, shift lights, three backgrounds.
- **M Sport** — BMW M's iDrive 8 M View, rebuilt for the iDrive 7 panel.
- **M Sport Plus** — the same dials round the M stripes, with a wide
  picture in the middle.

Each can show the phone's map, BMW's own map or Turn View's camera in its
middle, and each has its own settings on the app's page.

![The five designs and the app's page](docs/screenshots/overview.png)

> **Unofficial. Nothing to do with BMW AG or Automobili Lamborghini.**
> Changing what your cluster shows can distract you and may affect your
> warranty. The car's own warning lights and its gear display are never
> covered. Test it parked. You use it entirely at your own risk.

This is version **0.9.6**. What changed in each version is in
[CHANGELOG.md](CHANGELOG.md).

## What you need

- A BMW with iDrive 7 (MGU) and a rooted head unit.
- The [MGU Store](https://github.com/robertnisipeanu/mgu-store), with
  `cluster-render` working.
- Developed on a 2023 X3 M40i (petrol). Other cars may differ: see *Tell
  me how it goes*. **A diesel?** See *If your car is a diesel*, below.

## Installing

1. In the MGU Store, choose *Add source* and type exactly:

   ```
   waliworld/MGU-Styles2
   ```

   That is all: no `https://`, no spaces, a hyphen (not an underscore),
   and the **2** on the end. Capitals do not matter. The Store checks the
   repository and adds it on its `main` branch.
2. Install **mgu-styles2**.
3. Open it from iDrive's menu. It is **off** after install: nothing on
   your cluster changes until you press the switch on the **CLUSTER** tab.

**If the Store will not add it**, its status line says why:

| It says | What it means | What to do |
|---|---|---|
| `Not owner/repo or https://host/path` | What was typed is not a repository's name | Type it again exactly as above |
| `Not found or private` | No such public repository: nearly always a typing slip, most often the **2** left off the end | Type it again exactly as above. Do not sign in or add a token: none is needed |
| `GitHub limit reached. Try later or sign in.` | GitHub allows only so many unsigned requests an hour from one internet connection (a phone hotspot shares its with others) | Wait an hour, or use *Sign in with GitHub* in the Store |
| `Add source failed: Offline` | The head unit has no internet | Connect it (hotspot or the Store's uplink) and try again |
| `... is already a source` | It was added before | Nothing: look for **mgu-styles2** in the Store's list |

If you added an earlier address for this app (`waliworld/MGU-Styles`,
without the 2), remove that source: it is no longer public.

To get BMW's own cluster back at any time: the same switch. A key-off
hands it back too, and a head-unit restart always does.

For a map or the camera in the middle, set the car's *Instrument cluster >
Central display area* to *Map view*.

## Settings, in short

Everything is set on the app's page on iDrive — nothing on the cluster.

- **GENERAL**: on / off, start with the car, the style, units, your car,
  **petrol or diesel**, redline and limiter, the limiter flash, BMW's
  bottom strip (show, trim or hide it), readings with or without
  BeeM-Flash, **electric range** for
  plug-in hybrids and fully electric cars (off until you turn it on: a
  hybrid gets its electric range beside the fuel's; a fully electric car
  gets range, charge and battery temperature in place of fuel and oil),
  the holiday theme, the start-up message.
- **TORO / M SPORT / M SPORT PLUS**: each style's own — what its middle
  shows and how much of it, colours, the gear, the footer's readings.
  **km/h only** in an M style: *GENERAL → Units → km/h*, then on the
  style's tab *Second speed underneath → One speed only* (the M View
  otherwise shows mph and km/h together).

![Toro's map opening in its three sizes](docs/screenshots/toro-opening.png)

![Toro's gear numeral](docs/screenshots/toro-gear.png)

![The M styles' window, standard and larger](docs/screenshots/m-centre-size.png)

**M Sport Plus** has a third size, *Fullest*: one blended picture across
the middle, soft at every edge and reaching further down, with the speed
and the gear kept on dark ground. M SPORT PLUS tab → *Centre picture: how
much shows*.

**M Sport's two centre lines no longer cross the map.** Where a picture
shows (the phone's map, BMW's map or the camera) they fade out with the
rest of the window; under it they still run into the rails. To have them
over the picture as before: M SPORT tab → *Centre picture: the two lines
across it → Keep them over the picture*.

![M Sport's centre lines: faded where the picture shows, or kept](docs/screenshots/m-lines.png)

## If your car is a diesel

As it comes the app is set for a petrol engine: a rev counter to 8,000
with its red zone, shift lights and limiter flash near 7,000 — which a
diesel never reaches, so its revs stay in the bottom half and nothing
lights up. Tell the app it is a diesel:

1. Open the app from iDrive's menu.
2. Choose the **GENERAL** tab along the top.
3. Press **Engine** and choose **Diesel**.

That gives every style a diesel's rev counter:

| | Petrol (as it comes) | Diesel |
|---|---|---|
| The rev counter reads | 0 – 8,000 | **0 – 6,000** |
| Red zone from | the car's (6,750 on the X3 M40i) | **4,500** |
| Limiter flash, last shift light | the car's (7,000) | **5,000** |
| Toro's shift lights begin at | 1,800 below the redline | **3,200** |

If your engine revs higher or lower than that, set **Redline** and
**Limiter** on the same tab (from 4,000 and 4,500 upwards); *From the car*
is the diesel's own figures above.

On a diesel **without BeeM-Flash**, Toro's lower left gauge shows turbo
pressure, not oil pressure: the app only asks a diesel's engine unit the
standard readings, and there is no standard one for oil pressure.

![A diesel: the rev counter to 6,000 in each style](docs/screenshots/diesel.png)

**This has not been on a diesel car yet** — please say how it goes. If the
rev counter does not move **at all** with *Engine* on *Diesel* (the needle
stays at 0 while the engine runs), that is something else: report it with
your car and model year, and whether the speed and the gear show.

## Trimming or hiding BMW's bottom strip

BMW's own cluster keeps a strip along the bottom of the screen: range,
clock, street name, driving mode, gear and outside temperature. As it
comes, MGU Styles trims 18 px off its top edge, so nothing of BMW's own
cluster shows between the style and the strip's figures. To show more of
it, or less:

1. Open the app from iDrive's menu.
2. Choose the **GENERAL** tab along the top.
3. Scroll to **BMW's bottom strip** and press it.
4. Pick one:

| Choice | What you get |
|---|---|
| **Show all of it** | The strip as BMW draws it |
| **Trim its top edge: 6 px / 12 px / 18 px** | The style runs a little further down and covers that much of the strip's top edge. The app comes with 18, the most a trim can be |
| **Hide it (BMW's own gear letter stays)** | Everything in the strip is covered in black except BMW's gear letter |
| **Hide it, a wider gap left beside the gear** | The same, with more room left open around the gear letter. The end of a long driving-mode name (the T of COMFORT) shows in that gap |

The change shows on the cluster within about half a second, for every
style. Nothing is set on the cluster itself.

**If the top of BMW's speed limit sign shows under the style** (a small
red arc right of the strip's clock, with Speed Limit Info on): GENERAL →
**Cover the speed limit sign's edge in BMW's strip**. It covers that spot
alone and leaves the rest of the strip as you have it.

**BMW's gear letter always stays.** It cannot be hidden: if it is covered,
BMW's cluster draws a black box in the rev dial instead. Warning lamps
still show over the covered strip.

With the strip hidden, the M styles' footer can carry what it showed:
**M SPORT** or **M SPORT PLUS** tab → *Footer, left / middle / right* (time,
range, outside temperature and more), and *The gear's place shows* if you
would rather not see the gear twice.

![BMW's bottom strip at each setting](docs/screenshots/strip.png)

(The pictures are the app's own preview, not photographs of a car.)

### If a black box appears in the rev dial

It should not: the app never covers the gear letter. If you see one after
choosing *Hide it*, choose *Hide it, a wider gap left beside the gear*,
lock the car and let it sleep once (the box can stay until the cluster
restarts) — and please report it, with your car and model year.

## Tell me how it goes

Feedback is what this release is for. Open an **issue** on this repository
with your car, what you set, what you saw — and a photograph of the
cluster if you can. [docs/IN-CAR-TEST.md](docs/IN-CAR-TEST.md) lists what
is most useful to check.

## Licence

**MGU Styles is currently free, and open for public testing, without its
source code.** You may install the app, unmodified, on your own car and
use it for yourself, and send feedback. You may not copy, modify, decompile for reuse, redistribute
or sell it, or use any part of it in something else. The terms are in
[LICENSE](LICENSE).

Parts that are other people's keep their own licences: the MGU App Kit in
`kit/` (MIT), `cluster_render_client.js` (MPL 2.0) and the typefaces
(SIL OFL 1.1) — see `apps/mgustyles_toro/NOTICE`.

## Credits

MGU Styles stands on what others built and worked out, mostly on their
own cars. Thank you to:

- **Robert Nisipeanu** —
  [robertnisipeanu/idrive-apps](https://github.com/robertnisipeanu/idrive-apps):
  `cluster-render`, the renderer every cluster app draws through, and its
  protocol; *Maps on cluster*, which puts the phone's map on the cluster;
  and the [MGU Store](https://github.com/robertnisipeanu/mgu-store), which
  installs all of it.
- **[ALMSTRA/idv7lol](https://github.com/ALMSTRA/idv7lol)** — the rule that
  a cluster theme ends above BMW's bottom strip, the shader limits, boost
  readings, and the copy of the MGU App Kit used here.
- **[cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps)**
  — the **MGU App Kit** (MIT) that runs and packages the app, and the
  engine readings' identifiers.
- **[Vizualyse/idrive-apps](https://github.com/Vizualyse/idrive-apps)** — the
  measurements of the cluster's panel: that only the gear's window in
  BMW's strip must stay uncovered, the glass's cut corners, where the
  warning lamps stand.
- **[IterioDev/car-apps](https://github.com/IterioDev/car-apps)** — Turn
  View, whose front camera and next turn can show in the middle (used as
  installed; nothing of it is in this app).
- **[bimmer-lab/apps](https://github.com/bimmer-lab/apps)** — a map inside
  a cluster theme, and where BMW's map sits on the panel.
- **[ZEKAI-Design/ID7-Cluster-Themes](https://github.com/ZEKAI-Design/ID7-Cluster-Themes)**
  and **[NamelsMissing/mgu-apps](https://github.com/NamelsMissing/mgu-apps)**
  — app structure, signal catalogues and layout practice.
- The typefaces: **Saira**, **Chakra Petch**, **Michroma**, **Barlow
  Condensed**, **Barlow Semi Condensed** and **Inter Tight** (SIL Open Font
  License 1.1).

None of them is responsible for this app, and none endorses it.
