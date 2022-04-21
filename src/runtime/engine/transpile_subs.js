import { autorun, Quarx } from 'quarx';
import { toObservable, fromObservable } from './adapters.js';
import { isSubscribable } from './quack.js';
import { reactiveCell } from './reactive_cell.js';

const subscribables = new WeakMap();
const noop = () => {};

function getObs(subs) {
  let r = subscribables.get(subs);
  const seqNo = Quarx.sequenceNumber;

  if (!r) {
    subscribables.set(subs, r = {
      hydrationId: seqNo,
      current: 0,
      observables: new Map()
    });
  }

  if (r.hydrationId !== seqNo) {
    r.hydrationId = seqNo;
    r.current = 0;
  }

  const id = subs.id || r.current++;

  let obs = r.observables.get(id);

  if (!obs) {
    obs = toObservable({
      subscribe: subscriber => {
        let unsubscribe = subs.subscribe(subscriber);
        if (typeof unsubscribe !== 'function') unsubscribe = noop;

        r.observables.set(id, obs);

        return () => {
          if (r.observables.get(id) === obs) {
            r.observables.delete(id);
          }
          unsubscribe();
        }
      },
      get: subs.get
    });
  }
  return obs;
}

export const invokeSubs = (fn, ...args) => {
  args = args.map(a => isSubscribable(a) ? getObs(a) : { get: () => a });

  return fromObservable(
    reactiveCell(() => fn(...args.map(a => a.get())), { name: fn.toString() }),
    { name: 'fromObservable:' + fn.toString() }
  );
}
