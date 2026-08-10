export const CELL = 2; // meters per grid cell

// Legend: '#' wall, '.' floor, 'D' doorway (floor), 'S' spawn (floor), 'L' lamp (floor).
// Six rooms along the top and middle, one grand hall at the bottom.
export const MAP = `
########################
#......#........#......#
#......#...L....#..L...#
#......D........D......#
#......#........#......#
####D######DD######D####
#........#......#......#
#...L....#......#..L...#
#........D......D......#
#........#......#......#
#####D##########D#######
#......................#
#....L......S.....L....#
#......................#
########################
`;

export function parseMap(text, cell = CELL) {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const walls = [];
  const wallSet = new Set();
  const lamps = [];
  let spawn = null;
  let wandererSpawn = null;

  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') {
        walls.push({ c, r });
        wallSet.add(`${c},${r}`);
      } else if (ch === 'S') {
        spawn = { x: c * cell, z: r * cell };
      } else if (ch === 'L') {
        lamps.push({ x: c * cell, z: r * cell });
      } else if (ch === 'W') {
        wandererSpawn = { x: c * cell, z: r * cell };
      }
    });
  });

  if (!spawn) throw new Error('Map has no spawn point (S)');

  const cols = Math.max(...lines.map((l) => l.length));
  return { walls, wallSet, spawn, lamps, wandererSpawn, cols, rows: lines.length };
}
