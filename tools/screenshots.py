#!/usr/bin/env python3
"""
Takes the program's pictures, as the docs show them.

  python3 tools/screenshots.py [--jobs 4] [--only NAME[,NAME...]] [--gallery]
  npm run screenshots

As it comes it draws the pictures the README and docs/*.md show
(docs/screenshots/<name>.png): the ones the repository keeps. --gallery draws
every style, option and screen as well, with docs/GALLERY.md (which lists
every picture with the preview address that draws it, so each can be opened
live) and the comparisons in docs/img: for looking at, not for committing.
Run it again after changing how anything looks; nothing here is edited by hand.

Two kinds of picture:

  the cluster    the WebGL preview (preview/index.html, through
                 tools/shot.js), cut to the 1920 x 646 the styles are drawn
                 in: the 74 rows under it are the car's own strip. One
                 screenshot pixel is one pixel of the panel. The pictures
                 about that strip (how much of it shows, the M footer) keep
                 all 720 rows, with a stand-in for BMW's strip drawn under
                 ours (bmwStrip=on) so what is covered can be seen.
  the app page   what MGU Styles shows on the iDrive screen, drawn by the
                 app itself with the kit's software canvas
                 (tools/page-shot.js): the whole 1920 x 720 screen.

The drive is the preview's own simulated one, frozen at a moment (t=9: 56
mph, fourth, 5,500 rpm; t=0: parked), so the pictures come out the same
every time. The map and the camera picture in the middle are the preview's
stand-ins, and so is BMW's strip: there is no phone, camera or car here.

With --gallery it also refreshes the comparison pictures in docs/img that the measurement
notes use (the M styles against their reference pictures), by running
tools/m-compare.py, tools/m-plus-compare.py and tools/mt-compare.py; those
need scipy as well, and are skipped with a note if it is missing.

Needs Python with Pillow, Node with Playwright (as `npm test` does), and for
the captions on the sheets the fonts of `npm run fonts` (without them a
plain face is used).
"""
import argparse
import concurrent.futures
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "screenshots"
TMP = ROOT / "build" / "screenshots"
PANEL = (0, 0, 1920, 646)           # what a style is drawn in, of the 1920 x 720 panel
FOOT = (0, 500, 1920, 720)          # the foot of the panel: a style's last rows and the car's strip

DRIVE = "t=9&freeze=1&strip=off"
PARKED = "t=0&freeze=1&strip=off"
REVS = "t=5&freeze=1&strip=off&rpm=6500"
M = "&style=track&clock12=on"
MP = "&style=mplus&clock12=on"
MT = "&style=mtrack"                # M Track Mode
STRIP = "&bmwStrip=on"              # a stand-in for the car's own bottom strip, under ours
MAP = "&centre=waze&show=map"       # the middle open over a stand-in map
CAMERA = "&centre=camera&show=camera"   # ... over a stand-in camera picture
DAY = "&centre=waze&show=day"       # ... over the same map by day: the hardest ground for a white readout
DIESEL = "&engine=diesel"           # General: Engine: Diesel

BG, INK, DIM = (7, 11, 17), (232, 240, 246), (141, 154, 166)

