import { it, expect } from 'vitest';
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
  const player = { x: 5 * CELL, z: 2 * CELL }; // straight ahead down the row
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
  const seen = { x: 5 * CELL, z: 2 * CELL };
  run(ai, 0.5, seen);
  expect(ai.state()).toBe('chase');
  // teleport the player somewhere it cannot see and wait out the timer
  run(ai, WANDERER_CONFIG.loseSightTime + 1, { x: 1000, z: 1000 });
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
