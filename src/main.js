import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { moveWithCollision } from './level/collision.js';
import { createGameLoop } from './core/gameLoop.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED } from './player/movement.js';
import { createFlashlight } from './player/flashlight.js';
import { createPostStack } from './rendering/postStack.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

scene.add(new THREE.AmbientLight(0x27303f, 0.4)); // faint cold moonlight fill
scene.add(camera); // the flashlight is a child of the camera
const flashlight = createFlashlight(camera);
const post = createPostStack(renderer, scene, camera);

const EYE_HEIGHT = 1.7;
const player = { x: parsed.spawn.x, z: parsed.spawn.z };
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
});
window.addEventListener('keyup', (e) => setKey(e.code, false));
window.addEventListener('blur', () => {
  for (const key of Object.keys(keys)) keys[key] = false;
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
  }
  camera.position.set(player.x, EYE_HEIGHT, player.z);
  camera.rotation.set(look.pitch, look.yaw, 0);
  post.render(dt);
});
loop.start();
