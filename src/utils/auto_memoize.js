import { createAtom, autorun } from 'quarx';
import { whenFinished, isFlow } from 'conclure';
import { reactiveFlow } from 'conclure-quarx';

export default (fn, options = {}) => {
  const {
    cache = new Map(),
    equals = (a, b) => a === b,
    gc
  } = options;

  return (key, ...args) => {
    if (cache.has(key)) {
      const { atom, error, result } = cache.get(key);
      atom.reportObserved();

      if (error) throw error;
      return result;
    }

    function invalidate() {
      cache.delete(key);
      off();
    }

    const atom = createAtom(() => {
      if (gc) {
        gc.delete(invalidate);
        return () => gc.add(invalidate);
      }
      return invalidate;
    }, {
      name: `Memoize ${fn.name}(${key})`
    });

    const cached = {
      atom,
      error: null,
      result: undefined
    };
    cache.set(key, cached);

    if (!atom.reportObserved()) {
      throw new Error('Auto memo only works when observed');
    }

    const off = autorun(() => {
      try {
        const value = fn(key, ...args);

        if (!cached.error && equals(cached.result, value)) return;

        if (isFlow(value)) {
          reactiveFlow(value);

          whenFinished(value, ({ cancelled }) => {
            if (cancelled) invalidate();
          });
        }

        cached.result = value;
        cached.error = null;
      }
      catch (e) {
        cached.error = e;
      }
      atom.reportChanged();
    });

    if (cached.error) throw cached.error;
    return cached.result;
  }
}
