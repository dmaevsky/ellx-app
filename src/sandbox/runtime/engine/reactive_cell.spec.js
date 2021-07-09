import test from 'ava';
import { observable, autorun } from 'quarx';

import { reactiveCell, asyncCell } from './reactive_cell.js';
import { STALE, isStale } from './quack.js';

const evaluator = observable.box();

const cell = reactiveCell(() => {
  const evaluate = evaluator.get();
  return evaluate && evaluate();
});

function get(obs) {
  try {
    return obs.get();
  }
  catch (err) {
    if (isStale(err)) return err;
    throw err;
  }
}

test('reactiveCell', async t => {
  evaluator.set(() => 42);

  const results = [];

  const autoCalc = observable.box(false);

  const off = autorun(() => {
    if (!autoCalc.get()) return;

    results.push(get(cell));
  });

  t.is(get(cell), STALE); // cell is not observed yet, so should be STALE
  t.is(results.length, 0);

  autoCalc.set(true);

  t.is(cell.get(), 42);
  t.deepEqual(results, [42]);

  results.length = 0;

  const promise = Promise.resolve(42);
  evaluator.set(() => promise);

  t.deepEqual(results, [STALE]);
  await promise;
  t.deepEqual(results, [STALE, 42]);

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

  t.deepEqual(results, [STALE]);
  await promise;
  t.deepEqual(results, [STALE, 'async', 'sync']);

  off();
});
