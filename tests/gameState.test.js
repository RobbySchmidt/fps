import { it, expect } from 'vitest';
import { createGameState } from '../src/core/gameState.js';

it('starts playing', () => {
  const game = createGameState();
  expect(game.state()).toBe('playing');
  expect(game.isPlaying()).toBe(true);
  expect(game.isDead()).toBe(false);
});

it('dies once and retries back to playing', () => {
  const game = createGameState();
  game.die();
  expect(game.isDead()).toBe(true);
  expect(game.isPlaying()).toBe(false);
  game.retry();
  expect(game.isPlaying()).toBe(true);
});

it('die is idempotent', () => {
  const game = createGameState();
  game.die();
  game.die();
  expect(game.state()).toBe('dead');
});