# ------------------------------------------------------------------ the catalogue
# single pictures: name, title, what it shows, preview query
SINGLES = [
    ("designs", "The six designs", [
        ("toro-genuine", "Toro — genuine Huracan",
         "The Lamborghini dial with its hollow gear numeral, wedge gauges either side, boost level with the speed "
         "and the G meter between.", DRIVE),
        ("toro-modern", "Toro — modern hex lattice",
         "The same instruments over a lattice of hexagons, its joints lit in the accent colour.",
         DRIVE + "&background=modern"),
        ("toro-revuelto", "Toro — Revuelto",
         "The Revuelto's Y lights sweeping in from both sides.", DRIVE + "&background=revuelto"),
        ("m-sport", "M Sport",
         "BMW M's iDrive 8 M View, rebuilt line for line from a photograph: blue speed dial, red rev dial, "
         "both speeds, fuel and oil strips.", DRIVE + M),
        ("m-sport-plus", "M Sport Plus",
         "The same dials round the M stripes; the scale numbers grow as the needle passes them.", DRIVE + MP),
        ("m-track", "M Track Mode",
         "BMW M's track view, rebuilt from a photograph: four gauge rows in a pointed blue wing, the gear on a "
         "black band with the speed under it, a leaning rev counter, oil and fuel as ladders beside it.",
         DRIVE + MT),
    ]),
    ("parked", "Parked", [
        ("toro-parked", "Toro, parked", "Engine idling, in P.", PARKED),
        ("m-sport-parked", "M Sport, parked", "0 mph, 0 km/h, P.", PARKED + M),
        ("m-sport-plus-parked", "M Sport Plus, parked",
         "With no map up, the stripes and the lattice are the middle.", PARKED + MP),
        ("m-track-parked", "M Track Mode, parked",
         "Idling in P: the marker low on the rev counter, a mark on each gauge row at its reading.", PARKED + MT),
    ]),
    ("centre", "The middle: the phone's map, BMW's map, the camera, the next turn", [
        ("toro-waze", "Toro with a map in the middle",
         "Toro opens its background behind the dial over the cluster's map slot. Whatever the car has there "
         "shows: the phone's map (Waze, Apple or Google Maps, from Maps on cluster) or BMW's own map view.",
         DRIVE + MAP),
        ("toro-camera", "Toro with Turn View's camera",
         "The same opening over the front camera (a test picture here).", DRIVE + CAMERA),
        ("m-sport-waze", "M Sport with a map in the middle",
         "The two inner plates thin out and the middle opens as a V, wide at the top, the two fine centre "
         "lines still over it.", DRIVE + M + MAP),
        ("m-sport-camera", "M Sport with Turn View's camera",
         "The same V over the camera.", DRIVE + M + CAMERA),
        ("m-sport-plus-waze", "M Sport Plus with a map in the middle",
         "A wide band across the centre plate and the two to its right, fading out a long way at both ends: "
         "no edge anywhere.", DRIVE + MP + MAP),
        ("m-sport-plus-camera", "M Sport Plus with Turn View's camera",
         "The same band over the camera.", DRIVE + MP + CAMERA),
        ("m-sport-turn", "M Sport, next turn",
         "The turn card (from Turn View's route), here in metric units.", DRIVE + M + "&units=metric&turn=left"),
        ("m-sport-plus-turn", "M Sport Plus, next turn",
         "The stripes stand back so the card reads over them.", DRIVE + MP + "&units=metric&turn=roundabout"),
        ("m-track-waze", "M Track Mode with a map in its left wing",
         "The picture takes the wing, to its point, and nothing else: the four gauge rows give way to it, the "
         "M bands and the fine lines stay over it, and everything right of the first seam is untouched. With "
         "a picture chosen the style stands 193 px further right, so that the car's picture reaches the wing's "
         "point.", DRIVE + MT + MAP),
        ("m-track-camera", "M Track Mode with Turn View's camera",
         "The same wing over the camera.", DRIVE + MT + CAMERA),
    ]),
    ("limits", "At the limiter, and in metric", [
        ("toro-limiter", "Toro on the limiter",
         "The shift lights full and firing in bursts, the screen's edges flashing; on the car the whole cluster "
         "shakes in step.", "t=3&freeze=1&strip=off&rpm=7000"),
        ("m-sport-limiter", "M Sport on the limiter",
         "The red band flashes and the screen's edges with it.", "t=3.07&freeze=1&strip=off&rpm=7000" + M),
        ("m-sport-metric", "M Sport in km/h and °C",
         "The speed scale runs 0 – 330 km/h, uneven above 150 as on the car; mph moves underneath.",
         DRIVE + M + "&units=metric"),
        ("m-track-limiter", "M Track Mode on the limiter",
         "The lit band flashes and the screen's edges with it; the fine strip beside the rail is the red field, "
         "from the redline to the top of the scale.", "t=3.07&freeze=1&strip=off&rpm=7000" + MT),
        ("m-track-metric", "M Track Mode in km/h, bar and °C",
         "The frame's own units: 0.0 - 1.9 bar, 70 - 130, 50 - 150 and -20 - 50 °C.", DRIVE + MT + "&units=metric"),
    ]),
    ("extras", "Extras", [
        ("startup-message", "The start-up message",
         "Shown for 6 – 20 seconds when the car starts, then fading slowly into the cluster. The words are a "
         "setting, or your own from a text file.", DRIVE + "&intro=on&since=4"),
    ]),
]

# sheets: name, title, what it shows, columns, tile width, crop (or None), tiles (label, note, query)
ACCENTS = [("arancio", "Arancio"), ("giallo", "Giallo"), ("rosso", "Rosso"), ("verde", "Verde"),
           ("blu", "Blu"), ("viola", "Viola"), ("magenta", "Magenta"), ("bianco", "Bianco")]
