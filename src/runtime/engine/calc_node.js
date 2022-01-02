import { observable, computed, batch } from 'quarx';
import * as environment from './reserved_words.js';
import { STALE, isStale } from './quack.js';
import { pull } from './pull.js';
import EventEmitter  from './event_emitter.js';
import ProgressiveEval from './progressive_assembly.js';

const getComponent = obj => obj && obj.__EllxMeta__ && obj.__EllxMeta__.component;

export default class CalcNode extends EventEmitter {
  constructor(resolve) {
    super({ onSubscribe: {
      update: subscriber => {
        // Report the node's name at subscription: it might have been assigned automatically
        const payload = { node: this.name, value: this.currentValue.get(), formula: this.parser.input };

        if (this.component) payload.component = this.component;
        subscriber(payload);
      }
    }});

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

  initialize(identifier, formula, initValue) {
    batch(() => {
      this.name = identifier;
      this.evaluator.set(this.parser.parse(String(formula)));

      if (initValue === STALE) this.compute();
      else if (initValue !== undefined) this.setCurrentValue(initValue);
    });
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
    this.emit('update', { value });

    this.currentValue.set(value);

    if (!(value instanceof Error) && !isStale(value)) {
      this.lastValue = value;
    }
  }

  setComponent(component, valueOverride = false) {
    if (this.component === component) return;

    if (this.component && typeof this.component.dispose === 'function') {
      this.component.dispose();
    }

    this.component = component;
    this.valueOverride = valueOverride;

    this.emit('update', { component });
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

      const Component = getComponent(result);
      if (typeof Component === 'function') {
        if (this.component instanceof Component) {
          if (typeof this.component.update === 'function') {
            this.component.update(result);
          }
        }
        else {
          let component, valueOverride;

          const options = {
            initState: this.lastValue,
            output: value => {
              if (valueOverride && this.component !== component) return; // Ignore output from disposed components
              valueOverride = true;
              this.set(value);
            }
          };

          component = new Component(result, options);
          this.setComponent(component, valueOverride);
        }
      }
      else if (isStale(result) && this.component && typeof this.component.stale === 'function') {
        this.component.stale(result);
      }
      else this.setComponent();

      if (!this.valueOverride) this.set(result);
    }
    catch (e) {
      this.setComponent();        // Clear and dispose component
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
    this.setComponent(); // Clear and dispose component

    if (this.stopCompute) this.stopCompute();
  }
}
