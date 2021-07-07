import { serial as test } from 'ava';

import CalcGraph from './calc_graph';
import { STALE } from './quack';

const bundle = {
  TestDate: Date
};

const cg = new CalcGraph([], () => bundle);
test.afterEach(() => cg.dispose());

test('basic graph operations', t => {
  cg.autoCalc.set(true);
  const a = cg.insert('a', '5');
  cg.insert(undefined, '6');

  t.is(cg.maxAutoID, 1);

  const c = cg.insert('c', 'a + $1');
  t.is(c.currentValue.get(), 11);

  cg.update('$1', '42');
  t.is(c.currentValue.get(), 47);

  t.throws(() => cg.insert('a', '1'), { instanceOf: Error, message: 'Node a is already present in the calculation graph' });

  const d = cg.insert('d', 'a + d');
  t.true(d.currentValue.get() instanceof Error);
  t.is(d.currentValue.get().message, 'Circular dependency detected');

  cg.update('a', 'c');
  t.true(a.currentValue.get() instanceof Error);
  t.is(a.currentValue.get().message, 'Circular dependency detected');
  t.true(c.currentValue.get() instanceof Error);
  t.is(c.currentValue.get().message, 'Circular dependency detected');

  cg.update('a', '8');
  t.is(c.currentValue.get(), 50);

  t.throws(() => cg.insert('function', 'foo'), { instanceOf: Error, message: 'function is a reserved word' });
});

test('renaming nodes', t => {
  cg.autoCalc.set(true);
  cg.insert('a', 5);

  const a2 = cg.insert('a2', 'a * a');
  cg.rename('a', 'foo', 6);

  t.is(a2.currentValue.get(), 36);
  t.is(a2.parser.input, 'foo * foo');
});

test('evaluation error for a node should be cleared after setting the right value for a dependency and turning on autoCalc', t => {
  cg.insert('r', '{}');
  cg.insert('qq', 'r.map(i=>i+1)');
  cg.update('r', '[0,1]');
  cg.autoCalc.set(true);

  t.deepEqual(cg.nodes.get('qq').currentValue.get(), [1,2]);
});

test('that node dependents are not recalculated on rename', t => {
  cg.autoCalc.set(true);

  cg.insert('f', '(a=>x=>a.push(x))([])');
  cg.insert('x', '5');

  const y = cg.insert('y', 'f(x)');
  t.is(y.currentValue.get(), 1);

  cg.update('x', '42');
  t.is(y.currentValue.get(), 2);

  cg.rename('x', 'xxx', '42');
  t.is(y.currentValue.get(), 2);
  t.is(y.parser.input, 'f(xxx)');
});

test('circular dependency detection after dependency has been renamed', t => {
  cg.insert('a', '5', STALE);
  const b = cg.insert('b', 'a', STALE);

  cg.rename('a', 'c', '5');
  const a = cg.insert('a', 'b', STALE);

  t.is(a.currentValue.get(), 5);
  t.is(b.parser.input, 'c');
  t.deepEqual([...b.parser.dependencies()], ['c']);
});

test('subscriptions to the node', t => {
  cg.autoCalc.set(true);
  const updates = [];

  cg.insert('a', '5');
  cg.insert(null, 'a+1').on('update', updated => updates.push(updated));

  cg.update('a', '6');
  cg.rename('a', 'b', '6');

  t.deepEqual(updates, [
    { node: '$1', value: 6, formula: 'a+1' },
    { value: 7 },
    { formula: 'b+1' }
  ]);
});

test('external constructors', t => {
  cg.autoCalc.set(true);

  cg.insert('d', "'2021-02-17'");
  cg.insert('date', 'new TestDate(d)');

  t.is(cg.nodes.get('date').currentValue.get().getDay(), 3);

  cg.update('d', "'2021-02-18'");

  t.is(cg.nodes.get('date').currentValue.get().getDay(), 4);
});

test.todo('return the same iterator in different parts of an object structure');
