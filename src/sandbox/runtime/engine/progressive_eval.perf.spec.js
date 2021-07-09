import ava from 'ava';
const test = ava.serial;

import ProgressiveEval from './progressive_assembly.js';
import * as environment from './reserved_words.js';
import * as library from './library.js';

const resolve = name => {
  if (name in library) return library[name];
  return name.charCodeAt(0);
}

const parser = new ProgressiveEval(environment, resolve);

test.skip('transpiled arrow function performance', t => {
  const formula = 'range(0, 1000000).reduce((a, b) => a + b)';
  const evaluator1 = parser.parse(formula);
  const evaluator2 = new Function('range', 'return () => ' + formula)(library.range);

  const start1 = Date.now();
  t.is(evaluator1(), 499999500000);
  const time1 = Date.now() - start1;

  const start2 = Date.now();
  t.is(evaluator2(), 499999500000);
  const time2 = Date.now() - start2;

  const relative = (time1 - time2) / time2;
  console.log('Relative slow-down is ' + relative);
  t.true(relative < 1.2);
});

// test('performance of a slightly more complicated arrow function', () => {
//   const formula = 'range(1, 1000000).reduce(acc => acc.append(acc[acc.length-1] + acc[acc.length-2]), [1,1])';
//   const evaluator1 = parser.parse(formula);
// });
