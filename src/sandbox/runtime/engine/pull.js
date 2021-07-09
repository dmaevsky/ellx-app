import { conclude, isFlow, inProgress } from 'conclure';
import { STALE, isSubscribable } from './quack.js';

export function pull(value, cb) {
  let inner, outer;

  if (isFlow(value)) {
    outer = conclude(value, (error, result) => {
      inner = pull(error || result, cb);
    });
    if (inProgress(value)) cb(STALE);
  }
  else if (isSubscribable(value)) {
    outer = value.subscribe(result => {
      if (inner) inner();
      inner = pull(result, cb);
    });
  }
  else cb(value);

  return () => {
    if (inner) inner();
    if (outer) outer();
  };
}
