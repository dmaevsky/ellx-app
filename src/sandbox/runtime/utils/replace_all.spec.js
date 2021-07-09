import test from 'ava';
import replaceAll from './replace_all.js';

const URLS = /\[([^\[]+)\]\(([^)]*)\)/g;
const parseLinks = cell => replaceAll(cell, URLS, (_, text, href) => `<a href="${href}">${text}</a>`);

test('replaceAll polyfill', t => {
  const input = 'Check out [this link](https://this.link) and [that link](https://that.link)';

  const parsed = parseLinks(input);

  t.is(parsed, 'Check out <a href="https://this.link">this link</a> and <a href="https://that.link">that link</a>');
});
