// Floor-plan generator for the M4a mansion-blueprint mockups (session 3).
// Builds 1m-cell tile grids from room rects/octagons + door carves,
// validates connectivity, prints ASCII, emits HTML fragments for the
// brainstorming visual companion, and exports the engine-format map +
// furniture manifest (mode: export).
//
// Usage: node genfloor.mjs <ground|ground2|upper|export|room <id>>
//   ground2 = the approved v2 ground floor (source of truth for the M4a spec)
//   upper   = banked upper-floor draft (M4b+)
//   room X  = zoomed furnished mockup (FURN2 data, v2 coords)
//   export  = engine map text + manifest + windows + wall props
//
// NOTE: SCREEN_DIR points at a visual-companion session content dir — update
// it to the active session before generating mockup HTML (export/ASCII modes
// work regardless).
import { writeFileSync } from 'node:fs';

const SCREEN_DIR = String.raw`C:\Users\WildC\OneDrive\Dokumente\GitHub\fps\.superpowers\brainstorm\937-1786358800\content`;

// ---------------------------------------------------------------- grid core
function makeFloor(W, H) {
  const grid = Array.from({ length: H }, () => Array(W).fill(null));
  const rooms = new Map();

  function room(id, label, color, type = 'room') {
    if (!rooms.has(id)) rooms.set(id, { id, label, color, type, cells: [] });
    return rooms.get(id);
  }
  function set(x, z, id, skip) {
    if (grid[z][x] !== null) {
      if (skip) return;
      throw new Error(`overlap at ${x},${z}: ${grid[z][x]} vs ${id}`);
    }
    grid[z][x] = id;
    rooms.get(id).cells.push([x, z]);
  }
  function rect(id, label, color, x0, z0, x1, z1, type = 'room') {
    room(id, label, color, type);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, id);
  }
  function octagon(id, label, color, x0, z0, x1, z1, cut, type = 'room', skip = false) {
    room(id, label, color, type);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const a = (x - x0) + (z - z0), b = (x1 - x) + (z - z0), c = (x - x0) + (z1 - z), d = (x1 - x) + (z1 - z);
      if (a >= cut && b >= cut && c >= cut && d >= cut) set(x, z, id, skip);
    }
  }
  function door(id, x0, z0, x1, z1) {
    rect(id, '', '#c9a86a', x0, z0, x1, z1, 'door');
  }
  return { grid, rooms, rect, octagon, door, W, H };
}

const isWalk = (f, id) => id && f.rooms.get(id).type !== 'well';

// ------------------------------------------------------------- validation
function validate(f, spawn) {
  const { grid, rooms, W, H } = f;
  const errors = [];
  const seenPairs = new Set();
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const id = grid[z][x];
    if (!id) continue;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx >= W || nz >= H) continue;
      const nid = grid[nz][nx];
      if (!nid || nid === id) continue;
      const a = rooms.get(id), b = rooms.get(nid);
      if (a.type !== 'room' || b.type !== 'room') continue; // doors + wells may touch anything
      const key = [id, nid].sort().join('|');
      if (!seenPairs.has(key)) { seenPairs.add(key); errors.push(`rooms touch without wall: ${key} at ${x},${z}`); }
    }
  }
  const seen = new Set([spawn.join(',')]);
  const queue = [spawn];
  while (queue.length) {
    const [x, z] = queue.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      if (!isWalk(f, grid[nz][nx])) continue;
      const k = `${nx},${nz}`;
      if (!seen.has(k)) { seen.add(k); queue.push([nx, nz]); }
    }
  }
  let total = 0;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (isWalk(f, grid[z][x])) total++;
  if (seen.size !== total) errors.push(`unreachable floor: ${total - seen.size} of ${total} cells`);
  return { errors, total };
}

// ---------------------------------------------------------------- renderers
function nearFloor(f, x, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= f.W || nz >= f.H) continue;
    if (f.grid[nz][nx]) return true;
  }
  return false;
}

function ascii(f, marks) {
  const out = [];
  for (let z = 0; z < f.H; z++) {
    let line = '';
    for (let x = 0; x < f.W; x++) {
      const m = marks.find((mk) => mk.x === x && mk.z === z);
      if (m) { line += m.ch; continue; }
      const id = f.grid[z][x];
      if (id) {
        const t = f.rooms.get(id).type;
        line += t === 'door' ? 'D' : t === 'well' ? 'O' : '.';
        continue;
      }
      line += nearFloor(f, x, z) ? '#' : ' ';
    }
    out.push(line);
  }
  return out.join('\n');
}

