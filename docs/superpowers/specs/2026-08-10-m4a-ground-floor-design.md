# M4a ground floor — design (the mansion blueprint, built)

**Date:** 2026-08-10 (session 3)
**Status:** approved in brainstorm (all 11 spaces mockup-approved by the user)
**Context:** Both M4a de-risk slices are merged and playtest-accepted: combat
with furniture works (`?map=kitchen-test`), and the "inked illustration" art
direction is the game's look. This spec is the payoff: replace the old 2m
greybox mansion with the blueprint ground floor — 58×47m at 1m cells, 11
named furnished spaces — using only validated engine vocabulary (level
descriptors, low/tall/decor furniture with the two-set rule, ink materials,
floor/wall patches, windows, composed figures).

Mockup provenance: every coordinate below comes from the generator that
rendered the user-approved mockups (validated: connected floor, no room
bleed, furniture on floor cells, exits clear).

## Goal

`npm run dev` with no URL param loads the blueprint ground floor: spawn in
the foyer, octagonal grand hall ahead, Wanderer prowling, every room
furnished in the ink style. The old greybox map is retired. The
`?map=kitchen-test` slice stays for regression/testing.

## Playtest questions (success criteria)

1. Orientation: after one loop, does the user know where they are from the
   room they're in?
2. Do fights stay good across room types (arena hall, tight kitchen, stack
   alleys in the library, single-exit billiard room)?
3. Pacing of light: lamp-lit rooms vs dark pockets (study, passages) — moody
   but fair?
4. Perf at ~2.7k cells / ~70 furniture pieces / 34 windows (P overlay).
5. Does the whole floor feel like ONE building (art, surfaces, windows)?

## 1. The map (58×47, cell = 1)

Legend: `#` wall, `.` floor, `D` doorway, `S` player spawn, `L` lamp (11),
`W` Wanderer spawn (billiard room — the single-exit room is its den).
`D` remains walkable floor to the engine but is now RECORDED by `parseMap`
(see §7.1) so furniture validation can reject doorway blockers.

```
 ######################################################
 #................##......##........##................#
 #................##......##........##...W............#
 #................##......##........##................#
 #................##......##........##................#
 #.......L........##......##........##.......L........#
 #................##......##........##................#
 #................##......##........##................#
 #................##......##........##................#
 #................####DD#######DD#####................#
 #................DD##DD#     #DD#   #................#
 #####DD##########DD##DD#######DD###########DD#########
 #####DD##########DD..............................L...#
 #................##..................................#
 #................############DD###############DD######
 #................#      ##........##    ######DD########
 #................#     ##..........##   #..............#
 #................#    ##............##  #..............#
 #.......L........#   ##..............## #..............#
 #................#  ##................###..............#
 #................#  #..................##......L.......#
 #................####..................##..............#
 #................DDDD..................DD..............#
 #................DDDD....L........L....DD..............#
 #................####..................##..............#
 #####DD###########  #..................##..............#
 #####DD##############..................##..............#
 #..................###................###..............#
 #..................# ##..............## #......L.......#
 #..................#  ##............##  #..............#
 #..................#   ##..........##   #..............#
 #..................#    ##........##    #..............#
 #.......L..........#     ####DD####     ######DD########
 #..................#   ######DD######   ######DD########
 #..................#   #............#   #..............#
 #..................#   #............#   #..............#
 #..................#####............#####..............#
 #..................DDDDD............DDDDD..............#
 #..................DDDDD.....L......DDDDD......L.......#
 ########################............#####..............#
                        #.....S......#   #..............#
                        #............#   #..............#
                        ##############   #..............#
                                         #..............#
                                         ################
```

(Line 1 of the fenced block is map row z1; z0 and z46 are all-void and may
be omitted or kept as blank/wall rows — `parseMap` trims nothing, so author
the string with the full rectangle including the z0/z46 border rows of `#`
where adjacent to floor, exactly as the generator emits. The implementation
plan carries the byte-exact string; this rendering is for review.)

