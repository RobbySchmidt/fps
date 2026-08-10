# Kitchen art slice — design ("inked illustration" pass)

**Date:** 2026-08-10 (session 3)
**Status:** approved in brainstorm
**Context:** M4a's combat rules and room sizing are playtest-validated on the
kitchen test map (`?map=kitchen-test`). Before furnishing ten rooms, this
slice sets the VISUAL template: art direction **B — toon + hand-drawn grain
and hatching** (user: "i love B"), applied to that same kitchen map. The
identity stays "dark ink & toon" (flat palette colors, hard toon steps,
post-stack ink outlines); this pass adds sparse hand-drawn surface detail —
it deepens the identity, never replaces it. Film-grain lesson applies:
subtle, surface-bound, never a screen effect.

## Goal

Walk the kitchen test map and it reads as the game's actual art, not a
greybox: composed-primitive furniture with inked grain, per-room floor/wall
surfaces, glowing windows, and a subtly textured Wanderer. This look is the
template every M4a room copies.

## Playtest questions (success criteria)

1. Does the kitchen read as "an inked illustration come to life"?
2. Does furniture detail (legs, shelves, jars) hold up in first person at
   melee distance without breaking the chunky aesthetic?
3. Does the Wanderer keep its silhouette scare in darkness while gaining
   readable surface detail in lamplight / flashlight?
4. Do the kitchen's distinct floor/walls vs the plain dining stub prove the
   per-room-surface idea?
5. Perf: texture maps + more meshes — frame time still smooth (P overlay)?

## 1. Ink texture system

New module `src/rendering/inkTextures.js` (rendering layer — Three.js +
canvas allowed, untested by project convention):

- `createInkTexture(family, baseColorHex)` → `THREE.CanvasTexture`,
  `RepeatWrapping`, `NearestFilter` (crisp strokes, no mip smear). A small
  tileable canvas (256×256) filled with the base color, plus sparse
  hand-drawn-style strokes in a darker (or for chitin, slightly lighter)
  shade of the SAME hue — never a new color outside the palette's family.
- Families and stroke vocabulary:
  - `wood` — long wavering grain strokes + occasional knot ellipse.
  - `stone` — short speckle dashes + sparse cross-hatch patches.
  - `iron` — faint straight scratches + rivet dots along edges.
  - `chitin` — thin curved ridge strokes + sparse scratch hatching,
    ~10% LIGHTER than base (reads only when lit).
- Strokes are sparse: ≥70% of the tile is untouched base color. The toon
  gradient map and ink outlines do the rest.
- **Tinting model** (so existing color-based behaviors keep working):
  - `wood` / `stone` / `iron`: the canvas is GREYSCALE — white base
    (1.0) with darker strokes (~0.78). Used as a multiply `map` while
    `material.color` carries the palette color. One cached texture per
    family serves every color.
  - `chitin` is the exception: a 15%-relative delta on a near-black
    multiply would be invisible, so its canvas bakes actual colors —
    base `PALETTE.wanderer` (0x0d1014) with strokes ~0x232a33 (a
    slightly lighter cold grey: ~2× the luminance, still near-black) —
    and `material.color` stays white.
- `src/rendering/toonMaterial.js` gains
  `createInkMaterial(colorHex, family)` → `MeshToonMaterial` wired per the
  tinting model above, sharing the existing gradient map.
  `createToonMaterial` is unchanged for existing callers.

## 2. Composed-primitive furniture

New module `src/level/furnitureFigures.js` (Three-only): one builder per
furniture id, each returning a `THREE.Group` of primitive meshes that stays
within the piece's footprint bounds (visuals must match collision):

- `work-table`: 0.12m-thick top on four 0.12m square legs + side aprons.
- `stove`: iron body, front oven door (inset box + handle bar), two hob
  rings (short cylinders) on top, stovepipe cylinder rising to the wall top.
- `hearth`: stone surround (two jambs + lintel), shallow dark firebox,
  mantel shelf, small kettle (sphere + handle torus) hanging in the opening.
- `counter`: stone top with an inset basin (box with rim), wood cabinet
  base below.
- `larder`: wood frame, three shelf boards, 6–10 small jars/tins (tiny
  cylinders/boxes in muted palette shades) scattered on the shelves.
- `barrel` / `barrel-2`: cylinder with two darker iron hoop rings.
- `stool` / `stool-2`: round seat on three splayed legs.