function html(f, marks, title, subtitle, notes) {
  const { grid, rooms, W, H } = f;
  const PX = 15;
  let cells = '';
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const id = grid[z][x];
    const mark = marks.find((mk) => mk.x === x && mk.z === z);
    let style = '';
    let content = '';
    if (id) {
      const r = rooms.get(id);
      style = `background:${r.color};`;
      if (r.type === 'door') style += 'outline:1px dashed rgba(0,0,0,.35);outline-offset:-2px;';
      if (r.type === 'well') style += 'box-shadow:inset 0 0 0 1px #6b5d3f;';
    } else {
      style = nearFloor(f, x, z) ? 'background:#15151a;' : '';
    }
    if (mark) {
      content = mark.glyph;
      style += `color:${mark.color};font-size:11px;line-height:${PX}px;text-align:center;font-weight:700;`;
      if (mark.bg) style += `background:${mark.bg};`;
    }
    cells += `<div style="${style}">${content}</div>`;
  }
  const labels = [...rooms.values()].filter((r) => r.label).map((r) => {
    const xs = r.cells.map((c) => c[0]), zs = r.cells.map((c) => c[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2 * PX;
    const cz = (Math.min(...zs) + Math.max(...zs) + 1) / 2 * PX + (r.labelDy || 0);
    return `<div style="position:absolute;left:${cx}px;top:${cz}px;transform:translate(-50%,-50%);color:#f2ede2;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;text-shadow:0 1px 3px #000,0 0 6px #000;white-space:pre;text-align:center;pointer-events:none;">${r.label}</div>`;
  }).join('');
  return `<h2>${title}</h2>
<p class="subtitle">${subtitle}</p>
<div class="mockup">
  <div class="mockup-header">${W}m × ${H}m — 1m grid cells</div>
  <div class="mockup-body" style="background:#26262c;overflow:auto;padding:16px;">
    <div style="position:relative;width:${W * PX}px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:repeat(${W},${PX}px);grid-auto-rows:${PX}px;">${cells}</div>
      ${labels}
    </div>
  </div>
</div>
<div class="section" style="margin-top:16px;">
  <span class="label">Legend</span>
  <p style="margin-top:6px;">
  <span style="display:inline-block;width:12px;height:12px;background:#15151a;vertical-align:-1px;"></span> wall &nbsp;
  <span style="display:inline-block;width:12px;height:12px;background:#c9a86a;vertical-align:-1px;"></span> doorway &nbsp;
  <span style="display:inline-block;width:12px;height:12px;background:#1c1620;box-shadow:inset 0 0 0 2px #6b5d3f;vertical-align:-1px;"></span> open well + railing &nbsp;
  <span style="color:#ffb84d;font-weight:700;">●</span> lamp &nbsp;
  <span style="color:#7ec8ff;font-weight:700;">▲</span> stairs up &nbsp;
  <span style="color:#b88cff;font-weight:700;">▼</span> stairs down &nbsp;
  <span style="color:#8bd48b;font-weight:700;">S</span> spawn
  </p>
</div>
${notes}`;
}

// =============================================================== GROUND FLOOR
function buildGround() {
  const f = makeFloor(46, 36);
  f.octagon('hall', 'GRAND\nHALL', '#5a4a6e', 16, 13, 29, 25, 4);
  f.rect('foyer', 'FOYER', '#6e5a4a', 18, 28, 27, 33);
  f.rect('kitchen', 'KITCHEN', '#4a6e5a', 2, 2, 13, 9);
  f.rect('stair', 'SERVICE\nSTAIR', '#555c66', 16, 2, 20, 8);
  f.rect('study', 'STUDY', '#6e4a4a', 23, 2, 29, 8);
  f.rect('billiard', 'BILLIARD\nROOM', '#4a5a6e', 32, 2, 43, 8);
  f.rect('ncorr', '', '#3f3f47', 16, 10, 43, 11);
  f.rect('dining', 'DINING\nROOM', '#6e6a4a', 2, 12, 13, 21);
  f.rect('sitting', 'SITTING\nROOM', '#5a6e4a', 2, 24, 13, 30);
  f.rect('library', 'LIBRARY', '#7e5a3e', 33, 14, 43, 25);
  f.rect('drawing', 'DRAWING\nROOM', '#4a6e6e', 33, 28, 43, 33);
  f.door('d-hall-foyer', 22, 26, 23, 27);
  f.door('d-hall-north', 22, 12, 23, 12);
  f.door('d-hall-dining', 14, 18, 15, 19);
  f.door('d-hall-library', 30, 18, 32, 19);
  f.door('d-kitchen-dining', 6, 10, 7, 11);
  f.door('d-kitchen-ncorr', 14, 9, 15, 11);
  f.door('d-stair-ncorr', 17, 9, 18, 9);
  f.door('d-study-ncorr', 25, 9, 26, 9);
  f.door('d-billiard-ncorr', 36, 9, 37, 9);
  f.door('d-library-ncorr', 37, 12, 38, 13);
  f.door('d-library-drawing', 37, 26, 38, 27);
  f.door('d-foyer-drawing', 28, 30, 32, 31);
  f.door('d-sitting-foyer', 14, 28, 17, 29);
  f.door('d-dining-sitting', 6, 22, 7, 23);
  const marks = [
    { x: 22, z: 32, ch: 'S', glyph: 'S', color: '#8bd48b' },
    { x: 22, z: 34, ch: '=', glyph: '╬', color: '#e8e4d8', bg: '#3a3226' },
    { x: 23, z: 34, ch: '=', glyph: '╬', color: '#e8e4d8', bg: '#3a3226' },
    { x: 21, z: 14, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 22, z: 14, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 23, z: 14, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 24, z: 14, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 17, z: 3, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 18, z: 3, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 17, z: 7, ch: 'C', glyph: '▼', color: '#b88cff' },
    { x: 18, z: 7, ch: 'C', glyph: '▼', color: '#b88cff' },
    { x: 22, z: 30, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 19, z: 19, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 26, z: 19, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 7, z: 16, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 7, z: 5, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 38, z: 17, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 38, z: 23, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 37, z: 5, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 7, z: 27, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 40, z: 10, ch: 'L', glyph: '●', color: '#ffb84d' },
    { x: 38, z: 30, ch: 'L', glyph: '●', color: '#ffb84d' },
  ];
  const notes = `<div class="section" style="margin-top:12px;">
  <span class="label">Reading the plan</span>
  <ul style="margin-top:6px;line-height:1.6;">
    <li>You spawn in the <b>foyer</b>, back to the locked main door. The octagonal <b>grand hall</b> is straight ahead with the grand staircase (▲).</li>
    <li><b>Two ways upstairs</b> (grand + service stair), <b>one way down</b> to the cellar (▼ in the service stairwell).</li>
    <li><b>Dark pockets</b>: study, service stairwell, both short south passages.</li>
  </ul>
</div>`;
  return { f, marks, spawn: [22, 32], file: 'ground-floor.html', title: 'Ground floor — proposal', subtitle: 'The mansion at 1m grid cells, 46m × 36m. Named rooms around the octagonal grand hall.', notes };
}

// ============================================= GROUND FLOOR v2 (sizing pass)
// Playtest rule: 16x10m (the validated kitchen) is the MINIMUM fight room.
// Same topology as v1 — same rooms, doors, loops — bigger bones.
function buildGround2() {
  const f = makeFloor(58, 47);
  f.octagon('hall', 'GRAND\nHALL', '#5a4a6e', 22, 16, 39, 32, 5);            // 18x17 arena
  f.rect('foyer', 'FOYER', '#6e5a4a', 25, 35, 36, 42);                       // 12x8
  f.rect('kitchen', 'KITCHEN', '#4a6e5a', 2, 2, 17, 11);                     // 16x10 = the slice
  f.rect('stair', 'SERVICE\nSTAIR', '#555c66', 20, 2, 25, 9);                // 6x8
  f.rect('study', 'STUDY', '#6e4a4a', 28, 2, 35, 9);                         // 8x8 dark pressure room
  f.rect('billiard', 'BILLIARD\nROOM', '#4a5a6e', 38, 2, 53, 11);            // 16x10
  f.rect('ncorr', '', '#3f3f47', 20, 13, 53, 14);
  f.rect('dining', 'DINING\nROOM', '#6e6a4a', 2, 14, 17, 25);                // 16x12
  f.rect('sitting', 'SITTING\nROOM', '#5a6e4a', 2, 28, 19, 39);              // 18x12
  f.rect('library', 'LIBRARY', '#7e5a3e', 42, 17, 55, 32);                   // 14x16
  f.rect('drawing', 'DRAWING\nROOM', '#4a6e6e', 42, 35, 55, 44);             // 14x10
  f.door('d-hall-foyer', 30, 33, 31, 34);
  f.door('d-hall-north', 30, 15, 31, 15);
  f.door('d-hall-dining', 18, 23, 21, 24);      // short west vestibule
  f.door('d-hall-library', 40, 23, 41, 24);
  f.door('d-kitchen-dining', 6, 12, 7, 13);
  f.door('d-kitchen-ncorr', 18, 11, 19, 13);    // L-passage kitchen -> corridor
  f.door('d-stair-ncorr', 22, 10, 23, 12);
  f.door('d-study-ncorr', 31, 10, 32, 12);
  f.door('d-billiard-ncorr', 44, 12, 45, 12);
  f.door('d-library-ncorr', 47, 15, 48, 16);
  f.door('d-library-drawing', 47, 33, 48, 34);
  f.door('d-foyer-drawing', 37, 38, 41, 39);    // south passage east
  f.door('d-sitting-foyer', 20, 38, 24, 39);    // south passage west
  f.door('d-dining-sitting', 6, 26, 7, 27);
  const marks = [
    { x: 30, z: 41, ch: 'S', glyph: 'S', color: '#8bd48b' },
    { x: 30, z: 43, ch: '=', glyph: '╬', color: '#e8e4d8', bg: '#3a3226' },
    { x: 31, z: 43, ch: '=', glyph: '╬', color: '#e8e4d8', bg: '#3a3226' },
    // grand staircase, now 6 wide
    { x: 28, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 29, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 30, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 31, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 32, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 33, z: 17, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 22, z: 3, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 23, z: 3, ch: 'U', glyph: '▲', color: '#7ec8ff' },
    { x: 22, z: 8, ch: 'C', glyph: '▼', color: '#b88cff' },
    { x: 23, z: 8, ch: 'C', glyph: '▼', color: '#b88cff' },
    // lamps
    { x: 9, z: 6, ch: 'L', glyph: '●', color: '#ffb84d' },   // kitchen
    { x: 9, z: 19, ch: 'L', glyph: '●', color: '#ffb84d' },  // dining
    { x: 9, z: 33, ch: 'L', glyph: '●', color: '#ffb84d' },  // sitting
    { x: 30, z: 39, ch: 'L', glyph: '●', color: '#ffb84d' }, // foyer
    { x: 26, z: 24, ch: 'L', glyph: '●', color: '#ffb84d' }, // hall W
    { x: 35, z: 24, ch: 'L', glyph: '●', color: '#ffb84d' }, // hall E
    { x: 48, z: 21, ch: 'L', glyph: '●', color: '#ffb84d' }, // library N
    { x: 48, z: 29, ch: 'L', glyph: '●', color: '#ffb84d' }, // library S
    { x: 45, z: 6, ch: 'L', glyph: '●', color: '#ffb84d' },  // billiard
    { x: 48, z: 39, ch: 'L', glyph: '●', color: '#ffb84d' }, // drawing
    { x: 50, z: 13, ch: 'L', glyph: '●', color: '#ffb84d' }, // corridor E
  ];
  const notes = `<div class="section" style="margin-top:12px;">
  <span class="label">What changed vs v1 (sizing pass after the kitchen playtest)</span>
  <ul style="margin-top:6px;line-height:1.6;">
    <li>Every fight room now meets the validated 16×10m minimum: kitchen 16×10 (= the test slice exactly), billiard 16×10, dining 16×12, sitting 18×12, library 14×16, drawing 14×10. Footprint grew 46×36 → 58×47m.</li>
    <li>The <b>grand hall</b> grew to an 18×17 arena with a 6m-wide staircase.</li>
    <li>The <b>study stays small on purpose</b> (8×8, dark, no lamp): a non-combat pressure room — you don't want to be caught in there.</li>
    <li>Topology unchanged: same rooms, same doors, same two loops (west chain + hall/corridor/library).</li>
  </ul>
</div>`;
  return { f, marks, spawn: [30, 41], file: 'ground-floor-v2.html', title: 'Ground floor v2 — sizing pass', subtitle: 'Fight rooms grown to the playtest-validated 16×10m minimum; 58m × 47m footprint at 1m cells.', notes };
}

// ================================================================ UPPER FLOOR
function buildUpper() {
  const f = makeFloor(46, 36);
  // well first, then gallery ring carves around it
  f.octagon('well', 'GALLERY\n(open to hall below)', '#1c1620', 19, 16, 26, 22, 3, 'well');
  f.octagon('gallery', '', '#5a4a6e', 16, 13, 29, 25, 4, 'room', true);
  f.rect('scorr', '', '#3f3f47', 18, 28, 27, 33); // south corridor above foyer
  f.rect('servants', "SERVANTS'\nQUARTERS", '#4a6e5a', 2, 2, 13, 9);
  f.rect('stair', 'SERVICE\nSTAIR', '#555c66', 16, 2, 20, 8);
  f.rect('nursery', 'NURSERY', '#6e4a4a', 23, 2, 29, 8);
  f.rect('guest', 'GUEST\nROOM', '#4a5a6e', 32, 2, 43, 8);
  f.rect('ncorr', '', '#3f3f47', 16, 10, 43, 11);
  f.rect('rose', 'ROSE\nROOM', '#6e6a4a', 2, 12, 13, 21);
  f.rect('store', 'STORE\nROOM', '#5a6e4a', 2, 24, 13, 30);
  f.rect('master', 'MASTER\nBEDROOM', '#7e5a3e', 33, 14, 43, 25);
  f.rect('bath', 'BATH', '#4a6e6e', 33, 28, 38, 33);
  f.rect('linen', 'LINEN', '#66555c', 41, 28, 43, 33);
  f.door('d-gallery-scorr', 22, 26, 23, 27);
  f.door('d-gallery-north', 22, 12, 23, 12);
  f.door('d-gallery-rose', 14, 18, 15, 19);
  f.door('d-gallery-master', 30, 18, 32, 19);
  f.door('d-servants-ncorr', 14, 9, 15, 11);
  f.door('d-stair-ncorr', 17, 9, 18, 9);
  f.door('d-nursery-ncorr', 25, 9, 26, 9);
  f.door('d-guest-ncorr', 36, 9, 37, 9);
  f.door('d-master-ncorr', 37, 12, 38, 13);
  f.door('d-scorr-bath', 28, 30, 32, 31);
  f.door('d-store-scorr', 14, 28, 17, 29);
  f.door('d-rose-store', 6, 22, 7, 23);
  f.door('d-bath-linen', 39, 30, 40, 31);
  const marks = [
    // grand staircase arrives here (down to hall)
    { x: 21, z: 14, ch: 'V', glyph: '▼', color: '#b88cff' },
    { x: 22, z: 14, ch: 'V', glyph: '▼', color: '#b88cff' },
    { x: 23, z: 14, ch: 'V', glyph: '▼', color: '#b88cff' },
    { x: 24, z: 14, ch: 'V', glyph: '▼', color: '#b88cff' },
    // service stair down to ground
    { x: 17, z: 3, ch: 'V', glyph: '▼', color: '#b88cff' },
    { x: 18, z: 3, ch: 'V', glyph: '▼', color: '#b88cff' },
    // lamps
    { x: 17, z: 19, ch: 'L', glyph: '●', color: '#ffb84d' }, // gallery W ring
    { x: 28, z: 19, ch: 'L', glyph: '●', color: '#ffb84d' }, // gallery E ring
    { x: 40, z: 10, ch: 'L', glyph: '●', color: '#ffb84d' }, // corridor E
    { x: 38, z: 17, ch: 'L', glyph: '●', color: '#ffb84d' }, // master
    { x: 37, z: 5, ch: 'L', glyph: '●', color: '#ffb84d' },  // guest
    { x: 7, z: 16, ch: 'L', glyph: '●', color: '#ffb84d' },  // rose
    { x: 7, z: 5, ch: 'L', glyph: '●', color: '#ffb84d' },   // servants
    { x: 22, z: 30, ch: 'L', glyph: '●', color: '#ffb84d' }, // south corridor
    { x: 35, z: 30, ch: 'L', glyph: '●', color: '#ffb84d' }, // bath
  ];
  const notes = `<div class="section" style="margin-top:12px;">
  <span class="label">Reading the plan</span>
  <ul style="margin-top:6px;line-height:1.6;">
    <li>The center is the <b>gallery</b>: a walkway ringing an open well with a railing — you look down into the grand hall. The grand staircase (▼) lands on its north side, exactly above the ground-floor stair.</li>
    <li>Every room sits over its ground-floor counterpart, so the footprint and stair positions match 1:1: servants' quarters over the kitchen, nursery over the study, master bedroom over the library, Rose Room (guest) over the dining room.</li>
    <li><b>Loops preserved</b>: gallery ↔ north corridor ↔ service stair, and the west chain Rose Room → store room → south corridor mirrors the ground floor.</li>
    <li><b>Dark pockets</b>: the nursery, the store room (sheet-covered furniture), the linen closet, and the service stairwell. The gallery's south half is lit only by spill from its two lamps.</li>
  </ul>
</div>`;
  return { f, marks, spawn: [22, 14], file: 'upper-floor.html', title: 'Upper floor — proposal', subtitle: 'Bedrooms around the gallery — an open well with railing, looking down into the grand hall.', notes };
}

// ========================================================== furnished rooms
// kind: 'block' = occupies cells (collision + cover), 'decor' = walk-through,
// 'flat' = floor covering (rug), drawn under everything.
// All coords are GROUND FLOOR V2. Engine kinds map: block-low / block-tall
// noted in desc; seat-height pieces get (0.45m) in the label.
const FURN2 = {
  study: {
    title: 'Study — furnished (+ corridor policy below)',
    subtitle: '8×8m, NO lamp. The only fully dark room on the floor — a flashlight-only preview of the cellar.',
    region: [26, 1, 37, 14],
    items: [
      { label: 'rug', x0: 29, z0: 3, x1: 33, z1: 6, kind: 'flat', color: '#4a3b3b', desc: 'Dark rug, edge curled.' },
      { label: 'desk', x0: 30, z0: 4, x1: 32, z1: 5, kind: 'block', color: '#5e4a36', desc: 'LOW (0.9m). Massive oak desk drowning in papers; drawers half-open. Prime lore/loot spot for M4b.' },
      { label: 'desk chair', x0: 31, z0: 6, x1: 31, z1: 6, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Pushed back hard, fallen sideways (visual).' },
      { label: 'shelves', x0: 28, z0: 2, x1: 28, z1: 4, kind: 'block', color: '#5e4a36', desc: 'TALL. West wall shelving, ledgers and specimen jars.' },
      { label: 'shelves', x0: 35, z0: 2, x1: 35, z1: 4, kind: 'block', color: '#5e4a36', desc: 'TALL. East wall shelving.' },
      { label: 'safe', x0: 35, z0: 8, x1: 35, z1: 8, kind: 'block', color: '#3a3e46', desc: 'LOW (1.0m). Iron safe, door ajar, empty — or is it. M4b key-item candidate.' },
      { label: 'armchair', x0: 29, z0: 7, x1: 29, z1: 7, kind: 'block', color: '#4e4436', desc: 'LOW (0.9m). Reading chair facing the door. Someone liked watching who came in.' },
      { label: 'candle table', x0: 28, z0: 7, x1: 28, z1: 7, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Burned-out candle stub — the room HAD light once.' },
    ],
    wallDecor: [
      { side: 'N', x0: 31, x1: 32, z: 1, label: 'boarded window' },
      { side: 'N', x0: 28, x1: 29, z: 1, label: 'portrait' },
      { side: 'E', z0: 5, z1: 6, x: 36, label: 'map' },
    ],
    notes: ['NO lamp — the one fully dark room on the ground floor. Flashlight required; this is the cellar teaser.',
      'Non-combat pressure room by design (8×8, gaps of 1-2m everywhere): you come for the desk and the safe, you leave quickly. Fighting the Wanderer in here is a mistake the room lets you make.',
      'The exterior window is BOARDED — the darkness is deliberate, in-fiction too.',
      '<b>CORRIDOR POLICY (all corridors + passages + vestibules):</b> no blocking furniture anywhere — corridors are 2m wide and any blocker makes a 1m pinch A* funnels into. Corridors get: runner rugs (flat), portraits/coat hooks/sconces (wall decor), and the one lamp at the corridor east end. The two south passages and the hall vestibules stay bare and dark — transitional dread space.'],
  },
  billiard: {
    title: 'Billiard room — furnished',
    subtitle: '16×10m, ONE entrance. The billiard table is the arena centerpiece.',
    region: [36, 1, 55, 14],
    items: [
      { label: 'rug', x0: 42, z0: 5, x1: 49, z1: 8, kind: 'flat', color: '#3b5e4a', desc: 'Green baize-toned rug under the table.' },
      { label: 'billiard table', x0: 44, z0: 6, x1: 47, z1: 7, kind: 'block', color: '#2e5e42', desc: 'LOW (0.9m). Full-size billiard table, balls frozen mid-game; the lamp (●) is a low pendant right over the felt. THE orbit piece of the room.' },
      { label: 'stool', x0: 42, z0: 7, x1: 42, z1: 7, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Spectator stool, west end, offset south.' },
      { label: 'stool', x0: 49, z0: 6, x1: 49, z1: 6, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Spectator stool, east end, offset north.' },
      { label: 'bar cabinet', x0: 50, z0: 2, x1: 51, z1: 2, kind: 'block', color: '#5e4a36', desc: 'TALL (1.9m). Bar cabinet, north wall — bottles and glasses.' },
      { label: 'trophy case', x0: 53, z0: 5, x1: 53, z1: 7, kind: 'block', color: '#5e4a36', desc: 'TALL. Trophy case on the east wall — hunting trophies, one shelf conspicuously empty.' },
      { label: 'armchair', x0: 50, z0: 9, x1: 50, z1: 9, kind: 'block', color: '#4e4436', desc: 'LOW (0.9m). Leather armchair, smoking corner.' },
      { label: 'armchair', x0: 52, z0: 9, x1: 52, z1: 9, kind: 'block', color: '#4e4436', desc: 'LOW (0.9m). Its pair.' },
      { label: 'smoke table', x0: 51, z0: 9, x1: 51, z1: 9, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Ashtray, cold cigar.' },
    ],
    wallDecor: [
      { side: 'N', x0: 42, x1: 43, z: 1, label: 'window' },
      { side: 'N', x0: 46, x1: 47, z: 1, label: 'window' },
      { side: 'N', x0: 39, x1: 40, z: 1, label: 'cue rack' },
      { side: 'W', z0: 5, z1: 6, x: 37, label: 'scoreboard' },
    ],
    notes: ['ONE entrance (corridor, south) — deliberately the risk room: in M4b this is where the good pickups live, and the Wanderer between you and the only door is the nightmare scenario the room is built for.',
      'The billiard table is the perfect orbit piece: 4×2m of low cover in a big open floor — the kitchen-table fight at grander scale.',
      'North wall is exterior: two windows over the table.',
      'Door approach (south, x44-45) kept completely clear.'],
  },
  drawing: {
    title: 'Drawing room — furnished',
    subtitle: '14×10m. Formal receiving room: one central seating cluster you fight around.',
    region: [40, 33, 57, 46],
    items: [
      { label: 'rug', x0: 46, z0: 37, x1: 51, z1: 42, kind: 'flat', color: '#4a3b5e', desc: 'Fine violet rug under the seating cluster.' },
      { label: 'tea table', x0: 48, z0: 39, x1: 49, z1: 40, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Tea service still set; the chandelier (lamp ●) hangs above.' },
      { label: 'settee', x0: 47, z0: 37, x1: 50, z1: 37, kind: 'block', color: '#5e4a6e', desc: 'LOW (0.9m). Velvet settee, north side of the tea table.' },
      { label: 'settee', x0: 47, z0: 42, x1: 50, z1: 42, kind: 'block', color: '#5e4a6e', desc: 'LOW (0.9m). Matching settee, south side.' },
      { label: 'chaise longue', x0: 52, z0: 42, x1: 54, z1: 42, kind: 'block', color: '#5e4a6e', desc: 'LOW (0.9m). Chaise by the south windows, cushion dented.' },
      { label: 'secretary desk', x0: 52, z0: 35, x1: 53, z1: 35, kind: 'block', color: '#5e4a36', desc: 'TALL (1.9m). Writing desk, flap open, letters scattered — future note/lore spot.' },
      { label: 'drinks cabinet', x0: 43, z0: 35, x1: 44, z1: 35, kind: 'block', color: '#5e4a36', desc: 'TALL. Glass-front drinks cabinet; decanters catch the lamp light.' },
      { label: 'fern', x0: 44, z0: 43, x1: 44, z1: 43, kind: 'block', color: '#3e5e3e', desc: 'LOW. Potted fern, SW corner.' },
    ],
    wallDecor: [
      { side: 'E', z0: 37, z1: 38, x: 56, label: 'window' },
      { side: 'E', z0: 41, z1: 42, x: 56, label: 'window' },
      { side: 'S', x0: 45, x1: 46, z: 45, label: 'window' },
      { side: 'S', x0: 51, x1: 52, z: 45, label: 'window' },
      { side: 'N', x0: 44, x1: 45, z: 34, label: 'portrait' },
    ],
    notes: ['One dense central cluster (settees + tea table) instead of spread cover: the perimeter stays 2m+ open all the way around, and the cluster interior has deliberate 1m squeeze-gaps — you or the Wanderer can slip through the seating, which feels risky for both.',
      'East AND south walls are exterior — four windows, second-brightest room after the sitting room.',
      'Both exits (library N, foyer passage W) clear.'],
  },
  library: {
    title: 'Library — furnished',
    subtitle: '14×16m. Freestanding book stacks: the first tall, sight-blocking cover in the middle of a room.',
    region: [40, 14, 57, 34],
    items: [
      { label: 'book stack A', x0: 45, z0: 20, x1: 46, z1: 23, kind: 'block', color: '#5e4a36', desc: 'TALL (1.9m). Freestanding double-sided bookcase — the Wanderer loses sight of you behind it. Cat-and-mouse furniture.' },
      { label: 'book stack B', x0: 45, z0: 26, x1: 46, z1: 29, kind: 'block', color: '#5e4a36', desc: 'TALL. Second stack, 2m gap between them — a sight-line alley that opens and closes as you circle.' },
      { label: 'wall shelves', x0: 42, z0: 18, x1: 42, z1: 21, kind: 'block', color: '#5e4a36', desc: 'TALL. West wall shelving, north of the hall door.' },
      { label: 'wall shelves', x0: 42, z0: 27, x1: 42, z1: 31, kind: 'block', color: '#5e4a36', desc: 'TALL. West wall shelving, south of the hall door.' },
      { label: 'wall shelves', x0: 42, z0: 17, x1: 46, z1: 17, kind: 'block', color: '#5e4a36', desc: 'TALL. North wall shelving, west of the corridor door.' },
      { label: 'wall shelves', x0: 50, z0: 17, x1: 55, z1: 17, kind: 'block', color: '#5e4a36', desc: 'TALL. North wall shelving, east of the corridor door.' },
      { label: 'reading table', x0: 50, z0: 20, x1: 52, z1: 21, kind: 'block', color: '#8a6a48', desc: 'LOW (0.9m). Heavy reading table, open books and a dead candle.' },
      { label: 'globe', x0: 53, z0: 20, x1: 53, z1: 20, kind: 'block', color: '#6b5138', desc: 'LOW (1.2m visual). Standing globe in its frame beside the table.' },
      { label: 'rug', x0: 50, z0: 24, x1: 53, z1: 27, kind: 'flat', color: '#3b4a5e', desc: 'Reading-corner rug by the east windows.' },
      { label: 'armchair', x0: 51, z0: 24, x1: 51, z1: 24, kind: 'block', color: '#4e4436', desc: 'LOW (0.9m). Wing-back armchair facing the window.' },
      { label: 'armchair', x0: 52, z0: 26, x1: 52, z1: 26, kind: 'block', color: '#4e4436', desc: 'LOW (0.9m). Its twin, angled toward the first.' },
      { label: 'side table', x0: 52, z0: 25, x1: 52, z1: 25, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Between the chairs; empty glass, full ashtray.' },
    ],
    wallDecor: [
      { side: 'E', z0: 20, z1: 21, x: 56, label: 'window' },
      { side: 'E', z0: 25, z1: 26, x: 56, label: 'window' },
      { side: 'E', z0: 29, z1: 30, x: 56, label: 'window' },
    ],
    notes: ['The design experiment: TALL cover mid-room. The two freestanding stacks break line of sight — the Wanderer has to commit to a side, and so do you.',
      'Aisles are all 2m+ (validated width): west aisle, center alley between stacks, east reading half stays open.',
      'East wall is exterior: three windows over the reading corner.',
      'All three exits (hall W, corridor N, drawing room S) clear.',
      'Both lamps sit in the center alley — the stacks cast real shadows into the aisles.'],
  },
  sitting: {
    title: 'Sitting room — furnished',
    subtitle: '18×12m. Fireplace lounge on the west, grand piano on the east.',
    region: [1, 26, 25, 41],
    items: [
      { label: 'rug', x0: 3, z0: 30, x1: 8, z1: 36, kind: 'flat', color: '#3b5e4a', desc: 'Deep green rug under the fireplace seating.' },
      { label: 'fireplace', x0: 2, z0: 32, x1: 2, z1: 34, kind: 'block', color: '#555c60', desc: 'TALL. Stone fireplace, west wall — stacked with the dining room chimney one room north.' },
      { label: 'sofa', x0: 4, z0: 31, x1: 7, z1: 31, kind: 'block', color: '#4a5e3e', desc: 'LOW (0.9m). Worn velvet sofa, north side of the hearth.' },
      { label: 'sofa', x0: 4, z0: 35, x1: 7, z1: 35, kind: 'block', color: '#4a5e3e', desc: 'LOW (0.9m). Matching sofa, south side — cushions disturbed.' },
      { label: 'coffee table', x0: 5, z0: 33, x1: 6, z1: 33, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m). Between the sofas; abandoned teacups.' },
      { label: 'grand piano', x0: 14, z0: 30, x1: 16, z1: 31, kind: 'block', color: '#2e2a26', desc: 'LOW (0.9m). Black grand piano, lid open. The east half\'s cover anchor. (M5: one flat note when a fight bumps it.)' },
      { label: 'piano stool', x0: 13, z0: 32, x1: 13, z1: 32, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m).' },
      { label: 'bookcase', x0: 10, z0: 28, x1: 12, z1: 28, kind: 'block', color: '#5e4a36', desc: 'TALL. Small bookcase, north wall.' },
      { label: 'card table', x0: 15, z0: 36, x1: 15, z1: 36, kind: 'block', color: '#6b5138', desc: 'LOW (0.7m). Card table mid-game, SE corner.' },
      { label: 'chair', x0: 14, z0: 36, x1: 14, z1: 36, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m).' },
      { label: 'chair', x0: 16, z0: 36, x1: 16, z1: 36, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), pushed back from the table.' },
    ],
    wallDecor: [
      { side: 'N', x0: 14, x1: 15, z: 27, label: 'portrait' },
      { side: 'W', z0: 29, z1: 30, x: 1, label: 'window' },
      { side: 'W', z0: 37, z1: 38, x: 1, label: 'window' },
      { side: 'S', x0: 4, x1: 5, z: 40, label: 'window' },
      { side: 'S', x0: 10, x1: 11, z: 40, label: 'window' },
    ],
    notes: ['Two cover clusters instead of one: the hearth seating group (west) and the piano (east) — first room where a fight has two orbits to switch between.',
      'West AND south walls are exterior: four windows, the brightest moonlight in the house.',
      'Both exits (dining N, foyer passage E) clear of furniture.'],
  },
  dining: {
    title: 'Dining room — furnished',
    subtitle: '16×12m fight room. One long table to orbit, elegance gone slightly wrong.',
    region: [1, 12, 22, 28],
    items: [
      { label: 'rug', x0: 5, z0: 17, x1: 14, z1: 20, kind: 'flat', color: '#6e3b3b', desc: 'Long faded rug under the table.' },
      { label: 'dining table', x0: 6, z0: 18, x1: 13, z1: 19, kind: 'block', color: '#8a6a48', desc: 'LOW (0.9m). Eight-meter walnut dining table, still half-set with dusty silverware. The chandelier (lamp ●) hangs above it. Main cover — the fight orbits it like the kitchen table, with more room to breathe.' },
      { label: 'chair', x0: 7, z0: 17, x1: 7, z1: 17, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m seat height), north side.' },
      { label: 'chair', x0: 10, z0: 17, x1: 10, z1: 17, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), north side.' },
      { label: 'chair', x0: 12, z0: 17, x1: 12, z1: 17, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), north side.' },
      { label: 'chair', x0: 8, z0: 20, x1: 8, z1: 20, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), south side.' },
      { label: 'chair', x0: 11, z0: 20, x1: 11, z1: 20, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), south side — knocked over on its back (visual only).' },
      { label: 'chair', x0: 5, z0: 18, x1: 5, z1: 18, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), head of the table, pulled out as if someone left in a hurry.' },
      { label: 'sideboard', x0: 10, z0: 14, x1: 13, z1: 14, kind: 'block', color: '#5e4a36', desc: 'TALL (1.9m). Buffet sideboard against the north wall — blocks sight; future pickup shelf (M4b).' },
      { label: 'china cabinet', x0: 17, z0: 16, x1: 17, z1: 17, kind: 'block', color: '#5e4a36', desc: 'TALL. Glass-front cabinet, east wall. Rattles when shot (audio, M5).' },
      { label: 'fireplace', x0: 2, z0: 19, x1: 2, z1: 21, kind: 'block', color: '#555c60', desc: 'TALL. Cold stone fireplace, west wall, mantel with stopped clock.' },
      { label: 'cart', x0: 14, z0: 16, x1: 14, z1: 16, kind: 'block', color: '#6b5a42', desc: 'LOW. Serving cart, slightly askew.' },
    ],
    wallDecor: [
      { side: 'N', x0: 4, x1: 5, z: 13, label: 'portrait' },
      { side: 'W', z0: 15, z1: 16, x: 1, label: 'window' },
      { side: 'W', z0: 23, z1: 24, x: 1, label: 'window' },
    ],
    notes: ['Kitchen-proven recipe scaled up: one big low table to orbit, tall sight-blockers on the walls only.',
      'Three exits (kitchen N, hall vestibule E, sitting room S) — all kept clear of furniture.',
      'Chairs at seat height (0.45m): block movement, shots clear them easily.',
      'West wall is exterior — two windows for moonlight spill.'],
  },
  kitchen: {
    title: 'Kitchen — furnished (v2, = the validated test slice)',
    subtitle: 'Identical to the playtested slice layout: 16×10m, table lanes, everything blocks.',
    region: [1, 1, 20, 15],
    items: [
      { label: 'work table', x0: 8, z0: 6, x1: 12, z1: 7, kind: 'block', color: '#8a6a48', desc: 'LOW (0.9m). The validated centerpiece; pendant lamp above.' },
      { label: 'stove', x0: 4, z0: 2, x1: 6, z1: 2, kind: 'block', color: '#3e3e46', desc: 'TALL. Cast-iron range, north wall.' },
      { label: 'hearth', x0: 13, z0: 2, x1: 16, z1: 2, kind: 'block', color: '#5e4632', desc: 'TALL. Open hearth with kettle, NE.' },
      { label: 'counter', x0: 2, z0: 4, x1: 2, z1: 7, kind: 'block', color: '#6b5a42', desc: 'LOW. Stone counter with basin, west wall.' },
      { label: 'larder', x0: 2, z0: 11, x1: 5, z1: 11, kind: 'block', color: '#5e4a36', desc: 'TALL. Larder shelving, south wall — M4b pickup shelf.' },
      { label: 'barrel', x0: 17, z0: 5, x1: 17, z1: 5, kind: 'block', color: '#6b5a42', desc: 'LOW. Barrel, east wall.' },
      { label: 'barrel', x0: 17, z0: 6, x1: 17, z1: 6, kind: 'block', color: '#6b5a42', desc: 'LOW. Second barrel.' },
      { label: 'stool', x0: 7, z0: 6, x1: 7, z1: 6, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), west end of the table.' },
      { label: 'stool', x0: 13, z0: 7, x1: 13, z1: 7, kind: 'block', color: '#6b5138', desc: 'LOW (0.45m), east end of the table.' },
    ],
    wallDecor: [
      { side: 'N', x0: 4, x1: 6, z: 1, label: 'pot rack' },
      { side: 'N', x0: 9, x1: 10, z: 1, label: 'window' },
      { side: 'W', z0: 8, z1: 9, x: 1, label: 'window' },
    ],
    notes: ['This layout shipped and was playtested — coordinates in the blueprint match the test slice exactly.'],
  },
  hall: {
    title: 'Grand hall — furnished (v2)',
    subtitle: '18×17m arena. Open center with the settee anchor, 6m staircase to the north.',
    region: [19, 14, 42, 35],
    items: [
      { label: 'grand staircase', x0: 27, z0: 16, x1: 34, z1: 17, kind: 'zone', color: '#7ec8ff', desc: 'Walk-in transition zone (inert this milestone, roped off).' },
      { label: 'rug', x0: 27, z0: 21, x1: 34, z1: 27, kind: 'flat', color: '#5e3b6e', desc: 'Grand rug under the settee.' },
      { label: 'round settee + statue', x0: 29, z0: 23, x1: 31, z1: 25, kind: 'block', shape: 'round', color: '#6a4a5e', desc: 'LOW (0.9m). Now 3×3m — circular settee around a marble statue plinth. THE center anchor.' },
      { label: 'armor', x0: 26, z0: 17, x1: 26, z1: 17, kind: 'block', color: '#5a5e66', desc: 'TALL. Suit of armor flanking the stair, west.' },
      { label: 'armor', x0: 35, z0: 17, x1: 35, z1: 17, kind: 'block', color: '#5a5e66', desc: 'TALL. Suit of armor flanking the stair, east.' },
      { label: 'pedestal', x0: 24, z0: 19, x1: 24, z1: 19, kind: 'block', color: '#6b6355', desc: 'LOW. Stone pedestal with bust, NW diagonal.' },
      { label: 'pedestal', x0: 37, z0: 19, x1: 37, z1: 19, kind: 'block', color: '#6b6355', desc: 'LOW. Stone pedestal with bust, NE diagonal.' },
      { label: 'armchair', x0: 24, z0: 29, x1: 24, z1: 29, kind: 'block', color: '#4e4436', desc: 'LOW (0.45m). Armchair, SW diagonal.' },
      { label: 'armchair', x0: 37, z0: 29, x1: 37, z1: 29, kind: 'block', color: '#4e4436', desc: 'LOW (0.45m). Armchair, SE diagonal.' },
      { label: 'fern', x0: 27, z0: 31, x1: 27, z1: 31, kind: 'block', color: '#3e5e3e', desc: 'LOW. Potted fern by the south exit, west.' },
      { label: 'fern', x0: 34, z0: 31, x1: 34, z1: 31, kind: 'block', color: '#3e5e3e', desc: 'LOW. Potted fern by the south exit, east.' },
    ],
    wallDecor: [
      { side: 'W', z0: 26, z1: 27, x: 21, label: 'tapestry' },
      { side: 'E', z0: 26, z1: 27, x: 40, label: 'tapestry' },
    ],
    notes: ['Still the brightest, openest room — one strong center cover, perimeter dressing only.',
      'Everything freestanding blocks (playtest rule); nothing here is walk-through.'],
  },
  foyer: {
    title: 'Foyer — furnished (v2)',
    subtitle: '12×8m spawn room. Grand first impression, cover the moment you turn around.',
    region: [23, 33, 38, 44],
    items: [
      { label: 'rug', x0: 27, z0: 37, x1: 34, z1: 40, kind: 'flat', color: '#7a3b3b', desc: 'Worn red rug.' },
      { label: 'center table', x0: 30, z0: 38, x1: 31, z1: 39, kind: 'block', shape: 'round', color: '#8a6a48', desc: 'LOW (0.9m). Round walnut table; the foyer lamp sits ON it.' },
      { label: 'clock', x0: 36, z0: 36, x1: 36, z1: 36, kind: 'block', color: '#5e4632', desc: 'LOW (1.7m, thin — does not block sight). Grandfather clock, east wall.' },
      { label: 'console', x0: 25, z0: 36, x1: 25, z1: 37, kind: 'block', color: '#8a6a48', desc: 'LOW. Console table with candlestick and dusty letters, west wall.' },
      { label: 'coat stand', x0: 25, z0: 42, x1: 25, z1: 42, kind: 'block', color: '#4e4436', desc: 'LOW (1.7m, thin). Coat stand with hanging coat — reads as a figure for a beat.' },
      { label: 'umbrella stand', x0: 36, z0: 42, x1: 36, z1: 42, kind: 'block', color: '#4e4436', desc: 'LOW (0.45m). By the main door.' },
    ],
    wallDecor: [
      { side: 'N', x0: 26, x1: 28, z: 34, label: 'portrait' },
      { side: 'N', x0: 33, x1: 35, z: 34, label: 'portrait' },
      { side: 'W', z0: 39, z1: 40, x: 24, label: 'mirror' },
    ],
    notes: ['Both south passages enter clear of furniture (console moved north of the west entry).',
      'Tall-thin pieces (clock, coat stand) use LOW + height override 1.7 — they block movement but not enemy sight; a 1-cell pillar should not create sight shadows.'],
  },
};
const FURN = {
  hall: {
    title: 'Grand hall — furnished',
    subtitle: 'The octagonal anchor. Open arena with a center statue seat; grand staircase to the north.',
    region: [13, 11, 32, 27],
    items: [
      { label: 'grand staircase', x0: 20, z0: 13, x1: 25, z1: 14, kind: 'zone', color: '#7ec8ff', desc: 'Wide staircase sweeping up to the (future) upper floor — built visually now, transition inert until the upper floor ships. The ▲ cells are the walk-in zone.' },
      { label: 'round settee + statue', x0: 22, z0: 19, x1: 23, z1: 20, kind: 'block', shape: 'round', color: '#6a4a5e', desc: 'Circular velvet settee around a marble statue plinth — THE center anchor and best cover in the house. Fights orbit it.' },
      { label: 'armor', x0: 19, z0: 14, x1: 19, z1: 14, kind: 'block', color: '#5a5e66', desc: 'Suit of armor flanking the staircase, west.' },
      { label: 'armor', x0: 26, z0: 14, x1: 26, z1: 14, kind: 'block', color: '#5a5e66', desc: 'Suit of armor flanking the staircase, east.' },
      { label: 'pedestal', x0: 17, z0: 16, x1: 17, z1: 16, kind: 'block', color: '#6b6355', desc: 'Stone pedestal with a bust, NW diagonal.' },
      { label: 'pedestal', x0: 28, z0: 16, x1: 28, z1: 16, kind: 'block', color: '#6b6355', desc: 'Stone pedestal with a bust, NE diagonal.' },
      { label: 'armchair', x0: 17, z0: 22, x1: 17, z1: 22, kind: 'decor', color: '#4e4436', desc: 'Armchair, SW diagonal.' },
      { label: 'armchair', x0: 28, z0: 22, x1: 28, z1: 22, kind: 'decor', color: '#4e4436', desc: 'Armchair, SE diagonal.' },
      { label: 'fern', x0: 19, z0: 24, x1: 19, z1: 24, kind: 'decor', color: '#3e5e3e', desc: 'Potted fern near the south exit, west side.' },
      { label: 'fern', x0: 26, z0: 24, x1: 26, z1: 24, kind: 'decor', color: '#3e5e3e', desc: 'Potted fern near the south exit, east side.' },
      { label: 'rug', x0: 20, z0: 17, x1: 25, z1: 22, kind: 'flat', color: '#5e3b6e', desc: 'Large octag— fine, square — rug under the settee.' },
    ],
    wallDecor: [
      { side: 'W', z0: 20, z1: 21, x: 15, label: 'tapestry' },
      { side: 'E', z0: 20, z1: 21, x: 30, label: 'tapestry' },
    ],
    notes: ['The hall stays deliberately open — it is the main gunfight arena. One strong center cover (settee) instead of clutter.',
      'The two standing lamps (●) are tall candelabras; the room is the brightest in the mansion.',
      'The staircase is a walk-in transition zone later; this milestone it is scenery (the ▲ cells will simply be blocked or roped off).',
      'Armor suits are 1-cell blockers near the stair — tight cover when retreating upstairs is not yet an option.'],
  },
  kitchen: {
    title: 'Kitchen — furnished',
    subtitle: 'Dense working room: the big table owns the center, everything else hugs the walls.',
    region: [1, 1, 16, 12],
    items: [
      { label: 'work table', x0: 6, z0: 5, x1: 9, z1: 6, kind: 'block', color: '#8a6a48', desc: 'Massive oak work table, scarred and flour-dusted. The kitchen lamp is a pendant hanging OVER it. Main cover — fights circle this table.' },
      { label: 'stove', x0: 4, z0: 2, x1: 5, z1: 2, kind: 'block', color: '#3e3e46', desc: 'Cast-iron range against the north wall, cold.' },
      { label: 'hearth', x0: 10, z0: 2, x1: 12, z1: 2, kind: 'block', color: '#5e4632', desc: 'Wide open hearth with a hanging kettle, NE corner.' },
      { label: 'counter', x0: 2, z0: 4, x1: 2, z1: 6, kind: 'block', color: '#6b5a42', desc: 'Stone counter with basin along the west wall.' },
      { label: 'larder shelves', x0: 2, z0: 9, x1: 4, z1: 9, kind: 'block', color: '#5e4a36', desc: 'Larder shelving stacked with jars and tins, south wall — natural future home for pickups (M4b).' },
      { label: 'barrel', x0: 13, z0: 4, x1: 13, z1: 4, kind: 'block', color: '#6b5a42', desc: 'Barrel against the east wall.' },
      { label: 'barrel', x0: 13, z0: 5, x1: 13, z1: 5, kind: 'decor', color: '#6b5a42', desc: 'Smaller barrel beside it, walk-through.' },
      { label: 'stool', x0: 5, z0: 5, x1: 5, z1: 5, kind: 'decor', color: '#4e4436', desc: 'Stool at the table, west end.' },
      { label: 'stool', x0: 10, z0: 6, x1: 10, z1: 6, kind: 'decor', color: '#4e4436', desc: 'Stool at the table, east end, knocked slightly askew.' },
    ],
    wallDecor: [
      { side: 'N', x0: 4, x1: 5, z: 1, label: 'pot rack' },
      { side: 'N', x0: 8, x1: 9, z: 1, label: 'window' },
      { side: 'W', z0: 6, z1: 7, x: 1, label: 'window' },
    ],
    notes: ['Counter-play to the hall: tight lanes around one huge table instead of open space. The Wanderer’s serpentine charge gets clipped by geometry here.',
      'North and west walls are exterior — the kitchen gets the mansion’s only ground-floor windows so far (moonlight spill, ink-outline frames).',
      'Larder shelves are placed to become the ammo/medkit shelf in M4b without moving anything.',
      'Two exits (dining, corridor) — never a dead end.'],
  },
  foyer: {
    title: 'Foyer — furnished',
    subtitle: 'Spawn room. Grand first impression: rug, round center table, grandfather clock.',
    region: [16, 26, 29, 35],
    items: [
      { label: 'rug', x0: 20, z0: 29, x1: 25, z1: 32, kind: 'flat', color: '#7a3b3b', desc: 'Worn red rug, flat plane, catches lamp light.' },
      { label: 'center table', x0: 22, z0: 30, x1: 23, z1: 31, kind: 'block', shape: 'round', color: '#8a6a48', desc: 'Round walnut table; the foyer lamp is a table lamp ON it — first cover the player ever sees.' },
      { label: 'clock', x0: 27, z0: 29, x1: 27, z1: 29, kind: 'block', color: '#5e4632', desc: 'Grandfather clock against the east wall. Ticks (audio, M5).' },
      { label: 'console', x0: 18, z0: 31, x1: 18, z1: 32, kind: 'block', color: '#8a6a48', desc: 'Narrow console table, west wall; candlestick + dusty letters on top.' },
      { label: 'coat stand', x0: 18, z0: 33, x1: 18, z1: 33, kind: 'decor', color: '#4e4436', desc: 'Coat stand with a hanging coat — reads as a figure in the dark for a beat.' },
      { label: 'umbrella stand', x0: 27, z0: 33, x1: 27, z1: 33, kind: 'decor', color: '#4e4436', desc: 'Umbrella stand by the main door.' },
    ],
    wallDecor: [
      { side: 'N', x0: 19, x1: 21, z: 27, label: 'portrait' },
      { side: 'N', x0: 24, x1: 26, z: 27, label: 'portrait' },
      { side: 'W', z0: 29, z1: 30, x: 17, label: 'mirror' },
    ],
    notes: ['Solid-outline pieces occupy grid cells: they block you, the Wanderer, and pathfinding — and work as cover.',
      'Dashed pieces are walk-through set dressing.',
      'The center table forces the fight to flow around it if the Wanderer follows you down here.'],
  },
};

function roomHtml(f, marks, def) {
  const [rx0, rz0, rx1, rz1] = def.region;
  const PX = 34;
  const W = rx1 - rx0 + 1, H = rz1 - rz0 + 1;
  let cells = '';
  for (let z = rz0; z <= rz1; z++) for (let x = rx0; x <= rx1; x++) {
    const id = f.grid[z]?.[x];
    let style = 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.15);';
    if (id) {
      const r = f.rooms.get(id);
      style += `background:${r.type === 'door' ? '#c9a86a' : '#6b6355'};`;
    } else {
      style += nearFloor(f, x, z) ? 'background:#15151a;' : '';
    }
    cells += `<div style="${style}"></div>`;
  }
  const px = (x) => (x - rx0) * PX, pz = (z) => (z - rz0) * PX;
  const order = { flat: 0, zone: 0, block: 1, decor: 1 };
  const layers = [...def.items].sort((a, b) => order[a.kind] - order[b.kind]).map((it) => {
    const w = (it.x1 - it.x0 + 1) * PX, h = (it.z1 - it.z0 + 1) * PX;
    let s = `position:absolute;left:${px(it.x0)}px;top:${pz(it.z0)}px;width:${w}px;height:${h}px;box-sizing:border-box;`;
    if (it.kind === 'flat') s += `background:${it.color};opacity:.45;`;
    if (it.kind === 'zone') s += `background:repeating-linear-gradient(45deg,${it.color}30,${it.color}30 6px,transparent 6px,transparent 12px);border:2px solid ${it.color}80;`;
    if (it.kind === 'block') s += `background:${it.color};border:2px solid #1a1410;box-shadow:0 2px 5px rgba(0,0,0,.5);`;
    if (it.kind === 'decor') s += `background:${it.color}90;border:2px dashed #1a141090;`;
    if (it.shape === 'round') s += 'border-radius:50%;';
    const fits = w >= 60;
    const lbl = `<span style="position:absolute;${fits ? 'inset:0;display:flex;align-items:center;justify-content:center;' : `left:50%;top:100%;transform:translateX(-50%);`}color:#f2ede2;font-size:9px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px #000;white-space:nowrap;">${it.label}</span>`;
    return `<div style="${s}">${lbl}</div>`;
  }).join('');
  const decor = (def.wallDecor || []).map((d) => {
    let s = 'position:absolute;background:#c9a227;box-shadow:0 0 4px rgba(201,162,39,.5);';
    if (d.side === 'N') s += `left:${px(d.x0) + 4}px;top:${pz(d.z) + PX - 7}px;width:${(d.x1 - d.x0 + 1) * PX - 8}px;height:5px;`;
    if (d.side === 'S') s += `left:${px(d.x0) + 4}px;top:${pz(d.z) + 2}px;width:${(d.x1 - d.x0 + 1) * PX - 8}px;height:5px;`;
    if (d.side === 'W') s += `left:${px(d.x) + PX - 7}px;top:${pz(d.z0) + 4}px;width:5px;height:${(d.z1 - d.z0 + 1) * PX - 8}px;`;
    if (d.side === 'E') s += `left:${px(d.x) + 2}px;top:${pz(d.z0) + 4}px;width:5px;height:${(d.z1 - d.z0 + 1) * PX - 8}px;`;
    return `<div style="${s}" title="${d.label}"></div><div style="position:absolute;left:${d.side === 'N' || d.side === 'S' ? px((d.x0 + d.x1 + 1) / 2) : px(d.x) + (d.side === 'W' ? -6 : PX + 6)}px;top:${d.side === 'N' ? pz(d.z) + PX - 20 : d.side === 'S' ? pz(d.z) + 12 : pz((d.z0 + d.z1 + 1) / 2)}px;transform:translate(-50%,-50%);color:#c9a227;font-size:8px;text-transform:uppercase;letter-spacing:.05em;">${d.label}</div>`;
  }).join('');
  const mk = marks.filter((m) => m.x >= rx0 && m.x <= rx1 && m.z >= rz0 && m.z <= rz1).map((m) =>
    `<div style="position:absolute;left:${px(m.x)}px;top:${pz(m.z)}px;width:${PX}px;height:${PX}px;display:flex;align-items:center;justify-content:center;color:${m.color};font-size:16px;font-weight:700;text-shadow:0 0 6px #000;">${m.glyph}</div>`).join('');
  const itemList = def.items.map((it) =>
    `<li><b style="text-transform:uppercase;font-size:11px;letter-spacing:.04em;">${it.label}</b> <span style="opacity:.65;font-size:11px;">(${it.kind === 'block' ? 'blocks / cover' : it.kind === 'decor' ? 'walk-through' : 'floor'})</span> — ${it.desc}</li>`).join('');
  return `<h2>${def.title}</h2>
<p class="subtitle">${def.subtitle}</p>
<div class="mockup">
  <div class="mockup-header">Zoomed: ${W}m × ${H}m of the ground floor — 1m grid</div>
  <div class="mockup-body" style="background:#26262c;overflow:auto;padding:16px;">
    <div style="position:relative;width:${W * PX}px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:repeat(${W},${PX}px);grid-auto-rows:${PX}px;">${cells}</div>
      ${layers}${decor}${mk}
    </div>
  </div>
</div>
<div class="section" style="margin-top:14px;">
  <span class="label">Pieces</span>
  <ul style="margin-top:6px;line-height:1.7;">${itemList}</ul>
</div>
<div class="section">
  <span class="label">Notes</span>
  <ul style="margin-top:6px;line-height:1.6;">${def.notes.map((n) => `<li>${n}</li>`).join('')}</ul>
</div>`;
}

// ================================================================== export
// Emits the engine-format map text + furniture manifest + windows/wallProps
// for the M4a spec, straight from the validated mockup data.
const HEX_TO_PALETTE = {
  '#8a6a48': 'furnitureOak', '#6b5138': 'furnitureWalnut', '#5e4a36': 'furnitureWood',
  '#3e3e46': 'furnitureIron', '#3a3e46': 'furnitureIron', '#5e4632': 'furnitureWoodDark',
  '#6b5a42': 'furnitureStoneWarm', '#555c60': 'furnitureStone', '#4e4436': 'upholsteryDark',
  '#5e4a6e': 'velvet', '#6a4a5e': 'velvetRose', '#2e5e42': 'feltGreen', '#2e2a26': 'pianoBlack',
  '#3e5e3e': 'fernGreen', '#4a5e3e': 'sofaGreen', '#5a5e66': 'armorSteel', '#6b6355': 'stonePale',
  '#7a3b3b': 'rugRed', '#6e3b3b': 'rugRed', '#5e3b6e': 'rugViolet', '#4a3b5e': 'rugViolet',
  '#3b5e4a': 'rugGreen', '#3b4a5e': 'rugBlue', '#4a3b3b': 'rugBrown',
};
const FACING = { N: 's', S: 'n', W: 'e', E: 'w' };

function exportAll() {
  const { f, marks } = buildGround2();
  console.log('=== MAP (58x47, legend: # wall, . floor, D doorway, S spawn, L lamp, W wanderer) ===');
  const mapMarks = marks.filter((m) => 'SLW='.includes(m.ch)).map((m) => (m.ch === '=' ? { ...m, ch: '#' } : m));
  console.log(ascii(f, mapMarks));
  console.log('\n=== FURNITURE MANIFEST ===');
  const usedNames = {};
  for (const [roomId, def] of Object.entries(FURN2)) {
    console.log(`// --- ${roomId} ---`);
    for (const it of def.items) {
      if (it.kind === 'zone') continue;
      let kind, height = null;
      if (it.kind === 'flat') { kind = 'decor'; height = 0.02; }
      else if (/^TALL/.test(it.desc)) kind = 'tall';
      else { kind = 'low'; const m = it.desc.match(/^LOW \((\d+\.?\d*)m/); if (m && m[1] !== '0.9') height = Number(m[1]); }
      const slug = `${roomId}-${it.label.replace(/\s+/g, '-')}`;
      usedNames[slug] = (usedNames[slug] || 0) + 1;
      const id = usedNames[slug] > 1 ? `${slug}-${usedNames[slug]}` : slug;
      const pal = HEX_TO_PALETTE[it.color] || `UNMAPPED(${it.color})`;
      const h = height ? ` height: ${height},` : '';
      console.log(`{ id: '${id}', kind: '${kind}',${h} x0: ${it.x0}, z0: ${it.z0}, x1: ${it.x1}, z1: ${it.z1}, color: PALETTE.${pal} },`);
    }
  }
  console.log('\n=== WINDOWS (glow-only on the mansion floor) ===');
  for (const [roomId, def] of Object.entries(FURN2)) {
    for (const d of def.wallDecor || []) {
      if (d.label !== 'window') continue;
      const facing = FACING[d.side];
      if (d.side === 'N' || d.side === 'S') {
        for (let x = d.x0; x <= d.x1; x++) console.log(`{ x: ${x}, z: ${d.z}, facing: '${facing}' }, // ${roomId}`);
      } else {
        for (let z = d.z0; z <= d.z1; z++) console.log(`{ x: ${d.x}, z: ${z}, facing: '${facing}' }, // ${roomId}`);
      }
    }
  }
  console.log('\n=== WALL PROPS (portraits, mirrors, racks — frame+plane builder) ===');
  for (const [roomId, def] of Object.entries(FURN2)) {
    for (const d of def.wallDecor || []) {
      if (d.label === 'window') continue;
      const facing = FACING[d.side];
      const type = d.label.replace(/\s+/g, '-');
      if (d.side === 'N' || d.side === 'S') {
        console.log(`{ x0: ${d.x0}, x1: ${d.x1}, z: ${d.z}, facing: '${facing}', type: '${type}' }, // ${roomId}`);
      } else {
        console.log(`{ x: ${d.x}, z0: ${d.z0}, z1: ${d.z1}, facing: '${facing}', type: '${type}' }, // ${roomId}`);
      }
    }
  }
}

// ==================================================================== main
const which = process.argv[2] || 'ground';
if (which === 'export') { exportAll(); process.exit(0); }
if (which === 'room') {
  const roomId = process.argv[3];
  const def = FURN2[roomId];
  if (!def) { console.error(`no furniture def for: ${roomId}`); process.exit(1); }
  const { f, marks } = buildGround2();
  // furniture must not sit on walls or doors, and blocking pieces must not overlap marks
  const errs = [];
  for (const it of def.items) {
    for (let z = it.z0; z <= it.z1; z++) for (let x = it.x0; x <= it.x1; x++) {
      const id = f.grid[z]?.[x];
      if (!id) errs.push(`${it.label} on wall/void at ${x},${z}`);
      else if (f.rooms.get(id).type === 'door') errs.push(`${it.label} blocks doorway at ${x},${z}`);
      if (it.kind === 'block') {
        const m = marks.find((mm) => mm.x === x && mm.z === z && (mm.ch === 'S' || mm.ch === 'U' || mm.ch === 'C'));
        if (m) errs.push(`${it.label} covers ${m.ch} mark at ${x},${z}`);
      }
    }
  }
  if (errs.length) { console.log('ERRORS:'); errs.forEach((e) => console.log('  ' + e)); process.exit(1); }
  console.log('furniture placement: OK');
  writeFileSync(`${SCREEN_DIR}\\room-${roomId}.html`, roomHtml(f, marks, def));
  console.log(`wrote room-${roomId}.html`);
} else {
  const build = { ground: buildGround, ground2: buildGround2, upper: buildUpper }[which];
  if (!build) { console.error(`unknown floor: ${which}`); process.exit(1); }
  const { f, marks, spawn, file, title, subtitle, notes } = build();
  const { errors, total } = validate(f, spawn);
  console.log(ascii(f, marks));
  console.log(`\nwalkable cells: ${total}`);
  if (errors.length) { console.log('ERRORS:'); errors.forEach((e) => console.log('  ' + e)); process.exit(1); }
  console.log('validation: OK');
  writeFileSync(`${SCREEN_DIR}\\${file}`, html(f, marks, title, subtitle, notes));
  console.log(`wrote ${file}`);
}
