import { PALETTE } from '../rendering/palette.js';

// The blueprint ground floor: 58x47 at 1m cells, 11 furnished rooms
// (foyer, grand hall, kitchen, dining, sitting, library, drawing, billiard,
// study, corridors) replacing the M1 greybox mansion. See the M4a spec:
// docs/superpowers/specs/2026-08-10-m4a-ground-floor-design.md
// Row 0 and row 46 are full '#' rows so parseMap's empty-line trimming can
// never shift coordinates. Leading spaces on rows are load-bearing: they are
// outside-the-building void, not floor.
const GROUND_FLOOR_MAP = `
##########################################################
 ######################################################
 #................##......##........##...W............#
 #................##......##........##................#
 #................##......##........##................#
 #................##......##........##................#
 #.......L........##......##........##.......L........#
 #................##......##........##................#
 #................##......##........##................#
 #................##......##........##................#
 #................####DD#######DD#####................#
 #................DD##DD#     #DD#   #................#
 #####DD##########DD##DD#######DD###########DD#########
 #####DD##########DD..............................L...#
 #................##..................................#
 #................############DD###############DD######
 #................#      ##........##    ######DD########
 #................#     ##..........##   #..............#
 #................#    ##............##  #..............#
 #.......L........#   ##..............## #..............#
 #................#  ##................###..............#
 #................#  #..................##......L.......#
 #................####..................##..............#
 #................DDDD..................DD..............#
 #................DDDD....L........L....DD..............#
 #................####..................##..............#
 #####DD###########  #..................##..............#
 #####DD##############..................##..............#
 #..................###................###..............#
 #..................# ##..............## #......L.......#
 #..................#  ##............##  #..............#
 #..................#   ##..........##   #..............#
 #..................#    ##........##    #..............#
 #.......L..........#     ####DD####     ######DD########
 #..................#   ######DD######   ######DD########
 #..................#   #............#   #..............#
 #..................#   #............#   #..............#
 #..................#####............#####..............#
 #..................DDDDD............DDDDD..............#
 #..................DDDDD.....L......DDDDD......L.......#
 ########################............#####..............#
                        #.....S......#   #..............#
                        #............#   #..............#
                        ##############   #..............#
                                         #..............#
                                         ################
##########################################################
`;

