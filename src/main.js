import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { buildLamps } from './level/buildLamps.js';
import { moveWithCollision } from './level/collision.js';
import { createGameLoop } from './core/gameLoop.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED, tryJump, stepVertical } from './player/movement.js';
import { createFlashlight } from './player/flashlight.js';
import { createPostStack } from './rendering/postStack.js';
import { PALETTE } from './rendering/palette.js';
import { createEventBus } from './core/eventBus.js';
import { createRevolver } from './weapons/revolver.js';
import { createImpactPool } from './weapons/impacts.js';
import { createMuzzleFlash } from './weapons/muzzleFlash.js';
import { createHud } from './ui/hud.js';
import { createWandererAI } from './enemy/wandererAI.js';
import { createWandererFigure } from './enemy/wandererFigure.js';
import { createHealth } from './player/health.js';
import { createGameState } from './core/gameState.js';
import { createScreenShake } from './rendering/screenShake.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
const level = buildGreybox(parsed);
scene.add(level);
scene.add(buildLamps(parsed));

scene.add(new THREE.AmbientLight(PALETTE.ambient, 0.85));
scene.add(camera); // the flashlight is a child of the camera
const flashlight = createFlashlight(camera);
const post = createPostStack(renderer, scene, camera);

const bus = createEventBus();
const revolver = createRevolver();
const impacts = createImpactPool(scene);
const muzzleFlash = createMuzzleFlash(camera);
const hud = createHud();
const wandererAI = createWandererAI({
  spawn: parsed.lamps[0],          // a lamp cell in a far room
  wallSet: parsed.wallSet,
  waypoints: parsed.lamps,          // one waypoint per room, already spread out
});
const wanderer = createWandererFigure();
scene.add(wanderer.group);
bus.on('noise', (noise) => wandererAI.hearNoise(noise));
const raycaster = new THREE.Raycaster();
const health = createHealth();
const shake = createScreenShake();
const death = document.getElementById('death');
let elapsed = 0; // game-seconds; freezes while paused, so cooldowns pause too
let sprintNoiseTimer = 0;

const EYE_HEIGHT = 1.7;
const VIEW_KICK = -12; // mouse-delta units fed to applyLookDelta on each shot
const BODY_DAMAGE = 30;
const SPRINT_NOISE = 0.25;         // quieter than a gunshot, so sprinting carries less far
const SPRINT_NOISE_INTERVAL = 0.35; // seconds between sprint noise pulses
const MELEE_DAMAGE = 25;
const HIT_SHAKE = 0.55;
const player = { x: parsed.spawn.x, z: parsed.spawn.z, y: 0, vy: 0 };
const look = createLook();
const game = createGameState();

const lock = setupPointerLock(canvas, {
  onLocked: () => { overlay.hidden = true; },
  onUnlocked: () => { overlay.hidden = game.isDead(); },
  onMouseDelta: (dx, dy) => applyLookDelta(look, dx, dy),
});
overlay.addEventListener('click', () => lock.request());

// `elapsed` deliberately keeps running across a retry: every module that holds
// a timer (health, revolver, the AI) resets its own, so a monotonic clock is
// both correct and simpler than rewinding it.
function retry() {
  player.x = parsed.spawn.x;
  player.z = parsed.spawn.z;
  player.y = 0;
  player.vy = 0;
  health.reset();
  revolver.reset();
  wandererAI.reset();
  wanderer.reset();
  game.retry();
  hud.showDeath(false);
  hud.setHealth(health.fraction());
  hud.setAmmo(revolver.rounds(), revolver.capacity());
  hud.setReloading(false);
  lock.request();
}
death.addEventListener('click', retry);

const keys = { forward: false, back: false, left: false, right: false, sprint: false };

function setKey(code, down) {
  if (code === 'KeyW') keys.forward = down;
  if (code === 'KeyS') keys.back = down;
  if (code === 'KeyA') keys.left = down;
  if (code === 'KeyD') keys.right = down;
  if (code === 'ShiftLeft' || code === 'ShiftRight') keys.sprint = down;
  if (code === 'KeyF' && down) flashlight.toggle();
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return; // ignore OS auto-repeat so held keys don't re-fire toggles
  setKey(e.code, true);
  if (e.code === 'Space' && lock.isLocked() && game.isPlaying()) tryJump(player);
  if (e.code === 'KeyR' && lock.isLocked() && game.isPlaying()) revolver.startReload(elapsed);
});
window.addEventListener('keyup', (e) => setKey(e.code, false));
window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

function shoot() {
  if (!lock.isLocked() || !game.isPlaying()) return;
  if (!revolver.fire(elapsed)) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const shootables = [...level.children, ...wanderer.hitMeshes];
  const hits = raycaster.intersectObjects(shootables, false);
  if (hits.length > 0) {
    const hit = hits[0];
    const part = hit.object.userData.wandererPart;
    if (part && !wandererAI.isDead()) {
      const headshot = part === 'head';
      wandererAI.takeHit({ damage: BODY_DAMAGE, headshot, from: { x: player.x, z: player.z } });
      wanderer.flash();
      hud.hitMarker(headshot ? 'head' : 'body');
    } else if (!part) {
      const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      impacts.spawn(hit.point, worldNormal);
    }
  }
  muzzleFlash.trigger();
  applyLookDelta(look, 0, VIEW_KICK);
  bus.emit('noise', { x: player.x, z: player.z, loudness: 1 });
}
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot();
});

const loop = createGameLoop((dt) => {
  if (lock.isLocked()) {
    const wish = computeWishDir(keys, look.yaw);
    const speed = keys.sprint ? SPRINT_SPEED : WALK_SPEED;
    const next = moveWithCollision(player, wish.x * speed * dt, wish.z * speed * dt, parsed.wallSet);
    player.x = next.x;
    player.z = next.z;
    stepVertical(player, dt);
    elapsed += dt;
    sprintNoiseTimer -= dt;
    if (keys.sprint && (wish.x !== 0 || wish.z !== 0) && sprintNoiseTimer <= 0) {
      sprintNoiseTimer = SPRINT_NOISE_INTERVAL;
      bus.emit('noise', { x: player.x, z: player.z, loudness: SPRINT_NOISE });
    }
    const enemy = wandererAI.update(dt, player);
    if (enemy.attacked && game.isPlaying()) {
      health.damage(MELEE_DAMAGE, elapsed);
      hud.flashDamage();
      shake.trigger(HIT_SHAKE);
      if (health.isDead()) {
        game.die();
        hud.showDeath(true);
        document.exitPointerLock();
      }
    }
    health.update(elapsed);
    hud.setHealth(health.fraction());
    hud.setReloading(revolver.isReloading(elapsed));
    hud.setAmmo(revolver.rounds(), revolver.capacity());
  }
  shake.update(dt);
  const jolt = shake.offset();
  camera.position.set(player.x + jolt.x, EYE_HEIGHT + player.y + jolt.y, player.z);
  camera.rotation.set(look.pitch, look.yaw, 0);
  muzzleFlash.update(dt);
  wanderer.update({
    state: wandererAI.state(),
    position: wandererAI.position(),
    facing: wandererAI.facing(),
    time: elapsed,
    dt,
  });
  post.render(dt);
});
loop.start();
