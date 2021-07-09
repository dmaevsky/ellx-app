import test from 'ava';
import Parser from 'rd-parse';
import EllxFile from './ellx_format.js';

const parser = Parser(EllxFile);

test('Empty nodes', t => {
  const input = 'version: 1.1\nnodes:\nlayout:\n[\n]\n';
  const ast = parser(input);

  t.deepEqual(ast, { version: '1.1', nodes: {}, layout: [] });
});
