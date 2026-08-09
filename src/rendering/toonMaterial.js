import * as THREE from 'three';

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
