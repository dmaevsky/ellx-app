import test from 'ava';
import * as acorn from 'acorn';
import { readFileSync } from 'fs';
import { parse } from './cjs.js';

import { transform } from './acorn_adapter.js';


const ignoreEnd = n => ({ ...n, end: 0 });

function testSingle(t, code) {
  const ast = parse(code).map(ignoreEnd);
  const acornAst = transform(acorn.parse(code, { sourceType: 'module' })).map(ignoreEnd);

  t.snapshot({ code, ast, acornAst });

  t.deepEqual(acornAst, ast);
}

test('bundle_imports', t => {
  testSingle(t, readFileSync('src/bundler/cjs.js', 'utf8'));
})

test('default', t => {
  testSingle(t, `
    export default coreJs;
    export const __esModule = true;
  `);
})

test(`import "jquery"`, t => {
  testSingle(t, `import "jquery"`);
});

test(`import $ from "jquery"`, t => {
  testSingle(t, `import $ from "jquery"`);
});

test(`import { encrypt, decrypt } from "crypto"`, t => {
  testSingle(t, `import { encrypt, decrypt } from "crypto"`);
});

test(`import { encrypt as enc } from "crypto"`, t => {
  testSingle(t, `import { encrypt as enc } from "crypto"`);
});

test(`import crypto, { decrypt, encrypt as enc } from "crypto"`, t => {
  testSingle(t, `import crypto, { decrypt, encrypt as enc } from "crypto"`);
});

test(`import { null as nil } from "bar"`, t => {
  testSingle(t, `import { null as nil } from "bar"`);
});

test(`import * as crypto from "crypto"`, t => {
  testSingle(t, `import * as crypto from "crypto"`);
});

test(`import foo, * as bar from 'baz';`, t => {
  testSingle(t, `import foo, * as bar from 'baz';`);
});

test(`import {super as a} from 'a' `, t => {
  testSingle(t, `import {super as a} from 'a' `);
});

test(`export var document`, t => {
  testSingle(t, `export var document`);
});

test(`export var document = { }`, t => {
  testSingle(t, `export var document = { }`);
});

test(`export let document`, t => {
  testSingle(t, `export let document`);
});

test(`export let document = { }`, t => {
  testSingle(t, `export let document = { }`);
});

test(`export const document = { }`, t => {
  testSingle(t, `export const document = { }`);
});

test(`export function parse() { }`, t => {
  testSingle(t, `export function parse() { }`);
});

test(`export class Class {}`, t => {
  testSingle(t, `export class Class {}`);
});

test(`export default 42`, t => {
  testSingle(t, `export default 42`);
});

test(`export default function () {}`, t => {
  testSingle(t, `export default function () {}`);
});

test(`export default function f() {}`, t => {
  testSingle(t, `export default function f() {}`);
});

test(`export default class {}`, t => {
  testSingle(t, `export default class {}`);
});

test(`export default class A {}`, t => {
  testSingle(t, `export default class A {}`);
});

test(`export default (class{});`, t => {
  testSingle(t, `export default (class{});`);
});

test(`export * from "crypto"`, t => {
  testSingle(t, `export * from "crypto"`);
});

test(`export { default as test } from "crypto"`, t => {
  testSingle(t, `export { default as test } from "crypto"`);
});

test(`export { encrypt }\nvar encrypt`, t => {
  testSingle(t, `export { encrypt }\nvar encrypt`);
});

test(`export default class Test {}; export { Test }`, t => {
  testSingle(t, `export default class Test {}; export { Test }`);
});

test(`export { encrypt as default }; function* encrypt() {}`, t => {
  testSingle(t, `export { encrypt as default }; function* encrypt() {}`);
});

test(`export { encrypt, decrypt as dec }; let encrypt, decrypt`, t => {
  testSingle(t, `export { encrypt, decrypt as dec }; let encrypt, decrypt`);
});

test(`export { default } from "other"`, t => {
  testSingle(t, `export { default } from "other"`);
});

test(`export default function foo() {} false`, t => {
  testSingle(t, `export default function foo() {} false`);
});

test(`export default /foo/`, t => {
  testSingle(t, `export default /foo/`);
});

test(`export default class Foo {}++x`, t => {
  testSingle(t, `export default class Foo {}++x`);
});

test(`export { default as y } from './y.js';\nexport default 42`, t => {
  testSingle(t, `export { default as y } from './y.js';\nexport default 42`);
});

test(`export default function(x) {};`, t => {
  testSingle(t, `export default function(x) {};`);
});
