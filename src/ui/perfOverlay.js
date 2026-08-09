// Debug performance overlay — hidden by default, toggle with P.
export function createPerfOverlay(renderer) {
  const el = document.createElement('div');
  el.id = 'perf';
  el.style.cssText =
    'position:fixed;left:8px;top:8px;z-index:3;font:12px/1.5 monospace;' +
    'color:#9fe89f;background:rgba(0,0,0,0.65);padding:6px 8px;white-space:pre;pointer-events:none;';
  el.hidden = true;
  document.body.appendChild(el);

  let last = performance.now();
  let frames = 0;
  let sum = 0;
  let worst = 0;
  let worstShown = 0;
  let lastReport = last;
  let heapAtReport = 0;

  return {
    toggle() {
      el.hidden = !el.hidden;
    },
    tick() {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frames += 1;
      sum += dt;
      if (dt > worst) worst = dt;

      if (now - lastReport >= 500) {
        worstShown = worst;
        const avg = sum / frames;
        const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
        const heapDelta = heap - heapAtReport;
        heapAtReport = heap;
        const info = renderer.info.render;
        if (!el.hidden) {
          el.textContent =
            `avg ${avg.toFixed(1)} ms  (${(1000 / avg).toFixed(0)} fps)\n` +
            `worst ${worstShown.toFixed(1)} ms\n` +
            `draw calls ${info.calls}  tris ${(info.triangles / 1000).toFixed(1)}k\n` +
            (performance.memory
              ? `heap ${(heap / 1048576).toFixed(1)} MB (${heapDelta >= 0 ? '+' : ''}${(heapDelta / 1024).toFixed(0)} KB/0.5s)`
              : 'heap n/a');
        }
        frames = 0;
        sum = 0;
        worst = 0;
        lastReport = now;
      }
    },
  };
}
