import test from 'ava';
import math from './math.mock';

import ProgressiveEval, { compile } from './progressive_assembly';
import * as environment from './reserved_words';
import * as library from './library';

const resolve = name => {
  if (name === 'math') return math;
  if (name in library) return library[name];
  return name.charCodeAt(0);
}

const parser = new ProgressiveEval(environment, resolve);

test('Identifier, Literal, BinaryExpression', t => {
  const evaluator = parser.parse('a + 42');

  // Not evaluated yet, so expect the binary + to be deferred
  t.is(compile(parser.root, true),
    'this.nodes[0].reactiveFlow(this.nodes[0].transpile(this.nodes[1].reactiveFlow(this.external("a")),this.nodes[2].reactiveFlow(42)))'
  );
  t.is(evaluator(), 97 + 42);

  // After evaluation the compiled body should be finalized
  t.is(compile(parser.root, true), 'this.external("a") + 42');
  t.is(evaluator(), 97 + 42);
});

test('exponentiation operator', t => {
  const evaluator = parser.parse('2 ** 3 ** 2');
  t.is(evaluator(), 512);
});

test('string literals concatenation with binary +', t => {
  const evaluator = parser.parse('"a" + "b"');
  t.is(compile(parser.root, true),
    'this.nodes[0].reactiveFlow(this.nodes[0].transpile(this.nodes[1].reactiveFlow("a"),this.nodes[2].reactiveFlow("b")))'
  );
  t.is(evaluator(), 'ab');
  t.is(compile(parser.root, true), '"a" + "b"');
});

test('ArrowFunction', t => {
  const evaluator = parser.parse('a => (b = c) => a * x + b');

  t.is(parser.root.type, 'ArrowFunction');
  t.deepEqual(parser.dependencies(), new Set(['c', 'x']));

  const arrows = parser.nodes.filter(node => node.type === 'ArrowFunction');
  t.is(arrows.length, 2);

  const outer = evaluator();
  t.is(outer.signature(), `a => this.nodes[${arrows[1].id}].evaluator({a})`);
  t.deepEqual(outer.closure, {});

  const inner = outer(5);
  t.true(inner.signature().startsWith('(b = this.nodes[4].reactiveFlow(this.external("c"))) => this.nodes[5].reactiveFlow(this.nodes[5].transpile('));
  t.deepEqual(inner.closure, {a: 5});

  t.is(inner(), 5 * 120 + 99);
  // Signature is updated after the first execution
  t.is(inner.signature(), '(b = this.external("c")) => a * this.external("x") + b');
  // But the result stays the same
  t.is(inner(), 699);
});

test('ArrayLiteral, EmptyElement, SpreadElement, and rest parameter', t => {
  const evaluator = parser.parse('(a, ...z) => [...z, , a]');
  t.is(parser.dependencies().size, 0);

  const f = evaluator();
  t.deepEqual(f(1,2,3), [2,3,,1]);
  t.is(f.signature(), '(a, ...z) => [...z, , a]');
});

test('CompoundExpression', t => {
  const args = [];
  console.__ellxSpy = a => args.push(a);

  const evaluator = parser.parse('(console.__ellxSpy(555), 42)');
  t.is(parser.root.type, 'CompoundExpression');
  t.is(parser.dependencies().size, 0);

  t.is(evaluator(), 42);
  t.is(compile(parser.root, true), '(console.__ellxSpy(555), 42)');
  t.deepEqual(args, [555]);
});

test('ObjectLiteral', t => {
  const evaluator = parser.parse('{ foo: "bar", [x]: y }');
  t.is(parser.root.type, 'ObjectLiteral');
  t.deepEqual(parser.dependencies(), new Set(['x', 'y']));
  t.deepEqual(evaluator(), { foo: 'bar', 120: 121 });
  t.is(compile(parser.root, true), '{ foo: "bar", [this.external("x")]: this.external("y") }');
});

test('CallExpression', t => {
  const evaluator = parser.parse('((a, b, c) => a * x + b * c)(...[5, c], 2)');
  t.is(parser.root.type, 'CallExpression');
  t.deepEqual(parser.dependencies(), new Set(['x', 'c']));

  const arrows = parser.nodes.filter(node => node.type === 'ArrowFunction');
  t.is(arrows.length, 1);

  t.is(evaluator(), 5 * 120 + 99 * 2);
  t.is(compile(parser.root, true), `this.nodes[${arrows[0].id}].evaluator({})(...[5, this.external("c")], 2)`);
});

