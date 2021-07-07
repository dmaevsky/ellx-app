import Parser from 'rd-parse';
import EllxFile from './ellx_format';
import { serialize, toJS, fromJS } from './serialize';

const v1_1 = Parser(EllxFile);

export function loadBody(body) {
  const match = /^version:([^\n]+)/.exec(body);
  if (!match) {
    throw new Error('Cannot determine the version of the file');
  }
  const version = match[1].trim();

  if (version !== '1.1') {
    throw new Error('Unsupported Ellx format version');
  }

  return v1_1(body);
}

export function buildBlocks({ nodes, layout }) {
  const blocks = new Set();

  layout.forEach((row, i) => {
    if (!row) return;
    row.forEach((block, j) => {
      if (!block) return;

      let { value, formula, node, expansion } = block;
      value = fromJS(value);
      if (node !== undefined) formula = nodes[node];

      let position = [i, j, i, j];
      if (expansion) {
        let { height, width, ...x } = expansion;
        position[0] -= !!x.labelsTop;
        position[1] -= !!x.labelsLeft;
        if (height !== undefined) position[2] += height - 1;
        if (width !== undefined) position[3] += width - 1;
        expansion = x;
      }

      blocks.add({ position, expansion, value, formula, node });
    });
  });
  return blocks;
}

const sortBlocks = ({ position: [topA, leftA], expansion: expansionA }, { position: [topB, leftB], expansion: expansionB }) => {
  topA += !!(expansionA && expansionA.labelsTop);
  leftA += !!(expansionA && expansionA.labelsLeft);
  topB += !!(expansionB && expansionB.labelsTop);
  leftB += !!(expansionB && expansionB.labelsLeft);
  return (topA - topB) || leftA - leftB;
}

export function saveBody(blocks) {
  blocks = [...blocks].sort(sortBlocks);

  let nodes = [], layout = [];

  for (let { position: [top, left, bottom, right], expansion, value, formula, node } of blocks) {
    top += !!(expansion && expansion.labelsTop);
    left += !!(expansion && expansion.labelsLeft);

    const serializedBlock = {};

    if (node) {
      serializedBlock.node = node;
      nodes.push(`  ${node} = ${formula}`);
    }
    else {
      serializedBlock.value = toJS(value);
      if (formula !== undefined) serializedBlock.formula = formula;
    }

    if (expansion) {
      serializedBlock.expansion = {
        ...expansion,
        height: bottom - top + 1,
        width: right - left + 1
      }
    }

    if (!layout[top]) layout[top] = [];
    layout[top][left] = serializedBlock;
  }

  return [
    'version: 1.1',
    'nodes:',
    ...nodes,
    'layout:',
    serialize(layout)
  ].join('\n') + '\n';
}