SHEETS = [
    ("toro-colours", "Toro: colours and looks",
     "The eight accent colours, and four more ways to set the look.", 3, 624, None,
     [(name, "accent colour", DRIVE + "&accent=" + key) for key, name in ACCENTS] + [
         ("Match the interior light", "follows the car's ambient colour (here green)", DRIVE + "&ambient=20FF80"),
         ("Colour on everything", "gear and labels too (blu)", DRIVE + "&accent=blu&accentScope=full"),
         ("Filled number at the needle", "instead of the outline (giallo)", DRIVE + "&accent=giallo&numeralFill=on"),
         ("Lattice in the accent", "modern background, verde", DRIVE + "&background=modern&accent=verde&hexTint=1"),
     ]),
    ("toro-shift-lights", "Toro: shift lights",
     "Three kinds, and what the first does on the limiter.", 2, 944, (300, 0, 1620, 300),
     [("Lamborghini", "blades closing on a hex core", REVS),
      ("GT3", "a row of LEDs, green to red", REVS + "&shiftStyle=gt3"),
      ("Single blade", "one bar filling from the left", REVS + "&shiftStyle=blade"),
      ("On the limiter", "full, firing in bursts, edges flashing", "t=3&freeze=1&strip=off&rpm=7000")]),
    ("holiday", "Holiday theme",
     "Snow falling slowly down both sides, near flakes larger and faster than far ones, and a tree in a clean "
     "corner, in every style.", 3, 624, None,
     [("Toro", "", DRIVE + "&holiday=on"),
      ("M Sport", "", DRIVE + M + "&holiday=on"),
      ("M Sport Plus", "", DRIVE + MP + "&holiday=on"),
      ("M Track Mode", "", DRIVE + MT + "&holiday=on")]),
    ("m-footer-panel", "M styles: the footer panel",
     "The car does not report its drive, so what the panel says is a setting.", 4, 464, (700, 546, 1220, 646),
     [("4WD", "", DRIVE + M),
      ("2WD", "", DRIVE + M + "&mPanel=2wd"),
      ("The driving mode", "BMW's own name for it", DRIVE + M + "&mPanel=mode&drive=SPORT"),
      ("Nothing", "", DRIVE + M + "&mPanel=off")]),
    ("strip", "BMW's bottom strip: On or Off",
     "The foot of the panel, all 720 rows, with a stand-in for the car's own strip under the style (hatched: "
     "the rows between a style and the strip's figures, where the rest of BMW's own cluster shows on the "
     "car). On trims those rows by 18 px; Off hides the strip: all of it but BMW's own gear letter, which has "
     "to stay in view (cover it and the cluster draws a black box in the rev dial).",
     1, 1280, FOOT,
     [("On", "18 px trimmed: the row above the gear's own", DRIVE + M + STRIP + "&bottomExtra=18"),
      ("Off", "BMW's gear letter is all that is left; warning lamps still show over the covers",
       DRIVE + M + STRIP + "&bottomExtra=hide"),
      ("Off, in Toro", "the same rule in every style", DRIVE + STRIP + "&bottomExtra=hide")]),
    ("lowered", "BETA: the cluster lowered, and larger by as much",
     "With BMW's strip hidden, the rows it stood in hold nothing but black (left). Lowered 20 px (right) the "
     "whole style is drawn into them: its foot 20 rows further down and all of it 3 % larger, about the top of "
     "the screen's middle - the same picture, bigger. BMW's gear letter stays where it is: nothing is ever "
     "drawn in its columns. All 720 rows are shown, over a stand-in for the car's strip.",
     2, 944, (0, 0, 1920, 720),
     [("Toro, the strip hidden", "", DRIVE + STRIP + "&bottomExtra=hide"),
      ("Toro, 20 px lower: 3 % larger", "", DRIVE + STRIP + "&lower=20"),
      ("M Sport, the strip hidden", "", DRIVE + M + STRIP + "&bottomExtra=hide"),
      ("M Sport, 20 px lower: 3 % larger", "", DRIVE + M + STRIP + "&lower=20"),
      ("M Sport Plus, the strip hidden", "the fullest picture", DRIVE + MP + STRIP + MAP + "&centreSize=most&bottomExtra=hide"),
      ("M Sport Plus, 20 px lower", "the picture is the car's: it stays the size it is", DRIVE + MP + STRIP + MAP + "&centreSize=most&lower=20"),
      ("M Track Mode, the strip hidden", "", DRIVE + MT + STRIP + "&bottomExtra=hide"),
      ("M Track Mode, 20 px lower", "", DRIVE + MT + STRIP + "&lower=20")]),
    ("toro-opening", "Toro: how much of the picture shows",
     "The opening behind the dial in its three sizes, over a map by night and by day. The larger two are the "
     "inside of the dial: they stop short of the band, so its numbers keep the dark they are drawn on, and "
     "above the G meter, the boost and the speed.", 3, 624, (330, 40, 1590, 646),
     [("Standard", "a lens of it behind the gear, as every release has had", DRIVE + MAP),
      ("More", "the inside of the dial, soft at the edge", DRIVE + MAP + "&centreSize=more"),
      ("Most", "all of the inside of the dial", DRIVE + MAP + "&centreSize=most"),
      ("Standard, by day", "", DRIVE + DAY),
      ("More, by day", "", DRIVE + DAY + "&centreSize=more"),
      ("Most, by day", "the band and every white figure still on dark", DRIVE + DAY + "&centreSize=most")]),
    ("toro-gear", "Toro: the gear numeral",
     "Three ways to draw it - a fine outline, a heavy one, or bold - and three places: the middle of the dial "
     "or, at half the height, a corner of its foot: above the boost gauge, or above the speed. In a corner it "
     "leaves the middle to the picture.",
     3, 624, (330, 40, 1590, 646),
     [("Outline, in the middle", "as it comes: the Huracan's own", DRIVE),
      ("Heavy outline", "as the first versions of this style drew it", DRIVE + "&gearFill=heavy"),
      ("Bold", "filled in its colour", DRIVE + "&gearFill=filled"),
      ("Left corner", "above the boost gauge", DRIVE + "&gearPlace=left"),
      ("Right corner, bold", "above the speed", DRIVE + "&gearPlace=right&gearFill=filled"),
      ("Left corner, bold, the largest opening", "the whole dome is the map's", DRIVE + DAY + "&gearPlace=left&gearFill=filled&centreSize=most")]),
    ("m-centre-size", "M styles: how much of the picture shows",
     "Each M style's window as it comes, and its larger one. M Sport: the V clear almost to its edge, and "
     "a band across the top over the plate above the speed and the plate above the gear. M Sport Plus: the "
     "same band at full strength to its edges and well into the plates by the gear, and the plate above the "
     "speed. In both the black bars the speed and the gear are written in stay shut. M Sport Plus also has "
     "Fullest: one smooth picture across the middle. (Both have Widest as well: the next sheet.)",
     2, 944, (250, 40, 1670, 600),
     [("M Sport, standard", "", DRIVE + M + DAY),
      ("M Sport, more", "", DRIVE + M + DAY + "&centreSize=more"),
      ("M Sport Plus, standard", "", DRIVE + MP + DAY),
      ("M Sport Plus, more", "", DRIVE + MP + DAY + "&centreSize=more"),
      ("M Sport Plus, fullest", "one blended picture: the spot between the plates filled, soft at every edge, "
       "further down", DRIVE + MP + DAY + "&centreSize=most"),
      ("M Sport Plus, fullest, by night", "", DRIVE + MP + MAP + "&centreSize=most"),
      ("M Sport, more, with the camera", "", DRIVE + M + CAMERA + "&centreSize=more"),
      ("M Sport Plus, fullest, one speed and no gear", "the pads round the figures follow what is shown",
       DRIVE + MP + CAMERA + "&centreSize=most&speed2=off&mGear=off")]),
    ("m-widest", "M styles: the widest picture",
     "Centre picture: how much shows: Widest, in M Sport and M Sport Plus. All of the car's picture, not a "
     "shape cut in the style: the glass opens over the picture's whole rectangle and fades out at all four "
     "edges, and the plates make way while it shows. The speeds, the gear's place and the fuel and oil strips "
     "each keep a soft-edged pad of dark glass, no larger than what is shown there. With no picture the "
     "style is whole.",
     2, 944, (250, 40, 1670, 600),
     [("M Sport, widest, by day", "55 % of the car's picture, where More shows 36 %", DRIVE + M + DAY + "&centreSize=full"),
      ("M Sport Plus, widest, by day", "", DRIVE + MP + DAY + "&centreSize=full"),
      ("M Sport, by night", "", DRIVE + M + MAP + "&centreSize=full"),
      ("M Sport Plus, over Turn View's camera", "", DRIVE + MP + CAMERA + "&centreSize=full"),
      ("One speed, the revs in the gear's place", "the pads follow what is shown",
       DRIVE + M + DAY + "&centreSize=full&speed2=off&mGear=rpm"),
      ("One speed, nothing in the gear's place", "", DRIVE + MP + DAY + "&centreSize=full&speed2=off&mGear=off"),
      ("The picture coming up", "four tenths open: the plates make way as it comes", DRIVE + M + DAY + "&centreSize=full&open=0.4"),
      ("No picture", "the style whole, as with any other size", DRIVE + MP + "&centre=waze&centreSize=full")]),
    ("startup-sequence", "The start-up message, from the first frame to the last",
     "The screen is dark from the first frame. The words come up on it over 1.2 s, stay until the time set "
     "(10 s as it comes) and fade over 2.8 s; the dark behind them starts to thin 1.2 s after they do, so the "
     "cluster comes up through the last of the words and is clear 1.2 s after they have gone. (Until 0.10.0 "
     "the dark fell away for about a second just after it came up: the second picture then had the cluster "
     "behind the half-faded words.)",
     3, 624, PANEL,
     [("0.3 s", "dark; the words beginning", DRIVE + M + "&intro=on&since=0.3"),
      ("0.9 s", "the words coming up, on the dark", DRIVE + M + "&intro=on&since=0.9"),
      ("5 s", "the message", DRIVE + M + "&intro=on&since=5"),
      ("11.6 s", "the words fading; the dark begins to thin", DRIVE + M + "&intro=on&since=11.6"),
      ("12.4 s", "the cluster coming up through the last of the words", DRIVE + M + "&intro=on&since=12.4"),
      ("13.4 s", "the words gone; the last of the dark", DRIVE + M + "&intro=on&since=13.4")]),
    ("m-lines", "M Sport: the two centre lines and a picture",
     "The M View's two fine lines run through the middle of its window. Where a picture shows they fade out "
     "with the glass and the plates, so nothing of the style crosses a map; their feet, under the window, "
     "still run into the rails. \"Keep them over the picture\" is the setting that brings them back.",
     2, 944, (250, 40, 1670, 600),
     [("Fade out where the picture shows", "as it comes", DRIVE + M + DAY),
      ("Keep them over the picture", "as it was up to 0.9.5", DRIVE + M + DAY + "&mLines=keep"),
      ("Fade out, the larger window", "", DRIVE + M + DAY + "&centreSize=more"),
      ("The window half open", "the lines thin out as it opens, with the plates", DRIVE + M + MAP + "&open=0.5")]),
    ("diesel", "A diesel: the rev counter to 6,000",
     "General: Engine: Diesel (petrol as it comes). A diesel's engine speed is read exactly as a petrol's; "
     "what it needs is its own range. The rev counter reads 0 - 6 in every style, red from 4,500 and the "
     "limit at 5,000, so the red field, the shift lights and the limiter's flash are within a diesel's reach.",
     2, 944, PANEL,
     [("Toro, 3,000 rpm", "half-way round a dial marked 1 to 6", DRIVE + DIESEL + "&rpm=3000"),
      ("Toro, at a diesel's limit", "the shift lights, the red zone and the flash, at 5,000",
       DRIVE + DIESEL + "&rpm=5000"),
      ("M Sport, 3,000 rpm", "seven numerals over the dial's whole height", DRIVE + M + DIESEL + "&rpm=3000"),
      ("M Sport Plus, 4,400 rpm", "the pale field just before the red, which begins at 4,500",
       DRIVE + MP + DIESEL + "&rpm=4400"),
      ("M Track Mode, 3,000 rpm", "seven marks spread evenly over the same height", DRIVE + MT + DIESEL + "&rpm=3000"),
      ("M Track Mode, at a diesel's limit", "the red field from 4,500, the flash at 5,000",
       DRIVE + MT + DIESEL + "&rpm=5000")]),
    ("m-track-rows", "M Track Mode: the gauge rows",
     "Each of the four rows shows the reading chosen for it - BMW's own four as it comes - or is left out. "
     "The reading is a mark on the rail, as the frame the style is traced from has it; the other way dims the "
     "rail past the mark, so a row reads as a bar. (The left wing.)", 2, 944, (190, 110, 930, 560),
     [("As BMW's", "boost, coolant, oil and intake air; each reading a mark on its rail", DRIVE + MT),
      ("As a bar", "the rail past the mark dimmed", DRIVE + MT + "&rowMark=fill"),
      ("In bar and °C", "the frame's own scales", DRIVE + MT + "&units=metric"),
      ("Other readings", "oil pressure, the battery, oil and coolant; as bars",
       DRIVE + MT + "&row1=oilp&row2=volts&row3=oil&row4=coolant&rowMark=fill"),
      ("An electric car's", "the drive battery's charge and temperature, the other rows left out",
       DRIVE + MT + "&electric=bev&units=metric"),
      ("Two rows", "the others left out", DRIVE + MT + "&row2=off&row4=off")]),
    ("m-track-wing", "M Track Mode: a picture in the left wing",
     "Chosen in its settings, the wing holds the phone's map, BMW's own or Turn View's camera in place of the "
     "gauges - there and nowhere else. The picture is the car's own map slot, which cannot be moved and has "
     "nothing left of x 416, so with a picture chosen the style stands 193 px further right - the same size - "
     "and the picture fills the wing to its point, soft at every edge. \"The style stays where it is\" is "
     "the other setting: the picture then starts part way along the wing.", 2, 944, PANEL,
     [("The gauges", "as it comes: the style where the frame has it", DRIVE + MT),
      ("A map, by night", "the whole wing, to its point", DRIVE + MT + MAP),
      ("A map, by day", "the bands and the fine lines stay over it", DRIVE + MT + DAY),
      ("Turn View's camera", "", DRIVE + MT + CAMERA),
      ("The style stays where it is", "the other setting: the picture begins where the gauge rows did",
       DRIVE + MT + DAY + "&wing=slot"),
      ("Opening", "half way: the rows fading out as the picture comes up", DRIVE + MT + MAP + "&open=0.5"),
      ("BMW's strip hidden", "the footer's places given other readings",
       DRIVE + MT + MAP + STRIP + "&bottomExtra=hide&footL=rpm&footM=economy&footR=iat"),
      ("Lowered (BETA)", "the style is not moved: the window begins where the picture does",
       DRIVE + MT + MAP + STRIP + "&lower=74")]),
    ("m-footer", "M styles: what the footer's three places show",
     "Each of the three places takes any reading or nothing, so nothing has to be told twice. Left, middle "
     "and right are settings of each M style; BMW's strip is the general setting above.",
     1, 1280, FOOT,
     [("The M View's own, over BMW's strip", "time, range and outside temperature: each of them twice",
       DRIVE + M + STRIP),
      ("Other readings", "revs, average consumption and intake air: nothing twice",
       DRIVE + M + STRIP + "&footL=rpm&footM=economy&footR=iat"),
      ("Nothing in the footer", "BMW's strip does the telling", DRIVE + M + STRIP + "&footL=off&footM=off&footR=off"),
      ("BMW's strip hidden, the M View's own", "each reading once, in the style's own figures",
       DRIVE + M + STRIP + "&bottomExtra=hide"),
      ("BMW's strip hidden, engine readings", "oil, coolant and battery (the battery and the intake air come "
       "from BeeM-Flash)", DRIVE + M + STRIP + "&bottomExtra=hide&footL=oil&footM=coolant&footR=volts"),
      ("In metric", "average consumption in l/100 km, boost in bar",
       DRIVE + M + STRIP + "&units=metric&bottomExtra=hide&footL=economy&footM=boost&footR=iat")]),
    ("m-gear", "M styles: the gear's place",
     "BMW's own gear letter cannot be hidden, so with the M View's gear above it the gear is told twice. "
     "The style's can make way for the revs as a figure, or for nothing. (The right half of the panel, "
     "BMW's strip hidden.)", 3, 624, (960, 120, 1920, 720),
     [("The gear", "as the M View has it", DRIVE + M + STRIP + "&bottomExtra=hide"),
      ("Engine speed, in figures", "to the nearest ten", DRIVE + M + STRIP + "&bottomExtra=hide&mGear=rpm"),
      ("Nothing", "BMW's own gear letter is the only one", DRIVE + M + STRIP + "&bottomExtra=hide&mGear=off")]),
]

