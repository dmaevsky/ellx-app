import { observable, computed, batch } from 'quarx';
import * as environment from './reserved_words.js';
import { STALE, isStale } from './quack.js';
import { pull } from './pull.js';
import ProgressiveEval from './progressive_assembly.js';

export default class CalcNode {
  constructor(resolve) {
    this.resolve = resolve;

    this.parser = new ProgressiveEval(environment, identifier => {
      const resolved = this.resolve(identifier);
      if (! (resolved instanceof CalcNode)) return resolved;

      const value = resolved.currentValue.get();
      if (isStale(value) || value instanceof Error) throw value;
      return value;
    });

    this.evaluator = observable.box(() => undefined, { name: `[${this.name}]:evaluator` });
    this.currentValue = observable.box(undefined, { name: `[${this.name}]:currentValue` });

    this.circular = computed(() => {
      if (this.evaluator.get()) { // re-run on evaluator update
        return this.dependsOn(this);
      }
    }, { name: 'circular_check' });
  }

  initialize(identifier, formula) {
    this.name = identifier;
    this.evaluator.set(this.parser.parse(String(formula)));
  }

  dependsOn(node, marker = {}) {
    this._traversalMarker = marker;

    return [...this.parser.dependencies()].some(dep => {
      const resolved = this.resolve(dep, false);  // static resolve
      if (! (resolved instanceof CalcNode)) return false;

      if (resolved === node) return true;
      return (resolved._traversalMarker !== marker && resolved.dependsOn(node, marker));
    });
  }

  setCurrentValue(value) {
    this.currentValue.set(value);
  }

  evalFormula() {
    try {
      return this.evaluator.get()();
    }
    catch (e) {
      if (isStale(e)) return e;
      throw e;
    }
  }

  compute() {
    try {
      if (this.circular.get()) {
        throw new Error('Circular dependency detected');
      }

      let result = this.evalFormula();

      this.set(result);
    }
    catch (e) {
      this.set(e);
    }
  }

  set(result) {
    if (this.cancelDistill) this.cancelDistill();

    this.cancelDistill = pull(result, this.setCurrentValue.bind(this));
  }

  dispose() {
    if (this.cancelDistill) {
      this.cancelDistill(); // This will cancel all on-going node distillation
    }

    if (this.stopCompute) this.stopCompute();
  }
}
