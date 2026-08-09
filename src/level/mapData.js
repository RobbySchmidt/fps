export const CELL = 2; // meters per grid cell

// Legend: '#' wall, '.' floor, 'D' doorway (floor), 'S' spawn (floor).
// Six rooms along the top and middle, one grand hall at the bottom.
export const MAP = `
########################
#......#........#......#
#......#........#......#
#......D........D......#
#......#........#......#
####D######DD######D####
#........#......#......#
#........#......#......#
#........D......D......#
#........#......#......#
#####D##########D#######
#......................#
#..........S...........#
#......................#
########################
`;

export function parseMap(text) {
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const walls = [];
  const wallSet = new Set();
  let spawn = null;

  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') {
        walls.push({ c, r });
        wallSet.add(`${c},${r}`);
      } else if (ch === 'S') {
        spawn = { x: c * CELL, z: r * CELL };
      }
    });
  });

  if (!spawn) throw new Error('Map has no spawn point (S)');

  const cols = Math.max(...lines.map((l) => l.length));
  return { walls, wallSet, spawn, cols, rows: lines.length };
}
