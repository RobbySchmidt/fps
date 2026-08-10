import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Hand-drawn-style tileable detail maps, generated once per family at runtime.
// wood/stone/iron are GREYSCALE multiply maps (white base, darker strokes) so
// material.color carries the palette tint. chitin bakes real colors: a
// multiply delta on a near-black body would be invisible.
// Node (vitest) has no canvas: createInkTexture returns null there and
// materials degrade to plain toon colors.
const SIZE = 256;
const cache = new Map();

function strokeStyle(ctx, shade, width) {
  ctx.strokeStyle = shade;
  ctx.lineWidth = width;
}

function drawWood(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.22)', 2);
  for (let i = 0; i < 9; i++) {
    const y = (i + 0.5) * (SIZE / 9);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= SIZE; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 2 + i * 1.7) * 5);
    }
    ctx.stroke();
  }
  // two knots
  strokeStyle(ctx, 'rgba(0,0,0,0.28)', 1.5);
  for (const [kx, ky] of [[70, 90], [190, 200]]) {
    ctx.beginPath();
    ctx.ellipse(kx, ky, 7, 4, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStone(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.20)', 1.5);
  // speckle dashes
  for (let i = 0; i < 60; i++) {
    const x = (i * 97) % SIZE;
    const y = (i * 61 + 23) % SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + (i % 5), y + (i % 3) - 1);
    ctx.stroke();
  }
  // two sparse cross-hatch patches
  strokeStyle(ctx, 'rgba(0,0,0,0.14)', 1);
  for (const [px, py] of [[40, 170], [180, 60]]) {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(px + i * 6, py);
      ctx.lineTo(px + i * 6 - 18, py + 26);
      ctx.stroke();
    }
  }
}

function drawIron(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.16)', 1);
  for (let i = 0; i < 22; i++) {
    const x = (i * 83 + 11) % SIZE;
    const y = (i * 47 + 31) % SIZE;
    const len = 14 + (i % 4) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (i % 3) - 1);
    ctx.stroke();
  }
  // rivet dots near tile edges (tile-safe: same offset both sides)
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  for (let i = 0; i < 8; i++) {
    const p = (i + 0.5) * (SIZE / 8);
    ctx.beginPath();
    ctx.arc(p, 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p, SIZE - 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChitin(ctx) {
  const base = '#' + PALETTE.wanderer.toString(16).padStart(6, '0');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, '#232a33', 1.4); // ~2x luminance of base, still near-black
  for (let i = 0; i < 14; i++) {
    const x = (i * 71 + 19) % SIZE;
    const y = (i * 53 + 41) % SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 18, y + 26, x + 8, y + 54);
    ctx.stroke();
  }
  strokeStyle(ctx, '#1c222a', 1);
  for (let i = 0; i < 4; i++) {
    const px = (i * 113 + 37) % SIZE;
    const py = (i * 149 + 61) % SIZE;
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.moveTo(px + j * 5, py);
      ctx.lineTo(px + j * 5 - 12, py + 18);
      ctx.stroke();
    }
  }
}

const DRAW = { wood: drawWood, stone: drawStone, iron: drawIron, chitin: drawChitin };

export function createInkTexture(family) {
  if (typeof document === 'undefined') return null; // Node/vitest: no canvas
  if (cache.has(family)) return cache.get(family);
  const draw = DRAW[family];
  if (!draw) throw new Error(`unknown ink family "${family}"`);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  cache.set(family, texture);
  return texture;
}