Rooms and interior sizes: grand hall 18×17 octagon (cut 5), foyer 12×8,
kitchen 16×10 (== the shipped test slice), service stair 6×8, study 8×8,
billiard 16×10, north corridor 34×2, dining 16×12, sitting 18×12, library
14×16, drawing 14×10, plus two south passages, a west vestibule and the
kitchen L-passage. Two loops (west chain, hall/corridor/library ring).

## 2. Level descriptors

- `MANSION` in `src/level/levels.js` becomes this floor: `{ name:
  'mansion', mapText: GROUND_FLOOR_MAP, cell: 1, furniture, floorPatches,
  wallPatches, windows, wallProps }` — data lives in a new
  `src/level/groundFloor.js` (the old `MAP`/`CELL=2` constants in
  `mapData.js` are deleted; `CELL` export becomes 1 and remains the default
  cell everywhere).
- `KITCHEN_TEST` is unchanged and stays reachable via `?map=kitchen-test`.
- Player spawn `S` at (30,41); main double door is a `main-door` wall prop
  on the foyer's south wall (30-31, 43), locked — the future ending exit.
- Wanderer spawn `W` at (41,2); waypoints remain `parsed.lamps` (11 lamps
  spread over every wing — full-floor patrol).

## 3. Furniture manifest

Engine kinds per the validated rules (`low` blocks move not sight, `tall`
blocks both, `decor` no collision — rugs only, height 0.02). Items gain an
optional **`figure`** field naming their builder (see §4); ids stay
room-prefixed and unique. Chairs/stools at seat height 0.45 per playtest.

**Kitchen: reuse the SHIPPED slice manifest verbatim** (same coordinates,
ids, colors as `src/level/kitchenTest.js` — it is playtest-validated, and
its ids already resolve to builders via `baseId`, so it needs no `figure`
fields). All other rooms as follows (colors are palette keys, §6):

