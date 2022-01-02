import { createAtom, batch } from 'quarx';

export function observableMap(map = new Map(), options = {}) {
  const {
    name = 'observableMap',
    equals = (a, b) => a === b
  } = options;

  const atoms = new Map();

  // This atom is an optimization: an operation touching all elements would only need to report this one observed
  const allElements = createAtom(null, { name: name + '.*'});

  function reportObserved(key) {
    const atom = atoms.get(key) || createAtom(
      () => {
        atoms.set(key, atom);
        return () => atom === atoms.get(key) && atoms.delete(key);
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
      const unchanged = equals(map.get(key), value);

      if (existed && unchanged) return this;

      map.set(key, value);
      reportChanged(key);

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
    toJS() {
      allElements.reportObserved();
      return map;
    },
    values() {
      allElements.reportObserved();
      return map.values();
    }
  };
}
