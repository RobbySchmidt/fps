import * as THREE from 'three';
import { createInkTexture } from './inkTextures.js';

let sharedGradientMap = null;

export function createToonGradientMap() {
  const data = new Uint8Array([40, 110, 220]); // 3 hard light steps: shadow, mid, lit
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createToonMaterial(colorHex) {
  if (!sharedGradientMap) sharedGradientMap = createToonGradientMap();
  return new THREE.MeshToonMaterial({ color: colorHex, gradientMap: sharedGradientMap });
}

const inkMaterialCache = new Map();

// Shared instances: ~70 manifest pieces × parts would otherwise mint hundreds
// of materials. Sharing is safe — nothing mutates furniture materials, and the
// one per-frame mutator (the Wanderer's chitin emissive flash) has exactly one
// consumer in the scene.
export function createInkMaterial(colorHex, family, repeatU = 1, repeatV = 1) {
  const key = `${colorHex}|${family}|${repeatU}|${repeatV}`;
  if (inkMaterialCache.has(key)) return inkMaterialCache.get(key);
  const material = buildInkMaterial(colorHex, family, repeatU, repeatV);
  inkMaterialCache.set(key, material);
  return material;
}

// wood/stone/iron: greyscale multiply map, tinted by material.color.
// chitin: baked-color map, white material color (near-black multiply would
// hide both strokes and the hit flash — see the art-slice spec).
// In Node (no canvas) the texture is null and this degrades to a plain
// toon material so the test suite never touches canvas.
function buildInkMaterial(colorHex, family, repeatU = 1, repeatV = 1) {
  const base = createInkTexture(family);
  if (!base) return createToonMaterial(colorHex);
  if (!sharedGradientMap) sharedGradientMap = createToonGradientMap();
  const map = base.clone(); // shares the image source (cheap); repeat is per-instance
  map.repeat.set(repeatU, repeatV);
  map.needsUpdate = true;
  return new THREE.MeshToonMaterial({
    color: family === 'chitin' ? 0xffffff : colorHex,
    map,
    gradientMap: sharedGradientMap,
  });
}
