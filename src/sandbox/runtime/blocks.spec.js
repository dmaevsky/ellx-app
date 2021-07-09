import test from 'ava';

import binarySearch from 'binary-search';
import { xmur3, sfc32 } from './utils/prng.js';

import query from './blocks.js';

const meshLessEq = (meshPoint, i) => meshPoint.start <= i ? -1 : 1;
const meshLess = (meshPoint, i) => meshPoint.start < i ? -1 : 1;

const eliminateIntersections = blocks => {
  // Blocks must be sorted according to some "reasonable" left to right top to bottom order
  // This routine is conservative: it eliminates more blocks than necessary

  const hMesh = [{ start: 0, edge: Infinity, idx: -1 }], vMesh = [{ start: 0, edge: Infinity, idx: -1 }];

  for (let blockIdx = blocks.length - 1; blockIdx >= 0; blockIdx--) {
    const [top, left, bottom, right] = blocks[blockIdx][1].position;

    let jBottom = ~binarySearch(vMesh, bottom, meshLessEq) - 1;
    let jRight = ~binarySearch(hMesh, right, meshLessEq) - 1;

    // Intersection check
    if (vMesh[jBottom].edge <= right || hMesh[jRight].edge <= bottom) {
      blocks.splice(blockIdx, 1);   // Cut out the current offending block and
      continue;
    }

    // Update the meshes

    const jTop = ~binarySearch(vMesh, top, meshLess);
    const jLeft = ~binarySearch(hMesh, left, meshLess);

    jBottom = jLeft > 0 ? ~binarySearch(vMesh, hMesh[jLeft - 1].edge, meshLess) : vMesh.length;
    jRight = jTop > 0 ? ~binarySearch(hMesh, vMesh[jTop - 1].edge, meshLess) : hMesh.length;

    hMesh.splice(jLeft, jRight - jLeft, { start: left, edge: top, idx: blockIdx });
    vMesh.splice(jTop, jBottom - jTop, { start: top, edge: left, idx: blockIdx });
  }
  return blocks;
}

const nRows = 1000, nCols = 800, size = 20, nSamples = 2 * Math.floor(nRows / size * nCols / size);

const seedString = 'play_with_me';
console.debug(`Generating random blocks on a ${nRows} x ${nCols} field with max size of ${size}, using random seed <${seedString}>`)

const seed = xmur3(seedString);
const rand = sfc32(seed(), seed(), seed(), seed());

const randomBlock = () => {
  const top = Math.floor(rand() * nRows);
  const left = Math.floor(rand() * nCols);
  let bottom = top + Math.floor(rand() * size);
  let right = left + Math.floor(rand() * size);
  if (bottom >= nRows) bottom = nRows - 1;
  if (right >= nCols) right = nCols - 1;

  return { position: [top, left, bottom, right] }
}

let blocks = new Map();
for (let i = 0; i < nSamples; i++) blocks.set(i, randomBlock());

blocks = new Map(eliminateIntersections([...blocks].sort(([, { position: [top1, left1] }], [, { position: [top2, left2] }]) => top1 - top2 || left1 - left2)));

console.debug(`Generated ${blocks.size} disjunct blocks out of ${nSamples} samples`);
// for (block of blocks) console.log(block[1].position);

const bt = query(blocks);

// Cells to use for brute-force check
const cells = new Array(nRows);
for (let i = 0; i < nRows; i++) {
  cells[i] = new Array(nCols);
}

for (let [i, block] of blocks) {
  const [top, left, bottom, right] = block.position;

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (cells[row][col] !== undefined) throw new Error('Blocks are not disjunct');
      cells[row][col] = i;
    }
  }
}

const findNeighbor = (position, which) => {
  const edge = position[which];
  const direction = (which & 2) - 1;
  const vertical = !(which & 1);

  const [start, end] = [position[+vertical], position[2 + vertical]];
  const span = vertical ? nRows : nCols;

  for (let i = edge + direction; i >= 0 && i < span; i += direction) {
    for (let j = start; j <= end; j++) {
      const [row, col] = vertical ? [i, j] : [j, i];
      if (cells[row][col] !== undefined) return cells[row][col];
    }
  }
  return undefined;
}

const findIntersections = position => {
  const [top, left, bottom, right] = position;
  const found = new Set();

  for (let i = top; i <= bottom; i++) {
    for (let j = left; j <= right; j++) {
      if (cells[i][j] !== undefined) {
        found.add(cells[i][j]);
      }
    }
  }
  return found;
}

test('the hit-test algorithm QueryBlocks.getAt', t => {

  const nTries = 100;
  for (let i = 0; i < nTries; i++) {
    const row = Math.floor(rand() * nRows);
    const col = Math.floor(rand() * nCols);

    const block = bt.getAt(row, col);
    t.is(block, cells[row][col]);
  }
});

test('finding block neighbors', t => {

  const nTries = 100;
  for (let i = 0; i < nTries; i++) {
    const blockIdx = Math.floor(rand() * blocks.size);
    const position = [...blocks.values()][blockIdx].position;

    for (let j = 0; j < 4; j++) {
      const nbr = findNeighbor(position, j);
      t.is(bt.neighbor(position, j), nbr);
    }
  }
});

test('finding blocks intersecting with a specified range', t => {
  const nTries = 20;

  for (let i = 0; i < nTries; i++) {
    const range = randomBlock().position;
    const found1 = bt.getInRange(range);
    const found2 = findIntersections(range);
    t.true([...found1].every(b => found2.has(b)));
    t.true([...found2].every(b => found1.has(b)));
  }
});
