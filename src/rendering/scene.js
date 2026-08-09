import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.background);
  scene.fog = new THREE.Fog(PALETTE.background, 3, 34);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = 'YXZ'; // yaw (Y) then pitch (X) — FPS convention

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera };
}
