# Mansion — project context for Claude

Stylized action-horror FPS for the browser. Three.js + Vite + plain JavaScript
(ES modules, no TypeScript, no dependencies beyond `three`/`vite`/`vitest`).
Owner: Robby (solo dev, has Phaser experience). This file is the portable
memory — read it fully at session start, especially on a machine without
local Claude memory.

## Current state (2026-08-10, start of session 3)

| Milestone | State |
|---|---|
| M1 grey-box mansion (tile map, FPS controls, collision, flashlight) | merged to main, accepted |
| M2 art pass ("dark ink & toon": toon materials, ink outlines, vignette, lamp lighting) | merged to main, accepted |
| M3a shooting core (jump, revolver, impacts, HUD, noise events) | merged to main, accepted |
| M3b the Wanderer (enemy, health, death/retry) | **merged to main, accepted** ("scary and fair") |

Everything is on `main` and pushed to GitHub. Fresh machine: `npm install`,
`npm test` (expect 102 passing), `npm run dev`.

### IN PROGRESS: M4a "mansion blueprint" — brainstorming, mid-flight

The user's idea (session 3): redesign the mansion from an actual
architectural blueprint — named, recognizable rooms instead of
square-to-square sameness; varied shapes; a round central hall as the
orientation anchor; three floors. Decisions already made in brainstorming
(do not re-ask):

1. **Blueprint-first**: design all floor plans as a document before touching
   code; rooms get identities (foyer, library, etc.) for orientation.
2. **Finer grid, 1m cells** (down from 2m): same tile engine (collision, A*,
   LOS, rendering all keep working), 4x resolution allows octagonal "round"
   hall, L-shaped rooms, alcoves, varied corridor widths. True curved
   geometry was considered and rejected (full engine rewrite, not worth it;
   chunky suits the ink aesthetic).
3. **Three floors — ground, upper, cellar — as separate per-floor maps**
   connected by stair-transition zones (walk into stairwell → short fade →
   matching landing on the other floor; classic Resident Evil). No vertical
   physics. The Wanderer hunts on its own floor for now. The cellar is the
   fully dark flashlight-only floor (long-standing user idea).

**Next step when resuming:** design the actual three floor plans WITH THE
VISUAL COMPANION (browser mockup tool from the brainstorming skill) — the
user explicitly agreed to use it for this. Then: finish brainstorm → spec →
plan → subagent implementation, per the usual process. No spec has been
written yet.

### Other open items

1. **Dev-server stutter (deferred by user).** Root-caused to GC pressure,
   amplified by Vite dev mode; production build is smooth. Remaining
   suspect: OneDrive sync (repo lives in OneDrive on the original PC).
   Pending experiment: pause OneDrive, retest dev. Perf overlay: press
   **P** in game (frame time + heap; sawtooth heap = GC). Further trim
   candidates are in the M3b ledger.
2. **Tuning questions (user never answered — re-ask after next playtest):**
   does perfect accuracy stun-lock the monster (staggerTime 0.35 ==
   fireCooldown 0.35)? Is the jitter amount right?

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
