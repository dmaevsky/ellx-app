import { isFlow } from 'conclure';
import { isSubscribable } from './engine/quack';

export function* iterate(obj, maxEntries = Infinity) {
  let count = 0;

  if (Array.isArray(obj) || obj instanceof Set) {
    for (let value of obj) {
      yield [count, value];
      if (++count >= maxEntries) return;
    }
  }
  else if (obj instanceof Map) {
    for (let entry of obj) {
      yield entry;
      if (++count >= maxEntries) return;
    }
  }
  else {
    for (let k in obj) {
      yield [k, obj[k]];
      if (++count >= maxEntries) return;
    }
  }
}

export function* iterateKeys(obj, maxEntries = Infinity) {
  for (let [key] of iterate(obj, maxEntries)) yield key;
}

export const expandable = value =>
  typeof value === 'object' &&
  value &&
  !(value instanceof Error) &&
  !isFlow(value) &&
  !isSubscribable(value);

export const getPrimaryKeys = (value, maxLength = Infinity) => expandable(value) ? iterateKeys(value, maxLength) : [];
export const expandOnce = (value, maxLength = Infinity) => expandable(value) ? iterate(value, maxLength) : [];

export function* getSecondaryKeys(value, maxPrimaryLength = Infinity, maxSecondaryLength = Infinity) {
  if (maxSecondaryLength <= 0) return;

  const secondaryKeys = new Set();

  for (let [, pv] of expandOnce(value, maxPrimaryLength)) {
    if (!expandable(pv)) continue;

    for (let sk of iterateKeys(pv)) {
      if (!secondaryKeys.has(sk)) {
        secondaryKeys.add(sk);
        yield sk;
        if (secondaryKeys.size >= maxSecondaryLength) return;
      }
    }
  }
}

export function* expandTwice(value, maxPrimaryLength = Infinity, maxSecondaryLength = Infinity) {
  const secondaryKeys = new Set();

  for (let [pk, pv] of expandOnce(value, maxPrimaryLength)) {
    if (!expandable(pv)) yield [pk, pv];
    else {
      const secondary = new Map();

      for (let [sk, sv] of iterate(pv)) {
        if (secondaryKeys.size < maxSecondaryLength) secondaryKeys.add(sk);
        if (secondaryKeys.has(sk)) secondary.set(sk, sv);
        if (secondary.size >= maxSecondaryLength) break;
      }
      yield [pk, secondary];
    }
  }
}
