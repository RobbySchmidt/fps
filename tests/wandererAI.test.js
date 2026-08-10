import { describe, it, expect } from 'vitest';
import { createWandererAI, WANDERER_CONFIG } from '../src/enemy/wandererAI.js';
import { CELL } from '../src/level/mapData.js';

// An open 9x9 arena: only the border is wall, so cells 1..7 are walkable.
function makeArena() {
  const wallSet = new Set();
  for (let i = 0; i < 9; i++) {
    wallSet.add(`${i},0`);
    wallSet.add(`${i},8`);
    wallSet.add(`0,${i}`);
    wallSet.add(`8,${i}`);
  }
  return wallSet;
}

const wallSet = makeArena();
const spawn = { x: 2 * CELL, z: 2 * CELL };
const waypoints = [{ x: 6 * CELL, z: 2 * CELL }, { x: 6 * CELL, z: 6 * CELL }];
const far = { x: 7 * CELL, z: 7 * CELL };

function makeAI(config = {}) {
  return createWandererAI({ spawn, wallSet, waypoints, config });
}

function run(ai, seconds, player, dt = 1 / 60) {
  let events = { attacked: false };
  for (let t = 0; t < seconds; t += dt) {
    const step = ai.update(dt, player);
    if (step.attacked) events.attacked = true;
  }
  return events;
}

it('starts patrolling and walks toward its first waypoint', () => {
  const ai = makeAI();
  expect(ai.state()).toBe('patrol');
  const before = ai.position();
  run(ai, 1, far);
  const after = ai.position();
  expect(after.x).toBeGreaterThan(before.x);
});

it('investigates a noise it can hear', () => {
  const ai = makeAI();
  ai.hearNoise({ x: 6 * CELL, z: 6 * CELL, loudness: 1 });
  expect(ai.state()).toBe('investigate');
  const before = ai.position();
  run(ai, 1, far);
  expect(ai.position().z).toBeGreaterThan(before.z);
});

it('ignores a quiet noise from far away', () => {
  const ai = makeAI();
  ai.hearNoise({ x: 7 * CELL, z: 7 * CELL, loudness: 0.05 });
  expect(ai.state()).toBe('patrol');
});

it('chases a player it can see and closes the distance', () => {
  const ai = makeAI();
  const player = { x: 7 * CELL, z: 2 * CELL }; // far enough that 0.5s of chasing does not reach melee range
  const startDistance = Math.hypot(player.x - spawn.x, player.z - spawn.z);
  run(ai, 0.5, player);
  expect(ai.state()).toBe('chase');
  const now = ai.position();
  expect(Math.hypot(player.x - now.x, player.z - now.z)).toBeLessThan(startDistance);
});

it('winds up and then lands one attack when it reaches the player', () => {
  const ai = makeAI();
  const player = { x: 3 * CELL, z: 2 * CELL }; // very close
  run(ai, 0.4, player);
  expect(['chase', 'windup']).toContain(ai.state());
  const events = run(ai, 1.5, player);
  expect(events.attacked).toBe(true);
});

it('a hit staggers it and interrupts the wind-up', () => {
  const ai = makeAI();
  const player = { x: 3 * CELL, z: 2 * CELL };
  run(ai, 1, player);
  ai.takeHit({ damage: 30, from: player });
  expect(ai.state()).toBe('stagger');
  expect(ai.health()).toBe(WANDERER_CONFIG.maxHealth - 30);
});

it('a headshot kills instantly at full health', () => {
  const ai = makeAI();
  const result = ai.takeHit({ damage: 30, headshot: true, from: far });
  expect(result.killed).toBe(true);
  expect(ai.isDead()).toBe(true);
  expect(ai.state()).toBe('dead');
});

it('four body shots kill it', () => {
  const ai = makeAI();
  for (let i = 0; i < 3; i++) ai.takeHit({ damage: 30, from: far });
  expect(ai.isDead()).toBe(false);
  const result = ai.takeHit({ damage: 30, from: far });
  expect(result.killed).toBe(true);
  expect(ai.isDead()).toBe(true);
});

it('a dead Wanderer stops moving and cannot attack', () => {
  const ai = makeAI();
  ai.takeHit({ damage: 999, from: far });
  const restingPlace = ai.position();
  const events = run(ai, 2, { x: 2 * CELL, z: 2 * CELL });
  expect(ai.position()).toEqual(restingPlace);
  expect(events.attacked).toBe(false);
});

it('gives up and returns to patrol after losing the player for long enough', () => {
  const ai = makeAI();
  const seen = { x: 7 * CELL, z: 2 * CELL };
  run(ai, 0.5, seen);
  expect(ai.state()).toBe('chase');
  // teleport the player somewhere it cannot see and wait out the timer
  run(ai, WANDERER_CONFIG.loseSightTime + 4, { x: 1000, z: 1000 });
  expect(ai.state()).toBe('patrol');
});

it('reset returns it to the spawn, full health and patrolling', () => {
  const ai = makeAI();
  run(ai, 1, { x: 3 * CELL, z: 2 * CELL });
  ai.takeHit({ damage: 60, from: far });
  ai.reset();
  expect(ai.state()).toBe('patrol');
  expect(ai.health()).toBe(WANDERER_CONFIG.maxHealth);
  expect(ai.position()).toEqual(spawn);
});

