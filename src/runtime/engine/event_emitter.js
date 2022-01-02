export default class EventEmitter {
  constructor(options) {
    this.events = {};
    this.onSubscribe = options && options.onSubscribe || {};
  }

  on(eventName, fn) {
    if (!this.events[eventName]) {
      this.events[eventName] = new Set();
    }
    if (this.events[eventName].has(fn)) return this;

    this.events[eventName].add(fn);

    if (this.onSubscribe[eventName]) {
      this.onSubscribe[eventName](fn);
    }
    return this;
  }

  off(eventName, fn) {
    if (!fn) {
      delete this.events[eventName];
      return this;
    }

    if (this.events[eventName]) {
      this.events[eventName].delete(fn);
      if (this.events[eventName].size === 0) delete this.events[eventName];
    }
    return this;
  }

  emit(eventName, ...args) {
    if(!this.events[eventName]) return;
    for (let fn of this.events[eventName]) fn(...args);
    return this;
  }
};
