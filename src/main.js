import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';

const canvas = document.getElementById('game');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

camera.position.set(parsed.spawn.x, 1.7, parsed.spawn.z);

renderer.setAnimationLoop(() => renderer.render(scene, camera));
