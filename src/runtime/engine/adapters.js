import { autorun, createAtom, untracked } from 'quarx';
import { isStale } from './quack.js';

export function fromObservable(obs, options = {}) {
  return {
    get: () => obs.get(),
    subscribe: subscriber => autorun(() => {
      try {
        subscriber(obs.get());
      }
      catch (error) {
        subscriber(error);
      }
    }, { name: options.name || 'fromObservable' })
  };
}

export function toObservable({ subscribe, get }, options = {}) {
  const {
    name = 'toObservable',
  } = options;

  let value;

  const atom = createAtom(() => untracked(() => subscribe(s => {
    value = s;
    atom.reportChanged();
  })), { name });

  return {
    get: () => {
      if (!atom.reportObserved()) return get();
      if (value instanceof Error || isStale(value)) throw value;
      return value;
    }
  };
}