`src/level/buildFurniture.js` uses a figure builder when one exists for the
item's id, else falls back to the current box (future rooms add builders
incrementally). All part meshes are collected into a flat
`group.userData.hitMeshes` array; `main.js` spreads THAT into `shootables`
instead of `furnitureGroup.children`, so bullets hit the real geometry and
impact sparks land on what was struck. Collision/pathfinding unchanged
(footprint cells).

## 3. Per-room surfaces

Level descriptors gain two optional arrays (absent = current behavior):

```js
floorPatches: [{ x0, z0, x1, z1, family, color }]
wallPatches:  [{ x0, z0, x1, z1, family, color }]
```

- `buildGreybox` renders each floor patch as a plane 0.01m above the base
  floor (avoids z-fighting) with `createInkMaterial`, sized/positioned by
  the cell rect.
- Wall cells inside a wallPatch rect use the patch material instead of the
  default wall material (checked per wall cell at build time).
- The kitchen-test descriptor patches the kitchen room (x2–17, z2–11 plus
  its wall ring): stone floor (`family: 'stone'`, a slightly warm grey from
  the palette), stone-tinted walls. The dining stub keeps defaults — the
  map demonstrates before/after in one walk.
- New palette keys for the slice: `kitchenFloor: 0x4a4d52`,
  `kitchenWall: 0x62676e` (values tunable at playtest).

## 4. Windows

Level descriptors gain `windows: [{ x, z, facing }]` — a wall cell and the
direction its window faces (`'n' | 's' | 'e' | 'w'`). For each:
ink-dark frame (thin box outline) + a pale glow plane (basic material,
`PALETTE.moonlight: 0xbfd0e6`, slight emissive feel via plain
MeshBasicMaterial) mounted on the wall cell's interior face, plus a faint
`PointLight` (intensity ~2, distance ~4, cool color) just inside — enough
for a pool of moonlight, cheap enough to keep. Kitchen-test windows: north
wall at x9–10 (two adjacent cells, one wide window each) and west wall at
z8–9, matching the approved mockup.

## 5. The Wanderer

`src/enemy/wandererFigure.js`: body-part materials switch from
`createToonMaterial(PALETTE.wanderer)` to
`createInkMaterial(PALETTE.wanderer, 'chitin')`. Eyes stay flat pale —
untouched. **The hit flash must migrate from color to emissive**: today
`update()` does `skin.color.setHex(PALETTE.wanderer)` then
`skin.color.lerp(FLASH_COLOR, flashAmount)` (wandererFigure.js:115-116);
with the chitin map the material color is white, so the flash becomes
`skin.emissive` lerped from black toward white by `flashAmount` (and reset
to black each frame). MeshToonMaterial supports emissive. Same decay, same
FLASH_COLOR constant. No geometry, animation, or AI changes.

## Non-goals / out of scope

- No changes to the mansion map, other rooms, or the blueprint.
- No image/texture assets on disk — everything canvas-generated.
- No screen-space effects (grain stays on surfaces; the film-grain ban
  stands).
- No new furniture pieces or collision changes.
- No audio.

## Testing

- Logic surface is deliberately thin; canvas/Three modules follow the
  untested-rendering convention. Testable seams:
  - `furnitureBox` and footprint logic: unchanged, already covered.
  - Descriptor sanity (append to `tests/levels.test.js`): kitchen-test
    `floorPatches`/`wallPatches`/`windows` reference in-bounds cells;
    window cells are wall cells; patch rects are non-inverted.
- Everything else is the manual playtest against the five questions.

## Risks / watch-for

- **Vitest has no canvas**: `inkTextures.js` must only be imported by
  rendering modules (`buildFurniture`, `buildGreybox` via materials,
  `wandererFigure`), never by logic modules the test suite loads. The
  descriptor data (patches/windows) lives in `kitchenTest.js` as plain
  data — safe to import in tests.
- **NearestFilter moiré** at distance: if strokes shimmer, switch to
  LinearFilter + slightly thicker strokes (playtest call).
- **Wanderer readability**: if chitin strokes read at all in darkness,
  they are too strong — darkness silhouette is non-negotiable.
- **Stovepipe/wall-top furniture height**: pieces may not exceed
  WALL_HEIGHT (3m); stovepipe stops at 2.8m.
