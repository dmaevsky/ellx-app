import { whenFinished } from 'conclure';

export default (fn, expiry = 0, cache = {}) => function(key, ...args) {
  if (key in cache) {
    return cache[key];
  }

  const it = fn(key, ...args);
  cache[key] = it;

  whenFinished(it, ({ cancelled }) => {
    if (cancelled || expiry === 0) {
      delete cache[key];
    }
    else if (isFinite(expiry)) {
      setTimeout(() => (delete cache[key]), expiry);
    }
  });

  return it;
}
