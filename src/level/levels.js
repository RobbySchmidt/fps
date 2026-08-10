import { GROUND_FLOOR } from './groundFloor.js';
import { KITCHEN_TEST } from './kitchenTest.js';

export { KITCHEN_TEST };
export { GROUND_FLOOR as MANSION };

const BY_NAME = new Map([[KITCHEN_TEST.name, KITCHEN_TEST]]);

export function selectLevel(queryString) {
  const name = new URLSearchParams(queryString).get('map');
  return BY_NAME.get(name) ?? GROUND_FLOOR;
}
