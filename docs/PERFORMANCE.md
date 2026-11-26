# What a frame costs

The cluster is smooth on the car for one reason: a frame asks very little
of the head unit. Every layer is an *effect layer* — a rectangle with a
small program the renderer's GPU runs by itself — so no pixels are ever
uploaded, and what crosses the renderer's socket after start-up is only
the handful of numbers that changed.

Features have been added in every release since the first public one
(0.9.1): electric gauges, a trim, a fuller window, diesel dials, a fourth
style, a BETA that enlarges the whole cluster. This page is the check that
none of them made a frame cost more — measured, not assumed — and what now
holds it there.

**In short**

- **Toro, M Sport and M Sport Plus, as they come, ask exactly what they
  asked in 0.9.1**: the same number of layers, the same bytes on the wire
  to the byte, the same shaders (44 of the 46 that existed are byte for
  byte the same; the other two are M Sport Plus's glass, 151 characters
  longer), the same processor time within the measurement's noise.
- **They now ask less of the GPU than they did**: the limiter's flash lay
  over the whole style and was drawn on every frame, lit or not — a
  quarter to a third of all the pixels the renderer filled. It is now not
  drawn unless the limiter is near. Nothing looks different (26 pictures
  compared with 0.9.6, pixel for pixel).
- **M Track Mode is the lightest style to draw.** As first built it was
  the heaviest of the M styles; its labels were then given boxes their own
  size.
- **The package is 13 % larger** than 0.9.6 (407 KB against 361 KB),
  nearly all of it M Track Mode: its code, its shaders and its symbols in
  the atlas.
  That is paid once, at start-up, not per frame.
- **The one thing that costs more is an option, off as it comes**: the
  BETA that lowers and enlarges the cluster draws 8 – 22 % more, because
  it is that much bigger.
- **The M styles' widest picture is the lightest of their windows.** With
  the picture open the plates are not drawn at all: a fifth fewer pixels
  than the same style with any other window, and 7 – 9 % less time to
  draw.

None of these times is the car's. The head unit's processor is several
times slower than the machine this ran on and its GPU is a real one, not a
software rasteriser; what carries over is the comparison — one version
against another, measured the same way — and the counts, which are exact.
**The last word is the car's**: if a style ever feels less smooth than it
did, that is worth reporting with the style and its settings.

## How it was measured

