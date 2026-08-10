# Mansion — project context for Claude

Stylized action-horror FPS for the browser. Three.js + Vite + plain JavaScript
(ES modules, no TypeScript, no dependencies beyond `three`/`vite`/`vitest`).
Owner: Robby (solo dev, has Phaser experience). This file is the portable
memory — read it fully at session start, especially on a machine without
local Claude memory.

## Current state (2026-08-10, mid session 3)

| Milestone | State |
|---|---|
| M1 grey-box mansion (tile map, FPS controls, collision, flashlight) | merged to main, accepted |
| M2 art pass ("dark ink & toon": toon materials, ink outlines, vignette, lamp lighting) | merged to main, accepted |
| M3a shooting core (jump, revolver, impacts, HUD, noise events) | merged to main, accepted |
| M3b the Wanderer (enemy, health, death/retry) | merged to main, accepted ("scary and fair") |
| M4a kitchen combat test slice (furniture-as-cover, 1m cells, `?map=kitchen-test`) | merged to main, playtest-validated ("that feels good") |
| M4a kitchen ART slice (ink grain/hatch textures, composed furniture, room surfaces, windows, chitin Wanderer) | **merged to main, accepted** ("i love the art style") |
| M4a mansion blueprint — GROUND FLOOR (58×47 @ 1m, 11 furnished rooms, ~90 pieces, wall props, engine perf work) | **implemented on `feature/m4a-ground-floor`, reviewed clean — AWAITING USER PLAYTEST** |

Everything through the art slice is on `main` and pushed to GitHub. Fresh
machine: `npm install`, `npm test` (129 on main, 147 on the ground-floor
branch), `npm run dev`.

**Art direction (decided, session 3): "inked illustration" = direction B.**
Flat toon + ink outlines PLUS sparse hand-drawn grain/hatching via
canvas-generated tileable textures (`src/rendering/inkTextures.js`,
families wood/stone/iron/chitin; greyscale multiply maps tinted by
material.color, chitin baked-color). Per-room floor/wall patches and
moonlight windows exist as level-descriptor data. Furniture is composed
primitives (`src/level/furnitureFigures.js`) with a box fallback. Read
`docs/superpowers/ledgers/kitchen-art-slice.md` before extending: deferred
items include a shared material cache before ten rooms, non-shootable
windows, basin shape, and playtest watch-items (8-light perf, patch seam).

### IN PROGRESS: M4a "mansion blueprint" — BUILT, AWAITING PLAYTEST

All 7 plan tasks executed on `feature/m4a-ground-floor` (9 commits,
363729e..fe1b112). 147 tests green, production build green, per-task and
whole-branch reviews clean. **The branch is NOT merged — the next step is the
user's browser playtest, then merge.**

What shipped: `src/level/groundFloor.js` (the 58×47 map, ~90-piece furniture
manifest, floor/wall patches, 34 glow-only windows, 15 wall props);
`MANSION` now re-exports `GROUND_FLOOR` and `CELL` is `1` (the greybox `MAP`
is gone); 21 new furniture builders + an explicit `item.figure` field; 23 new
palette keys; `src/level/buildWallProps.js`. Engine work: doorway-cell
validation, keyed ink-material cache, merged wall geometry, optional window
lights, one static shootables list.

- **Ledger (read this first):** `docs/superpowers/ledgers/m4a-ground-floor.md`
  — rulings, the patrol-wedge bug worth remembering, deferred items, and the
  measured perf numbers.
- **Spec:** `docs/superpowers/specs/2026-08-10-m4a-ground-floor-design.md`.
  **Plan:** `docs/superpowers/plans/2026-08-10-m4a-ground-floor.md`.
- Playtest questions are at the end of both the plan and the ledger.

Decisions locked during brainstorm (do not re-ask):

1. **Blueprint-first**, 1m cells, three floors as separate maps; M4a =
   GROUND FLOOR ONLY. Upper-floor draft banked (see genfloor.mjs `upper`);
   cellar undesigned, fully dark, M4b+.
2. **Furniture rules (playtest-validated):** `low` ~0.9m blocks
   movement+A* not sight; `tall` ~1.9m blocks sight too; `decor` = no
   collision, ONLY for visually-passable dressing (rugs) — freestanding
   solid-looking pieces must block. Per-item `height` override (chairs
   0.45). Blocking furniture never on doorway cells.
3. **Sizing rule:** 16×10m = minimum fight room (validated). Study 8×8 is
   the deliberate dark non-combat pressure room (no lamp, boarded window).
   Billiard room = single-entrance risk room, Wanderer spawns there.
4. **Corridor policy:** no blocking furniture in corridors/passages ever
   (2m wide; blockers create 1m A* funnels). Runner rugs + wall props only.
