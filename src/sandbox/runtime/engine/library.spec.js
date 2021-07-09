import test from 'ava';
import math from './math.mock.js';

import { range } from './library.js';
import { unaryOp, binaryOp } from './transpile.js';

test('default object / vector operator overloads', t => {
  let o1 = {a: 10, b: 20}, o2 = {a: 15, b: 15, c: 999};

  t.deepEqual(unaryOp('-')(o1), {a: -10, b: -20});
  t.deepEqual(binaryOp('-')(o1, o2), {a: -5, b: 5});
  t.deepEqual(binaryOp('<')(o1, o2), {a: true, b: false});
  t.deepEqual(binaryOp('&')(range(0, 6), 3), [0, 1, 2, 3, 0, 1]);
});

test('explicit operator overloads', t => {
  let z = math.complex(2, 3);
  let z1 = unaryOp('~')(z);
  let product = binaryOp('*')(z, z1);
  t.is(product.re, 13);
  t.is(product.im, 0);
});
