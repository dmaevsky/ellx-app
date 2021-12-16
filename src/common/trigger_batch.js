import { autorun, batch } from 'quarx';

export default trigger => {
  const runners = new Map();
  let off;

  function subscribe() {
    off = autorun(() => trigger.reportObserved() && batch(runAll));
  }

  function unsubscribe() {
    if (off) off();
    off = undefined;
  }

  function runAll() {
    for (let run of runners.values()) run();
    runners.clear();
    unsubscribe();
  }

  return {
    add(key, runner) {
      if (!runners.size) {
        subscribe();
      }
      runners.set(key, runner);
    },
    remove(key) {
      runners.delete(key);
      if (!runners.size) {
        unsubscribe();
      }
    }
  }
}
