import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { moveWithCollision } from './level/collision.js';
import { createGameLoop } from './core/gameLoop.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED } from './player/movement.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const EYE_HEIGHT = 1.7;
const player = { x: parsed.spawn.x, z: parsed.spawn.z };
const look = createLook();
const keys = { forward: false, back: false, left: false, right: false, sprint: false };

function setKey(code, down) {
  if (code === 'KeyW') keys.forward = down;
  if (code === 'KeyS') keys.back = down;
  if (code === 'KeyA') keys.left = down;
  if (code === 'KeyD') keys.right = down;
  if (code === 'ShiftLeft') keys.sprint = down;
}
window.addEventListener('keydown', (e) => setKey(e.code, true));
window.addEventListener('keyup', (e) => setKey(e.code, false));

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
  renderer.render(scene, camera);
});
loop.start();
