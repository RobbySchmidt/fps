# Mansion — project context for Claude

Stylized action-horror FPS for the browser. Three.js + Vite + plain JavaScript
(ES modules, no TypeScript, no dependencies beyond `three`/`vite`/`vitest`).
Owner: Robby (solo dev, has Phaser experience). This file is the portable
memory — read it fully at session start, especially on a machine without
local Claude memory.

## Current state (2026-08-09, end of session 2)

| Milestone | State |
|---|---|
| M1 grey-box mansion (tile map, FPS controls, collision, flashlight) | merged to main, accepted |
| M2 art pass ("dark ink & toon": toon materials, ink outlines, vignette, lamp lighting) | merged to main, accepted |
| M3a shooting core (jump, revolver, impacts, HUD, noise events) | merged to main, accepted |
| M3b the Wanderer (enemy, health, death/retry) | **complete on branch `milestone-3b-wanderer` — NOT yet merged** |

**First action on a fresh machine:** `git checkout milestone-3b-wanderer`, `npm install`, `npm test` (expect 102 passing).

### Open items, in order

1. **Stutter investigation (dev-server only).** Root-caused to GC pressure;
   production build is smooth. Remaining suspect for the residual dev-mode
   stutter is **OneDrive sync** (the repo lived inside OneDrive on the
   original PC) — the pending experiment is: pause OneDrive syncing, retest
   the dev server. If a session starts on a non-OneDrive machine and the
   stutter is gone, that confirms it; recommend keeping the repo outside
   OneDrive. A hidden perf overlay exists — press **P** in game (frame
   time + heap; a sawtooth heap with big drops = GC).
2. **Merge decision for M3b** — playtest verdict was "scary and fair"; the
   user deferred the merge to next session. Merge `milestone-3b-wanderer`
   into `main` once they confirm.
3. **Tuning questions for the user:** does perfect accuracy stun-lock the
   monster (staggerTime 0.35 == fireCooldown 0.35)? Is the jitter amount
   right?

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

- **M4 content:** keys + escalation, second enemy, shotgun, ammo scarcity via
  pickups + medkits, the basement, weapon viewmodel + hipfire/ADS (user
  wishlist). Before adding the second enemy: extract an `encounter` module
  (array of {ai, figure}, shootables registry, noise subscription, resetAll)
  out of main.js — see the M3b ledger's final-review notes.
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
