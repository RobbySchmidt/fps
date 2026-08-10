import { describe, it, expect } from 'vitest';
import { expandFurniture, furnitureBox, FURNITURE_HEIGHTS } from '../src/level/furniture.js';

const bounds = { wallSet: new Set(['0,0']), cols: 10, rows: 10 };

describe('expandFurniture', () => {
  it('expands a low footprint into moveCells but not sightCells', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'table', kind: 'low', x0: 2, z0: 3, x1: 3, z1: 4 }],
      bounds,
    );
    expect([...moveCells].sort()).toEqual(['2,3', '2,4', '3,3', '3,4']);
    expect(sightCells.size).toBe(0);
  });

  it('puts tall furniture in both sets', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'shelf', kind: 'tall', x0: 5, z0: 5, x1: 5, z1: 6 }],
      bounds,
    );
    expect(moveCells.has('5,5')).toBe(true);
    expect(sightCells.has('5,6')).toBe(true);
  });

  it('leaves decor out of both sets', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'stool', kind: 'decor', x0: 1, z0: 1, x1: 1, z1: 1 }],
      bounds,
    );
    expect(moveCells.size).toBe(0);
    expect(sightCells.size).toBe(0);
  });

  it('throws when a footprint overlaps a wall cell', () => {
    expect(() =>
      expandFurniture([{ id: 'bad-table', kind: 'low', x0: 0, z0: 0, x1: 1, z1: 0 }], bounds),
    ).toThrow(/bad-table/);
  });

  it('throws when a footprint leaves the map bounds', () => {
    expect(() =>
      expandFurniture([{ id: 'runaway', kind: 'low', x0: 9, z0: 9, x1: 10, z1: 9 }], bounds),
    ).toThrow(/runaway/);
  });

  it('throws on an unknown kind', () => {
    expect(() =>
      expandFurniture([{ id: 'typo', kind: 'tal', x0: 1, z0: 1, x1: 1, z1: 1 }], bounds),
    ).toThrow(/typo/);
  });

  it('throws on an inverted footprint', () => {
    expect(() =>
      expandFurniture([{ id: 'backwards', kind: 'low', x0: 3, z0: 1, x1: 2, z1: 1 }], bounds),
    ).toThrow(/backwards/);
  });
});

describe('furnitureBox', () => {
  it('computes world-space size and center from the footprint', () => {
    const box = furnitureBox({ id: 't', kind: 'low', x0: 6, z0: 5, x1: 9, z1: 6 }, 1);
    expect(box).toEqual({ w: 4, h: FURNITURE_HEIGHTS.low, d: 2, x: 7.5, y: FURNITURE_HEIGHTS.low / 2, z: 5.5 });
  });

  it('lets an item override its kind height', () => {
    const box = furnitureBox({ id: 'chair', kind: 'low', height: 0.45, x0: 1, z0: 1, x1: 1, z1: 1 }, 1);
    expect(box.h).toBe(0.45);
    expect(box.y).toBe(0.225);
  });

  it('scales with the cell size', () => {
    const box = furnitureBox({ id: 'b', kind: 'tall', x0: 1, z0: 1, x1: 1, z1: 1 }, 2);
    expect(box.w).toBe(2);
    expect(box.x).toBe(2);
  });
});