5. **Windows on the mansion floor are glow-only** (no PointLights — 34
   would sink the renderer); kitchen-test keeps its 4 lit windows.
6. **Mockup tool saved to the repo:** `docs/superpowers/tools/genfloor.mjs`
   (modes: ground2 = approved blueprint, room <id> = furnished mockups,
   export = engine map+manifest, upper = banked draft). Update SCREEN_DIR
   to the active companion session before generating HTML.

**M4b wishlist (user, parked):** jump/vault onto low furniture — needs
vertical collision + AI reach rules; design note: Wanderer reach must cover
0.9m surfaces so tables are repositioning, not safety. Also parked: door
props/locks, pickups in billiard room + study safe, secretary-desk lore
notes, window light budget revisit.

### Other open items

1. **Dev-server stutter (deferred by user).** Root-caused to GC pressure,
   amplified by Vite dev mode; production build is smooth. Remaining
   suspect: OneDrive sync (repo lives in OneDrive on the original PC).
   Pending experiment: pause OneDrive, retest dev. Perf overlay: press
   **P** in game (frame time + heap; sawtooth heap = GC). Further trim
   candidates are in the M3b ledger.
2. **Tuning questions:** kitchen-slice playtest verdict was "it seemed
   alright" on pathing/weave/stun-lock — no complaints, but no explicit
   answer on stun-lock either; keep an eye on it in the next combat-heavy
   playtest. Jitter amount unquestioned.

## The Wanderer (what M3b built)

Mantis-bladed shambling humanoid, near-black with pale eyes, built from
primitives. Deliberately "wrong" motion: poses snap at 10fps, serpentine
charge, burst-freeze rhythm, constant twitch — except during the attack
wind-up, where ALL jitter stops (stillness is the telegraph). It cannot be
outrun (chase 11 m/s bursts vs 5.5 sprint). It hears gunshots (loud) and
sprinting (quiet) via the event bus, pathfinds with A* over the tile grid,
staggers on every hit, dies to 4 body shots or 1 headshot. Player: 100 HP,
25/hit, regen after 5 s, death → instant retry.

Tunables: `WANDERER_CONFIG` in `src/enemy/wandererAI.js`; damage constants in
`src/main.js`; `ANIMATION_FPS` in `src/enemy/wandererFigure.js`; weave
parameters in `src/enemy/movementStyle.js`.

## Design direction (decisions already made — do not relitigate)

- **Action horror** (F.E.A.R.-leaning), amended from the original survival-horror
  spec: gunplay is the main event; fights are content, not failure; ammo gets
  generous in M4. Fleeing is not the answer; fighting well is.
- Lighting is "moody, not uniformly dark": warm lamp-lit rooms (`L` cells in
  the MAP), a couple of dark pockets. A fully dark **basement** (M4, user's
  idea) will make the flashlight "an actual tool, not a gimmick".
- **Film grain was built and removed after playtest ("very annoying") — never re-add it.**
- All colors come from `src/rendering/palette.js`. Stop-motion/ink aesthetic is
  the identity; XIII was the stylization reference, not to be copied.

## Roadmap

- **M4a (current): the mansion blueprint** — see IN PROGRESS above.
- **M4b content:** keys + escalation, second enemy, shotgun, ammo scarcity
  via pickups + medkits, weapon viewmodel + hipfire/ADS (user wishlist).
  Before adding the second enemy: extract an `encounter` module (array of
  {ai, figure}, shootables registry, noise subscription, resetAll) out of
  main.js — see the M3b ledger's final-review notes.
- **M5 polish:** audio (positional), menus, ending, balancing.

## Process conventions (how we work)

- Superpowers flow: brainstorm → spec (`docs/superpowers/specs/`) → plan
  (`docs/superpowers/plans/`) → subagent-driven implementation on a feature
  branch → per-task review → final whole-branch review → user playtest →
  merge to main. TDD throughout; logic modules are DOM-free and
  clock-injected; wiring stays thin in `src/main.js`.
- Per-milestone ledgers (deferred minors, parked findings, review notes) are
  copied into `docs/superpowers/ledgers/` — read the latest one before
  starting a new milestone.
- The user works in batches and may leave mid-milestone; every task ends in a
  commit, so resuming is always safe. Playtest feedback drives tuning —
  numbers in this codebase are starting points.

## Commands

`npm run dev` (server; the user plays via hot reload during sessions),
`npm test` (Vitest), `npm run build` / `npm run preview` (production).
Controls: WASD, mouse, Shift sprint, Space jump, F flashlight, left click
fire, R reload, Esc pause, P perf overlay.
