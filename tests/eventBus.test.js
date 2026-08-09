import { it, expect, vi } from 'vitest';
import { createEventBus } from '../src/core/eventBus.js';

it('delivers payloads to all subscribed handlers', () => {
  const bus = createEventBus();
  const a = vi.fn();
  const b = vi.fn();
  bus.on('noise', a);
  bus.on('noise', b);
  bus.emit('noise', { x: 1, z: 2 });
  expect(a).toHaveBeenCalledWith({ x: 1, z: 2 });
  expect(b).toHaveBeenCalledWith({ x: 1, z: 2 });
});

it('unsubscribe stops delivery', () => {
  const bus = createEventBus();
  const handler = vi.fn();
  const off = bus.on('noise', handler);
  off();
  bus.emit('noise', {});
  expect(handler).not.toHaveBeenCalled();
});

it('emitting an event nobody listens to does not throw', () => {
  expect(() => createEventBus().emit('ghost', {})).not.toThrow();
});
