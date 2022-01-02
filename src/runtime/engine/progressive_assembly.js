import Parser from 'rd-parse';
import Grammar from 'rd-parse-jsexpr';
import { reactiveFlow } from 'conclure-quarx';
import { isFlow, isIterator } from 'conclure';
import { isStale, isSubscribable } from './quack.js';
import { binaryOp, unaryOp, transpile } from './transpile.js';
import { pull } from './pull.js';

const parseFormula = Parser(Grammar);
const Union = (...sets) => sets.reduce((acc, s) => (s ? new Set([...acc, ...s]) : acc), new Set());

const bind = (f, o) => f && typeof f.bind === 'function' ? f.bind(o) : f;

const fromParts = (node, replacer) => {
  let pos = 0, result = '', count = 0;

  for (let child of node.children) {
    const childPos = child.pos - node.pos;
    result += node.text.slice(pos, childPos) + replacer(child, count++);
    pos = childPos + child.text.length;
  }

  result += node.text.slice(pos);
  return result;
}

// Just assemble compiled code
export const compile = (node, asRoot = false) => {

  if (!asRoot && node.evaluator) {
    const args = node.parent.namespace || [];
    return `this.nodes[${node.id}].evaluator({${[...args].join(',')}})`;
  }

  let result;

  if (node.external) {
    result = `this.external(${JSON.stringify(node.external)})`;
  }
  else if (node.transpile) {
    result = `this.nodes[${node.id}].transpile(${node.children.map(child => compile(child)).join(',')})`;
  }
  else {
    result = fromParts(node, child => compile(child));
  }

  if (node.reactiveFlow) {
    result = `this.nodes[${node.id}].reactiveFlow(${result})`;
  }

  if (node.shortNotation) {
    result = node.name + ':' + result;
  }
  else if (node.isConstructor) {
    result = `(${result})`;
  }

  return result;
}

const assembler = node => {
  const body = fromParts(node, (_, i) => '_' + i);
  const f = new Function(...node.children.map((_, i) => '_' + i), 'return ' + body);

  return (...args) => {
    try {
      return f(...args);
    }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      throw new Error(error.message.replace(/\b_([0-9]+)\b/, (_, idx) => node.children[idx].text));
    }
  }
}

export default class ProgressiveEval {
  constructor(env, external) {
    this.reserved = new Set(env.reserved);
    this.builtin = new Set(env.builtin);

    this.external = name => external(this.renamed.get(name) || name);
  }

  parse(input) {
    this.nodes = [];

    this.renamed = new Map();
    this.input = this.originalInput = input;

    this.root = parseFormula(input);

    this.precompile(this.root);

    this.nodes.sort((a, b) => a.pos - b.pos || b.text.length - a.text.length);
    this.nodes.forEach((node, i) => node.id = i);

    return () => this.root.evaluator();
  }

  dependencies() {
    return new Set([...this.root.deps].map(name => this.renamed.get(name) || name));
  }

  rename(oldName, newName) {
    if (!this.dependencies().has(oldName)) return;

    if (this.renamed.has(oldName)) {
      const original = this.renamed.get(oldName);
      this.renamed.delete(oldName);
      oldName = original;
    }

    if (oldName === newName) {
      this.renamed.delete(oldName);
      this.renamed.delete(newName);
    }
    else {
      this.renamed.set(oldName, newName);
      this.renamed.set(newName, oldName);
    }

    // re-assemble this.input
    let pos = 0, result = '';

    for (let node of this.nodes) {
      if (node.type !== 'Identifier' && node.type !== 'BoundName') continue;
      if (!this.renamed.has(node.name)) continue;

      const replaced = node.shortNotation ?
        node.name + ':' + this.renamed.get(node.name) :
        this.renamed.get(node.name);

      result += this.originalInput.slice(pos, node.pos) + replaced;
      pos = node.pos + node.text.length;
    }

    result += this.originalInput.slice(pos);
    this.input = result;
  }

