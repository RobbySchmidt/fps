import { moveWithCollision } from '../level/collision.js';
import { findPath, worldToCell, cellToWorld, hasLineOfSight } from '../level/pathfinding.js';
import { burstFreezeFactor, serpentineDirection } from './movementStyle.js';

export const WANDERER_CONFIG = {
  maxHealth: 100,
  radius: 0.45,
  patrolSpeed: 1.8,
  investigateSpeed: 3.0,
  // Burst speed, reduced by the burst-freeze duty cycle (0.55/(0.55+0.25) ≈ 0.6875)
  // and by the serpentine weave's forward component (≈0.82 at peak weave), must still
  // net faster than the player's 5.5 sprint: 11 * 0.6875 * 0.82 ≈ 6.2 > 5.5.
  chaseSpeed: 11,
  sightRange: 14,
  sightHalfAngle: (50 * Math.PI) / 180,
  proximityRange: 3.5,      // senses the player this close regardless of facing
  hearingRange: 30,         // multiplied by a noise's loudness
  meleeRange: 1.9,
  attackReachBonus: 0.6,    // extra reach forgiveness when the swipe actually lands
  windupTime: 0.45,         // the telegraph: all jitter stops
  attackTime: 0.25,
  recoverTime: 0.5,
  staggerTime: 0.35,
  knockback: 0.45,
  loseSightTime: 6,
  investigateTime: 4,
  investigateTimeout: 12,   // give up even if the noise position is never reachable
  repathInterval: 0.4,
  arriveRadius: 0.35,
  waypointRadius: 0.8,
};

