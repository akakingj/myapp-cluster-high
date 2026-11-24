# Readings from the engine unit

Six readings a style can show are not on the head unit's bus: **oil
pressure**, the **intake air's temperature**, the **battery's voltage**, the
**accelerator pedal**, the **throttle's opening** and the **ignition
angle**.
AK Cluster ID8 asks the engine unit for them itself, on every head unit —
and for **boost**, on a car whose Sport Display sends none. There is no
setting for it, and nothing is taken from BeeM-Flash: its feed is not looked
at, whether it is on the head unit or not (AK 0.13.0).

## What "asked" means

- **Read only.** The link is the MGU App Kit's read-only one
  (`kit/runtime/readonly-diag.js`): it lets through UDS `22`
  (ReadDataByIdentifier) and OBD `01` / `09` and refuses everything else —
  sessions, resets, clearing faults, security access, writes, routines —
  before a request leaves the head unit. Nothing in MGU Styles could write
  to the car if it tried.
- **One unit:** the engine unit (DME, address `0x12`). One request at a
  time, each waiting at most 0.6 s.
- **Only with the engine running**, a style on the cluster and the car
  on. Never parked, where requests would keep the car's networks awake;
  never with the ignition on and the engine off, which is when a control
  unit is coded or flashed. (An engine stopped by auto start-stop is still
  asked, for up to three minutes: the car is in drive readiness then, and a
  gauge that went blank at every traffic light would be no gauge.)
- **Only what is shown.** Toro's left gauges want oil pressure; an M
  style's footer, M Track Mode's rows and strips and Toro's side gauges
  want whatever they hold. A reading no style is showing is never asked.
- **Lightly:** oil pressure twice a second, intake air every 2 s, battery
  every 5 s, boost four times a second (and only while the Sport Display
  gives none), the accelerator pedal and the throttle four times a second,
  the ignition angle twice, ambient pressure once a minute. A reading that gets no
  answer three times is asked once a minute from then on. In the simulated
  car that is 2 requests a second for Toro, under 1 for an M style with
  intake air and the battery in its footer, and 6 with boost as well.

The app's page says what is happening on the CLUSTER tab's *Readings* row:
*Engine unit: oil pressure, intake air*, *read while the engine runs*,
*no answer*, *no diagnostic link*.

## The identifiers, and where each is published

Every identifier MGU Styles asks is one the open projects this app is built
on already publish, and reads in their own code. **None is taken from
BeeM-Flash's own tables**; what BeeM-Flash has worked out for itself stays
in BeeM-Flash. `test/engine.test.js` fails if `src/car/engine.js` asks for
an identifier that is not in this table, or if the table lists one the code
does not ask.

OBD identifiers are OBD-II service 01 PIDs (SAE J1979), a public standard;
`F4xx` is the same PID read through UDS.

