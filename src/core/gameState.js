export function createGameState() {
  let state = 'playing';
  return {
    state: () => state,
    isPlaying: () => state === 'playing',
    isDead: () => state === 'dead',
    die() {
      state = 'dead';
    },
    retry() {
      state = 'playing';
    },
  };
}
