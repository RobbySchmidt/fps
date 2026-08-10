# SDD ledger — plan: docs/superpowers/plans/2026-08-10-m4a-ground-floor.md
Branch: feature/m4a-ground-floor (from main @ 363729e; baseline 129 tests green; final 147 green)
Task 1: complete (363729e..f9f3702, review clean) — doorCells in parseMap, doorway guard in expandFurniture
Task 2: complete (f9f3702..7fd2d30, review clean) — keyed ink-material cache
Task 3: complete (7fd2d30..387f6da, review clean) — merged wall geometry
Task 4: complete (387f6da..ff7645d, review clean) — figure field + wave-1 builders
Task 5: complete (ff7645d..b37d5cc, review clean) — wave-2 builders
Task 6: fix round 1/5 (4 addressed) then complete (b37d5cc..f0b90ad) — groundFloor.js, 23 palette keys, MANSION swap, CELL = 1
Task 7: complete (f0b90ad..a5c09f8, review clean) — wall props, optional window lights, static shootables
Final review (whole branch): "with fixes" — 1 Critical, 3 Important, 7 Minor. Fix wave a5c09f8..fe1b112, re-review clean.

## Rulings made during the milestone (user decisions — do not relitigate)

- **CELL 2 → 1 broke three test files** that implicitly assumed cell size 2
  (collision, pathfinding, wandererAI). The plan's "no other existing test is
  modified" constraint was written on a false assumption. Ruling: decouple
  them with an explicit `TEST_CELL = 2`; every assertion and expected value
  preserved byte-identical. Consequence to remember: **the Wanderer AI suite
  now runs a synthetic 2m arena that no shipping level uses** — that gap is
  exactly why the patrol-wedge bug below reached final review.
- **Foyer mirror wall prop** moved from the plan's `x24, z39-40` (z39 is a
  doorway cell, which the plan's own test rejects) to `x24, z40-41`, still
  facing east into the foyer. Revisit at playtest if it reads wrong.
- **wallProps count is 15**, not 16 — spec §5's prose miscounts; its own
  enumeration is 14 exported + `main-door`. Nothing was dropped.

## The bug worth remembering

**Lamp cells double as the Wanderer's patrol route.** `main.js` passes
`parsed.lamps` as waypoints and `moveSet` (walls + blocking furniture) as the
AI's `wallSet`. Five of eleven `L` cells sit inside furniture (lamp over a
table = good level design), so `findPath` returned `null`, the AI fell back to
a wall-ignoring beeline, and the 0.45 radius kept it 0.95m from the lamp
centre — past the 0.8m `waypointRadius` — so `waypointIndex` never advanced.
Simulated: motionless 168 of 180 seconds, never leaving the billiard room.
Kitchen-test was unaffected (no blocked lamps), which is why playtests missed
it. Fixed two ways: `reachableWaypoints()` filters blocked lamps (11 → 6 on the
ground floor; lamp LIGHTING still uses all 11), and the patrol branch now
advances `waypointIndex` when a path is unreachable instead of beelining. The
chase branch keeps the beeline — the player may legitimately stand on
furniture. Each fix is independently sufficient (verified by simulation).

**Any new room manifest must keep lamps and patrol in mind.** Two tests now
guard this: patrol waypoints must be on free cells, and a flood fill from the
spawn must reach every open cell (nothing sealed).

## Deferred / parked — pick these up in M4b

- `reachableWaypoints` can return `[]` if a future level's lamps all sit on
  furniture → patrol throws on `waypoints[NaN]`. Not reachable today; add a
  fallback when the upper floor lands.
- The waypoint test asserts against the shared helper, so it would not catch
  `main.js` reverting to `parsed.lamps`. Pinning the 6 expected cells is the
  cheap upgrade.
- The patrol-advance branch has no direct test (the 19 existing wandererAI
  tests confirm chase/investigate are untouched).
- **Before the second enemy:** the shared ink-material cache is keyed
  `color|family|repeatU|repeatV`. A second chitin enemy would get the SAME
  material instance as the Wanderer, so both would flash on either being hit.
  Fix alongside the `encounter` module extraction the M3b ledger asks for.
- `low` furniture at or above eye height (foyer clock and coat stand at 1.7m =
  `EYE_HEIGHT`; both staircases at 1.5m) blocks the player's view but not the
  Wanderer's. Not a rule violation, but it may read as a bug in playtest.
- The merged wall mesh has a building-sized bounding sphere, so it is never
  frustum-culled — still a net win at this scale, but it stops scaling if the
  cellar and upper floor are ever merged into one level.
- A* is fast (0.30–0.60 ms per `findPath` at 0.4 s repath — ~0.15% of frame
  budget) but allocates thousands of string keys per call. File that under the
  known GC-stutter item, not under pathfinding.
- `buildGreybox` still builds a material for a wall patch that matches zero
  cells; no test for that case. Ink cache key interpolates a numeric
  `colorHex` — fine while the palette stays numeric.
- `buildWallProps` silently falls back to `portrait` on an unknown type, and
  its `spanCells || 1` collapses to one cell if a prop's span axis contradicts
  its facing. All 15 shipped props are consistent.
- Plan Task 7 says the player spawns "facing the locked main door" — actually
  `look.yaw = 0` faces north into the hall, with the door behind. The plan text
  is self-contradictory; the hall-ahead reading is what ships.

## Measured at merge (for the perf conversation)

- 670 wall cells → 2 draw calls. 1350 static meshes → 79 distinct material
  instances. Bookcase spines merged per shelf by material: 693 meshes → 99,
  pixel-identical (630 spines, 0 geometry mismatches).
- Scene at merge: ~19 greybox meshes, ~500 furniture meshes, 204 window
  meshes, 30 wall-prop meshes. 11 lamp PointLights; windows are glow-only.
- Constraints verified by measurement, not assertion: 0 of 89 furniture pieces
  let visuals escape their x/z footprint; tallest object is the kitchen stove
  at exactly 2.80m; flood fill from spawn reaches all 1445 open cells.

## Playtest questions (the handoff)

Orientation after one loop; fight quality across room types (hall arena,
kitchen lanes, library stacks, billiard den); light pacing (lamp rooms vs the
study and passages); perf on the **P** overlay; does it read as one building.
Watch for: Wanderer hearing at 58m scale, 6-waypoint patrol pacing (down from
11 — is the floor still covered?), lamp radius in small rooms, emissive flash
strength, the wall-patch seam mid-corridor at z12.
