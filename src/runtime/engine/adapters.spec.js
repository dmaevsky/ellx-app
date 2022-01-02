import test from 'ava';
import { autorun } from 'quarx';
import { writable } from 'tinyx';
import { toObservable } from './adapters.js';

test('toObservable', t => {
  const w = writable(42);
  const obs = toObservable(w);
  const values = [];

  const off = autorun(() => values.push(obs.get()));
  w.set(55);

  t.deepEqual(values, [42, 55]);
  off();
});