test('MemberExpression', t => {
  const evaluator = parser.parse('({x}).x');
  t.is(parser.root.type, 'MemberExpression');
  t.deepEqual(parser.dependencies(), new Set(['x']));
  t.is(evaluator(), 120);
  t.is(compile(parser.root, true), '({x:this.external("x")}).x');

  t.is(parser.parse('(o => o.x * o["y"])({x,y})')(), 120 * 121);
});

test('MemberExpression with a compiled property', t => {
  const evaluator = parser.parse('({xy})["x" + "y"]');
  t.is(evaluator(), 120);
  t.is(compile(parser.root, true), '({xy:this.external("xy")})["x" + "y"]');
  t.is(evaluator(), 120);
});

test('using library functions', t => {
  const evaluator = parser.parse('range(1, 3).map(i => i + x)');
  t.deepEqual(parser.dependencies(), new Set(['range', 'x']));
  const arrows = parser.nodes.filter(node => node.type === 'ArrowFunction');
  t.is(arrows.length, 1);

  t.deepEqual(evaluator(), [121, 122]);
  t.is(compile(parser.root, true), `this.external("range")(1, 3).map(this.nodes[${arrows[0].id}].evaluator({}))`);
  t.deepEqual(evaluator(), [121, 122]);
});

test('NewExpression', t => {
  const evaluator = parser.parse('new Array(3)');
  t.is(parser.root.type, 'NewExpression');
  t.is(parser.dependencies().size, 0);
  t.deepEqual(evaluator(), [,,,]);
  t.is(compile(parser.root, true), 'new (Array)(3)');
});

test('UnaryExpression', t => {
  const evaluator = parser.parse('typeof +"42"');
  t.is(parser.root.type, 'UnaryExpression');
  t.is(parser.dependencies().size, 0);
  t.is(evaluator(), 'number');
  t.is(compile(parser.root, true), 'typeof +"42"');
});

test('ConditionalExpression', t => {
  const evaluator = parser.parse('x => x > a ? x - a : a - x');
  t.is(parser.root.result.type, 'ConditionalExpression');
  t.deepEqual(parser.dependencies(), new Set(['a']));

  const f = evaluator();
  t.true(f.signature().startsWith(
    'x => this.nodes[2].reactiveFlow(this.nodes[3].reactiveFlow(this.nodes[3].transpile(this.nodes[4].reactiveFlow(x),this.nodes[5].reactiveFlow(this.external("a")))) ?'
  ));

  t.is(f(100), 100 - 97);
  t.is(f.signature(), `x => x > this.external("a") ? x - this.external("a") : this.nodes[9].reactiveFlow(this.nodes[9].transpile(this.nodes[10].reactiveFlow(this.external("a")),this.nodes[11].reactiveFlow(x)))`);
  t.is(f(80), 97 - 80);
  t.is(f.signature(), 'x => x > this.external("a") ? x - this.external("a") : this.external("a") - x');
});

test('transpilation of UnaryExpression', t => {
  const evaluator = parser.parse('~math.complex(1,2)');
  t.is(parser.root.type, 'UnaryExpression');
  t.is(parser.dependencies().size, 1);
  t.deepEqual(evaluator(), math.complex(1, -2));
  t.is(compile(parser.root, true), 'this.nodes[0].transpile(this.external("math").complex(1,2))');
  t.deepEqual(evaluator(), math.complex(1, -2));
});

test('transpilation of BinaryExpression', t => {
  const evaluator = parser.parse('math.complex(1,2) * math.complex(1,-2)');
  t.is(parser.root.type, 'BinaryExpression');
  t.is(parser.dependencies().size, 1);
  t.deepEqual(evaluator(), math.complex(5, 0));
  t.is(compile(parser.root, true), 'this.nodes[0].transpile(this.external("math").complex(1,2),this.external("math").complex(1,-2))');
  t.deepEqual(evaluator(), math.complex(5, 0));
});

test('more awesome transpilation', t => {
  const evaluator = parser.parse('(x => x * ~x)(math.complex(2,3))');
  t.deepEqual(evaluator(), math.complex(13, 0));
});

