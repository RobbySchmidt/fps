# Milestone 2: Art Pass ("Dark Ink & Toon") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the grey-box mansion into the spec's "dark ink & toon" look: cel-shaded surfaces, screen-space ink outlines, film grain + vignette, and the cold-blue/warm-accent palette — plus the parked game-loop fix from Milestone 1.

**Architecture:** A shared palette module feeds toon materials (MeshToonMaterial + 3-step gradient map) and scene colors. Post-processing runs through an EffectComposer: render → ink-edge pass (depth-based second-difference edge detection from a dedicated depth pre-pass) → grain/vignette pass → OutputPass. Pure-logic pieces (gradient map, material factory, game loop) are unit-tested; shader passes are verified visually — the human partner is available for the look check.

**Tech Stack:** Three.js (`three/addons` post-processing), Vite, Vitest, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-08-09-mansion-horror-fps-design.md` (Milestone 2 scope). Prior state: Milestone 1 merged to main (grey-box, FPS controls, flashlight, 27 tests).

## Global Constraints

- Plain JavaScript with ES modules — no TypeScript. No new dependencies (`three/addons/...` ships inside the existing `three` package).
- Logic modules must not touch `document`/`window`; shader definition objects are plain data and count as logic.
- All colors come from `src/rendering/palette.js` — no other file hardcodes a color hex except shader-internal defaults noted in this plan.
- Visual tuning values (palette hexes, edge thresholds, grain amount, fog distances, light intensities) are starting points: adjusting numbers during the visual check is allowed and expected. Structural changes are not.
- Commit after every task with the message given in the task.

---

### Task 1: Fix the parked game-loop restart bug

**Files:**
- Modify: `src/core/gameLoop.js` (the `start()` method only)
- Test: `tests/gameLoop.test.js` (add one test)

**Interfaces:**
- Consumes: existing `createGameLoop` with its generation counter (added in the M1 hardening commit).
- Produces: unchanged public API; restart-safe behavior later milestones' pause menu relies on.

Parked finding being fixed: `start()` schedules `() => frame(generation)` closing over the **live** `generation` variable. Two `start()`/`stop()` cycles before the first queued frame fires make every stale callback read the final generation value, pass the guard, and double-fire `update`.

- [ ] **Step 1: Write the failing test** (append to `tests/gameLoop.test.js`, reusing the existing `makeFakeTimer` helper in that file)

```js
it('does not double-fire after two rapid stop/start cycles', () => {
  const timer = makeFakeTimer();
  let calls = 0;
  const loop = createGameLoop(() => calls++, { now: timer.now, schedule: timer.schedule });
  loop.start(); // queues a frame for generation 1
  loop.stop();
  loop.start(); // queues a frame for generation 2 — both are now pending
  timer.tick(0.016); // both queued callbacks fire; only generation 2 may run
  expect(calls).toBe(1);
  timer.tick(0.016);
  expect(calls).toBe(2);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/gameLoop.test.js`
Expected: the new test FAILS with `calls` = 2 after the first tick (both stale and live callbacks ran).

- [ ] **Step 3: Fix `start()` — snapshot the generation into a local**

Read the current `src/core/gameLoop.js` first. Change only `start()` so the scheduled callback carries a snapshot, mirroring how `frame`'s own reschedule already passes its bound generation along:

```js
start() {
  if (running) return;
  running = true;
  generation += 1;
  const gen = generation;
  last = now();
  schedule(() => frame(gen));
},
```

(Adapt the exact variable names to what the file actually uses; the essential change is `const gen = generation;` + `schedule(() => frame(gen))` instead of scheduling with the live `generation`.)

- [ ] **Step 4: Run the game-loop tests to verify they pass**

Run: `npx vitest run tests/gameLoop.test.js`
Expected: all pass, including the two existing restart tests.

- [ ] **Step 5: Run the full suite, then commit**

Run: `npm test` — Expected: all pass.

```bash
git add src/core/gameLoop.js tests/gameLoop.test.js
git commit -m "fix: snapshot generation in gameLoop start() to prevent stale-frame double-fire"
```

---

### Task 2: Palette and toon materials

**Files:**
- Create: `src/rendering/palette.js`
- Create: `src/rendering/toonMaterial.js`
- Modify: `src/level/buildGreybox.js` (swap materials)
- Modify: `src/rendering/scene.js` (background/fog from palette)
- Test: `tests/toonMaterial.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PALETTE` (named color constants, single source of truth); `createToonGradientMap() -> THREE.DataTexture` (3 hard steps, nearest-filtered); `createToonMaterial(colorHex) -> THREE.MeshToonMaterial` — all materials share ONE gradient map instance.

- [ ] **Step 1: Write the failing tests**

`tests/toonMaterial.test.js`:

```js
import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createToonGradientMap, createToonMaterial } from '../src/rendering/toonMaterial.js';

it('gradient map is a 3-step nearest-filtered texture', () => {
  const tex = createToonGradientMap();
  expect(tex.image.width).toBe(3);
  expect(Array.from(tex.image.data)).toEqual([40, 110, 220]);
  expect(tex.minFilter).toBe(THREE.NearestFilter);
  expect(tex.magFilter).toBe(THREE.NearestFilter);
});

it('creates toon materials that share one gradient map', () => {
  const a = createToonMaterial(0xff0000);
  const b = createToonMaterial(0x00ff00);
  expect(a).toBeInstanceOf(THREE.MeshToonMaterial);
  expect(a).not.toBe(b);
  expect(a.gradientMap).toBe(b.gradientMap);
});

it('applies the given color', () => {
  const m = createToonMaterial(0x123456);
  expect(m.color.getHex()).toBe(0x123456);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/toonMaterial.test.js`
Expected: FAIL — cannot resolve `../src/rendering/toonMaterial.js`.

- [ ] **Step 3: Implement `src/rendering/palette.js`**

```js
// Single source of truth for the "dark ink & toon" look.
export const PALETTE = {
  background: 0x07090d, // near-black night, also fog color
  wall: 0x5a6472,       // cold grey-blue
  floor: 0x3d4450,
  ceiling: 0x2e333d,
  ambient: 0x24304a,    // faint cold moonlight fill
  flashlight: 0xffe6b8, // warm hand-held beam
  ink: 0x05060a,        // outline color
};
```

- [ ] **Step 4: Implement `src/rendering/toonMaterial.js`**

```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/toonMaterial.test.js`
Expected: 3 passed.

- [ ] **Step 6: Swap materials in `src/level/buildGreybox.js`**

Replace the three `MeshStandardMaterial` usages with toon materials from the palette. The imports gain:

```js
import { createToonMaterial } from '../rendering/toonMaterial.js';
import { PALETTE } from '../rendering/palette.js';
```

Then: wall material becomes `createToonMaterial(PALETTE.wall)`, floor `createToonMaterial(PALETTE.floor)`, ceiling `createToonMaterial(PALETTE.ceiling)` — geometry and positions unchanged.

- [ ] **Step 7: Use the palette in `src/rendering/scene.js`**

Add `import { PALETTE } from './palette.js';` and replace the hardcoded background and fog colors:

```js
scene.background = new THREE.Color(PALETTE.background);
scene.fog = new THREE.Fog(PALETTE.background, 2, 26);
```

- [ ] **Step 8: Verify, then commit**

Run: `npm test` — Expected: all pass.
Run: `npm run build` — Expected: clean build.

```bash
git add src/rendering/palette.js src/rendering/toonMaterial.js src/level/buildGreybox.js src/rendering/scene.js tests/toonMaterial.test.js
git commit -m "feat: add dark-ink palette and toon materials for the mansion"
```

---

### Task 3: Post-processing stack (ink edges, grain, vignette)

**Files:**
- Create: `src/rendering/shaders.js`
- Create: `src/rendering/postStack.js`
- Modify: `src/main.js` (render through the post stack)

**Interfaces:**
- Consumes: `renderer`, `scene`, `camera` from `createScene`; `camera.near`/`camera.far`.
- Produces: `createPostStack(renderer, scene, camera) -> { render(dt) }` — call `render(dt)` instead of `renderer.render(scene, camera)`; it does a depth pre-pass, then composer passes (render → ink edge → grain/vignette → OutputPass) and handles its own window resizing.

No unit tests (GPU shader work) — verification is visual plus compile/build checks.

- [ ] **Step 1: Implement `src/rendering/shaders.js`**

```js
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

// Film grain + vignette in one cheap pass.
export const GrainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grainAmount: { value: 0.05 },
    vignetteStrength: { value: 0.45 },
  },
  vertexShader: FULLSCREEN_VERTEX,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float time;
uniform float grainAmount;
uniform float vignetteStrength;
varying vec2 vUv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(tDiffuse, vUv);
  float grain = (rand(vUv * (1.0 + fract(time))) - 0.5) * grainAmount;
  color.rgb += grain;
  vec2 centered = vUv - 0.5;
  float vignette = 1.0 - vignetteStrength * dot(centered, centered) * 2.0;
  color.rgb *= vignette;
  gl_FragColor = color;
}
`,
};
```

- [ ] **Step 2: Implement `src/rendering/postStack.js`**

```js
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { InkEdgeShader, GrainVignetteShader } from './shaders.js';

export function createPostStack(renderer, scene, camera) {
  const pixelRatio = renderer.getPixelRatio();
  const size = renderer.getSize(new THREE.Vector2());

  const depthTarget = new THREE.WebGLRenderTarget(size.x * pixelRatio, size.y * pixelRatio, {
    depthTexture: new THREE.DepthTexture(size.x * pixelRatio, size.y * pixelRatio),
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const edgePass = new ShaderPass(InkEdgeShader);
  edgePass.uniforms.tDepth.value = depthTarget.depthTexture;
  edgePass.uniforms.resolution.value.set(size.x * pixelRatio, size.y * pixelRatio);
  edgePass.uniforms.cameraNear.value = camera.near;
  edgePass.uniforms.cameraFar.value = camera.far;
  composer.addPass(edgePass);

  const grainPass = new ShaderPass(GrainVignetteShader);
  composer.addPass(grainPass);

  composer.addPass(new OutputPass());

  function setSize(width, height) {
    const pr = renderer.getPixelRatio();
    composer.setSize(width, height);
    depthTarget.setSize(width * pr, height * pr);
    edgePass.uniforms.resolution.value.set(width * pr, height * pr);
  }
  window.addEventListener('resize', () => setSize(window.innerWidth, window.innerHeight));

  return {
    render(dt) {
      grainPass.uniforms.time.value = (grainPass.uniforms.time.value + dt) % 1000.0;
      renderer.setRenderTarget(depthTarget);
      renderer.render(scene, camera); // depth pre-pass (scene is small; one extra render is fine at this scale)
      renderer.setRenderTarget(null);
      composer.render();
    },
  };
}
```

- [ ] **Step 3: Wire it in `src/main.js`**

Read the current file first. Two changes:

1. Add the import with the other imports:
```js
import { createPostStack } from './rendering/postStack.js';
```
and after the flashlight/scene setup lines (before the loop is created):
```js
const post = createPostStack(renderer, scene, camera);
```

2. In the game-loop callback, replace the line
```js
renderer.render(scene, camera);
```
with
```js
post.render(dt);
```

- [ ] **Step 4: Headless verification + regression**

Start `npm run dev` in the background; request `/src/main.js`, `/src/rendering/postStack.js`, and `/src/rendering/shaders.js` from the dev server — all must return transformed modules, not error pages. Stop the server.
Run: `npm test` — Expected: all pass.
Run: `npm run build` — Expected: clean build (catches bad `three/addons` import paths).

- [ ] **Step 5: Commit**

```bash
git add src/rendering/shaders.js src/rendering/postStack.js src/main.js
git commit -m "feat: add ink-edge and grain/vignette post-processing stack"
```

---

### Task 4: Lighting and atmosphere tune

**Files:**
- Modify: `src/main.js` (ambient light from palette)
- Modify: `src/player/flashlight.js` (beam color from palette)

**Interfaces:**
- Consumes: `PALETTE` from Task 2.
- Produces: no API changes — color/intensity values only.

- [ ] **Step 1: Ambient light from the palette in `src/main.js`**

Add `import { PALETTE } from './rendering/palette.js';` to the imports, and replace the existing `new THREE.AmbientLight(0x27303f, 0.4)` with:

```js
scene.add(new THREE.AmbientLight(PALETTE.ambient, 0.5));
```

(Replacing the whole `scene.add(new THREE.AmbientLight(...))` line; keep `scene.add(camera)` as is.)

- [ ] **Step 2: Flashlight beam color from the palette in `src/player/flashlight.js`**

Add `import { PALETTE } from '../rendering/palette.js';` and change the SpotLight's first argument from `0xfff2d8` to `PALETTE.flashlight` — all other SpotLight parameters unchanged.

- [ ] **Step 3: Verify, then commit**

Run: `npm test` — Expected: all pass (flashlight tests don't assert color).
Run: `npm run build` — Expected: clean.

```bash
git add src/main.js src/player/flashlight.js
git commit -m "feat: tune lighting to the dark-ink palette"
```

---

### Task 5: README status + Milestone 2 visual acceptance

**Files:**
- Modify: `README.md` (Status section)

**Interfaces:**
- Consumes: everything above.
- Produces: a documented, human-verifiable Milestone 2.

- [ ] **Step 1: Update the Status section of `README.md`**

Replace the existing `## Status` section content with:

```markdown
## Status

Milestone 2 (art pass) complete: cel-shaded "dark ink & toon" look —
toon-stepped lighting, screen-space ink outlines, film grain, vignette,
cold-moonlight palette with a warm flashlight beam.
Next: Milestone 3 — combat loop (first enemy + revolver).
```

- [ ] **Step 2: Automated checks**

Run: `npm test` — Expected: all pass.
Run: `npm run build` — Expected: clean.

- [ ] **Step 3: Visual acceptance checklist (human, in browser)**

Run `npm run dev` and have the human partner verify:

1. Surfaces show hard toon light steps (flashlight cone bands instead of smooth falloff).
2. Silhouette edges (wall corners, doorway frames) carry thin dark ink lines; flat walls/floors show no spurious lines.
3. Film grain is visible but subtle; corners of the screen darken gently (vignette).
4. The mansion reads cold blue-grey; the flashlight beam reads warm.
5. Frame rate still feels smooth while walking and turning.
6. Resizing the window keeps the effect artifact-free.

Tuning knobs if anything looks off (all safe to adjust live): `PALETTE` hexes, `edgeThreshold`/`edgeStrength` (ink lines), `grainAmount`/`vignetteStrength`, fog distances in `scene.js`, ambient intensity in `main.js`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update status; complete milestone 2 (art pass)"
```