  precompile(node, parent = this) {
    this.nodes.push(node);

    const children = [];
    const boundNames = [];

    const collectParts = tree => {
      for (let p in tree) {
        const part = tree[p];

        if (part && typeof part === 'object') {
          if (part.type === 'BoundName') {
            if (this.reserved.has(part.name)) {
              throw new Error(`Cannot use a reserved word ${part.name} as a parameter name`);
            }
            boundNames.push(part);
          }
          else if (part.text) {
            children.push(part);
          }
          else collectParts(part);
        }
      }
    }

    collectParts(node);

    node.children = children;
    node.parent = parent;
    node.namespace = parent.namespace;

    if (node.type === 'ArrowFunction') {
      node.isArrowFn = true;
      this.nodes.push(...boundNames);
      node.namespace = Union(node.namespace, boundNames.map(({ name }) => name));
    }
    else if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      node.callee.isMemFn = true;
    }
    else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && ['try', 'await'].includes(node.callee.name)) {
      if (!node.arguments.length) {
        throw new Error(`Empty ${node.callee.name} expression`);
      }
      node.arguments[0].catchErrors = true;
    }
    else if (node.type === 'NewExpression') {
      node.ctor.isConstructor = true;
    }

    for (let child of node.children) {
      this.precompile(child, node);
    }

    if (node.type === 'Identifier') {
      if (node.name === 'throw') {
        node.transpile = () => e => { throw e; };
      }
      else if (node.name === 'try') {
        node.transpile = () => ({ result, error }, catchClause) => {
          if (!error) return result;
          return catchClause && catchClause(error);
        }
      }
      else if (node.name === 'await') {
        node.transpile = () => ({ result, error }, staleClause) => ({
          subscribe: subscriber => pull(error || result, value => {
            if (isStale(value)) {
              try {
                value = staleClause();
              }
              catch (error) {
                value = error;
              }
            }
            subscriber(value);
          })
        });
      }
      else if (this.reserved.has(node.name)) {
        throw new Error(`Cannot refer to a reserved word ${node.name} as a dependency`);
      }

      if (this.reserved.has(node.name) || this.builtin.has(node.name) || node.namespace && node.namespace.has(node.name)) {
        node.deps = new Set();
      }
      else {
        // If node.namespace is present (we are inside an arrow function), but does not include the name, then it is still a dependency
        node.deps = new Set([node.name]);
        node.external = node.name;
      }
    }
    else node.deps = Union(...node.children.map(child => child.deps));

    if (['MemberExpression', 'CallExpression', 'NewExpression'].includes(node.type)) {
      const op = assembler(node);
      if (node.isMemFn) {
        // The transpilation will be lifted by the node's CallExpression parent if possible
        node.transpile = transpile((c, ...a) => bind(op(c, ...a), c));
      }
      else JIT_transpile(node, transpile(op), a => isFlow(a) || isSubscribable(a));
    }

    const opOverload = {
      'UnaryExpression': unaryOp,
      'BinaryExpression': binaryOp
    }[node.type];

    const opWhiteList = ['~', '**', '*', '/', '%', '+', '-', '>>>', '<<', '>>', '<=', '>=', '<', '>', '==', '!=', '&', '^', '|'];

    if (opOverload && opWhiteList.includes(node.operator)) {
      JIT_transpile(node, opOverload(node.operator), arg => typeof arg === 'object' || typeof arg === 'function');
    }

    JIT_reactiveFlow(node);

    if (parent === this || node.isArrowFn || node.catchErrors) {
      node.evaluator = this.progressiveEvaluator(node);
    }
  }

  // Only the root node and arrow function root nodes will have evaluators, non-removable

  buildEvaluator(node) {
    const args = node.parent.namespace || [];
    const evalFn = new Function(`{ ${[...args].join(',')} }`, 'return ' + compile(node, true)).bind(this);

    if (!node.catchErrors) return evalFn;

    return context => {
      try {
        return { result: evalFn(context) };
      }
      catch (error) {
        return { error };
      }
    };
  }

  progressiveEvaluator(node) {
    let evaluator = null;

    return Object.assign((context = {}) => {
      if (!evaluator) {
        evaluator = this.buildEvaluator(node);
      }

      let lastEvaluator = evaluator;
      let result = evaluator(context);

      if (node.isArrowFn) {
        const fn = (...args) => {
          if (lastEvaluator !== evaluator) {
            if (!evaluator) {
              evaluator = this.buildEvaluator(node);
            }
            lastEvaluator = evaluator;
            result = evaluator(context);
          }
          return result(...args);
        }

        // Mainly for debug and testing purposes
        fn.signature = () => compile(node, true);
        fn.closure = context;
        return fn;
      }
      return result;
    }, {
      invalidate: () => evaluator = null
    });
  }
}

function invalidate(node) {
  while (!node.evaluator) node = node.parent;
  node.evaluator.invalidate();
}

function JIT_transpile(node, op, shouldTranspile) {
  node.transpile = (...parts) => {
    if (!parts.some(shouldTranspile)) {
      delete node.transpile;
      if (node.callee && node.callee.isMemFn) {
        delete node.callee.transpile;
      }
      invalidate(node);
    }
    else node.transpile = op;
    return op(...parts);
  };
}

function JIT_reactiveFlow(node) {
  node.reactiveFlow = it => {
    if (!isIterator(it)) {
      delete node.reactiveFlow;
      invalidate(node);
      return it;
    }
    else {
      node.reactiveFlow = reactiveFlow;
    }
    return reactiveFlow(it);
  }
}
