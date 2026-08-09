import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const look = createLook();

const lock = setupPointerLock(canvas, {
  onLocked: () => { overlay.hidden = true; },
  onUnlocked: () => { overlay.hidden = false; },
  onMouseDelta: (dx, dy) => applyLookDelta(look, dx, dy),
});
overlay.addEventListener('click', () => lock.request());

camera.position.set(parsed.spawn.x, 1.7, parsed.spawn.z);

renderer.setAnimationLoop(() => {
  camera.rotation.set(look.pitch, look.yaw, 0);
  renderer.render(scene, camera);
});
