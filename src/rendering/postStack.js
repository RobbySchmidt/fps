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
