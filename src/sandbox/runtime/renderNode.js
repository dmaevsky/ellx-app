import { isFlow, inProgress, finished, getResult } from 'conclure';
import { STALE, STALE_BUNDLE, STALE_REQUIRE, isSubscribable } from './engine/quack';
import { iterate } from './iterate';

function constructorName(input) {
  if (input.constructor) return `[${input.constructor.name}]`;
  return input.name ? `[Object ${input.name}]` : '[Object]';
}

export function show(value, charLimit = 256) {
  let stream = {
    buffer: '',
    depth: 0,
    print(input) {
      if (input === undefined) return this.print('-');
      if (isFlow(input)) {
        if (finished(input)) {
          const { result, error, cancelled } = getResult(input);
          return this.print(cancelled ? '[Cancelled]' : error || result);
        }
        if (this.depth === 0 && inProgress(input)) return this.print('...');
        return this.print('[Flow]');
      }
      if (isSubscribable(input)) {
        return this.print('[Subs]');
      }
      if (input === STALE) return this.print('...');
      if (input === STALE_BUNDLE) return this.print('...bundling...');
      if (input === STALE_REQUIRE) return this.print('...fetching dependencies...');
      if (typeof input === 'function') {
        return this.print(input.name ? `[Function ${input.name}]` : '[Function]');
      }
      if (input instanceof Error) return this.print('#ERR: ' + input.message);

      if (typeof input === 'string') {
        this.buffer += input;
        if (this.buffer.length > charLimit) {
          this.buffer = this.buffer.slice(0, charLimit - 3) + '...';
          throw 'Buffer full';
        }
        return;
      }

      if (Array.isArray(input) || input instanceof Set) {
        if (this.depth >= 2) return this.print(constructorName(input));

        this.print(input instanceof Set ? 'Set[' : '[');
        ++this.depth;

        let first = true;
        for (let el of input) {
          if (!first) this.print(', ');
          else first = false;
          this.print(el);
        }

        this.print(']');
        --this.depth;
        return;
      }

      if (typeof input === 'object' && input || input instanceof Map) {
        if (Object.prototype !== Object.getPrototypeOf(input) && !(input instanceof Map)) {
          // non-trivial prototype
          if (typeof input.toString === 'function') return this.print(input.toString());
          if (typeof input.toJS === 'function') return this.print(input.toJS());
          return this.print(constructorName(input));
        }

        if (this.depth >= 2) {
          return this.print(constructorName(input));
        }

        this.print(input instanceof Map ? 'Map{' : '{');
        ++this.depth;

        let first = true;
        for (let [key, value] of iterate(input)) {
          if (!first) this.print(', ');
          else first = false;

          this.print(key + ': ');
          this.print(value);
        }

        this.print('}');
        --this.depth;
        return;
      }

      if (typeof input === 'number') {
        const MAXLEN = 13;

        const str = input.toString();
        if (str.length <= MAXLEN) return this.print(str);

        if (str.includes('e')) {
          // Keep the exponential format
          const fractionalDigits = /\.([0-9]+)e/.exec(str)[1];

          return this.print(
            input.toExponential(fractionalDigits.length - str.length + MAXLEN)
              .replace(/0+e/, 'e')
          );
        }

        const fixedLen = str.indexOf('.');

        // Try to convert to exponential format
        const strExp = input.toExponential();
        if (strExp.length <= MAXLEN) return this.print(strExp);

        if (fixedLen >= 0 && fixedLen <= MAXLEN && str.length <= strExp.length) {
          // Keep the current format
          const places = Math.max(MAXLEN - fixedLen - 1, 0);
          const factor = parseFloat(`1e${places}`);

          return this.print(
            String(Math.round(input * factor + Number.EPSILON) / factor)
          );
        }

        // Go with the exponential format
        const fractionalDigits = /\.([0-9]+)e/.exec(strExp)[1];
        return this.print(
          input.toExponential(fractionalDigits.length - strExp.length + MAXLEN)
            .replace(/0+e/, 'e')
        );
      }

      this.print(JSON.stringify(input));
    }
  };

  try {
    stream.print(value);
  }
  catch (err) {
    if (err !== 'Buffer full') throw err;
  }

  return stream.buffer;
}
