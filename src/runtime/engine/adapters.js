import { autorun, createAtom, untracked } from 'quarx';

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
      if (value instanceof Error) throw value;
      return value;
    }
  };
}
