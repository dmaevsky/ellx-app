import { createAtom, computed } from 'quarx';
import { whenFinished, isFlow } from 'conclure';
import { reactiveFlow } from 'conclure-quarx';

export default (fn, cache = new Map()) => (key, ...args) => {
  if (cache.has(key)) {
    return cache.get(key).get();
  }

  function invalidate() {
    if (cache.get(key) === obs) cache.delete(key);
  }

  const atom = createAtom(() => {
    cache.set(key, obs);
    return invalidate;
  }, {
    name: `Memoize ${fn.name}(${key})`
  });

  const obs = computed(() => {
    if (!atom.reportObserved()) {
      throw new Error('Auto-memoize only works when observed');
    }

    const it = fn(key, ...args);

    if (isFlow(it)) {
      reactiveFlow(it);

      whenFinished(it, ({ cancelled }) => {
        if (cancelled) invalidate();
      });
    }

    return it;
  }, {
    name: `Compute ${fn.name}(${key})`
  });

  return obs.get();
}
