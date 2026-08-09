# Design: Milestone 3b — The Wanderer

**Date:** 2026-08-09
**Status:** Approved

## Direction change (amends the project spec)

The game moves from pure survival horror toward **action horror**, in the vein
of F.E.A.R.: gunplay is the main event, and fear comes from intensity rather
than helplessness. This supersedes parts of
`2026-08-09-mansion-horror-fps-design.md`:

- Combat is content, not failure. Fights are meant to be fun and repeatable.
- Ammo becomes more generous than "6–20 rounds total" (retuned in Milestone 4
  when pickups land).
- Enemies are **melee** creatures, not armed humans — the horror fiction stays
  intact and all polish goes into how the player's own shooting feels.
- Fleeing is no longer a general answer: the Wanderer is faster than the
  player. The answer is to fight well.

Unchanged: one mansion location, the "dark ink & toon" look, the flashlight as
a real tool, the planned dark basement.

## The Wanderer

A hunched, shambling humanoid with a zombie posture — head jutting low and
lolling, pale eyes — whose forearms are long **scythe blades**, folded against
its body like a mantis at rest. Built from primitives, near-black, so the ink
outline pass traces its jagged silhouette. Its head is a separate body part and
is the weak point.

**The blades are the telegraph.** Folded while prowling (a narrow, near-harmless
silhouette), raised when it locks on, reared back and held for a beat before a
strike, dropped when a bullet staggers it. The same feature that makes it
frightening makes the fight readable, at no extra systems cost.

### Movement identity: "wrong" motion

The Wanderer must read as something rendering incorrectly — jittery, fast,
unnatural. Four techniques combine:

1. **Stop-motion animation.** Its poses snap at ~10 fps while everything else
   in the game runs at 60. Limbs arrive at positions rather than moving to
   them. This carries most of the effect.
2. **Serpentine charge.** It weaves with hard lateral cuts while closing
   distance instead of running straight, which makes it hard to track with the
   crosshair and reads as deliberate dodging.
3. **Twitch layer.** Constant small head and limb jerks at random intervals,
   plus occasional whole-body shudders. It is never still.
4. **Burst–freeze rhythm.** It explodes forward, stops dead for a heartbeat,
   then explodes again. The freezes are the player's shooting windows.

**The deliberate exception:** during the attack wind-up all jitter stops. The
sequence is chaos → sudden absolute stillness with blades reared → strike. The
contrast keeps the telegraph readable (so headshots stay possible and the fight
stays fair) and makes stillness itself frightening.

### Combat numbers (starting values, tunable)

| Property | Value |
|---|---|
| Wanderer health | 100 |
| Revolver body shot | 30 (four of six rounds to kill) |
| Revolver headshot | instant kill |
| Chase burst speed | 7.5 m/s (player sprint is 5.5 — it cannot be outrun) |
| Patrol speed | 1.8 m/s |
| Melee damage to player | 25 |
| Attack wind-up | 0.45 s (the telegraph) |
| Stagger duration | 0.35 s per hit |
| Player health | 100; after 5 s without damage, refills at 12 HP/s |

Stagger is the player's defensive tool: every hit interrupts the Wanderer and
knocks it back, so shooting buys distance as well as depleting health.

### Behavior states

`patrol` → `investigate` → `chase` → `windup` → `attack` → (`stagger`) →
`dead`.

- **patrol** — prowls between waypoints at low speed, blades folded. Waypoints
  are the mansion's six lamp cells, which are already spread one per room.
- **investigate** — a `noise` event pulls it to that position; it waits there
  briefly before returning to patrol. Gunshots already emit noise (Milestone
  3a); this milestone also emits a quieter, shorter-range noise while the
  player sprints.
- **chase** — triggered by seeing the player (forward vision cone, range, clear
  line of sight) or by close proximity; serpentine burst movement, blades up.
  Once chasing, it keeps chasing: it only drops back to patrol after losing
  sight of the player for a sustained period. There is no quick escape.
- **windup** — within melee range: all jitter stops, blades rear back.
- **attack** — the swipe; damages the player if still in range.
- **stagger** — any bullet interrupts the current state (including wind-up) and
  knocks it back.
- **dead** — collapses and stops; the player has cleared the encounter.

Navigation uses **A\* pathfinding over the existing tile grid**, so it comes
around through doorways rather than scraping along walls — the main thing
separating a smart-feeling enemy from a dumb one.

## Player systems

- **Health:** 100, no regeneration for 5 s after taking damage, then a steady
  refill. Medkits replace this model in Milestone 4 if it proves too forgiving.
- **Feedback:** health bar in the HUD, red screen-edge pulse and screen shake
  when hit.
- **Death:** a "YOU DIED" overlay; clicking retries immediately — player
  position and health, Wanderer state and position, and the game clock all
  reset in place, with no page reload.

## Feel

Ink-puff impact particles at the hit point, a brief flash on the figure when
hit, distinct feedback for headshots, screen shake and red vignette pulse when
the player is hit.

## Architecture

Pure logic stays separate from Three.js wiring, matching the existing codebase:

| Module | Responsibility |
|---|---|
| `src/level/pathfinding.js` | A\* over the tile grid; pure, unit-tested |
| `src/enemy/wandererAI.js` | State machine: senses, transitions, timers; pure, clock-injected |
| `src/enemy/wandererFigure.js` | Mesh assembly from primitives + procedural stop-motion animation |
| `src/player/health.js` | Damage, regeneration delay, death; pure |
| `src/core/gameState.js` | `playing` / `dead` states and the reset routine |
| `src/ui/hud.js` (extended) | Health bar, damage vignette, death screen |
| `src/main.js` | Wiring: shootables list, per-frame AI tick, damage routing |

Carry-forwards folded in from Milestone 3a's review: an explicit **shootables**
list (the Wanderer must be a raycast target alongside the level), the recoil
kick extracted to a named constant in radians, and the `lock`
temporal-dead-zone ordering trap in `main.js`.

## Testing

Unit-tested: A\* (finds paths, avoids walls, handles unreachable targets),
AI state transitions (noise → investigate, sight → chase, range → wind-up,
damage → stagger, health ≤ 0 → dead), health (damage, regen delay, death),
figure assembly (parts present, head separate for headshot detection).

Feel, animation, and difficulty are verified by playing — the human partner
playtests each milestone build.

## Out of scope (later milestones)

Multiple simultaneous enemies, ranged enemies, the weapon viewmodel and ADS,
ammo pickups and medkits, audio, the basement, and the second enemy type.
