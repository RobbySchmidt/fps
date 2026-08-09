import { it, expect } from 'vitest';
import { createWandererFigure } from '../src/enemy/wandererFigure.js';

const base = { position: { x: 4, z: 6 }, facing: 0, time: 0, dt: 1 / 60 };

it('exposes exactly one head hit mesh and several body hit meshes', () => {
  const figure = createWandererFigure();
  const heads = figure.hitMeshes.filter((m) => m.userData.wandererPart === 'head');
  const bodies = figure.hitMeshes.filter((m) => m.userData.wandererPart === 'body');
  expect(heads.length).toBe(1);
  expect(bodies.length).toBeGreaterThan(0);
});

it('places the group at the given world position', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  expect(figure.group.position.x).toBeCloseTo(4);
  expect(figure.group.position.z).toBeCloseTo(6);
});

it('holds the same pose across one stop-motion frame and changes across frames', () => {
  const figure = createWandererFigure();
  const armOf = (t) => {
    figure.update({ ...base, state: 'patrol', time: t });
    return figure.parts.leftArm.rotation.x;
  };
  const a = armOf(1.21);
  const b = armOf(1.29);
  const c = armOf(1.35);
  expect(a).toBe(b);
  expect(a).not.toBe(c);
});

it('raises the blades when chasing and folds them when patrolling', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  const folded = figure.parts.leftArm.rotation.z;
  figure.update({ ...base, state: 'chase' });
  const raised = figure.parts.leftArm.rotation.z;
  expect(raised).not.toBe(folded);
});

it('collapses when dead', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  const standing = figure.group.rotation.x;
  for (let i = 0; i < 60; i++) figure.update({ ...base, state: 'dead' });
  expect(Math.abs(figure.group.rotation.x)).toBeGreaterThan(Math.abs(standing));
  expect(figure.group.position.y).toBeLessThan(0);
});

it('reset clears the death collapse', () => {
  const figure = createWandererFigure();
  for (let i = 0; i < 60; i++) figure.update({ ...base, state: 'dead' });
  figure.reset();
  figure.update({ ...base, state: 'patrol' });
  expect(figure.group.rotation.x).toBeCloseTo(0);
  expect(figure.group.position.y).toBeCloseTo(0);
});
