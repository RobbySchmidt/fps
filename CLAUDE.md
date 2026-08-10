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

Everything is on `main` and pushed to GitHub. Fresh machine: `npm install`,
`npm test` (expect 129 passing), `npm run dev`.

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

### IN PROGRESS: M4a "mansion blueprint" — brainstorm mid-flight, slice validated

Redesign the mansion from an architectural blueprint — named furnished
rooms, octagonal grand hall anchor. Decisions already made (do not re-ask):

1. **Blueprint-first**, rooms get identities (foyer, library, …).
2. **1m cells** (down from 2m); same tile engine. Curved geometry rejected.
3. **Three floors** (ground/upper/cellar) as separate maps + stair
   transitions — but the user narrowed M4a to the GROUND FLOOR ONLY;
   upper-floor draft is banked in `.superpowers/brainstorm/` mockups,
   cellar undesigned. Cellar = fully dark flashlight-only floor (M4b+).
4. **Every room gets a furnished mockup** before implementation (user wants
   furniture everywhere). Approved so far: ground-floor overview (46×36m,
   11 spaces), foyer, grand hall, kitchen. Mockup generator (renders real
   tile grids to the visual companion): scratchpad `genfloor.mjs` — regen
   details in the session; concept is reproducible from the approved specs.
5. **Furniture engine rules (playtest-validated in the test slice):**
   `low` ~0.9m blocks movement+A* but not enemy sight (shoot over it);
   `tall` ~1.9m blocks sight too; `decor` = no collision, reserved for
   visually-passable dressing only — anything freestanding that LOOKS solid
   must be `low` (walk-through solid boxes read as clipping). Per-item
   `height` override exists (chairs 0.45).
6. **Room sizing rule from playtest:** 16×10m kitchen feels right for
   fighting the Wanderer; treat that as the MINIMUM fight room. The
   approved blueprint's small rooms (study 7×7, drawing 11×6) must grow or
   be non-combat pressure rooms — blueprint needs a sizing revision pass.

**Engine now supports (test slice, merged):** level descriptors
`{mapText, cell, furniture}` via `src/level/levels.js` + `?map=` URL param;
`parseMap(text, cell)` + `W` wanderer-spawn char; move/sight cell-set split
(`src/level/furniture.js`); AI takes `cell` + `sightSet`; toon furniture
boxes (`src/level/buildFurniture.js`). Mansion map untouched (default).

**Next step when resuming:** revise ground-floor blueprint room sizes per
rule 6, then continue per-room furnished mockups with the visual companion
(dining, sitting, library, drawing, billiard, study, corridors), then spec →
plan → subagent implementation. Read
`docs/superpowers/ledgers/kitchen-combat-test-slice.md` first (M4a
prerequisites: furniture door-overlap validation needs parseMap to record
`D` cells; lamp radius may flatten small rooms; ~1000 wall meshes at 1m
full-mansion — perf watch).

**M4b wishlist addition (user, parked):** jump/vault onto low furniture —
very fun, needs vertical collision + AI reach rules; design note: Wanderer
reach must cover 0.9m surfaces so tables are repositioning, not safety.

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
