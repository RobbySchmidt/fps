import * as THREE from 'three';

const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Ink outlines from depth discontinuities. Uses a second-difference filter so
// flat surfaces viewed at an angle (constant depth slope) produce no edge;
// only true silhouette jumps do.
export const InkEdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 100 },
    edgeStrength: { value: 0.9 },
    edgeThreshold: { value: 0.12 },
    inkColor: { value: new THREE.Color(0x05060a) },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float edgeStrength;
uniform float edgeThreshold;
uniform vec3 inkColor;
varying vec2 vUv;

float linearizeDepth(float z) {
  float ndc = z * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - ndc * (cameraFar - cameraNear));
}

float readDepth(vec2 uv) {
  return linearizeDepth(texture2D(tDepth, uv).x) / cameraFar; // 0..1
}

void main() {
  vec2 texel = 1.0 / resolution;
  float dc = readDepth(vUv);
  float d2x = abs(readDepth(vUv + vec2(texel.x, 0.0)) + readDepth(vUv - vec2(texel.x, 0.0)) - 2.0 * dc);
  float d2y = abs(readDepth(vUv + vec2(0.0, texel.y)) + readDepth(vUv - vec2(0.0, texel.y)) - 2.0 * dc);
  float edge = step(edgeThreshold, (d2x + d2y) / max(dc, 1e-4));
  vec4 color = texture2D(tDiffuse, vUv);
  color.rgb = mix(color.rgb, inkColor, edge * edgeStrength);
  gl_FragColor = color;
}
`,
};

// Gentle vignette — grain was removed after playtest feedback.
export const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.35 },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float vignetteStrength;
varying vec2 vUv;

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  vec2 centered = vUv - 0.5;
  float vignette = 1.0 - vignetteStrength * dot(centered, centered) * 2.0;
  color.rgb *= vignette;
  gl_FragColor = color;
}
`,
};