```js
// --- study (dark pressure room, no lamp) ---
{ id: 'study-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 29, z0: 3, x1: 33, z1: 6, color: PALETTE.rugBrown },
{ id: 'study-desk', kind: 'low', figure: 'table', x0: 30, z0: 4, x1: 32, z1: 5, color: PALETTE.furnitureWood },
{ id: 'study-desk-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 31, z0: 6, x1: 31, z1: 6, color: PALETTE.furnitureWalnut },
{ id: 'study-shelves', kind: 'tall', figure: 'bookcase', x0: 28, z0: 2, x1: 28, z1: 4, color: PALETTE.furnitureWood },
{ id: 'study-shelves-2', kind: 'tall', figure: 'bookcase', x0: 35, z0: 2, x1: 35, z1: 4, color: PALETTE.furnitureWood },
{ id: 'study-safe', kind: 'low', height: 1, figure: 'safe', x0: 35, z0: 8, x1: 35, z1: 8, color: PALETTE.furnitureIron },
{ id: 'study-armchair', kind: 'low', figure: 'armchair', x0: 29, z0: 7, x1: 29, z1: 7, color: PALETTE.upholsteryDark },
{ id: 'study-candle-table', kind: 'low', height: 0.45, figure: 'table', x0: 28, z0: 7, x1: 28, z1: 7, color: PALETTE.furnitureWalnut },
// --- billiard (Wanderer den, single exit) ---
{ id: 'billiard-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 42, z0: 5, x1: 49, z1: 8, color: PALETTE.rugGreen },
{ id: 'billiard-table', kind: 'low', figure: 'billiard-table', x0: 44, z0: 6, x1: 47, z1: 7, color: PALETTE.feltGreen },
{ id: 'billiard-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 42, z0: 7, x1: 42, z1: 7, color: PALETTE.furnitureWalnut },
{ id: 'billiard-stool-2', kind: 'low', height: 0.45, figure: 'stool', x0: 49, z0: 6, x1: 49, z1: 6, color: PALETTE.furnitureWalnut },
{ id: 'billiard-bar-cabinet', kind: 'tall', figure: 'cabinet', x0: 50, z0: 2, x1: 51, z1: 2, color: PALETTE.furnitureWood },
{ id: 'billiard-trophy-case', kind: 'tall', figure: 'cabinet', x0: 53, z0: 5, x1: 53, z1: 7, color: PALETTE.furnitureWood },
{ id: 'billiard-armchair', kind: 'low', figure: 'armchair', x0: 50, z0: 9, x1: 50, z1: 9, color: PALETTE.upholsteryDark },
{ id: 'billiard-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 9, x1: 52, z1: 9, color: PALETTE.upholsteryDark },
{ id: 'billiard-smoke-table', kind: 'low', height: 0.45, figure: 'table', x0: 51, z0: 9, x1: 51, z1: 9, color: PALETTE.furnitureWalnut },
// --- drawing room ---
{ id: 'drawing-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 46, z0: 37, x1: 51, z1: 42, color: PALETTE.rugViolet },
{ id: 'drawing-tea-table', kind: 'low', height: 0.45, figure: 'table', x0: 48, z0: 39, x1: 49, z1: 40, color: PALETTE.furnitureWalnut },
{ id: 'drawing-settee', kind: 'low', figure: 'settee', x0: 47, z0: 37, x1: 50, z1: 37, color: PALETTE.velvet },
{ id: 'drawing-settee-2', kind: 'low', figure: 'settee', x0: 47, z0: 42, x1: 50, z1: 42, color: PALETTE.velvet },
{ id: 'drawing-chaise-longue', kind: 'low', figure: 'settee', x0: 52, z0: 42, x1: 54, z1: 42, color: PALETTE.velvet },
{ id: 'drawing-secretary-desk', kind: 'tall', figure: 'cabinet', x0: 52, z0: 35, x1: 53, z1: 35, color: PALETTE.furnitureWood },
{ id: 'drawing-drinks-cabinet', kind: 'tall', figure: 'cabinet', x0: 43, z0: 35, x1: 44, z1: 35, color: PALETTE.furnitureWood },
{ id: 'drawing-fern', kind: 'low', figure: 'fern', x0: 44, z0: 43, x1: 44, z1: 43, color: PALETTE.fernGreen },
// --- library ---
{ id: 'library-book-stack-a', kind: 'tall', figure: 'bookcase', x0: 45, z0: 20, x1: 46, z1: 23, color: PALETTE.furnitureWood },
{ id: 'library-book-stack-b', kind: 'tall', figure: 'bookcase', x0: 45, z0: 26, x1: 46, z1: 29, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves', kind: 'tall', figure: 'bookcase', x0: 42, z0: 18, x1: 42, z1: 21, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-2', kind: 'tall', figure: 'bookcase', x0: 42, z0: 27, x1: 42, z1: 31, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-3', kind: 'tall', figure: 'bookcase', x0: 42, z0: 17, x1: 46, z1: 17, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-4', kind: 'tall', figure: 'bookcase', x0: 50, z0: 17, x1: 55, z1: 17, color: PALETTE.furnitureWood },
{ id: 'library-reading-table', kind: 'low', figure: 'table', x0: 50, z0: 20, x1: 52, z1: 21, color: PALETTE.furnitureOak },
{ id: 'library-globe', kind: 'low', height: 1.2, figure: 'globe', x0: 53, z0: 20, x1: 53, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'library-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 50, z0: 24, x1: 53, z1: 27, color: PALETTE.rugBlue },
{ id: 'library-armchair', kind: 'low', figure: 'armchair', x0: 51, z0: 24, x1: 51, z1: 24, color: PALETTE.upholsteryDark },
{ id: 'library-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 26, x1: 52, z1: 26, color: PALETTE.upholsteryDark },
{ id: 'library-side-table', kind: 'low', height: 0.45, figure: 'table', x0: 52, z0: 25, x1: 52, z1: 25, color: PALETTE.furnitureWalnut },
// --- sitting room ---
{ id: 'sitting-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 3, z0: 30, x1: 8, z1: 36, color: PALETTE.rugGreen },
{ id: 'sitting-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 32, x1: 2, z1: 34, color: PALETTE.furnitureStone },
{ id: 'sitting-sofa', kind: 'low', figure: 'settee', x0: 4, z0: 31, x1: 7, z1: 31, color: PALETTE.sofaGreen },
{ id: 'sitting-sofa-2', kind: 'low', figure: 'settee', x0: 4, z0: 35, x1: 7, z1: 35, color: PALETTE.sofaGreen },
{ id: 'sitting-coffee-table', kind: 'low', height: 0.45, figure: 'table', x0: 5, z0: 33, x1: 6, z1: 33, color: PALETTE.furnitureWalnut },
{ id: 'sitting-grand-piano', kind: 'low', figure: 'grand-piano', x0: 14, z0: 30, x1: 16, z1: 31, color: PALETTE.pianoBlack },
{ id: 'sitting-piano-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 13, z0: 32, x1: 13, z1: 32, color: PALETTE.furnitureWalnut },
{ id: 'sitting-bookcase', kind: 'tall', figure: 'bookcase', x0: 10, z0: 28, x1: 12, z1: 28, color: PALETTE.furnitureWood },
{ id: 'sitting-card-table', kind: 'low', height: 0.7, figure: 'table', x0: 15, z0: 36, x1: 15, z1: 36, color: PALETTE.furnitureWalnut },
{ id: 'sitting-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 14, z0: 36, x1: 14, z1: 36, color: PALETTE.furnitureWalnut },
{ id: 'sitting-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 16, z0: 36, x1: 16, z1: 36, color: PALETTE.furnitureWalnut },
// --- dining room ---
{ id: 'dining-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 5, z0: 17, x1: 14, z1: 20, color: PALETTE.rugRed },
{ id: 'dining-table', kind: 'low', figure: 'table', x0: 6, z0: 18, x1: 13, z1: 19, color: PALETTE.furnitureOak },
{ id: 'dining-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 7, z0: 17, x1: 7, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 10, z0: 17, x1: 10, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-3', kind: 'low', height: 0.45, figure: 'chair', x0: 12, z0: 17, x1: 12, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-4', kind: 'low', height: 0.45, figure: 'chair', x0: 8, z0: 20, x1: 8, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-5', kind: 'low', height: 0.45, figure: 'chair', x0: 11, z0: 20, x1: 11, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-6', kind: 'low', height: 0.45, figure: 'chair', x0: 5, z0: 18, x1: 5, z1: 18, color: PALETTE.furnitureWalnut },
{ id: 'dining-sideboard', kind: 'tall', figure: 'cabinet', x0: 10, z0: 14, x1: 13, z1: 14, color: PALETTE.furnitureWood },
{ id: 'dining-china-cabinet', kind: 'tall', figure: 'cabinet', x0: 17, z0: 16, x1: 17, z1: 17, color: PALETTE.furnitureWood },
{ id: 'dining-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 19, x1: 2, z1: 21, color: PALETTE.furnitureStone },
{ id: 'dining-cart', kind: 'low', figure: 'table', x0: 14, z0: 16, x1: 14, z1: 16, color: PALETTE.furnitureStoneWarm },
// --- grand hall ---
{ id: 'hall-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 21, x1: 34, z1: 27, color: PALETTE.rugViolet },
{ id: 'hall-settee-statue', kind: 'low', figure: 'statue-settee', x0: 29, z0: 23, x1: 31, z1: 25, color: PALETTE.velvetRose },
{ id: 'hall-armor', kind: 'tall', figure: 'armor', x0: 26, z0: 17, x1: 26, z1: 17, color: PALETTE.armorSteel },
{ id: 'hall-armor-2', kind: 'tall', figure: 'armor', x0: 35, z0: 17, x1: 35, z1: 17, color: PALETTE.armorSteel },
{ id: 'hall-pedestal', kind: 'low', figure: 'pedestal', x0: 24, z0: 19, x1: 24, z1: 19, color: PALETTE.stonePale },
{ id: 'hall-pedestal-2', kind: 'low', figure: 'pedestal', x0: 37, z0: 19, x1: 37, z1: 19, color: PALETTE.stonePale },
{ id: 'hall-armchair', kind: 'low', figure: 'armchair', x0: 24, z0: 29, x1: 24, z1: 29, color: PALETTE.upholsteryDark },
{ id: 'hall-armchair-2', kind: 'low', figure: 'armchair', x0: 37, z0: 29, x1: 37, z1: 29, color: PALETTE.upholsteryDark },
{ id: 'hall-fern', kind: 'low', figure: 'fern', x0: 27, z0: 31, x1: 27, z1: 31, color: PALETTE.fernGreen },
{ id: 'hall-fern-2', kind: 'low', figure: 'fern', x0: 34, z0: 31, x1: 34, z1: 31, color: PALETTE.fernGreen },
// --- foyer ---
{ id: 'foyer-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 37, x1: 34, z1: 40, color: PALETTE.rugRed },
{ id: 'foyer-center-table', kind: 'low', figure: 'round-table', x0: 30, z0: 38, x1: 31, z1: 39, color: PALETTE.furnitureOak },
{ id: 'foyer-clock', kind: 'low', height: 1.7, figure: 'clock', x0: 36, z0: 36, x1: 36, z1: 36, color: PALETTE.furnitureWoodDark },
{ id: 'foyer-console', kind: 'low', figure: 'table', x0: 25, z0: 36, x1: 25, z1: 37, color: PALETTE.furnitureOak },
{ id: 'foyer-coat-stand', kind: 'low', height: 1.7, figure: 'coat-stand', x0: 25, z0: 42, x1: 25, z1: 42, color: PALETTE.upholsteryDark },
{ id: 'foyer-umbrella-stand', kind: 'low', height: 0.45, figure: 'barrel', x0: 36, z0: 42, x1: 36, z1: 42, color: PALETTE.upholsteryDark },
// --- scenery (stairs inert this milestone) ---
{ id: 'hall-grand-staircase', kind: 'low', height: 1.5, figure: 'staircase', x0: 27, z0: 16, x1: 34, z1: 17, color: PALETTE.furnitureOak },
{ id: 'stair-service-stairs', kind: 'low', height: 1.5, figure: 'staircase', x0: 21, z0: 2, x1: 24, z1: 4, color: PALETTE.furnitureWood },
{ id: 'stair-cellar-hatch', kind: 'low', height: 0.25, figure: 'hatch', x0: 22, z0: 8, x1: 23, z1: 8, color: PALETTE.furnitureWoodDark },
```