| Reading | Identifier | How it is read | Published in |
|---|---|---|---|
| Oil pressure, absolute | `DID 4436` | 2 bytes, hPa | ZEKAI-Design/ID7-Cluster-Themes `apps/zekai_cluster_themes/engine-readings.js`; cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `DID 586F` | 2 bytes, signed, hPa | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| Ambient pressure (what oil pressure is taken over) | `DID 4201` | 2 bytes × 0.0390625, hPa | ZEKAI-Design/ID7-Cluster-Themes `apps/zekai_cluster_themes/engine-readings.js`; cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `DID F433` | 1 byte, kPa | ALMSTRA/idv7lol `apps/idv7lol/vehicle.js` |
| | `OBD 33` | 1 byte, kPa | SAE J1979; ALMSTRA/idv7lol `apps/idv7lol/vehicle.js`; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js` |
| Intake air temperature | `DID 580F` | 1 byte × 0.75 − 48, °C | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `DID F40F` | 1 byte − 40, °C | MGU App Kit `kit/runtime/dids.js` (its own example) |
| | `OBD 0F` | 1 byte − 40, °C | SAE J1979; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js`, `apps/live_data/useful.js` |
| Battery voltage | `DID 5853` | 2 bytes × 0.001, V | ZEKAI-Design/ID7-Cluster-Themes `apps/zekai_cluster_themes/engine-readings.js`; cauliflowermossgrape/idrive7-apps `apps/redline/electrical.js`, `apps/live_data/useful.js` |
| | `DID F442` | 2 bytes × 0.001, V | cauliflowermossgrape/idrive7-apps `apps/redline/electrical.js` |
| | `OBD 42` | 2 bytes × 0.001, V | SAE J1979; cauliflowermossgrape/idrive7-apps `apps/redline/electrical.js`, `apps/live_data/std.js` |
| Boost, absolute | `DID 580B` | 2 bytes × 0.00390625, kPa | ALMSTRA/idv7lol `apps/idv7lol/vehicle.js` |
| | `DID F470` | 2 bytes from the 4th × 0.03125, kPa | ALMSTRA/idv7lol `apps/idv7lol/vehicle.js` |
| | `OBD 70` | 2 bytes from the 4th × 0.03125, kPa | SAE J1979; ALMSTRA/idv7lol `apps/idv7lol/vehicle.js` |
| | `OBD 0B` | 1 byte, kPa | SAE J1979; ALMSTRA/idv7lol `apps/idv7lol/vehicle.js`; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js` |
| Accelerator pedal, normalised | `DID 5814` | 2 bytes, signed × 0.01220703, % | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `DID 480B` | 2 bytes, signed × 0.01220703, % | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `OBD 49` | 1 byte × 100 / 255, % | SAE J1979; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js`, `apps/live_data/useful.js` |
| Throttle opening, from its lower stop | `DID 4600` | 2 bytes, signed × 0.0078125, % | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `DID 5858` | 2 bytes, signed × 0.0078125, % | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `OBD 11` | 1 byte × 100 / 255, % | SAE J1979; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js`, `apps/live_data/useful.js` |
| Ignition angle | `DID 59FA` | 1 byte, signed × 0.75, degrees before top dead centre | cauliflowermossgrape/idrive7-apps `apps/live_data/useful.js`, `apps/live_data/builtin/DME8FF_R.json` |
| | `OBD 0E` | 1 byte × 0.5 − 64, degrees before top dead centre | SAE J1979; cauliflowermossgrape/idrive7-apps `apps/live_data/std.js`, `apps/live_data/useful.js` |

(Read at ALMSTRA/idv7lol `58e2418`, cauliflowermossgrape/idrive7-apps
`a948390`, ZEKAI-Design/ID7-Cluster-Themes `8a4f72f`, November 2026. The
catalogue `DME8FF_R.json` names its own source, a public description of
BMW's diagnostic tables for the DME 8 engine units — B58, B48, B38.)

Each reading has its identifiers tried in that order; the first that
answers with a plausible number is kept and asked first from then on. A
number outside the plausible range is not shown: oil pressure 0 – 20 bar
over ambient, intake air −45 – 150 °C, battery 5 – 18 V, the pedal and the
throttle −2 – 102 % (shown 0 – 100 %), the ignition angle −40 – 70 °.

**Oil pressure** is the absolute reading less the engine unit's own
ambient pressure — what the pump makes — as both upstream projects compute
it. Without an ambient reading there is no figure, rather than one taken
over a guessed barometer. **Boost** is the absolute reading less the
barometer (101.3 kPa until the engine unit has told us its own), and is
used only while the car's Sport Display sends no boost of its own.

## A diesel

With *GENERAL → Engine → Diesel* the engine unit is asked **only the
standard identifiers** in the table: the OBD ones and their `F4xx` forms.
A diesel's engine unit is a DDE, not the DME 8 the BMW identifiers belong
to, and what a DDE answers to `4436`, `586F`, `4201`, `580F`, `5853`,
`580B`, `5814`, `480B`, `4600`, `5858` or `59FA` is published in none of the projects above: a number in the right
range would be shown as a reading whatever it really was. The standard
PIDs mean the same on every engine.

What a diesel is asked, each from the table above:

- **Oil pressure**: nothing. There is no standard identifier for it;
  Toro's left gauge shows turbo pressure.
- **Ambient pressure and the barometer**: `DID F433`, then `OBD 33`.
- **Intake air temperature**: `DID F40F`, then `OBD 0F`.
- **Battery voltage**: `DID F442`, then `OBD 42`.
- **Boost, absolute**: `DID F470`, then `OBD 70`, then `OBD 0B`.
- **Accelerator pedal**: `OBD 49`. **Throttle**: `OBD 11`. **Ignition
  angle**: `OBD 0E` (a diesel has none to give).

Everything else is as for a petrol car: only while the engine runs, only
what a style shows, one request at a time. Changing *Engine* drops what was read and starts
again. `test/diesel.test.js` holds this against the kit's own diagnostic
stack, with an engine unit that answers the BMW identifiers with figures
that would pass for readings; so does the simulated car
(`CAR_SIM_DIESEL=1`).

## What is not known

- **None of this has been read on the project's car yet.** The decoding is
  the upstream projects'; whether this car's engine unit answers each
  identifier is for the car to say. A reading it does not answer shows
  dashes (or, for Toro's left gauge, turbo pressure as before).
- Other engines (S58, hybrids) may answer only the OBD forms, or none: the
  BMW identifiers above are the DME 8's. **A diesel** is asked only the
  standard forms once *Engine* is set to *Diesel* (above); left on
  *Petrol*, a diesel's engine unit would be asked the DME 8's first, as any
  car is. Whether a diesel's unit answers the standard forms through this
  link is not known: no diesel has run it.
- Whether asking twice a second is noticed anywhere else. Upstream apps ask
  the same unit more often than this; if anything seems off, a style that
  shows none of these readings asks nothing.
