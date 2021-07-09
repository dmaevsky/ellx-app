import * as Conclude from 'conclure/combinators';
import { delay } from 'conclure/effects';
import { transpile, binaryOp } from './transpile.js';
import { isIterable } from './quack.js';

export const range = (start, end) => {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  let res = new Array(end - start);
  for (let i = 0; i < res.length; i++) res[i] = start + i;
  return res;
};

const plus = binaryOp('+');

export const sum = transpile(iterable => {
  if (!isIterable(iterable)) {
    throw new Error('Argument to sum must resolve to an iterable');
  }
  return [...iterable].reduce(plus);
});

export const race = transpile(iterable => {
  if (!isIterable(iterable)) {
    throw new Error('Argument to race must resolve to an iterable');
  }
  return Conclude.race([...iterable]);
});

export function* delayed(ms, value) {
  yield delay(ms);
  return value;
}
