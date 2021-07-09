import ava from 'ava';
const test = ava.serial;
import { conclude } from 'conclure';
import math from './math.mock.js';

import ProgressiveEval, { compile } from './progressive_assembly.js';
import * as environment from './reserved_words.js';
import * as library from './library.js';

const resolve = name => {
  if (name === 'math') return math;
  if (name in library) return library[name];
  return name.charCodeAt(0);
}

const parse = formula => {
  // Make a new parser for each formula (1 in each test)
  const parser = new ProgressiveEval(environment, resolve);
  const evaluator = parser.parse(formula);
  const result = () => new Promise((resolve, reject) =>
    conclude(evaluator(), (error, result) => error ? reject(error) : resolve(result))
  );
  result.compiled = () => compile(parser.root, true);
  return result;
}

test('async error', async t => {
  const evaluator = parse('delayed(1, () => x.something.wrong)()');
  await t.throwsAsync(evaluator, { instanceOf: Error, message: 'Cannot read property \'wrong\' of undefined' });
});

test('async MemberExpression with a ComputedProperty', async t => {
  const evaluator = parse('delayed(1, () =>({xy}))()["x" + "y"]');

  t.is(await evaluator(), 120);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 120);
});

test('MemberExpression with an async ComputedProperty', async t => {
  const evaluator = parse('{xy}[delayed(1, () =>"x" + "y")()]');

  t.is(await evaluator(), 120);
  t.snapshot(evaluator.compiled());
});

test('async CallExpression', async t => {
  const evaluator = parse('Math.floor(delayed(1, () => 3.14)())');

  t.is(await evaluator(), 3);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 3);
});

test('async CallExpression with this argument', async t => {
  const evaluator = parse('range(0, 5).slice(delayed(1, () => 2)())');

  t.deepEqual(await evaluator(), [2,3,4]);
  t.snapshot(evaluator.compiled());
  t.deepEqual(await evaluator(), [2,3,4]);
});

test('async CallExpression with async callee and spread arguments', async t => {
  const evaluator = parse('delayed(1, () => (...args) => sum(args))()(...range(1, 3), ...range(4, 6))');

  t.is(await evaluator(), 12);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 12);
});

test('async CallExpression with async callee and this argument', async t => {
  const evaluator = parse('delayed(1, () => range(0, 5))().slice(2)');

  t.deepEqual(await evaluator(), [2,3,4]);
  t.snapshot(evaluator.compiled());
  t.deepEqual(await evaluator(), [2,3,4]);
});

test('async CallExpression with async callee and a chain of properties / calls', async t => {
  const evaluator = parse('~delayed(1, () => math.complex)()(1, 1)');

  t.deepEqual(await evaluator(), math.complex(1, -1));
  t.snapshot(evaluator.compiled());
});

test('o[p](args) with o, p sync but o[p] async resolving to a function', async t => {
  const evaluator = parse('({ f: delayed(1, () => x => x + 42)() }).f(8)');

  t.is(await evaluator(), 50);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 50);
});

test('o[p](args) with o, p sync but o[p] async resolving to a non-function', async t => {
  const evaluator = parse('({ f: delayed(1, () => [42])() }).f[0]');

  t.is(await evaluator(), 42);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 42);
});

test('NewExpression with async constructor', async t => {
  const evaluator = parse('new (delayed(1, () => Array)())(3)');

  t.snapshot(evaluator.compiled());
  t.deepEqual(await evaluator(), [,,,]);
  t.snapshot(evaluator.compiled());
  t.deepEqual(await evaluator(), [,,,]);
});

test('async sum', async t => {
  const evaluator = parse('sum(delayed(1, [ delayed(1, 55), delayed(1, 33) ]))');

  t.is(await evaluator(), 88);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 88);
});

test('race', async t => {
  const evaluator = parse('(x => x * x)(race([delayed(10, () => -1)(), delayed(1, () => 5)()]))');

  t.is(await evaluator(), 25);
  t.snapshot(evaluator.compiled());
});

test('that everything else (including .then callbacks) is still transpiled', async t => {
  const evaluator = parse('(x => x + delayed(1, () => y)())(Promise.resolve(42))');

  t.is(await evaluator(), 42 + 121);
  t.snapshot(evaluator.compiled());
  t.is(await evaluator(), 42 + 121);
});
