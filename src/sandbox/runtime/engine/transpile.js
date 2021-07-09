import { isFlow } from 'conclure';
import { all } from 'conclure/combinators';
import { isSubscribable } from './quack.js';
import { invokeSubs } from './transpile_subs.js';

export function* invoke(fn, ...args) {
  args = yield all(args);
  return fn(...args);
}

export const transpile = fn => {
  const transpiled = (...args) => {
    if (args.some(isFlow)) {
      return invoke(transpiled, ...args);
    }
    if (args.some(isSubscribable)) {
      return invokeSubs(transpiled, ...args);
    }

    return fn(...args);
  }
  return transpiled;
}

export const unaryOp = op => {
  const scalarOp = new Function('a', `return ${op} a`);

  function self(arg) {
    if (isFlow(arg)) {
      return invoke(self, arg);
    }
    if (isSubscribable(arg)) {
      return invokeSubs(self, arg);
    }

    if (typeof arg !== 'object') return scalarOp(arg);

    // Check explicit overload
    let meta = arg.__EllxMeta__;
    let opOverload = meta && meta.operator && meta.operator.unary && meta.operator.unary[op];
    if (typeof opOverload === 'function') return opOverload(arg);

    // Otherwise apply op element-wise
    let res = arg instanceof Array ? [] : {};
    for (let key in arg) {
      res[key] = self(arg[key]);
    }
    return res;
  }
  return self;
}

export const binaryOp = op => {
  const scalarOp = new Function('a', 'b', `return a ${op} b`);

  function self(left, right) {
    if (isFlow(left) || isFlow(right)) {
      return invoke(self, left, right);
    }
    if (isSubscribable(left) || isSubscribable(right)) {
      return invokeSubs(self, left, right);
    }

    if (typeof left !== 'object') {
      if (typeof right !== 'object') return scalarOp(left, right);

      // Apply self to left and all right's elements
      let res = right instanceof Array ? [] : {};
      for (let key in right) {
        res[key] = self(left, right[key]);
      }
      return res;
    }

    // left is an object: check whether the operator is overloaded explicitly
    let meta = left.__EllxMeta__;
    let opOverload = meta && meta.operator && meta.operator.binary && meta.operator.binary[op];
    if (typeof opOverload === 'function') return opOverload(left, right);

    let res = left instanceof Array ? [] : {};

    if (typeof right !== 'object') {
      // Apply op to all left's elements and right
      for (let key in left) {
        res[key] = self(left[key], right);
      }
      return res;
    }

    // left and right are both objects: apply op to their common keys
    for (let key in left) if (key in right) {
      res[key] = self(left[key], right[key]);
    }
    return res;
  }
  return self;
}