it('chase speed outpaces the player sprint even with burst-freeze and weaving', () => {
  const dutyCycle = 0.55 / (0.55 + 0.25);          // burstFreezeFactor defaults
  const worstCaseWeave = 1 / Math.hypot(1, 0.7);   // forward component at peak weave
  expect(WANDERER_CONFIG.chaseSpeed * dutyCycle * worstCaseWeave).toBeGreaterThan(5.5);
});

it('gives up investigating a noise it can never reach', () => {
  const ai = makeAI();
  ai.hearNoise({ x: 0, z: 0, loudness: 1 }); // inside a wall cell: unreachable
  expect(ai.state()).toBe('investigate');
  run(ai, WANDERER_CONFIG.investigateTimeout + 1, far);
  expect(ai.state()).toBe('patrol');
});

it('stands perfectly still during the wind-up telegraph', () => {
  const ai = makeAI();
  const player = { x: 3 * CELL, z: 2 * CELL };
  let guard = 0;
  while (ai.state() !== 'windup' && guard++ < 600) ai.update(1 / 60, player);
  expect(ai.state()).toBe('windup');
  const frozen = ai.position();
  ai.update(1 / 60, player);
  ai.update(1 / 60, player);
  expect(ai.position()).toEqual(frozen);
});

it('a gunshot heard while staggering does not cancel the stagger', () => {
  const ai = makeAI();
  ai.takeHit({ damage: 30, from: far });
  expect(ai.state()).toBe('stagger');
  ai.hearNoise({ x: far.x, z: far.z, loudness: 1 }); // the shot that caused the hit
  expect(ai.state()).toBe('stagger');
});

it('cannot wind up on a player it has no line of sight to', () => {
  // a wall cell at (4,2) between the Wanderer at (3,2) and the player at (5,2)
  const blocked = new Set([...wallSet, '4,2']);
  const ai = createWandererAI({
    spawn: { x: 3 * CELL, z: 2 * CELL },
    wallSet: blocked,
    waypoints,
  });
  const player = { x: 5 * CELL, z: 2 * CELL };
  run(ai, 1, player);
  expect(['windup', 'attack']).not.toContain(ai.state());
});

describe('two-set furniture behavior at cell 1', () => {
  // 7x5 map, all floor inside a wall ring; a 1-cell "table" at 3,2
  // between the monster (1,2) and the player (5,2).
  function ringWalls(cols, rows) {
    const set = new Set();
    for (let c = 0; c < cols; c++) { set.add(`${c},0`); set.add(`${c},${rows - 1}`); }
    for (let r = 0; r < rows; r++) { set.add(`0,${r}`); set.add(`${cols - 1},${r}`); }
    return set;
  }

  it('sees the player across low cover and paths around it', () => {
    const walls = ringWalls(7, 5);
    const moveSet = new Set([...walls, '3,2']); // low table blocks movement only
    const sightSet = walls;                      // ...but not sight
    const ai = createWandererAI({
      spawn: { x: 1, z: 2 },
      wallSet: moveSet,
      sightSet,
      cell: 1,
      waypoints: [{ x: 1, z: 2 }],
      // within proximityRange the facing cone is skipped — otherwise the monster
      // starts facing away and the sight-set behavior never gets exercised
      config: { proximityRange: 100 },
    });
    ai.update(0.016, { x: 5, z: 2 });
    expect(ai.state()).toBe('chase');
    // let it move: it must make progress toward the player without ever
    // standing on the blocked table cell
    for (let i = 0; i < 120; i++) {
      ai.update(0.016, { x: 5, z: 2 });
      const p = ai.position();
      expect(Math.round(p.x) === 3 && Math.round(p.z) === 2).toBe(false);
    }
    const p = ai.position();
    expect(Math.hypot(5 - p.x, 2 - p.z)).toBeLessThan(4);
  });

  it('does not see the player across tall cover', () => {
    const walls = ringWalls(7, 5);
    const moveSet = new Set([...walls, '3,1', '3,2', '3,3']); // tall shelf wall-to-wall
    const sightSet = moveSet;
    const ai = createWandererAI({
      spawn: { x: 1, z: 2 },
      wallSet: moveSet,
      sightSet,
      cell: 1,
      waypoints: [{ x: 1, z: 2 }],
      config: { proximityRange: 100 }, // neutralize the facing cone: only sight blocking matters here
    });
    ai.update(0.016, { x: 5, z: 2 });
    expect(ai.state()).toBe('patrol');
  });

  it('defaults sightSet to wallSet and cell to CELL (existing behavior)', () => {
    const walls = ringWalls(7, 5);
    const ai = createWandererAI({
      spawn: { x: 1 * CELL, z: 2 * CELL },
      wallSet: new Set([...walls, '3,1', '3,2', '3,3']),
      waypoints: [{ x: 1 * CELL, z: 2 * CELL }],
      config: { proximityRange: 100 }, // neutralize the facing cone here too
    });
    ai.update(0.016, { x: 5 * CELL, z: 2 * CELL });
    expect(ai.state()).toBe('patrol'); // the blocker also blocks sight by default
  });
});