Corridors, passages and vestibules get NO blocking furniture (2m width, A*
pinch rule) — only runner rugs (`decor` planes: north corridor x21-52
z13-14 `rugRed`; both south passages skipped, bare by design) and wall
props.

## 4. Figure builders

`hasFigure`/`buildFigure` resolve `item.figure ?? baseId(item.id)`. The
seven kitchen builders ship already; this milestone adds the generic set
(each 10-25 lines of composed primitives in `furnitureFigures.js`, ink
materials, within footprint, heights from the item):

| figure | built from | used by |
|---|---|---|
| `table` | top + 4 legs (+ aprons when ≥2m long) | desks, dining/tea/side/card tables, console, cart |
| `round-table` | cylinder top + pedestal leg | foyer center table |
| `chair` | seat + 4 legs + backrest | dining chairs, desk chair |
| `stool` | (ships) | stools |
| `armchair` | seat + arms + high back | armchairs |
| `settee` | armchair stretched to footprint | settees, sofas, chaise |
| `bookcase` | larder frame + shelves + book-row boxes (not jars) | all shelving/stacks |
| `cabinet` | closed tall box + door inset + feet | sideboard, secretary, drinks/china/bar cabinet, trophy case |
| `fireplace` | hearth builder reused | dining/sitting fireplaces |
| `billiard-table` | slab + rails + 4 legs, felt top | billiard table |
| `grand-piano` | body box + open lid wedge + 3 legs | piano |
| `clock` | tall thin box + face disc | grandfather clock |
| `globe` | sphere + meridian ring + tripod | globe |
| `safe` | box + dial cylinder + hinge | safe |
| `pedestal` | tapered column + bust blob | hall pedestals |
| `fern` | pot cylinder + leaf boxes fan | ferns |
| `armor` | mini figure: legs/torso/helm + halberd rod | armor suits |
| `statue-settee` | ring cylinder + plinth + abstract figure | hall centerpiece |
| `coat-stand` | pole + hook arms + draped coat box | foyer |
| `rug` | single plane at y = height (0.02) | every rug |
| `staircase` | 4-6 rising steps + side banisters + rope across | both stairs (inert scenery) |
| `hatch` | flat trapdoor frame + ring | cellar hatch (inert) |