const FURNITURE = [
  // --- kitchen (copied verbatim from kitchenTest.js's FURNITURE array) ---
  { id: 'work-table', kind: 'low', x0: 8, z0: 6, x1: 12, z1: 7, color: PALETTE.furnitureWood },
  { id: 'stove', kind: 'tall', x0: 4, z0: 2, x1: 6, z1: 2, color: PALETTE.furnitureIron },
  { id: 'hearth', kind: 'tall', x0: 13, z0: 2, x1: 16, z1: 2, color: PALETTE.furnitureIron },
  { id: 'counter', kind: 'low', x0: 2, z0: 4, x1: 2, z1: 7, color: PALETTE.furnitureStone },
  { id: 'larder', kind: 'tall', x0: 2, z0: 11, x1: 5, z1: 11, color: PALETTE.furnitureWood },
  { id: 'barrel', kind: 'low', x0: 17, z0: 5, x1: 17, z1: 5, color: PALETTE.furnitureWood },
  { id: 'barrel-2', kind: 'low', x0: 17, z0: 6, x1: 17, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stool', kind: 'low', height: 0.45, x0: 7, z0: 6, x1: 7, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stool-2', kind: 'low', height: 0.45, x0: 13, z0: 7, x1: 13, z1: 7, color: PALETTE.furnitureWood },
  // --- study (dark pressure room, no lamp) ---
  { id: 'study-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 29, z0: 3, x1: 33, z1: 6, color: PALETTE.rugBrown },
  { id: 'study-desk', kind: 'low', figure: 'table', x0: 30, z0: 4, x1: 32, z1: 5, color: PALETTE.furnitureWood },
  { id: 'study-desk-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 31, z0: 6, x1: 31, z1: 6, color: PALETTE.furnitureWalnut },
  { id: 'study-shelves', kind: 'tall', figure: 'bookcase', x0: 28, z0: 2, x1: 28, z1: 4, color: PALETTE.furnitureWood },
  { id: 'study-shelves-2', kind: 'tall', figure: 'bookcase', x0: 35, z0: 2, x1: 35, z1: 4, color: PALETTE.furnitureWood },
  { id: 'study-safe', kind: 'low', height: 1, figure: 'safe', x0: 35, z0: 8, x1: 35, z1: 8, color: PALETTE.furnitureIron },
  { id: 'study-armchair', kind: 'low', figure: 'armchair', x0: 29, z0: 7, x1: 29, z1: 7, color: PALETTE.upholsteryDark },
  { id: 'study-candle-table', kind: 'low', height: 0.45, figure: 'table', x0: 28, z0: 7, x1: 28, z1: 7, color: PALETTE.furnitureWalnut },
  // --- billiard (Wanderer den, single exit) ---
  { id: 'billiard-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 42, z0: 5, x1: 49, z1: 8, color: PALETTE.rugGreen },
  { id: 'billiard-table', kind: 'low', figure: 'billiard-table', x0: 44, z0: 6, x1: 47, z1: 7, color: PALETTE.feltGreen },
  { id: 'billiard-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 42, z0: 7, x1: 42, z1: 7, color: PALETTE.furnitureWalnut },
  { id: 'billiard-stool-2', kind: 'low', height: 0.45, figure: 'stool', x0: 49, z0: 6, x1: 49, z1: 6, color: PALETTE.furnitureWalnut },
  { id: 'billiard-bar-cabinet', kind: 'tall', figure: 'cabinet', x0: 50, z0: 2, x1: 51, z1: 2, color: PALETTE.furnitureWood },
  { id: 'billiard-trophy-case', kind: 'tall', figure: 'cabinet', x0: 53, z0: 5, x1: 53, z1: 7, color: PALETTE.furnitureWood },
  { id: 'billiard-armchair', kind: 'low', figure: 'armchair', x0: 50, z0: 9, x1: 50, z1: 9, color: PALETTE.upholsteryDark },
  { id: 'billiard-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 9, x1: 52, z1: 9, color: PALETTE.upholsteryDark },
  { id: 'billiard-smoke-table', kind: 'low', height: 0.45, figure: 'table', x0: 51, z0: 9, x1: 51, z1: 9, color: PALETTE.furnitureWalnut },
  // --- drawing room ---
  { id: 'drawing-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 46, z0: 37, x1: 51, z1: 42, color: PALETTE.rugViolet },
  { id: 'drawing-tea-table', kind: 'low', height: 0.45, figure: 'table', x0: 48, z0: 39, x1: 49, z1: 40, color: PALETTE.furnitureWalnut },
  { id: 'drawing-settee', kind: 'low', figure: 'settee', x0: 47, z0: 37, x1: 50, z1: 37, color: PALETTE.velvet },
  { id: 'drawing-settee-2', kind: 'low', figure: 'settee', x0: 47, z0: 42, x1: 50, z1: 42, color: PALETTE.velvet },
  { id: 'drawing-chaise-longue', kind: 'low', figure: 'settee', x0: 52, z0: 42, x1: 54, z1: 42, color: PALETTE.velvet },
  { id: 'drawing-secretary-desk', kind: 'tall', figure: 'cabinet', x0: 52, z0: 35, x1: 53, z1: 35, color: PALETTE.furnitureWood },
  { id: 'drawing-drinks-cabinet', kind: 'tall', figure: 'cabinet', x0: 43, z0: 35, x1: 44, z1: 35, color: PALETTE.furnitureWood },
  { id: 'drawing-fern', kind: 'low', figure: 'fern', x0: 44, z0: 43, x1: 44, z1: 43, color: PALETTE.fernGreen },
  // --- library ---
  { id: 'library-book-stack-a', kind: 'tall', figure: 'bookcase', x0: 45, z0: 20, x1: 46, z1: 23, color: PALETTE.furnitureWood },
  { id: 'library-book-stack-b', kind: 'tall', figure: 'bookcase', x0: 45, z0: 26, x1: 46, z1: 29, color: PALETTE.furnitureWood },
  { id: 'library-wall-shelves', kind: 'tall', figure: 'bookcase', x0: 42, z0: 18, x1: 42, z1: 21, color: PALETTE.furnitureWood },
  { id: 'library-wall-shelves-2', kind: 'tall', figure: 'bookcase', x0: 42, z0: 27, x1: 42, z1: 31, color: PALETTE.furnitureWood },
  { id: 'library-wall-shelves-3', kind: 'tall', figure: 'bookcase', x0: 42, z0: 17, x1: 46, z1: 17, color: PALETTE.furnitureWood },
  { id: 'library-wall-shelves-4', kind: 'tall', figure: 'bookcase', x0: 50, z0: 17, x1: 55, z1: 17, color: PALETTE.furnitureWood },
  { id: 'library-reading-table', kind: 'low', figure: 'table', x0: 50, z0: 20, x1: 52, z1: 21, color: PALETTE.furnitureOak },
  { id: 'library-globe', kind: 'low', height: 1.2, figure: 'globe', x0: 53, z0: 20, x1: 53, z1: 20, color: PALETTE.furnitureWalnut },
  { id: 'library-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 50, z0: 24, x1: 53, z1: 27, color: PALETTE.rugBlue },
  { id: 'library-armchair', kind: 'low', figure: 'armchair', x0: 51, z0: 24, x1: 51, z1: 24, color: PALETTE.upholsteryDark },
  { id: 'library-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 26, x1: 52, z1: 26, color: PALETTE.upholsteryDark },
  { id: 'library-side-table', kind: 'low', height: 0.45, figure: 'table', x0: 52, z0: 25, x1: 52, z1: 25, color: PALETTE.furnitureWalnut },
  // --- sitting room ---
  { id: 'sitting-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 3, z0: 30, x1: 8, z1: 36, color: PALETTE.rugGreen },
  { id: 'sitting-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 32, x1: 2, z1: 34, color: PALETTE.furnitureStone },
  { id: 'sitting-sofa', kind: 'low', figure: 'settee', x0: 4, z0: 31, x1: 7, z1: 31, color: PALETTE.sofaGreen },
  { id: 'sitting-sofa-2', kind: 'low', figure: 'settee', x0: 4, z0: 35, x1: 7, z1: 35, color: PALETTE.sofaGreen },
  { id: 'sitting-coffee-table', kind: 'low', height: 0.45, figure: 'table', x0: 5, z0: 33, x1: 6, z1: 33, color: PALETTE.furnitureWalnut },
  { id: 'sitting-grand-piano', kind: 'low', figure: 'grand-piano', x0: 14, z0: 30, x1: 16, z1: 31, color: PALETTE.pianoBlack },
  { id: 'sitting-piano-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 13, z0: 32, x1: 13, z1: 32, color: PALETTE.furnitureWalnut },
  { id: 'sitting-bookcase', kind: 'tall', figure: 'bookcase', x0: 10, z0: 28, x1: 12, z1: 28, color: PALETTE.furnitureWood },
  { id: 'sitting-card-table', kind: 'low', height: 0.7, figure: 'table', x0: 15, z0: 36, x1: 15, z1: 36, color: PALETTE.furnitureWalnut },
  { id: 'sitting-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 14, z0: 36, x1: 14, z1: 36, color: PALETTE.furnitureWalnut },
  { id: 'sitting-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 16, z0: 36, x1: 16, z1: 36, color: PALETTE.furnitureWalnut },
  // --- dining room ---
  { id: 'dining-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 5, z0: 17, x1: 14, z1: 20, color: PALETTE.rugRed },
  { id: 'dining-table', kind: 'low', figure: 'table', x0: 6, z0: 18, x1: 13, z1: 19, color: PALETTE.furnitureOak },
  { id: 'dining-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 7, z0: 17, x1: 7, z1: 17, color: PALETTE.furnitureWalnut },
  { id: 'dining-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 10, z0: 17, x1: 10, z1: 17, color: PALETTE.furnitureWalnut },
  { id: 'dining-chair-3', kind: 'low', height: 0.45, figure: 'chair', x0: 12, z0: 17, x1: 12, z1: 17, color: PALETTE.furnitureWalnut },
  { id: 'dining-chair-4', kind: 'low', height: 0.45, figure: 'chair', x0: 8, z0: 20, x1: 8, z1: 20, color: PALETTE.furnitureWalnut },
  { id: 'dining-chair-5', kind: 'low', height: 0.45, figure: 'chair', x0: 11, z0: 20, x1: 11, z1: 20, color: PALETTE.furnitureWalnut },
  { id: 'dining-chair-6', kind: 'low', height: 0.45, figure: 'chair', x0: 5, z0: 18, x1: 5, z1: 18, color: PALETTE.furnitureWalnut },
  { id: 'dining-sideboard', kind: 'tall', figure: 'cabinet', x0: 10, z0: 14, x1: 13, z1: 14, color: PALETTE.furnitureWood },
  { id: 'dining-china-cabinet', kind: 'tall', figure: 'cabinet', x0: 17, z0: 16, x1: 17, z1: 17, color: PALETTE.furnitureWood },
  { id: 'dining-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 19, x1: 2, z1: 21, color: PALETTE.furnitureStone },
  { id: 'dining-cart', kind: 'low', figure: 'table', x0: 14, z0: 16, x1: 14, z1: 16, color: PALETTE.furnitureStoneWarm },
  // --- grand hall ---
  { id: 'hall-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 21, x1: 34, z1: 27, color: PALETTE.rugViolet },
  { id: 'hall-settee-statue', kind: 'low', figure: 'statue-settee', x0: 29, z0: 23, x1: 31, z1: 25, color: PALETTE.velvetRose },
  { id: 'hall-armor', kind: 'tall', figure: 'armor', x0: 26, z0: 17, x1: 26, z1: 17, color: PALETTE.armorSteel },
  { id: 'hall-armor-2', kind: 'tall', figure: 'armor', x0: 35, z0: 17, x1: 35, z1: 17, color: PALETTE.armorSteel },
  { id: 'hall-pedestal', kind: 'low', figure: 'pedestal', x0: 24, z0: 19, x1: 24, z1: 19, color: PALETTE.stonePale },
  { id: 'hall-pedestal-2', kind: 'low', figure: 'pedestal', x0: 37, z0: 19, x1: 37, z1: 19, color: PALETTE.stonePale },
  { id: 'hall-armchair', kind: 'low', figure: 'armchair', x0: 24, z0: 29, x1: 24, z1: 29, color: PALETTE.upholsteryDark },
  { id: 'hall-armchair-2', kind: 'low', figure: 'armchair', x0: 37, z0: 29, x1: 37, z1: 29, color: PALETTE.upholsteryDark },
  { id: 'hall-fern', kind: 'low', figure: 'fern', x0: 27, z0: 31, x1: 27, z1: 31, color: PALETTE.fernGreen },
  { id: 'hall-fern-2', kind: 'low', figure: 'fern', x0: 34, z0: 31, x1: 34, z1: 31, color: PALETTE.fernGreen },
  // --- foyer ---
  { id: 'foyer-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 37, x1: 34, z1: 40, color: PALETTE.rugRed },
  { id: 'foyer-center-table', kind: 'low', figure: 'round-table', x0: 30, z0: 38, x1: 31, z1: 39, color: PALETTE.furnitureOak },
  { id: 'foyer-clock', kind: 'low', height: 1.7, figure: 'clock', x0: 36, z0: 36, x1: 36, z1: 36, color: PALETTE.furnitureWoodDark },
  { id: 'foyer-console', kind: 'low', figure: 'table', x0: 25, z0: 36, x1: 25, z1: 37, color: PALETTE.furnitureOak },
  { id: 'foyer-coat-stand', kind: 'low', height: 1.7, figure: 'coat-stand', x0: 25, z0: 42, x1: 25, z1: 42, color: PALETTE.upholsteryDark },
  { id: 'foyer-umbrella-stand', kind: 'low', height: 0.45, figure: 'barrel', x0: 36, z0: 42, x1: 36, z1: 42, color: PALETTE.upholsteryDark },
  // --- scenery (stairs inert this milestone) ---
  { id: 'hall-grand-staircase', kind: 'low', height: 1.5, figure: 'staircase', x0: 27, z0: 16, x1: 34, z1: 17, color: PALETTE.furnitureOak },
  { id: 'stair-service-stairs', kind: 'low', height: 1.5, figure: 'staircase', x0: 21, z0: 2, x1: 24, z1: 4, color: PALETTE.furnitureWood },
  { id: 'stair-cellar-hatch', kind: 'low', height: 0.25, figure: 'hatch', x0: 22, z0: 8, x1: 23, z1: 8, color: PALETTE.furnitureWoodDark },
  // --- corridors ---
  { id: 'corridor-runner', kind: 'decor', height: 0.02, figure: 'rug', x0: 21, z0: 13, x1: 52, z1: 14, color: PALETTE.rugRed },
];

export const GROUND_FLOOR = {
  name: 'mansion',
  mapText: GROUND_FLOOR_MAP,
  cell: 1,
  furniture: FURNITURE,
  floorPatches: [
    { x0: 22, z0: 16, x1: 39, z1: 32, family: 'stone', color: PALETTE.hallMarble },   // hall (octagon bbox)
    { x0: 25, z0: 35, x1: 36, z1: 42, family: 'stone', color: PALETTE.hallMarble },   // foyer
    { x0: 2, z0: 2, x1: 17, z1: 11, family: 'stone', color: PALETTE.kitchenFloor },   // kitchen
    { x0: 20, z0: 13, x1: 53, z1: 14, family: 'wood', color: PALETTE.floorParquetDark }, // north corridor
    { x0: 20, z0: 38, x1: 24, z1: 39, family: 'wood', color: PALETTE.floorParquetDark }, // west passage
    { x0: 37, z0: 38, x1: 41, z1: 39, family: 'wood', color: PALETTE.floorParquetDark }, // east passage
    { x0: 18, z0: 23, x1: 21, z1: 24, family: 'wood', color: PALETTE.floorParquetDark }, // hall-dining vestibule
    { x0: 18, z0: 11, x1: 19, z1: 13, family: 'wood', color: PALETTE.floorParquetDark }, // kitchen L-passage
    { x0: 2, z0: 14, x1: 17, z1: 25, family: 'wood', color: PALETTE.floorParquet },   // dining
    { x0: 2, z0: 28, x1: 19, z1: 39, family: 'wood', color: PALETTE.floorParquet },   // sitting
    { x0: 42, z0: 17, x1: 55, z1: 32, family: 'wood', color: PALETTE.floorParquet },  // library
    { x0: 42, z0: 35, x1: 55, z1: 44, family: 'wood', color: PALETTE.floorParquet },  // drawing
    { x0: 38, z0: 2, x1: 53, z1: 11, family: 'wood', color: PALETTE.floorParquet },   // billiard
    { x0: 28, z0: 2, x1: 35, z1: 9, family: 'wood', color: PALETTE.floorParquet },    // study
    { x0: 20, z0: 2, x1: 25, z1: 9, family: 'wood', color: PALETTE.floorParquet },    // service stair
  ],
  wallPatches: [
    { x0: 1, z0: 1, x1: 18, z1: 12, family: 'stone', color: PALETTE.kitchenWall },    // kitchen walls
  ],
  windows: [
    { x: 42, z: 1, facing: 's' }, { x: 43, z: 1, facing: 's' }, { x: 46, z: 1, facing: 's' }, { x: 47, z: 1, facing: 's' },
    { x: 56, z: 37, facing: 'w' }, { x: 56, z: 38, facing: 'w' }, { x: 56, z: 41, facing: 'w' }, { x: 56, z: 42, facing: 'w' },
    { x: 45, z: 45, facing: 'n' }, { x: 46, z: 45, facing: 'n' }, { x: 51, z: 45, facing: 'n' }, { x: 52, z: 45, facing: 'n' },
    { x: 56, z: 20, facing: 'w' }, { x: 56, z: 21, facing: 'w' }, { x: 56, z: 25, facing: 'w' }, { x: 56, z: 26, facing: 'w' },
    { x: 56, z: 29, facing: 'w' }, { x: 56, z: 30, facing: 'w' },
    { x: 1, z: 29, facing: 'e' }, { x: 1, z: 30, facing: 'e' }, { x: 1, z: 37, facing: 'e' }, { x: 1, z: 38, facing: 'e' },
    { x: 4, z: 40, facing: 'n' }, { x: 5, z: 40, facing: 'n' }, { x: 10, z: 40, facing: 'n' }, { x: 11, z: 40, facing: 'n' },
    { x: 1, z: 15, facing: 'e' }, { x: 1, z: 16, facing: 'e' }, { x: 1, z: 23, facing: 'e' }, { x: 1, z: 24, facing: 'e' },
    { x: 9, z: 1, facing: 's' }, { x: 10, z: 1, facing: 's' }, { x: 1, z: 8, facing: 'e' }, { x: 1, z: 9, facing: 'e' },
  ],
  wallProps: [
    { x0: 31, x1: 32, z: 1, facing: 's', type: 'boarded-window' },
    { x0: 28, x1: 29, z: 1, facing: 's', type: 'portrait' },
    { x: 36, z0: 5, z1: 6, facing: 'w', type: 'map' },
    { x0: 39, x1: 40, z: 1, facing: 's', type: 'cue-rack' },
    { x: 37, z0: 5, z1: 6, facing: 'e', type: 'scoreboard' },
    { x0: 44, x1: 45, z: 34, facing: 's', type: 'portrait' },
    { x0: 14, x1: 15, z: 27, facing: 's', type: 'portrait' },
    { x0: 4, x1: 5, z: 13, facing: 's', type: 'portrait' },
    { x0: 4, x1: 6, z: 1, facing: 's', type: 'pot-rack' },
    { x: 21, z0: 26, z1: 27, facing: 'e', type: 'tapestry' },
    { x: 40, z0: 26, z1: 27, facing: 'w', type: 'tapestry' },
    { x0: 26, x1: 28, z: 34, facing: 's', type: 'portrait' },
    { x0: 33, x1: 35, z: 34, facing: 's', type: 'portrait' },
    // NOTE: brief specified z0:39, but x24,z39 is a door cell (part of the
    // DDDDD passage), not wall — z0:39..z1:40 spans a door+wall pair that
    // fails "puts every window and wall prop on a wall cell". x24 is wall
    // from z40 through z42 (the passage's east wall), so this was shifted
    // one cell south to the nearest fully-wall 2-cell span. Flagged for
    // review — see task-6 report.
    { x: 24, z0: 40, z1: 41, facing: 'e', type: 'mirror' },
    { x0: 30, x1: 31, z: 43, facing: 'n', type: 'main-door' },
  ],
};
