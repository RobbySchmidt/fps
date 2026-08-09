import { it, expect } from 'vitest';
import { createGameLoop } from '../src/core/gameLoop.js';

function makeFakeTimer() {
  let t = 0;
  const queue = [];
  return {
    now: () => t,
    schedule: (fn) => queue.push(fn),
    tick(dt) {
      t += dt;
      const fns = queue.splice(0);
      fns.forEach((fn) => fn());
    },
  };
}

it('calls update with elapsed seconds per frame', () => {
  const timer = makeFakeTimer();
  const deltas = [];
  const loop = createGameLoop((dt) => deltas.push(dt), { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(0.016);
  timer.tick(0.02);
  expect(deltas.length).toBe(2);
  expect(deltas[0]).toBeCloseTo(0.016);
  expect(deltas[1]).toBeCloseTo(0.02);
});

it('clamps large deltas to maxDelta (default 0.1)', () => {
  const timer = makeFakeTimer();
  const deltas = [];
  const loop = createGameLoop((dt) => deltas.push(dt), { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(5);
  expect(deltas[0]).toBeCloseTo(0.1);
});

it('stops calling update after stop()', () => {
  const timer = makeFakeTimer();
  let calls = 0;
  const loop = createGameLoop(() => calls++, { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(0.016);
  loop.stop();
  timer.tick(0.016);
  timer.tick(0.016);
  expect(calls).toBe(1);
});