# the app's own page on the iDrive screen, the whole 1920 x 720 of it: name, title, what it shows,
# arguments of tools/page-shot.js
PAGES = [
    ("app-page", "The page: CLUSTER",
     "What opens: the style on the cluster with its switch, what the middle, the phone's map, Turn View, the "
     "footer and BMW's strip are doing, the design with \u25c0 \u25b6 to step through all six, and the "
     "centre picture for that style.", "style=mplus"),
    ("app-page-general", "GENERAL",
     "What every style shares: on or off, starting with the car, units, the car, limits, BMW's bottom strip, "
     "the refresh rate, the holiday theme, the start-up message.", "style=mplus @tab=general"),
    ("app-page-toro", "TORO", "Toro's own settings, and nothing of the M styles'.", "style=toro @tab=toro"),
    ("app-page-msport", "M SPORT",
     "M Sport's own: its centre picture, the footer's three places, the footer panel, the numbers at the needle.",
     "style=track @tab=msport"),
    ("app-page-mplus", "M SPORT PLUS",
     "The same for M Sport Plus, kept apart from M Sport's. A tab of a style that is not on the cluster says "
     "so, and has a button to use it.", "style=track @tab=mplus"),
    ("app-page-mtrack", "M TRACK",
     "M Track Mode's own: what its left wing holds, the reading in each of its four gauge rows, how a row "
     "shows it, the footer's three places.", "style=mtrack @tab=mtrack"),
    ("app-page-list", "Choosing a value",
     "A row opens its list (here what the footer's left place shows).", "style=track @tab=msport @press=set:mFootL"),
    ("app-page-controller", "With the controller",
     "The controller's ring on a place; turning steps through the places, pressing chooses.",
     "style=mplus @focus=centre:map"),
    ("app-page-plain", "Without the Store's renderer",
     "If mgu-render is not installed the head unit shows the plain page in its own frame, with the buttons in "
     "its own bar (not drawn here).", "style=mplus @own=0"),
]
# the CLUSTER tab for each design: title, settings
DESIGNS = [
    ("Toro \u2014 genuine", "style=toro background=genuine"),
    ("Toro \u2014 modern hex lattice", "style=toro background=modern"),
    ("Toro \u2014 Revuelto", "style=toro background=revuelto"),
    ("M Sport", "style=track mCentre=map"),
    ("M Sport Plus", "style=mplus"),
    ("M Track Mode", "style=mtrack"),
]

