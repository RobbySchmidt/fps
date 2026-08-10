import { describe, it, expect } from 'vitest';
import { parseMap } from '../src/level/mapData.js';
import { buildGreybox } from '../src/level/buildGreybox.js';

const MAP = `
#######
#S....#
#.....#
#######
`;

describe('buildGreybox wall merging', () => {
  it('merges all default walls into a single mesh', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1);
    // 1 merged wall mesh + floor + ceiling
    expect(group.children).toHaveLength(3);
  });

  it('adds one merged mesh per matching wall patch', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1, {
      wallPatches: [{ x0: 0, z0: 0, x1: 2, z1: 3, family: 'stone', color: 0x62676e }],
    });
    // 2 wall meshes (patched + default) + floor + ceiling
    expect(group.children).toHaveLength(4);
  });

  it('keeps floor patches as separate planes', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1, {
      floorPatches: [{ x0: 1, z0: 1, x1: 5, z1: 2, family: 'wood', color: 0x52432f }],
    });
    expect(group.children).toHaveLength(4); // walls + floor + ceiling + 1 patch
  });
});
