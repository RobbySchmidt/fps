import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';
import { createInkMaterial } from '../rendering/toonMaterial.js';
import { quantizeTime } from './movementStyle.js';

const ANIMATION_FPS = 10; // everything else runs at 60: this is the "wrong" look
const COLLAPSE_SPEED = 3.2;
const FLASH_COLOR = new THREE.Color(0xffffff);

function bodyPart(material, width, height, depth, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createWandererFigure() {
  const group = new THREE.Group();
  const skin = createInkMaterial(PALETTE.wanderer, 'chitin');
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.wandererEye });

  // Hunched torso, head jutting forward and low, mantis blades folded at rest.
  const torso = bodyPart(skin, 0.5, 0.9, 0.34, 0, 1.15, 0);
  torso.rotation.x = 0.35; // hunched

  const head = bodyPart(skin, 0.3, 0.28, 0.36, 0, 1.62, 0.16);
  head.userData.wandererPart = 'head';

  const eyeGeometry = new THREE.SphereGeometry(0.035, 6, 6);
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.07, 0, 0.18);
  rightEye.position.set(0.07, 0, 0.18);
  head.add(leftEye, rightEye);

  // Arms: a short upper arm with a long scythe blade as the forearm.
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.32, 1.42, 0);
    const upper = bodyPart(skin, 0.12, 0.42, 0.12, 0, -0.21, 0);
    const blade = bodyPart(skin, 0.08, 0.95, 0.2, 0, -0.85, 0.06);
    blade.rotation.x = -0.15;
    arm.add(upper, blade);
    return { arm, upper, blade };
  }
  const left = makeArm(-1);
  const right = makeArm(1);

  const leftLeg = bodyPart(skin, 0.15, 0.8, 0.15, -0.15, 0.4, 0);
  const rightLeg = bodyPart(skin, 0.15, 0.8, 0.15, 0.15, 0.4, 0);

  [torso, head, leftLeg, rightLeg].forEach((mesh) => group.add(mesh));
  group.add(left.arm, right.arm);

  [torso, leftLeg, rightLeg, left.upper, left.blade, right.upper, right.blade].forEach((mesh) => {
    mesh.userData.wandererPart = 'body';
  });

  const hitMeshes = [head, torso, leftLeg, rightLeg, left.blade, right.blade];
  const parts = {
    torso,
    head,
    leftArm: left.arm,
    rightArm: right.arm,
    leftLeg,
    rightLeg,
  };

  let flashAmount = 0;
  let collapse = 0;

  // Blade fold angle per state: tight while prowling, up when hunting,
  // reared back during the wind-up, dropped when staggered.
  function bladeFold(state) {
    if (state === 'chase') return 0.9;
    if (state === 'windup') return 2.1;
    if (state === 'attack') return -0.6;
    if (state === 'stagger') return 0.15;
    return 0.35;
  }

  function update(snapshot) {
    const { state, position, facing, time, dt = 0 } = snapshot;
    const frozen = state === 'windup'; // the telegraph: all jitter stops
    const t = frozen ? 0 : quantizeTime(time, ANIMATION_FPS);

    group.position.x = position.x;
    group.position.z = position.z;
    group.rotation.y = facing;

    const moving = state === 'chase' || state === 'patrol' || state === 'investigate';
    const stride = state === 'chase' ? 14 : 5;
    const swing = moving ? Math.sin(t * stride) * (state === 'chase' ? 0.9 : 0.45) : 0;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;

    // Twitch layer: small snapped jerks, never still unless frozen.
    const twitch = frozen ? 0 : (Math.sin(t * 37.1) + Math.sin(t * 23.7)) * 0.05;
    head.rotation.x = 0.3 + twitch;
    head.rotation.z = twitch * 1.5;
    torso.rotation.z = twitch * 0.6;

    const fold = bladeFold(state);
    left.arm.rotation.z = fold + twitch;
    right.arm.rotation.z = -fold - twitch;
    left.arm.rotation.x = -swing * 0.3;
    right.arm.rotation.x = swing * 0.3;

    if (state === 'dead') {
      collapse = Math.min(1, collapse + dt * COLLAPSE_SPEED);
    }
    group.rotation.x = collapse * 1.4;
    group.position.y = -collapse * 0.6;

    if (flashAmount > 0) flashAmount = Math.max(0, flashAmount - dt * 6);
    skin.emissive.setHex(0x000000);
    if (flashAmount > 0) skin.emissive.lerp(FLASH_COLOR, flashAmount);
  }

  return {
    group,
    parts,
    hitMeshes,
    update,
    flash() {
      flashAmount = 0.8;
    },
    reset() {
      collapse = 0;
      flashAmount = 0;
      group.rotation.set(0, 0, 0);
      group.position.y = 0;
    },
  };
}