# animations: name, title, what it shows, size, frames (queries)
SWEEPS = [
    ("toro-sweep", "Toro through the revs",
     "The band lighting, each number popping as the needle reaches it, the shift lights closing in.", (800, 269),
     ["t=5&freeze=1&strip=off&rpm=%d&speed=%d" % (1400 + i * 430, 30 + i * 9) for i in range(14)]),
    ("m-sport-plus-sweep", "M Sport Plus through the revs",
     "The marker rising, the band filling under it, and the nearest number always the biggest.", (800, 269),
     ["t=6&freeze=1&strip=off&style=mplus&centre=waze&show=map&rpm=%d&speed=%d" % (2400 + i * 260, 60 + i * 8)
      for i in range(12)]),
    ("m-track-sweep", "M Track Mode through the revs",
     "The marker climbing the leaning scale, the band lit under it, the boost row's mark moving with the load.",
     (800, 269),
     ["t=6&freeze=1&strip=off&style=mtrack&rpm=%d&speed=%d" % (1200 + i * 480, 40 + i * 9) for i in range(13)]),
]
# animations that run one way and start again: name, title, what it shows, size, crop, frames, ms a frame
LOOPS = [
    ("holiday-snow", "The snow falling",
     "Six seconds of the holiday theme with the car held still (M Sport's left side): the flakes fall at "
     "10 to 24 px a second, and the tree's lights twinkle.", (640, 430), (0, 0, 960, 646),
     ["t=9&freeze=1&strip=off&style=track&clock12=on&holiday=on&now=%.3f" % (20 + i * 0.2) for i in range(30)], 200),
]


