// Single source of truth for the "dark ink & toon" look.
export const PALETTE = {
  background: 0x07090d, // near-black night, also fog color
  wall: 0x5a6472,       // cold grey-blue
  floor: 0x3d4450,
  ceiling: 0x2e333d,
  ambient: 0x36415a,    // faint cold moonlight fill
  flashlight: 0xffe6b8, // warm hand-held beam
  ink: 0x05060a,        // outline color
  lamp: 0xffcf9e,       // warm lamp glow
  impact: 0x101318,     // dark bullet mark
  wanderer: 0x0d1014,   // near-black body: reads as a silhouette with ink outlines
  wandererEye: 0xdfe8ff, // pale, cold eyes
  chitinRidge: 0x232a33, // wanderer skin texture: ridge strokes
  chitinShadow: 0x1c222a, // wanderer skin texture: hatch shadow strokes
  furnitureWood: 0x5e4a36,  // oak table, barrels, larder shelving
  furnitureIron: 0x3a3e46,  // cast-iron stove, hearth metalwork
  furnitureStone: 0x555c60, // stone counter
  kitchenFloor: 0x4a4d52,     // worn stone, kitchen slice
  kitchenWall: 0x62676e,      // stone-tinted kitchen walls
  moonlight: 0xbfd0e6,        // window glow + spill
  furnitureIronDark: 0x2e3238, // oven doors, hob rings, barrel hoops
  firebox: 0x14171c,          // hearth interior, basin inset
  jarOchre: 0x6a5f4a,         // larder jars
  jarTeal: 0x4a5e5a,
  jarRust: 0x5e4a4a,
  furnitureOak: 0x8a6a48,
  furnitureWalnut: 0x6b5138,
  furnitureWoodDark: 0x5e4632,
  furnitureStoneWarm: 0x6b5a42,
  upholsteryDark: 0x4e4436,
  velvet: 0x5e4a6e,
  velvetRose: 0x6a4a5e,
  feltGreen: 0x2e5e42,
  pianoBlack: 0x2e2a26,
  fernGreen: 0x3e5e3e,
  sofaGreen: 0x4a5e3e,
  armorSteel: 0x5a5e66,
  stonePale: 0x6b6355,
  rugRed: 0x7a3b3b,
  rugGreen: 0x3b5e4a,
  rugBlue: 0x3b4a5e,
  rugViolet: 0x5e3b6e,
  rugBrown: 0x4a3b3b,
  floorParquet: 0x52432f,
  floorParquetDark: 0x463a2c,
  hallMarble: 0x565963,
  canvasDark: 0x3a3630,
  mirrorGlass: 0x77808e,
};
