const ids = new WeakMap();
let counter = 0;

export const uid = (length = 64) => [...Array(length)].map(() => (Math.random() * 16 | 0).toString(16)).join('');

export default function objectId(o, random = false) {
  if (!ids.has(o)) ids.set(o, random ? uid() : ++counter);
  return ids.get(o);
}

export function deepEqual(a, b) {
  if (!a || !b) return a === b;

  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((el, i) => deepEqual(el, b[i]));
  }

  if (typeof a === 'object') {
    const keys = Object.keys(a);
    return (typeof b === 'object') && Object.keys(b).length === keys.length && keys.every(key => deepEqual(a[key], b[key]));
  }
  return a === b;
}
