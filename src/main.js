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
const raycaster = new THREE.Raycaster();
let elapsed = 0; // game-seconds; freezes while paused, so cooldowns pause too

const EYE_HEIGHT = 1.7;
const player = { x: parsed.spawn.x, z: parsed.spawn.z, y: 0, vy: 0 };
const look = createLook();
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
  if (e.code === 'Space' && lock.isLocked()) tryJump(player);
  if (e.code === 'KeyR' && lock.isLocked()) revolver.startReload(elapsed);
});
window.addEventListener('keyup', (e) => setKey(e.code, false));
window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

function shoot() {
  if (!lock.isLocked()) return;
  if (!revolver.fire(elapsed)) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(level.children, false);
  if (hits.length > 0) {
    const worldNormal = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
    impacts.spawn(hits[0].point, worldNormal);
  }
  muzzleFlash.trigger();
  applyLookDelta(look, 0, -12); // small upward view kick
  bus.emit('noise', { x: player.x, z: player.z, loudness: 1 });
}
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot();
});

const lock = setupPointerLock(canvas, {
  onLocked: () => { overlay.hidden = true; },
  onUnlocked: () => { overlay.hidden = false; },
  onMouseDelta: (dx, dy) => applyLookDelta(look, dx, dy),
});
overlay.addEventListener('click', () => lock.request());

const loop = createGameLoop((dt) => {
  if (lock.isLocked()) {
    const wish = computeWishDir(keys, look.yaw);
    const speed = keys.sprint ? SPRINT_SPEED : WALK_SPEED;
    const next = moveWithCollision(player, wish.x * speed * dt, wish.z * speed * dt, parsed.wallSet);
    player.x = next.x;
    player.z = next.z;
    stepVertical(player, dt);
    elapsed += dt;
  }
  camera.position.set(player.x, EYE_HEIGHT + player.y, player.z);
  camera.rotation.set(look.pitch, look.yaw, 0);
  muzzleFlash.update(dt);
  post.render(dt);
});
loop.start();