(The tools and the test named here are part of the app's source.)

| | What | With |
|---|---|---|
| The app's own frame | The readings smoothed, the state made, every layer's uniforms worked out, what changed sent: microseconds a frame over a 52 s simulated drive, the median of nine runs | `node --expose-gc tools/perf.js [checkout]` |
| The wire | Messages and bytes a frame through the renderer's own client, its socket counted | the same |
| What the renderer is asked to draw | Layers; the pixels the drawn ones cover, in screens (1920 × 720); the shaders' text | the same, and `test/budget.test.js` |
| The whole process | The app as installed, on the simulated car: its process's CPU time by the kernel's count, from the cluster coming up to the end of the drive | `tools/car-sim.js` (its "cost" line), three runs each |
| The drawing itself | The preview's frame driven flat out in a browser whose GL is a software rasteriser, so the time is the fragment shaders' work on every pixel: milliseconds a frame, the median of five batches of sixty | `node tools/perf-draw.js [checkout]`; `PERF_LAYERS=1` for each layer's share |

"0.9.1" below is the first public release (`waliworld/MGU-Styles2`, its
first commit) and the source it was built from; "now" is 0.10.0.

## The three styles that were there: nothing more is asked

Each style as it comes, driving:

| | Layers | On the wire, a frame | Sent at start-up | The app's frame | The whole process |
|---|---|---|---|---|---|
| Toro, 0.9.1 | 43 | 7.06 messages, 629 bytes (37 KB/s) | 172.8 KB | 43 µs | 5.5 % of a core |
| Toro, now | 43 | 7.06 messages, 629 bytes | 172.8 KB | 43 µs | 5.5 % |
| M Sport, 0.9.1 | 39 | 4.98 messages, 472 bytes (28 KB/s) | 160.0 KB | 33 µs | 4.7 % |
| M Sport, now | 39 | 4.98 messages, 472 bytes | 160.0 KB | 31 µs | 4.9 % |
| M Sport Plus, 0.9.1 | 39 | 4.98 messages, 472 bytes | 159.4 KB | 31 µs | 5.0 % |
| M Sport Plus, now | 39 | 4.98 messages, 472 bytes | 159.5 KB | 31 µs | 4.9 % |
| M Track Mode, now | 35 | 1.65 messages, 160 bytes (9 KB/s) | 140.3 KB | 28 µs | 5.3 % |

- The wire is the same to the byte (the limiter's flash now sends two
  small messages each time it comes and goes: 0.002 of a message a frame
  over the drive). All of it is a hundred times inside the 5,500 KB/s the
  renderer's socket is given for the whole head unit.
- Parked, a style sends **nothing**: no message at all, then and now.
- The processor figures are each the middle of five runs, old and new
  taken turn about. The runs of any one spread by up to a fifth (the app's
  frame, Toro: 37 – 46 µs for 0.9.1, 42 – 43 now; the whole process, Toro:
  5.1 – 5.7 % of a core for 0.9.1, 5.1 – 5.9 % now), and every pair
  overlaps: there is no difference to measure. "Of a core" is of this
  machine's.
- **Two things had crept into every frame since 0.9.1, and are out
  again.** Each was a fraction of a microsecond here, and found only by
  looking for it: the electric gauges (0.9.2) made two empty gauge objects
  a frame for every car, electric or not, and M Track Mode's readings as
  numbers, and the bookkeeping for its gliding marks, were made for every
  style. A car that is not electric now shares one empty gauge, the
  numbers are made only for the style that reads them, and the smoother's
  loop is the one 0.9.1 ran.
- With every setting at a new install's value the layer counts are 47, 43
  and 43 in both (the start-up message's four layers, which are not drawn
  once it has faded), and the wire is the same. One thing differs: since
  0.9.4 a new install trims 18 px of BMW's strip, so the background layer
  is 18 rows taller — under 1 % more pixels.

**The shaders.** Of the 46 that 0.9.1 sent, 44 are byte for byte what they
were — every one Toro and M Sport use as they come among them — and so is
the prelude they all share. The two that changed are M Sport Plus's glass
(`mpback`, `mpbackWide`): 151 characters for the hold that keeps a larger
window inside the car's picture when the style is lowered; as the style
comes it multiplies by exactly one. Twenty-four are new, and each is sent
only when what it draws is chosen: the fullest window and the widest, a
diesel's dial, M Sport's fading lines with a picture, M Track Mode, the
lowered flash.

## What the renderer draws: less than it did

The renderer fills every pixel of every layer that is drawn, whatever the
layer's program puts there. Measured in screens (1920 × 720) of pixels in
an ordinary frame:

| | 0.9.1 | now | |
|---|---|---|---|
| Toro | 4.02 | 3.12 | −22 % |
| M Sport | 2.86 | 1.96 | −31 % |
| M Sport Plus | 2.84 | 1.95 | −32 % |
| M Track Mode | (3.05 as first built) | 1.83 | −40 % |

Two things account for it, and neither changes a pixel of the picture:

1. **The limiter's flash is drawn only when there is something to
   flash.** It is a layer over the whole style. It used to be drawn on
   every frame with nothing in it — a whole screen of pixels run through
   its program and blended, to no effect. It is now hidden until the
   engine nears the limiter, exactly as a turn card, a gauge's alternate
   label or the start-up message is hidden when there is nothing to show:
   the same mechanism every style already relies on, on the car.
2. **M Track Mode's labels have boxes their own size.** The text shader
   looks at each of a layer's glyphs for every pixel of the layer. The
   gauge rows' figures stood in four layers each the size of all four rows
   (327 × 234 px); each row's now has its own (268 × 25). The rev counter's
   numerals and the strips' labels likewise. Three more layers, a third of
   the pixels.

And the time to draw a frame, in the software rasteriser (lower is
better; the map is a picture in the middle, or in M Track Mode's wing):

| | 0.9.1 | now | |
|---|---|---|---|
| Toro | 225.8 ms | 224.3 ms | −1 % |
| Toro, with a map | 230.9 | 229.1 | −1 % |
| M Sport | 76.9 | 68.8 | **−11 %** |
| M Sport, with a map | 81.2 | 73.6 | −9 % |
| M Sport Plus | 77.3 | 69.6 | **−10 %** |
| M Sport Plus, with a map | 81.7 | 73.9 | −10 % |
| M Track Mode | (94.6 as first built) | 50.5 | **−47 %** |
| M Track Mode, with a map | (71.1) | 50.0 | −30 % |
| M Sport at the limiter, flashing | | 69.3 | |

(These are milliseconds on a processor doing a GPU's work, which is why
they are large. Before the two changes above, "now" measured 227.6, 77.3,
78.2 against 0.9.1's 225.8, 76.9, 77.3: the same.)

The rows "with a map" include the preview's own stand-in for the car's
picture - one more layer, the size of the map slot, about 7 ms of each
figure. The car draws its own picture; a style's own layers take no
longer with it open than shut (`PERF_LAYERS=1` gives each layer's share).
Old and new were measured with the same stand-in, so the comparison
stands.

**Toro is three times the others to draw, and always was.** Where its
time goes, by layer: the dial's numerals 52 % (one layer the size of the
whole dial, for eight figures), the background 21 %, the dial's band 10 %,
the gear 5 %. It is what has been driven and called smooth, so nothing in
it was touched. If it is ever wanted lighter, the numerals are the place:
set in a few smaller layers they would cost a fraction — a change to a
style that works, to be made on purpose and tried on the car, not slipped
in.

## What costs more, and only when chosen

| Option (off as it comes) | What it adds |
|---|---|
| Holiday theme | Three layers (two of snow, the tree); the snow's place is sent 30 times a second |
| Start-up message | Four layers for its ten seconds; not drawn after |
| A picture in the middle | The same layers, and no more to draw: the glass and the plates work out the window instead of being whole. (The 5 – 7 ms that "with a map" adds in the table above is the preview's stand-in picture, not the style.) In M Track Mode the gauge rows are not drawn then |
| **The widest picture** (M Sport, M Sport Plus) | The same 39 layers, the same bytes on the wire. With the picture open, three of them are not drawn - M Sport's two plate layers and its two lines, M Sport Plus's three plate layers: **31 layers drawn against 34, 1.54 screens of pixels against 1.96** (M Sport Plus: 1.56 against 1.95). To draw, with the same stand-in picture: M Sport 69.8 ms against 74.9 with its standard window and 75.1 with *More*; M Sport Plus 69.8 against 76.7 standard and 75.8 *Fullest*. Its glass works out more than the standard one (a field and four pads: about 3 ms more in this rasteriser), which the plates not being drawn pays for twice over. Shut, it draws what the style draws as it comes |
| M Track Mode: the picture over the whole wing | The same 35 layers in another place: 48.7 ms against 48.9 with the style where it stands |
| Shift now at (Auto or an rpm), and the cold-engine guard | No more layers. While the revs are past the shift point the speed and the gear blink four times a second (their colours sent); the cold guard's red zone is sent with the rev dial it is part of. Over the budget's drive, Shift now at Auto: Toro 7.21 messages and 641 bytes a frame against 7.06 and 628, M Sport and M Sport Plus 5.14 and 491 against 4.98 and 472, M Track Mode 1.82 and 178 against 1.65 and 159; the cold guard on as well, 0.02 messages more |

With everything on at once — lowered, holiday, start-up message, a
picture, the limiter flashing — the most any style has is 56 layers, of
the renderer's 64.

## The package

| | 0.9.1 | 0.9.6 | 0.10.0 |
|---|---|---|---|
| As the Store fetches it (tar.gz) | 357 KB | 361 KB | 407 KB |
| Files, installed | 621 KB | 636 KB | 730 KB |
| — the glyph atlas | 373 | 373 | 413 |
| — the styles and their geometry | 58 | 62 | 89 |
| — the shaders | 58 | 61 | 77 |
| — icon, manifest, notice | 51 | 57 | 66 |
| — the service and the page | 52 | 55 | 57 |
| — the renderer's client (upstream's) | 28 | 28 | 28 |

The 13 % since 0.9.6 is M Track Mode, all but a little (the lowered
cluster, and - 1.5 KB of it - the M styles' widest picture, M Track
Mode's second fit and their settings): its layout and measured geometry,
its eight shaders, its gear letters and nine symbols in the atlas (which
is the same 1024 × 1024 texture on the GPU as before: the new glyphs went
into rows that were empty), and its settings in the manifest. It is read
once when the app starts — on the simulated car, start-up took the same
0.15 – 0.20 s of processor time in both — and a style that is not on the
cluster sends none of its shaders and costs no frame anything.

The start-up message in the owner's own words (AK 0.20.0) with letters the atlas has not - Korean - adds them under
it, made on the head unit from its own Korean font: only the message's letters (at most 64), about 46 rows for 22 of
them, so 1024 × 1072 to 1024 × 1168 on the GPU (48 to 144 KB more) for as long as that message is chosen, and
about 0.1 s of processor time here (a few times that on the head unit) at the start and when the words change. Any
other message, and no message, leaves the atlas as it is.

## How it is held

`test/budget.test.js` runs with every `npm test`. For each style as it
comes it drives the car's own driver through the renderer's own client
over the same simulated drive and fails if the style has more layers,
covers more of the screen, sends more messages or more bytes a frame, or
more at start-up, than the figures above — and separately checks that
none of those is more than 0.9.1's. It also holds that a parked style
sends nothing, that the flash is not drawn below the limiter, that the
lowered option adds no more than its scale accounts for, and that the
widest picture, open, has the renderer draw less than the standard window
does.

So a feature that needs more than the budget has to be an option that is
off as it comes, and say here what it costs.

## What this cannot tell

- **The car's own timing.** Nothing here ran on the head unit's processor
  or the cluster's GPU. A GPU does not share out its time the way a
  software rasteriser does: a simple shader over many pixels and a complex
  one over few can swap places. The direction of every change above
  (fewer pixels, the same programs) is one that helps on any GPU.
- **Other things the head unit is doing** — navigation, CarPlay, a camera
  — which share its processor and GPU with the cluster.
- **BMW's own renderer**: how `cluster-render` schedules its layers is
  upstream's. What is sent to it is what was measured.