Box fallback still exists for anything unmapped. Shared material cache: see
§7.2 — mandatory before this manifest (≈70 pieces would otherwise create
hundreds of materials).

## 5. Windows, wall props, surfaces

- **Windows (34 cells, glow-only):** the full exported list (billiard N ×4,
  drawing E ×4 + S ×4, library E ×6, sitting W ×4 + S ×4, dining W ×4,
  kitchen N ×2 + W ×2) as `windows` on the descriptor. **On this floor
  windows get NO PointLights** — glow planes + frames only. 34 lights would
  sink the forward renderer (11 lamps + ambient + flashlight already ship).
  The kitchen-test map keeps its 4 lit windows unchanged. If the floor
  reads too flat at playtest, the fallback is a per-room "hero window"
  light budget (≤6 total), decided then.
- **Wall props** — new descriptor array + builder (`buildWallProps`,
  sibling of `buildWindows`: ink frame + flat colored plane on the wall
  face, type-tinted; no lights, no collision): the 15 exported entries
  (portraits ×6, tapestries ×2, mirror, map, scoreboard, cue rack, pot
  rack, boarded-window) **plus** `main-door` (x30-31, z43, facing 'n' —
  double door, handles, clearly a door and clearly shut). Wall-prop meshes
  join the shootables (impact marks on portraits are free horror).
