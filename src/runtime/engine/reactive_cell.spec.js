import test from 'ava';
import { observable, autorun } from 'quarx';
import { isPromise } from 'conclure';

import { reactiveCell, asyncCell } from './reactive_cell.js';

const evaluator = observable.box();

const cell = reactiveCell(() => {
  const evaluate = evaluator.get();
  return evaluate && evaluate();
});

test('reactiveCell', async t => {
  const results = [];
  const promise = Promise.resolve(42);
  evaluator.set(() => promise);

  const gate = observable.box(false);

  const off = autorun(() => {
    if (!gate.get()) return;

    results.push(cell.get());
  });

  t.true(isPromise(cell.get()));  // stale
  t.is(results.length, 0);

  gate.set(true);

  t.deepEqual(results, [promise]);

  await promise;
  t.deepEqual(results, [promise, 42]);

  off();
});

test('asyncCell', async t => {
  const results = [];
  const promise = Promise.resolve('async');

  function* resolve(value) {
    return yield value;
  }

  const itAsync = resolve(promise);
  const itSync = resolve('sync');

  const off = autorun(() => {
    try {
      results.push(asyncCell(itAsync));
      results.push(asyncCell(itSync));
    }
    catch (e) {
      results.push(e);
    }
  });

  t.deepEqual(results, [itAsync]);
  await promise;
  t.deepEqual(results, [itAsync, 'async', 'sync']);

  off();
});
