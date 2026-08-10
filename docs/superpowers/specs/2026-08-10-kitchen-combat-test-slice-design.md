# Kitchen combat test slice — design

**Date:** 2026-08-10 (session 3)
**Status:** approved in brainstorm; test slice for M4a
**Context:** M4a redesigns the mansion from a blueprint (1m cells, named furnished
rooms, three floors — ground floor first). Before furnishing every room, this
slice validates the two riskiest assumptions in one real room: **gunfighting the
Wanderer around blocking furniture**, and **the engine at 1m cells**. The
playtest verdict decides whether the furniture rules survive as designed.

## Goal

A standalone playable test map — the blueprint's furnished kitchen plus two bare
escape stubs — with a Wanderer inside, at `CELL = 1`. Reached via URL param;
the shipped mansion map is untouched and stays the default.

## Playtest questions (success criteria)

1. Does fighting around the work table feel good — does cover matter, does the
   fight orbit the table?
2. Do 1m-grid A* paths through furniture gaps look sane (no visible zigzag jank)?
3. Does the serpentine weave clip or jam the Wanderer against furniture in
   tight lanes?
4. Does "low cover: shoot over it, monster sees over it, nobody walks through
   it" read clearly in play?
5. Does performance hold at 4× grid resolution (perf overlay, toggle P)?

"Feels bad" outcomes adjust the furniture rules or tuning, not ten room designs
— that is the point of the slice.

## Test map

21×17 cells at 1m. The kitchen interior (x2–13, z2–9) is copied 1:1 from the
approved blueprint mockup; south door to a bare dining stub (retreat space,
player spawn), east L-passage to a dead-end corridor stub.

```
#####################
#####################
##............#######
##............#######
##............#######
##.........W..#######
##............#######
##...L........#######
##............#######
##............DD#####
######DD######DD....#
######DD######DD....#
##............#######
##..L.........#######
##.....S......#######
##............#######
#####################
```

Legend as today (`#` wall, `.` floor, `D` doorway, `S` player spawn, `L` lamp)
plus one new char: **`W` = Wanderer spawn** (optional in a map; the mansion map
keeps its current hardcoded spawn until M4a proper).

Lamps: one in the kitchen (stand-in floor lamp — the pendant-over-table visual
is deferred), one in the dining stub. Moody but fightable.

## Furniture

Furniture is **data alongside the map text**, not map characters — footprint
rectangles in cell coordinates:

```js
// kind: 'low'  ~0.9m — blocks movement + pathfinding; does NOT block enemy
//               sight; shots pass over it (3D raycast handles this naturally)
// kind: 'tall' ~1.9m — blocks movement, pathfinding, AND enemy sight
// kind: 'decor' ~0.5–1m — no collision at all, walk-through set dressing
{ id: 'work-table', kind: 'low',  x0: 6,  z0: 5, x1: 9,  z1: 6,  color: <palette> }
{ id: 'stove',      kind: 'tall', x0: 4,  z0: 2, x1: 5,  z1: 2 }
{ id: 'hearth',     kind: 'tall', x0: 10, z0: 2, x1: 12, z1: 2 }
{ id: 'counter',    kind: 'low',  x0: 2,  z0: 4, x1: 2,  z1: 6 }
{ id: 'larder',     kind: 'tall', x0: 2,  z0: 9, x1: 4,  z1: 9 }
{ id: 'barrel',     kind: 'low',  x0: 13, z0: 4, x1: 13, z1: 4 }
{ id: 'barrel-2',   kind: 'decor', x0: 13, z0: 5, x1: 13, z1: 5 }
{ id: 'stool',      kind: 'decor', x0: 5,  z0: 5, x1: 5,  z1: 5 }
{ id: 'stool-2',    kind: 'decor', x0: 10, z0: 6, x1: 10, z1: 6 }
```

### The two-set rule (core engine change)

Today one `wallSet` feeds collision, A*, and `hasLineOfSight`. The slice splits
it:

- **moveSet** = walls + all `low` + `tall` furniture cells → collision + A*.
- **sightSet** = walls + `tall` furniture cells only → `hasLineOfSight`.

`decor` pieces are in neither set. The Wanderer AI gains an optional `sightSet`
input **defaulting to the moveSet** — existing behavior and all 102 tests stay
untouched; the mansion map passes one set as before.

## Engine changes

1. **Level descriptor.** A level is `{ mapText, cell, furniture, ... }` instead
   of a bare map string. `parseMap` and `buildGreybox` get the cell size
   threaded through; collision and pathfinding already accept `cell` as a
   parameter, so only their call sites change. The existing mansion map becomes
   the default descriptor with `cell: 2` and no furniture — zero behavior
   change.
2. **`src/level/furniture.js`** (DOM-free logic): expand footprints →
   `{ moveCells, sightCells }`, validate footprints sit on floor cells (throw
   on wall/door overlap — same rule the mockup validator enforces).
3. **Furniture rendering** (in the build/art layer): one toon box per piece —
   footprint × kind height — with ink outlines, colors from
   `src/rendering/palette.js`. Meshes join the `shootables` list so bullets
   strike furniture (impact sparks on furniture are fine and free).
4. **Map selection.** `?map=kitchen-test` in the URL loads the test descriptor;
   no param loads the mansion. A tiny pure helper picks the descriptor from a
   query string (testable).
5. **`W` spawn char** in `parseMap` (optional field in the parse result).

## Non-goals / out of scope

- Windows, wall portraits, pendant lamp visuals, rugs (flat decor) — art pass
  polish for M4a proper.
- Pickups, ammo, medkits (M4b).
- Any change to the mansion map, Wanderer tuning, or damage numbers.
- Path smoothing. If 1m A* paths look bad we note it and decide then.

## Testing

TDD per project convention; logic modules DOM-free and clock-injected.

- `furniture.js`: footprint expansion, low/tall/decor set membership,
  floor-overlap validation errors.
- `parseMap`: `W` spawn parsing; cell-size threading (spawn/lamp world coords
  at `cell = 1`).
- Map selection helper: param → descriptor, default fallback.
- AI two-set behavior: with a low-cover cell between monster and player,
  `canSee` is true while the A* path routes around the cell; with a tall cell,
  `canSee` is false.
- Manual playtest checklist = the five questions above.

## Risks / watch-for

- **Serpentine weave vs 1m lanes** — weave amplitude was tuned for 2m
  corridors; the kitchen's lanes are 2–4m. If the Wanderer scrapes walls or
  furniture, first lever is weave amplitude in `movementStyle.js` (tunable),
  not the room.
- **Stagger stun-lock** — staggerTime (0.35) == fireCooldown (0.35); at
  point-blank kitchen ranges this may stun-lock. This playtest doubles as the
  long-postponed tuning check; note the verdict.
- **A* cost at 4×** — 21×17 is trivial, but note pathfinding timing in the perf
  overlay as a preview for the ~46×36 mansion floor (M3b ledger flags the
  linear open-set scan as the first thing to optimize if needed).