- **Floor patches** (families/colors, rects = room interiors): hall +
  foyer `hallMarble` (stone); kitchen `kitchenFloor` (stone, ships);
  north corridor + passages + vestibules `floorParquetDark` (wood);
  dining, sitting, library, drawing, billiard, study, service stair
  `floorParquet` (wood). Hall/octagon uses its bounding rect (the corner
  spill is hidden inside wall volumes and enclosed voids).
- **Wall patches**: kitchen keeps `kitchenWall` (ships). Everywhere else
  default walls this milestone (per-room wall tints are a cheap later
  polish knob).

## 6. Palette additions (21 keys)

```js
furnitureOak: 0x8a6a48,   furnitureWalnut: 0x6b5138, furnitureWoodDark: 0x5e4632,
furnitureStoneWarm: 0x6b5a42, upholsteryDark: 0x4e4436, velvet: 0x5e4a6e,
velvetRose: 0x6a4a5e,     feltGreen: 0x2e5e42,       pianoBlack: 0x2e2a26,
fernGreen: 0x3e5e3e,      sofaGreen: 0x4a5e3e,       armorSteel: 0x5a5e66,
stonePale: 0x6b6355,      rugRed: 0x7a3b3b,          rugGreen: 0x3b5e4a,
rugBlue: 0x3b4a5e,        rugViolet: 0x5e3b6e,       rugBrown: 0x4a3b3b,
floorParquet: 0x52432f,   floorParquetDark: 0x463a2c, hallMarble: 0x565963,
```

