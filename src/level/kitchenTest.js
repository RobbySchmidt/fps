import { PALETTE } from '../rendering/palette.js';

// The test kitchen (x2-17, z2-11, enlarged to 16x10m after the first playtest
// found 12x8m too tight for an 11 m/s burst enemy) with a dining stub (player
// spawn) and a dead-end corridor stub. 1m cells. See the M4a test-slice spec.
// Playtest rule change: freestanding furniture that looks solid always blocks
// ('low'), even chairs — 'decor' is reserved for things that read as passable.
const KITCHEN_TEST_MAP = `
#########################
#########################
##................#######
##................#######
##........L.......#######
##................#######
##............W...#######
##................#######
##................#######
##................#######
##................#######
##................DD#####
########DD########DD....#
########DD########DD....#
##................#######
##..L.............#######
##.......S........#######
##................#######
#########################
`;

const FURNITURE = [
  { id: 'work-table', kind: 'low', x0: 8, z0: 6, x1: 12, z1: 7, color: PALETTE.furnitureWood },
  { id: 'stove', kind: 'tall', x0: 4, z0: 2, x1: 6, z1: 2, color: PALETTE.furnitureIron },
  { id: 'hearth', kind: 'tall', x0: 13, z0: 2, x1: 16, z1: 2, color: PALETTE.furnitureIron },
  { id: 'counter', kind: 'low', x0: 2, z0: 4, x1: 2, z1: 7, color: PALETTE.furnitureStone },
  { id: 'larder', kind: 'tall', x0: 2, z0: 11, x1: 5, z1: 11, color: PALETTE.furnitureWood },
  { id: 'barrel', kind: 'low', x0: 17, z0: 5, x1: 17, z1: 5, color: PALETTE.furnitureWood },
  { id: 'barrel-2', kind: 'low', x0: 17, z0: 6, x1: 17, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stool', kind: 'low', x0: 7, z0: 6, x1: 7, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stool-2', kind: 'low', x0: 13, z0: 8, x1: 13, z1: 8, color: PALETTE.furnitureWood },
];

export const KITCHEN_TEST = {
  name: 'kitchen-test',
  mapText: KITCHEN_TEST_MAP,
  cell: 1,
  furniture: FURNITURE,
};
