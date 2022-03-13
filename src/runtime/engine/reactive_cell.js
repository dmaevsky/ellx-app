import { conclude, whenFinished } from 'conclure';
import { createAtom, autorun, computed } from 'quarx';
import { pull } from './pull.js';

export function asyncCell(it, options = {}) {
  const {
    name = 'asyncCell'
  } = options;

  let r = null;
  const cancel = conclude(it, (error, result) => r = { error, result });

  if (r) {
    // concluded sync
    const { error, result } = r;
    if (error) throw error;
    return result;
  }

  // The flow is still running -> create an observable atom and report it observed,
  // then this function will be called again when the task completes

  const atom = createAtom(() => cancel, { name });

  const promise = new Promise((resolve, reject) => whenFinished(it, ({ error, result, cancelled }) => {
    if (!cancelled) {
      atom.reportChanged();

      if (error) reject(error);
      else resolve(result);
    }
  }));

  throw atom.reportObserved() ? it : promise;
}

export function reactiveCell(evaluate, options = {}) {
  const name = (options.name || 'reactive') + ':cell';

  let value, inner, outer;

  const cell = computed(evaluate, options);

  const atom = createAtom(
    start,
    { name: 'atom:' + name }
  );

  function computation() {
    try {
      return cell.get();
    }
    catch (e) {
      return e;
    }
  }

  function start() {
    outer = autorun(() => {
      if (inner) inner();

      inner = pull(computation(), v => {
        value = v;
        atom.reportChanged();
      });
    }, { name });

    return () => {
      if (inner) inner();
      if (outer) outer();
    }
  }

  return {
    get: () => {
      if (!atom.reportObserved()) {
        throw new Error(`${name} unobserved`);
      };
      return value;
    }
  };
}
