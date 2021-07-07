import binarySearch from 'binary-search';

const memoizeOne = fn => {
  let lastArg;
  let lastResult;

  return arg => {
    if (lastArg === arg) return lastResult;
    return lastResult = fn(lastArg = arg);
  };
};

const addToMesh = (mesh, at, data) => {
  let list = mesh.get(at) || [];
  list.push(data);
  mesh.set(at, list);
}

const buildSliceMap = meshMap => {
  let mesh = [...meshMap].sort(([k1], [k2]) => k1 - k2);
  let result = [];
  let currentSlices = new Map();

  for (let [k, slices] of mesh) {
    for (let [blockId, I] of slices) {
      if (currentSlices.has(blockId)) currentSlices.delete(blockId);
      else currentSlices.set(blockId, I);
    }
    result.push([ k, [...currentSlices].sort(([, [s1]], [, [s2]]) => s1 - s2) ]);
  }
  return result;
}

const findNeighbor = (mesh, start, end, edge, direction) => {
  let iEnd = ~binarySearch(mesh, end, ([from], r) => from <= r ? -1 : 1) - 1;
  if (iEnd < 0) return undefined;

  let iStart = start === end ? iEnd : ~binarySearch(mesh, start, ([from], r) => from <= r ? -1 : 1, 0, iEnd) - 1;
  if (iStart < 0) iStart = 0;

  let closestEdge = direction * Infinity;
  let closestBlock = undefined;

  for (let i = iStart; i <= iEnd; i++) {
    const slices = mesh[i][1];
    if (!slices.length) continue;

    let j = binarySearch(slices, edge + direction, ([, [start, end]], c) => end < c ? -1 : start > c ? 1 : 0);
    if (j >= 0) return slices[j][0];

    j = ~j - (direction < 0);
    if (j < 0 || j >= slices.length) continue;
    let [nStart, nEnd] = slices[j][1];
    let nEdge = direction > 0 ? nStart : nEnd;

    if ((nEdge - closestEdge) * direction < 0) {
      closestEdge = nEdge;
      closestBlock = slices[j][0];
    }
  }
  return closestBlock;
}

const findInRange = (mesh, start, end, fromEdge, toEdge) => {
  let iEnd = ~binarySearch(mesh, end, ([from], r) => from <= r ? -1 : 1) - 1;
  if (iEnd < 0) return [];

  let iStart = start === end ? iEnd : ~binarySearch(mesh, start, ([from], r) => from <= r ? -1 : 1, 0, iEnd) - 1;
  if (iStart < 0) iStart = 0;

  let found = new Set();

  for (let i = iStart; i <= iEnd; i++) {
    const slices = mesh[i][1];
    if (!slices.length) continue;

    let jFrom = ~binarySearch(slices, fromEdge, ([, [, end]], c) => end < c ? -1 : 1);
    let jTo = ~binarySearch(slices, toEdge, ([, [start]], c) => start > c ? 1 : -1);

    for (let j = jFrom; j < jTo; j++) found.add(slices[j][0]);
  }
  return found;
}

class QueryBlocks {
  constructor(blocks) {
    let hMesh = new Map(), vMesh = new Map();

    for (let [blockId, block] of blocks) {
      let { position: [top, left, bottom, right] } = block;
      addToMesh(vMesh, top, [blockId, [left, right]]);
      addToMesh(vMesh, bottom + 1, [blockId, null]);
      addToMesh(hMesh, left, [blockId, [top, bottom]]);
      addToMesh(hMesh, right + 1, [blockId, null]);
    }

    this.hMesh = buildSliceMap(hMesh);
    this.vMesh = buildSliceMap(vMesh);
  }

  getAt(row, col) {
    let i = ~binarySearch(this.vMesh, row, ([top], r) => top <= r ? -1 : 1) - 1;
    if (i < 0) return undefined;

    const slices = this.vMesh[i][1];
    let j = binarySearch(slices, col, ([, [start, end]], c) => end < c ? -1 : start > c ? 1 : 0);
    if (j >= 0) return slices[j][0];
  }

  neighbor(position, which) {
    let edge = position[which];
    let direction = (which & 2) - 1;
    let vertical = !(which & 1);

    let [start, end] = [position[+vertical], position[2 + vertical]];
    return findNeighbor(vertical ? this.hMesh : this.vMesh, start, end, edge, direction);
  }

  getInRange(position) {
    const [top, left, bottom, right] = position;
    return bottom - top > right - left ? findInRange(this.hMesh, left, right, top, bottom) : findInRange(this.vMesh, top, bottom, left, right);
  }
}

const query = memoizeOne(blocks => {
  // console.log('...query blocks...');
  return new QueryBlocks(blocks);
});

export default query;
