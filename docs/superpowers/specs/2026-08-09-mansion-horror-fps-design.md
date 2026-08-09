# Design: "Mansion" — Stylized Survival-Horror FPS (working title)

**Date:** 2026-08-09
**Status:** Approved

## Concept

A first-person survival horror shooter running in the browser. The player is
trapped in an old mansion at night and must explore dark rooms, find keys and
scarce supplies, and survive the creatures living there to escape. One
contained location, a complete 20–40 minute experience with a beginning,
escalation, and ending.

**Visual identity: "dark ink & toon."** Cel shading in a muted, desaturated
palette; shadows fall to near-black ("inked" darkness); thin dark outlines
(not thick comic-black); cold moonlight blues/greys contrasted with warm
accents (candlelight, muzzle flash); film grain and vignette on top. The style
is inspired by stylized games like XIII in *technique* only — the presentation
is a normal FPS with horror mood, no comic-panel gimmicks.

**Why stylized:** the engine is not the limitation for a solo web game — asset
production is. Cel shading with outlines makes low-poly free assets look
deliberate and coherent, and darkness hides simplicity.

## Tech stack

- **Three.js** for real 3D rendering (Phaser is 2D-only and was ruled out for
  true 3D; its raycasting pseudo-3D alternative was considered and rejected)
- **Vite** as dev server and bundler
- **Plain JavaScript** (TypeScript optional later)
- **HUD and menus as HTML/CSS overlay** on top of the canvas
- **Positional audio** via Three.js built-in audio (`AudioListener` /
  `PositionalAudio`)
- **Assets:** CC0 low-poly packs (Kenney, Quaternius, Sketchfab CC0),
  re-materialed with the game's toon shader so mismatched packs read as one
  coherent style
- **Target platform:** desktop browser. Mobile is out of scope.

## Gameplay

### Objective structure

Find 3 hidden key items spread across the mansion to unlock the exit. Picking
up each key item escalates the danger (more/faster enemies, changed lighting).
Finale: a tense run back to the exit door; escaping wins the game.

### Player

- Pointer-lock first-person controller: WASD + mouse look, sprint. No
  crouch/lean mechanics in v1 (keep it simple).
- **Flashlight** always available — the core tool. Battery drains slowly;
  batteries are pickups, keeping darkness a resource decision.
- **Health:** no regeneration; sparse bandage pickups. Fleeing and sneaking
  past enemies are always valid strategies.

### Weapons

- **Revolver** from the start. Ammo is scarce (roughly 6–20 rounds found in
  total) — every shot is a decision.
- **Shotgun** findable mid-game as a power spike.
- Hit detection is raycast-based (hitscan); no projectile physics.
- Gunshots make noise that attracts enemies.

### Enemies (2 types)

- **Wanderer** — slow, patrols corridors, reacts to noise (gunshots, running).
  State machine: patrol → investigate noise → chase → attack.
- **Crawler** — fast, ambushes from dark rooms, fragile but terrifying.
- Few enemies total; each is a genuine threat. Simple state-machine AI with
  waypoint navigation through the mansion's rooms and corridors.

## Architecture

Small focused modules with one clear purpose each:

| Module | Responsibility |
|---|---|
| `core/` | Game loop, game states (menu / playing / paused / dead / escaped), input handling, event bus |
| `rendering/` | Toon shading (`MeshToonMaterial` + custom gradient steps), outline pass, post-processing (film grain, vignette, fog, color grading) |
| `player/` | FPS controller (pointer lock), flashlight, health, inventory (ammo, keys, batteries) |
| `weapons/` | Revolver/shotgun logic, raycast hits, muzzle flash, reload |
| `enemies/` | AI state machines, waypoint navigation, spawning/escalation |
| `level/` | Mansion layout assembled from asset-pack pieces, doors/locks, pickups, trigger zones |
| `audio/` | Ambient loops, positional enemy sounds, stingers |
| `ui/` | HTML HUD (health, ammo, battery, interaction prompts), menus, damage feedback |

**Data flow:** the game loop ticks each system per frame; cross-module
communication goes through a small event bus (e.g. `noise-emitted`,
`player-damaged`, `key-item-collected`) so modules stay decoupled.

**Error handling:** pointer-lock loss pauses the game; asset loading runs
behind a loading screen with failure messaging; WebGL context loss shows a
reload prompt.

**Testing:** game logic (AI state transitions, inventory, damage/ammo math,
escalation rules) is unit-testable with Vitest. Rendering and feel are
verified by playing milestone builds.

## Build order (each milestone is playable)

1. **Grey-box mansion** — walkable rooms with FPS controls and flashlight, no
   art
2. **Art pass** — toon shader, outlines, post-processing, lighting. The look
   is proven early; if "dark ink" doesn't land, adjust before building content
   on it.
3. **Combat loop** — one enemy (Wanderer) + revolver: the core fun/fear test
4. **Content** — full mansion layout, 3 key items, Crawler, shotgun, pickups,
   escalation
5. **Polish** — audio, menus, balancing, ending sequence

## Risks and known limitations

- **Enemy models** are the weak point of free packs; expect to creatively
  modify one (scale, distortion, silhouette, lighting) to make it scary.
- **Performance:** target is a smooth 60 fps on a normal desktop; keep
  shadow-casting lights to a handful at a time.
- **No save system in v1** — a 20–40 minute game is one sitting; can be added
  later.
- **Scope discipline:** exactly 2 enemy types, 2 weapons, 1 location. Any
  expansion happens only after v1 is complete and fun.
