import { conclude, whenFinished, isFlow, inProgress } from 'conclure';
import { createAtom, autorun } from 'quarx';

import { STALE as DEFAULT_STALE, isStale } from './quack';

export function asyncCell(it, options = {}) {
  const {
    STALE = DEFAULT_STALE,
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
  whenFinished(it, ({ cancelled }) => !cancelled && atom.reportChanged());

  atom.reportObserved();
  throw STALE;
}

export function reactiveCell(evaluate, options = {}) {
  const STALE = options.STALE || DEFAULT_STALE;
  let cell = STALE;

  const atom = createAtom(start, { name: options.name || 'reactiveCell' });

  function set(value) {
    if (cell === value) return;
    cell = value;
    atom.reportChanged();
  }

  const concludeOne = value => conclude(value, (error, result) => set(error || result));

  let cancel;

  const compute = () => {
    try {
      if (cancel) cancel();

      const value = evaluate();

      cancel = concludeOne(value);

      if (isFlow(value) && inProgress(value)) set(STALE);
    }
    catch (err) {
      set(err);
    }
  }

  function start() {
    const off = autorun(compute);
    return () => {
      off();
      if (cancel) cancel();
      cell = STALE;
    }
  }

  return {
    get: () => {
      atom.reportObserved();
      if ((cell instanceof Error) || isStale(cell)) throw cell;
      return cell;
    }
  };
}