function normalize(x, z) {
  const length = Math.hypot(x, z);
  if (length < 1e-6) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

function angleDifference(a, b) {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function createWandererAI({ spawn, wallSet, waypoints, config = {} }) {
  const cfg = { ...WANDERER_CONFIG, ...config };

  let state = 'patrol';
  let position = { x: spawn.x, z: spawn.z };
  let facing = 0;
  let health = cfg.maxHealth;
  let stateTime = 0;
  let moveTime = 0;
  let waypointIndex = 0;
  let noiseTarget = null;
  let path = [];
  let repathTimer = 0;
  let unseenTime = 0;
  let swingSpent = false;

  function setState(next) {
    state = next;
    stateTime = 0;
    if (next === 'attack') swingSpent = false;
    if (next === 'patrol' || next === 'investigate' || next === 'chase') {
      path = [];
      repathTimer = 0; // repath once on entry, then honour the interval
    }
  }

  function stepToward(goal, speed, dt, serpentine) {
    repathTimer -= dt;
    if (repathTimer <= 0) {
      repathTimer = cfg.repathInterval;
      const route = findPath(
        worldToCell(position.x, position.z),
        worldToCell(goal.x, goal.z),
        wallSet,
      );
      path = route ? route.slice(1) : [];
    }

    let step = path.length > 0 ? cellToWorld(path[0].c, path[0].r) : goal;
    if (path.length > 0 && Math.hypot(step.x - position.x, step.z - position.z) < cfg.arriveRadius) {
      path.shift();
      step = path.length > 0 ? cellToWorld(path[0].c, path[0].r) : goal;
    }

    const direction = serpentine
      ? serpentineDirection(position, step, moveTime)
      : normalize(step.x - position.x, step.z - position.z);
    if (direction.x === 0 && direction.z === 0) return;

    facing = Math.atan2(direction.x, direction.z);
    position = moveWithCollision(
      position,
      direction.x * speed * dt,
      direction.z * speed * dt,
      wallSet,
      cfg.radius,
    );
  }

  function canSee(player) {
    const dx = player.x - position.x;
    const dz = player.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > cfg.sightRange) return false;
    if (distance > cfg.proximityRange) {
      const toPlayer = Math.atan2(dx, dz);
      if (Math.abs(angleDifference(toPlayer, facing)) > cfg.sightHalfAngle) return false;
    }
    return hasLineOfSight(position, player, wallSet);
  }

  function update(dt, player) {
    const events = { attacked: false };
    if (state === 'dead') return events;

    stateTime += dt;
    moveTime += dt;

    const distance = Math.hypot(player.x - position.x, player.z - position.z);

    if (state === 'stagger') {
      if (stateTime >= cfg.staggerTime) setState('chase');
      return events;
    }

    if (state === 'windup') {
      // Deliberately frozen: this stillness is the readable telegraph.
      facing = Math.atan2(player.x - position.x, player.z - position.z);
      if (stateTime >= cfg.windupTime) setState('attack');
      return events;
    }

    if (state === 'attack') {
      if (!swingSpent) {
        swingSpent = true;
        if (
          distance <= cfg.meleeRange + cfg.attackReachBonus &&
          hasLineOfSight(position, player, wallSet)
        ) {
          events.attacked = true;
        }
      }
      if (stateTime >= cfg.attackTime + cfg.recoverTime) setState('chase');
      return events;
    }

    const seen = canSee(player);
    if (seen) {
      unseenTime = 0;
      if (state !== 'chase') setState('chase');
    } else if (state === 'chase') {
      unseenTime += dt;
      if (unseenTime >= cfg.loseSightTime) setState('patrol');
    }

    if (state === 'chase') {
      if (distance <= cfg.meleeRange && hasLineOfSight(position, player, wallSet)) {
        setState('windup');
        return events;
      }
      if (burstFreezeFactor(moveTime) > 0) {
        stepToward(player, cfg.chaseSpeed, dt, true);
      } else {
        facing = Math.atan2(player.x - position.x, player.z - position.z);
      }
      return events;
    }

    if (state === 'investigate') {
      if (stateTime >= cfg.investigateTimeout) {
        setState('patrol'); // give up even if the noise was never reachable
        return events;
      }
      const reached =
        !noiseTarget ||
        Math.hypot(noiseTarget.x - position.x, noiseTarget.z - position.z) <= cfg.waypointRadius;
      if (!reached) {
        stepToward(noiseTarget, cfg.investigateSpeed, dt, false);
      } else if (stateTime >= cfg.investigateTime) {
        setState('patrol');
      }
      return events;
    }

    const waypoint = waypoints[waypointIndex % waypoints.length];
    if (Math.hypot(waypoint.x - position.x, waypoint.z - position.z) <= cfg.waypointRadius) {
      waypointIndex = (waypointIndex + 1) % waypoints.length;
      path = [];
    } else {
      stepToward(waypoint, cfg.patrolSpeed, dt, false);
    }
    return events;
  }

  function takeHit({ damage, headshot = false, from = null }) {
    if (state === 'dead') return { killed: false };

    health = headshot ? 0 : Math.max(0, health - damage);

    if (from) {
      const away = normalize(position.x - from.x, position.z - from.z);
      position = moveWithCollision(
        position,
        away.x * cfg.knockback,
        away.z * cfg.knockback,
        wallSet,
        cfg.radius,
      );
    }

    if (health <= 0) {
      setState('dead');
      return { killed: true };
    }
    setState('stagger');
    return { killed: false };
  }

  function hearNoise({ x, z, loudness = 1 }) {
    if (
      state === 'dead' ||
      state === 'stagger' ||
      state === 'chase' ||
      state === 'windup' ||
      state === 'attack'
    ) {
      return;
    }
    if (Math.hypot(x - position.x, z - position.z) > cfg.hearingRange * loudness) return;
    noiseTarget = { x, z };
    setState('investigate');
  }

  function reset() {
    state = 'patrol';
    position = { x: spawn.x, z: spawn.z };
    facing = 0;
    health = cfg.maxHealth;
    stateTime = 0;
    moveTime = 0;
    waypointIndex = 0;
    noiseTarget = null;
    path = [];
    repathTimer = 0;
    unseenTime = 0;
    swingSpent = false;
  }

  return {
    state: () => state,
    position: () => ({ x: position.x, z: position.z }),
    facing: () => facing,
    health: () => health,
    isDead: () => state === 'dead',
    update,
    takeHit,
    hearNoise,
    reset,
  };
}
