import { MAP, CELL } from './mapData.js';
import { KITCHEN_TEST } from './kitchenTest.js';

export { KITCHEN_TEST };

export const MANSION = { name: 'mansion', mapText: MAP, cell: CELL, furniture: [] };

const BY_NAME = new Map([[KITCHEN_TEST.name, KITCHEN_TEST]]);

export function selectLevel(queryString) {
  const name = new URLSearchParams(queryString).get('map');
  return BY_NAME.get(name) ?? MANSION;
}
