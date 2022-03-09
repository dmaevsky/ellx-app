import test from 'ava';
import { writable } from 'tinyx';
import CalcGraph from './calc_graph.js';

const store = writable(42);

const cg = new CalcGraph(
  'file:///self.ellx',
  () => undefined,
  url => url === 'file:///self.js' && { store }
);

test('A simple subscribable', t => {
  cg.insert('s', 'store');
  cg.insert('plus5', 's + 5');

  t.is(cg.nodes.get('plus5').currentValue.get(), 47);
  store.set(55);
  t.is(cg.nodes.get('plus5').currentValue.get(), 60);
});
