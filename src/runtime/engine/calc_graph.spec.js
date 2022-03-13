import ava from 'ava';
import { autorun } from 'quarx';
const test = ava.serial;

import CalcGraph from './calc_graph.js';

const bundle = {
  TestDate: Date,
  counter: (a=>x=>a.push(x))([])
};

const cg = new CalcGraph(
  'file:///self.ellx',
  () => undefined,
  url => url === 'file:///self.js' && bundle
);

let nodeValues = {};
const off = autorun(() => {
  for (let node of cg.nodes.values()) {
    nodeValues[node.name] = node.currentValue.get();
  }
});

test.after(off);

test.afterEach(() => {
  cg.dispose();
  nodeValues = {};
});

test('basic graph operations', t => {
  cg.insert('a', '5');
  cg.insert(undefined, '6');

  t.is(cg.maxAutoID, 1);

  cg.insert('c', 'a + $1');
  t.is(nodeValues.c, 11);

  cg.update('$1', '42');
  t.is(nodeValues.c, 47);

  t.throws(() => cg.insert('a', '1'), { instanceOf: Error, message: 'Node a is already present in the calculation graph' });

  cg.insert('d', 'a + d');
  t.true(nodeValues.d instanceof Error);
  t.is(nodeValues.d.message, 'Circular dependency detected');

  cg.update('a', 'c');
  t.true(nodeValues.a instanceof Error);
  t.is(nodeValues.a.message, 'Circular dependency detected');
  t.true(nodeValues.c instanceof Error);
  t.is(nodeValues.c.message, 'Circular dependency detected');

  cg.update('a', '8');
  t.is(nodeValues.c, 50);

  t.throws(() => cg.insert('function', 'foo'), { instanceOf: Error, message: 'function is a reserved word' });
});

test('renaming nodes', t => {
  cg.insert('a', 5);

  const a2 = cg.insert('a2', 'a * a');
  cg.rename('a', 'foo', 6);

  t.is(nodeValues.a2, 36);
  t.is(a2.parser.input, 'foo * foo');
});

test('evaluation error for a node should be cleared after setting the right value for a dependency', t => {
  cg.insert('r', '{}');
  cg.insert('qq', 'r.map(i=>i+1)');
  cg.update('r', '[0,1]');

  t.deepEqual(nodeValues.qq, [1,2]);
});

test('that node dependents are not recalculated on rename', t => {
  cg.insert('x', '5');
  const y = cg.insert('y', 'counter(x)');

  t.is(nodeValues.y, 1);

  cg.update('x', '42');
  t.is(nodeValues.y, 2);

  cg.rename('x', 'xxx', '42');
  t.is(nodeValues.y, 2);
  t.is(y.parser.input, 'counter(xxx)');
});

test('circular dependency detection after dependency has been renamed', t => {
  cg.insert('a', '5');
  const b = cg.insert('b', 'a');

  cg.rename('a', 'c', '5');
  cg.insert('a', 'b');

  t.is(nodeValues.a, 5);
  t.is(b.parser.input, 'c');
  t.deepEqual([...b.parser.dependencies()], ['c']);
});

test('subscriptions to the node', t => {
  cg.insert('a', '5');
  cg.insert(null, 'a+1');

  t.is(nodeValues.$1, 6);
  const renamesInOtherNodes = cg.rename('a', 'b', '11');

  t.deepEqual([...renamesInOtherNodes], [['$1', 'b+1']]);

  t.is(nodeValues.$1, 12);
});

test('external constructors', t => {
  cg.insert('d', "'2021-02-17'");
  cg.insert('date', 'new TestDate(d)');

  t.is(nodeValues.date.getDay(), 3);

  cg.update('d', "'2021-02-18'");

  t.is(nodeValues.date.getDay(), 4);
});

test.todo('return the same iterator in different parts of an object structure');
