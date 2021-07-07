import { createAtom, batch } from 'quarx';

export function observableMap(options = {}) {
  const {
    name = 'observableMap',
  } = options;

  const map = new Map();
  const atoms = new Map();
  const allElements = createAtom(null, { name: name + '.*'});

  function reportObserved(key) {
    const atom = atoms.get(key) || createAtom(
      () => {
        atoms.set(key, atom);
        return () => atoms.delete(key);
      },
      { name: name + '.' + key }
    );
    atom.reportObserved();
  }

  const reportChanged = key => batch(() => {
    allElements.reportChanged();

    const atom = atoms.get(key);
    if (atom) atom.reportChanged();
  });

  return {
    has(key) {
      reportObserved(key);
      return map.has(key);
    },
    get(key) {
      reportObserved(key);
      return map.get(key);
    },
    set(key, value) {
      const existed = map.has(key);
      map.set(key, value);

      if (!existed) reportChanged(key);
      return this;
    },
    delete(key) {
      const deleted = map.delete(key);

      if (deleted) reportChanged(key);
      return deleted;
    },
    clear() {
      batch(() => {
        for (let key of map.keys()) this.delete(key);
      });
    },
    toJS: () => {
      allElements.reportObserved();
      return map;
    },
    values: () => map.values()
  };
}
