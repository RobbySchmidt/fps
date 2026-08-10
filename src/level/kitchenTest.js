import { PALETTE } from '../rendering/palette.js';

// The blueprint kitchen (x2-13, z2-9) with a dining stub (player spawn) and a
// dead-end corridor stub. 1m cells. See the M4a test-slice spec.
const KITCHEN_TEST_MAP = `
#####################
#####################
##............#######
##............#######
##............#######
##.........W..#######
##............#######
##...L........#######
##............#######
##..L.........#######
##............#######
##............#######
##............#######
##............#######
##.....S......#######
##............#######
#####################
`;

const FURNITURE = [
  { id: 'work-table', kind: 'low', x0: 6, z0: 5, x1: 9, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stove', kind: 'tall', x0: 4, z0: 2, x1: 5, z1: 2, color: PALETTE.furnitureIron },
  { id: 'hearth', kind: 'tall', x0: 10, z0: 2, x1: 12, z1: 2, color: PALETTE.furnitureIron },
  { id: 'counter', kind: 'low', x0: 2, z0: 4, x1: 2, z1: 6, color: PALETTE.furnitureStone },
  { id: 'larder', kind: 'tall', x0: 2, z0: 9, x1: 4, z1: 9, color: PALETTE.furnitureWood },
  { id: 'barrel', kind: 'low', x0: 13, z0: 4, x1: 13, z1: 4, color: PALETTE.furnitureWood },
  { id: 'barrel-2', kind: 'decor', x0: 13, z0: 5, x1: 13, z1: 5, color: PALETTE.furnitureWood },
  { id: 'stool', kind: 'decor', x0: 5, z0: 5, x1: 5, z1: 5, color: PALETTE.furnitureWood },
  { id: 'stool-2', kind: 'decor', x0: 10, z0: 6, x1: 10, z1: 6, color: PALETTE.furnitureWood },
];

export const KITCHEN_TEST = {
  name: 'kitchen-test',
  mapText: KITCHEN_TEST_MAP,
  cell: 1,
  furniture: FURNITURE,
};
