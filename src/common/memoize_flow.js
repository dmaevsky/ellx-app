import { whenFinished } from 'conclure';

export default (fn, expiry = 0, cache = {}) => {
  const [expiryResults, expiryErrors] = Array.isArray(expiry) ? expiry : [expiry, expiry];

  const expire = (it, key, ms) => {
    if (ms === 0 && cache[key] === it) {
      delete cache[key];
    }
    else if (isFinite(ms)) {
      setTimeout(() => (cache[key] === it && (delete cache[key])), ms);
    }
  }

  return (key, ...args) => {
    if (key in cache) {
      return cache[key];
    }

    const it = fn(key, ...args);
    cache[key] = it;

    whenFinished(it, ({ cancelled, error }) => {
      if (cancelled) {
        delete cache[key];
      }
      else {
        expire(it, key, error ? expiryErrors : expiryResults)
      }
    });

    return it;
  };
}
