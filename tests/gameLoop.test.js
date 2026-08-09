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

it('does not double-schedule when stop() then start() happens before a pending frame fires', () => {
  const timer = makeFakeTimer();
  let calls = 0;
  const loop = createGameLoop(() => calls++, { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(0.016); // one update; schedules the next (stale) frame
  loop.stop();
  loop.start(); // new generation; the still-queued stale frame from before stop() must be ignored
  timer.tick(0.016); // fires both the stale frame and the fresh one
  expect(calls).toBe(2);

  timer.tick(0.016);
  expect(calls).toBe(3);
});

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