test('renaming external node', t => {
  const evaluator = parser.parse('x * (x - y)');
  t.is(evaluator(), -120);
  t.is(compile(parser.root, true), 'this.external("x") * (this.external("x") - this.external("y"))');
  t.deepEqual(parser.dependencies(), new Set(['x', 'y']));

  parser.rename('x', 'zNew');
  t.is(parser.input, 'zNew * (zNew - y)');
  t.is(compile(parser.root, true), 'this.external("x") * (this.external("x") - this.external("y"))');
  t.deepEqual([...parser.renamed], [['x', 'zNew'], ['zNew', 'x']]);
  t.deepEqual(parser.dependencies(), new Set(['zNew', 'y']));
  t.is(evaluator(), 122);

  parser.rename('zNew', 'dAnother');
  parser.rename('y', 'yAnother');
  t.is(parser.input, 'dAnother * (dAnother - yAnother)');
  t.deepEqual([...parser.renamed], [['x', 'dAnother'], ['dAnother', 'x'], ['y', 'yAnother'], ['yAnother', 'y']]);
  t.deepEqual(parser.dependencies(), new Set(['dAnother', 'yAnother']));
  t.is(evaluator(), -2100);
});

test('Fibonacci numbers sequence generation', t => {
  const evaluator = parser.parse('range(0, 5).reduce(acc => acc.concat(acc[acc.length-1] + acc[acc.length-2]), [1,1])');
  t.deepEqual(evaluator(), [1, 1, 2, 3, 5, 8, 13]);
});

test('that external nodes are evaluated lazily when not inside ArrowFunction body', t => {
  const evaluator = parser.parse('a > 100 ? () => x : () => y');
  const arrows = parser.nodes.filter(node => node.type === 'ArrowFunction');
  t.is(arrows.length, 2);

  let f = evaluator();
  t.is(compile(parser.root, true), `this.external("a") > 100 ? this.nodes[${arrows[0].id}].evaluator({}) : this.nodes[${arrows[1].id}].evaluator({})`);
  t.is(f.signature(), '() => this.nodes[7].reactiveFlow(this.external("y"))');
  t.is(f(), 121);
  t.is(f.signature(), '() => this.external("y")');

  parser.rename('a', 'z');
  t.is(f(), 121);
  f = evaluator();
  t.is(f.signature(), '() => this.nodes[5].reactiveFlow(this.external("x"))');
  t.is(f(), 120);
  t.is(f.signature(), '() => this.external("x")');
});

test('more cases of arrow functions depending on external nodes', t => {
  const evaluator = parser.parse('x => a + (a => a + x)(5)');
  const f = evaluator();
  t.is(f(42), 97 + 5 + 42);
});

test('renaming external node when a conflicting shorthand notation is present', t => {
  const evaluator = parser.parse('{x}');
  t.deepEqual(parser.dependencies(), new Set(['x']));
  t.deepEqual(evaluator(), {x: 120});
  parser.rename('x', 'yy');
  t.is(parser.input, '{x:yy}');
  t.deepEqual(evaluator(), {x: 121});
  parser.rename('yy', 'zzz');
  t.is(parser.input, '{x:zzz}');
  t.deepEqual(evaluator(), {x: 122});
});

test('renaming external node when a conflicting arrow argument is present', t => {
  const evaluator = parser.parse('a => ({a}).a + bb');
  t.deepEqual(parser.dependencies(), new Set(['bb']));

  let f = evaluator();
  t.is(f(2), 100);
  t.is(f.signature(), 'a => ({a:a}).a + this.external("bb")');

  parser.rename('bb', 'a');
  t.deepEqual(parser.dependencies(), new Set(['a']));
  t.is(parser.input, 'bb => ({a:bb}).a + a');

  t.is(f(2), 99);

  f = evaluator();
  // After recalculation the compiled internals stay the same, but the externals re-captured correctly
  t.is(f.signature(), 'a => ({a:a}).a + this.external("bb")');
  t.is(f(2), 99);

  // Renaming it back brings the original formula back
  parser.rename('a', 'bb');
  t.deepEqual(parser.dependencies(), new Set(['bb']));
  t.is(parser.input, 'a => ({a}).a + bb');
});

test('MemFn expression', t => {
  const evaluator = parser.parse('[1, 2].reduce((a, b) => a + b)');
  t.is(parser.dependencies().size, 0);
  t.is(evaluator(), 3);
  t.is(compile(parser.root, true), '[1, 2].reduce(this.nodes[5].evaluator({}))');
  t.is(evaluator(), 3);
});

test('String interpolation', t => {
  const evaluator = parser.parse('`a + b is ${a + b}!`');
  t.deepEqual(parser.dependencies(), new Set(['a', 'b']));
  t.is(evaluator(), `a + b is ${97 + 98}!`);
});