# ------------------------------------------------------------------ rendering
def run(cmd):
    r = subprocess.run(cmd, cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if r.returncode != 0:
        sys.exit("failed: %s\n%s" % (" ".join(cmd), r.stdout[-2000:]))


_cache = {}


def cluster_file(query):
    n = len(_cache)
    f = TMP / ("c-%03d.png" % n)
    _cache[query] = f
    return f


def render_all(queries, jobs):
    todo = []
    for q in queries:
        if q not in _cache:
            todo.append((q, cluster_file(q)))
    with concurrent.futures.ThreadPoolExecutor(jobs) as ex:
        list(ex.map(lambda t: run(["node", "tools/shot.js", str(t[1]), t[0]]), todo))
    return len(todo)


def cluster(query, crop=None):
    """a frame of the preview: the 1920 x 646 a style is drawn in, or the part of all 720 rows asked for"""
    im = Image.open(_cache[query]).convert("RGB")
    return im.crop(crop) if crop else im.crop(PANEL)


def page(args, name):
    """the app's own page, as tools/page-shot.js draws it: the whole screen, or the plain page"""
    f = TMP / ("page-%s.png" % name)
    run(["node", "tools/page-shot.js", str(f)] + args.split())
    return Image.open(f).convert("RGB")


def font(kind, size):
    # captions: a heavy condensed face for names, a plain one for notes (both fetched by `npm run fonts`)
    name = {"title": "barlow-semi-condensed-latin-700-normal.ttf", "note": "inter-tight-latin-400-normal.ttf"}[kind]
    f = ROOT / "build" / "fonts" / name
    if f.exists():
        return ImageFont.truetype(str(f), size)
    return ImageFont.load_default(size)


def sheet(tiles, cols, tile_w, gap=16, title_px=25, note_px=16):
    """tiles: (image, title, note). A grid on the app's own dark ground, a caption under each."""
    ft, fn = font("title", title_px), font("note", note_px)
    scaled = []
    for im, title, note in tiles:
        h = round(im.size[1] * tile_w / im.size[0])
        scaled.append((im.resize((tile_w, h), Image.LANCZOS), title, note))
    label = title_px + 14 + (note_px + 6 if any(t[2] for t in tiles) else 0)
    rows = [scaled[i:i + cols] for i in range(0, len(scaled), cols)]
    width = gap + cols * (tile_w + gap)
    height = gap + sum(max(t[0].size[1] for t in row) + label + gap for row in rows)
    out = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(out)
    y = gap
    for row in rows:
        rh = max(t[0].size[1] for t in row)
        # a short last row sits in the middle
        x = gap + (cols - len(row)) * (tile_w + gap) // 2
        for im, title, note in row:
            out.paste(im, (x, y + (rh - im.size[1]) // 2))
            d.text((x + 2, y + rh + 8), title, font=ft, fill=INK)
            if note:
                d.text((x + 2, y + rh + 8 + title_px + 6), note, font=fn, fill=DIM)
            x += tile_w + gap
        y += rh + label + gap
    return out


def save(im, name):
    f = OUT / (name + ".png")
    im.save(f, optimize=True)
    return f


def gif(frames, name, size):
    small = [f.resize(size, Image.LANCZOS) for f in frames]
    small = small + small[-2:0:-1]                     # up, then back down
    pal = small[len(frames) // 2].quantize(colors=112, method=Image.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.NONE) for f in small]
    f = OUT / (name + ".gif")
    q[0].save(f, save_all=True, append_images=q[1:], duration=130, loop=0, optimize=True)
    return f


def loop_gif(frames, name, size, ms, fade=5):
    """one way and round again: the last frames melt into the first, so the turn-over is not a jump"""
    small = [f.resize(size, Image.LANCZOS) for f in frames]
    n = len(small) - fade
    out = small[:n]
    for i in range(fade):
        out[i] = Image.blend(small[n + i], small[i], (i + 1) / (fade + 1.0))
    pal = out[n // 2].quantize(colors=96, method=Image.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.NONE) for f in out]
    f = OUT / (name + ".gif")
    q[0].save(f, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True)
    return f


def icon_picture():
    """the app's tile, four times its size, on the 140 x 140 the menu gives it"""
    k, pad = 4, 28
    icon = Image.open(ROOT / "app" / "icon.png").convert("RGBA")
    side = icon.size[0] * k
    out = Image.new("RGB", (side + 2 * pad, side + 2 * pad), (58, 66, 78))
    d = ImageDraw.Draw(out)
    # the tile, dashed round, and the icon on it
    for a in range(0, side, 16):
        for x0, y0, x1, y1 in ((pad + a, pad, pad + a + 8, pad), (pad + a, pad + side, pad + a + 8, pad + side),
                               (pad, pad + a, pad, pad + a + 8), (pad + side, pad + a, pad + side, pad + a + 8)):
            d.line([x0, y0, x1, y1], fill=(232, 240, 246), width=2)
    big = icon.resize((side, side), Image.LANCZOS)
    out.paste(big, (pad, pad), big)
    return out


# ------------------------------------------------------------------ the comparisons
def comparisons():
    """docs/img: the M styles beside the pictures they are traced from (docs/ref/*MEASUREMENTS.md)"""
    img = ROOT / "docs" / "img"
    for tool in ("tools/m-compare.py", "tools/m-plus-compare.py", "tools/mt-compare.py"):
        r = subprocess.run([sys.executable, tool], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        if r.returncode != 0:
            print("skipped the comparison pictures: %s did not run (%s)" % (tool, r.stdout.strip().splitlines()[-1][:80]))
            return []
    a = ROOT / "build" / "m-compare"
    ref, ren = Image.open(a / "reference.png").convert("RGB"), Image.open(a / "render.png").convert("RGB")
    w, h = ref.size
    wide = 1294
    pair = Image.new("RGB", (w, h * 2 + 8), (46, 46, 46))
    pair.paste(ref, (0, 0))
    pair.paste(ren, (0, h + 8))
    pair.resize((wide, round((h * 2 + 8) * wide / w)), Image.LANCZOS).save(img / "m-compare.jpg", quality=88)
    Image.open(a / "overlay.png").convert("RGB").resize((wide, round(h * wide / w)), Image.LANCZOS).save(img / "m-overlay.jpg", quality=88)
    Image.open(a / "edges.png").convert("RGB").resize((wide, round(h * wide / w)), Image.LANCZOS).save(img / "m-edges.png", optimize=True)
    # the middle of M Sport Plus: the picture's above, ours below (the first two of the tool's three)
    m = Image.open(ROOT / "build" / "m-plus-compare" / "middle.png").convert("RGB")
    part = (m.size[1] - 16) // 3
    two = Image.new("RGB", (m.size[0], part * 2 + 8), (46, 46, 46))
    two.paste(m.crop((0, 0, m.size[0], part)), (0, 0))
    two.paste(m.crop((0, part + 8, m.size[0], 2 * part + 8)), (0, part + 8))
    two.save(img / "mplus-compare.jpg", quality=88)
    # M Track Mode: the photograph rectified above, ours below; and the two laid over each other
    t = ROOT / "build" / "mt-compare"
    ref, ren = Image.open(t / "reference.png").convert("RGB"), Image.open(t / "render.png").convert("RGB")
    w, h = ref.size
    pair = Image.new("RGB", (w, h * 2 + 8), (46, 46, 46))
    pair.paste(ref, (0, 0))
    pair.paste(ren, (0, h + 8))
    pair.resize((wide, round((h * 2 + 8) * wide / w)), Image.LANCZOS).save(img / "mtrack-compare.jpg", quality=88)
    Image.open(t / "overlay.png").convert("RGB").resize((wide, round(h * wide / w)), Image.LANCZOS).save(img / "mtrack-overlay.jpg", quality=88)
    Image.open(t / "edges.png").convert("RGB").resize((wide, round(h * wide / w)), Image.LANCZOS).save(img / "mtrack-edges.png", optimize=True)
    return [img / n for n in ("m-compare.jpg", "m-overlay.jpg", "m-edges.png", "mplus-compare.jpg",
                              "mtrack-compare.jpg", "mtrack-overlay.jpg", "mtrack-edges.png")]


# ------------------------------------------------------------------ the gallery page
def address(query):
    return "`preview/index.html?" + query.replace("&strip=off", "") + "`"


def gallery():
    L = ["# Gallery", "",
         "Every style, option and screen of MGU Styles. All of it is made by `npm run screenshots`",
         "(`tools/screenshots.py`): nothing here is edited by hand, and each picture can be opened live at the",
         "address under it (serve the repository's root and open it in a browser).", "",
         "The cluster pictures are the 1920 \u00d7 646 a style is drawn in, pixel for pixel; the car's own strip is",
         "in the 74 rows under that, and the pictures about it keep all 720 rows with a stand-in for it. The map,",
         "the camera picture and BMW's strip are the preview's stand-ins: on the car they are your phone's map,",
         "Turn View's camera and the car's own strip. Nothing here is a photograph of a car.", "",
         "![The six designs, and the app's page](screenshots/overview.png)", ""]
    for key, title, items in SINGLES:
        L += ["## " + title, ""]
        for name, t, what, q in items:
            L += ["### " + t, "", what, "", "![%s](screenshots/%s.png)" % (t, name), "", address(q), ""]
        if key == "extras":
            for name, t, what, cols, w, crop, tiles in SHEETS:
                if name != "holiday":
                    continue
                L += sheet_md(name, t, what, tiles)
            for name, t, what, size, crop, frames, ms in LOOPS:
                L += ["### " + t, "", what, "", "![%s](screenshots/%s.gif)" % (t, name), ""]
    L += ["## Options", ""]
    for name, t, what, cols, w, crop, tiles in SHEETS:
        if name == "holiday":
            continue
        L += sheet_md(name, t, what, tiles)
    L += ["## In motion", ""]
    for name, t, what, size, frames in SWEEPS:
        L += ["### " + t, "", what, "", "![%s](screenshots/%s.gif)" % (t, name), ""]
    L += ["## Against their references", "",
          "The M styles are traced from pictures of the real display. How each was measured and how close",
          "it comes: [M Sport](ref/MEASUREMENTS.md), [M Sport Plus](ref/M-PLUS-MEASUREMENTS.md),",
          "[M Track Mode](ref/M-TRACK-MEASUREMENTS.md).", "",
          "![M Sport: the reference photograph above, the render below](img/m-compare.jpg)", "",
          "![M Sport Plus: the middle of its picture above, the render's below](img/mplus-compare.jpg)", "",
          "![M Track Mode: the reference photograph, rectified, above; the render below](img/mtrack-compare.jpg)", ""]
    L += ["## The app on iDrive", "",
          "What MGU Styles shows on the head unit, the whole 1920 \u00d7 720 screen: a bar of tabs along the top",
          "(CLUSTER, GENERAL and one for each style, so a style's settings are only ever on its own tab), with",
          "the page under it. Everything is reached with the controller or by touch. These are drawn by the app",
          "itself, off the car (`tools/page-shot.js`).", ""]
    for name, t, what, args in PAGES:
        L += ["### " + t, "", what, "", "![%s](screenshots/%s.png)" % (t, name), "",
              "`node tools/page-shot.js out.png %s`" % args, ""]
    L += ["### The six designs", "",
          "The CLUSTER tab steps through them with \u25c0 \u25b6; the cluster follows.", "",
          "![The app's page for each design](screenshots/app-pages.png)", "",
          "### The app's tile", "",
          "The icon in iDrive's menu, four times its size on the 140 \u00d7 140 the menu gives it (dashed). Its plate",
          "stands 10 px in from the tile's edge all round: the menu draws its highlight behind and round a tile's",
          "icon, and under the first icon, which filled the tile, none of it could be seen.", "",
          "![The app's tile](screenshots/app-icon.png)", ""]
    (ROOT / "docs" / "GALLERY.md").write_text("\n".join(L))


def sheet_md(name, title, what, tiles):
    L = ["### " + title, "", what, "", "![%s](screenshots/%s.png)" % (title, name), "",
         "<details><summary>The address of each</summary>", ""]
    for label, note, q in tiles:
        L.append("- %s: %s" % (label, address(q)))
    return L + ["", "</details>", ""]


# ------------------------------------------------------------------ main
def shown_in_docs():
    """the pictures the README and docs/*.md show (docs/screenshots/<name>.png or .gif): what the repository keeps"""
    import re
    names = set()
    for md in [ROOT / "README.md"] + sorted((ROOT / "docs").glob("*.md")):
        names |= set(re.findall(r"screenshots/([\w-]+)\.(?:png|gif)", md.read_text(encoding="utf-8")))
    return names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--only", default="")
    ap.add_argument("--gallery", action="store_true",
                    help="every picture, with docs/GALLERY.md and docs/img: not only the ones the docs show")
    ap.add_argument("--no-comparisons", action="store_true", help="leave docs/img (the M styles against their references) alone")
    args = ap.parse_args()
    only = set(filter(None, args.only.split(",")))
    if not only and not args.gallery:
        only = shown_in_docs()
    want = (lambda n: not only or n in only)
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)

    queries = []
    for _, _, items in SINGLES:
        queries += [q for name, _, _, q in items if want(name) or want("overview")]
    for name, _, _, _, _, _, tiles in SHEETS:
        if want(name):
            queries += [q for _, _, q in tiles]
    for name, _, _, _, frames in SWEEPS:
        if want(name):
            queries += frames
    for name, _, _, _, _, frames, _ in LOOPS:
        if want(name):
            queries += frames
    n = render_all(list(dict.fromkeys(queries)), args.jobs)
    print("rendered %d cluster frames" % n)

    written = []
    for _, _, items in SINGLES:
        for name, title, what, q in items:
            if want(name):
                written.append(save(cluster(q), name))
    for name, title, what, cols, w, crop, tiles in SHEETS:
        if want(name):
            written.append(save(sheet([(cluster(q, crop), label, note) for label, note, q in tiles], cols, w), name))
    for name, title, what, size, frames in SWEEPS:
        if want(name):
            written.append(gif([cluster(q) for q in frames], name, size))
    for name, title, what, size, crop, frames, ms in LOOPS:
        if want(name):
            written.append(loop_gif([cluster(q, crop) for q in frames], name, size, ms))

    shots = {}
    for name, title, what, pargs in PAGES:
        if want(name) or (name == "app-page" and want("overview")):
            shots[name] = page(pargs, name)
            if want(name):
                written.append(save(shots[name], name))
    if want("app-pages"):
        designs = [(page(pargs + " @tab=cluster", "design-%d" % i), title, "") for i, (title, pargs) in enumerate(DESIGNS)]
        written.append(save(sheet(designs, 2, 944), "app-pages"))
    if want("app-icon"):
        written.append(save(icon_picture(), "app-icon"))
    if want("overview"):
        designs = [(cluster(q), t.replace(" \u2014 ", ", "), "") for name, t, _, q in SINGLES[0][2]]
        designs.append((shots["app-page"], "The app on iDrive", ""))
        written.append(save(sheet(designs, 2, 936), "overview"))

    if args.gallery and not args.only and not args.no_comparisons:
        written += comparisons()
    if args.gallery and not args.only:
        gallery()
        print("wrote docs/GALLERY.md")
        # a picture this no longer makes is not left behind to be mistaken for a current one
        made = {f.name for f in written}
        for f in sorted(OUT.iterdir()):
            if f.suffix in (".png", ".gif") and f.name not in made:
                f.unlink()
                print("removed %s: no longer made" % f.name)
    total = 0
    for f in written:
        total += f.stat().st_size
        print("  %-28s %5d KB  %s" % (f.name, f.stat().st_size // 1024, "x".join(map(str, Image.open(f).size))))
    print("%d pictures, %.1f MB, in docs/screenshots and docs/img" % (len(written), total / 1e6))


if __name__ == "__main__":
    main()