## 7. Engine prerequisites (from the two slice ledgers — mandatory here)

1. **`parseMap` records `D` cells** (`doorCells: Set<"c,r">`) and
   `expandFurniture` gains `doorCells` in its bounds arg, throwing when a
   blocking footprint covers a doorway (the mockup validator's rule,
   finally enforced in-engine).
2. **Shared material cache** in `createInkMaterial`: key
   `(color, family, repeatU, repeatV)` → material. ~70 pieces × parts
   currently mint fresh materials each; the cache caps it at a few dozen.
3. **Wall mesh merging**: ~1000 wall cells at 1m must not be 1000 draw
   calls. Merge wall boxes into one `BufferGeometry` per material (default
   walls + each wall patch) via `BufferGeometryUtils.mergeGeometries`
   (ships inside `three/addons`, no new dependency). Shot impacts on
   walls only need `hit.point`/`hit.face.normal` — merged geometry keeps
   both.
4. **Static shootables**: build the static list (level + furniture hit
   meshes + wall props) once at startup instead of per shot; only the
   wanderer part toggles per shot.
5. **Windows shootable** (art-slice ledger): window frames/glow join the
   static shootables so impacts don't land behind them.

Deferred, watch at playtest: A* linear open-set (2.7k cells), lamp radius
9m in small rooms, emissive flash strength.

## 8. Retiring the greybox

- Old `MAP` string and `CELL = 2` are deleted; `CELL` becomes `1`.
  `tests/mapData.test.js` currently parses `MAP` — those tests move to a
  small inline fixture (the `TINY` map pattern already in that file). No
  test loses coverage; they lose only the dead constant.
- `wandererAI`/`collision`/`pathfinding` defaults keep working (`CELL` is
  just 1 now; every geometry call already threads `cell` explicitly on the
  descriptor path).
- The M1 grey-box map lives on in git history; `?map=kitchen-test` remains
  the small regression playground.

## 9. Testing

- Descriptor sanity (pattern shipped in `tests/levels.test.js`): mansion
  parses at 58×47 cell 1; spawn/wanderer/lamp counts (S at {30,41}, W at
  {41,2}, 11 lamps); furniture expands cleanly (no wall/door overlap — the
  new §7.1 rule); every window/wallProp on a wall cell; patches in bounds;
  all furniture `figure` values exist in the builder registry.
- `parseMap` doorCells: new unit tests (D recorded, absent = empty set).
- Material cache: same-args calls return the identical material instance
  (browser-path logic guarded, Node path returns plain materials —
  cacheable identically).
- Wall merging: mansion `buildGreybox` output group has ≤ (1 + number of
  wall patches) wall meshes (assertable in Node — geometry merge is pure).
- Everything visual: the playtest questions in §0.

## Non-goals / out of scope

- Upper floor, cellar, stair transitions (stairs are inert scenery — M4b).
- Pickups, keys, second enemy, encounter-module extraction (M4b; the
  extraction happens BEFORE the second enemy per the M3b ledger).
- Audio (M5). Window light budget revisit (playtest call).
- Per-room wall tints beyond the kitchen (polish knob, later).

## Risks / watch-for

- **Perf is the milestone risk**: 2.7k cells, ~70 furniture pieces →
  ~350+ part meshes, 34 window glows, 49 wall-prop planes. §7.2-7.4 are
  the mitigations; the P overlay verdict at playtest decides if more is
  needed (instancing, A* heap).
- **The Wanderer across 58m**: hearingRange 30 × loudness now covers ~half
  the floor instead of all of it — gunshots in the kitchen may not pull it
  from the drawing room. That is probably GOOD pacing; confirm at playtest.
- **11-lamp patrol loop** is long; investigate/chase behavior unchanged,
  but time-between-encounters grows. Tuning lever: waypoint subsets or
  patrol speed — playtest first.
- **Figure builder volume** (20+ builders) is mechanical but wide; the box
  fallback means partial delivery still runs — builders can land in waves.
