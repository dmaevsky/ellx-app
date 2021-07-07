import test from 'ava';
import Parser from 'rd-parse';
import CodeFile from './imports_grammar';

const parse = Parser(CodeFile);

test('import specifier list with trailing commas', t => {
  const file = `
    import { bind, binding_callbacks, } from 'svelte/internal';
  `;
  t.snapshot(parse(file));
});

test('misc imports and exports', t => {
  const file = `
      import foo, { bar, baz as bas2 } from 'my-module';

      export { bla } from 'another-module';
      export { foo };

      export const blabla = 42;

      export default whatever;
  `;
  t.snapshot(parse(file));
});

test('re-exports', t => {
  const file = `
    export * from 'another-module';
    export { foo, bar as bar1 } from 'yet-another-one';
  `;
  t.snapshot(parse(file));
});

test('export declaration: object pattern', t => {
  const file = `
    export let { foo } = whatever;
    export let { foo: foo2, bar, baz: [baz1, baz2] } = whatever;
  `;
  t.snapshot(parse(file));
});

test('export declaration: array pattern', t => {
  const file = 'export let [a1,, a2, ...a3] = whatever';
  t.snapshot(parse(file));
});

test('export declaration: functions and classes', t => {
  const file = `
    export function foo();
    export function* bar();
    export async function afoo();
    export async function* abar();
    export class baz {};
  `;
  t.snapshot(parse(file));
});

test('imports and exports in comments and strings', t => {
  const file = `
    // this import smth is in a comment
    /* import is in a comment too */
    const s = 'import foo from "foo"';
  `;
  const ast = parse(file);
  t.is(ast.length, 0);
});

test('mix of valid code and imports / exports', t => {
  const file = `
    import foo from 'foo';
    function f() {
      return foo(42);
    }
    export { f };
  `;
  t.snapshot(parse(file));
});

test('global bindings', t => {
  const file = `
    export let document;
    export var foo;
  `;
  t.snapshot(parse(file));
});

test('string interpolation', t => {
  const file = "`Mismatched timing labels (expected ${this.current_timing.label}, got ${label})`"
  t.snapshot(parse(file));
});
