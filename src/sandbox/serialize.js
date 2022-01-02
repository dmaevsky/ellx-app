import Parser from 'rd-parse';
import Grammar from 'rd-parse-jsexpr';
import { isFlow } from 'conclure';
import { isStale } from '../runtime/engine/quack.js';

const FUNC_MARKER = '@@@func';
const ERROR_MARKER = '@@@error';
const PENDING_MARKER = '@@@pending';

export const serialize = (value, depth = 0) => {

  if (typeof value === 'object') {
    if (value instanceof Array) {
      return `[${
        value.map(a => (a !== undefined ? '\n' + ' '.repeat((depth + 1) << 1) + serialize(a, depth + 1) : '')).join(',')
        + '\n' + ' '.repeat(depth << 1)
      }]`
    }
    if (!value) return 'null';

    return `{${
      Object.keys(value)
        .filter(key => value[key] !== undefined)
        .map(key => '\n' + ' '.repeat((depth + 1) << 1) + JSON.stringify(key) + ': ' + serialize(value[key], depth + 1)).join(',')
      + '\n' + ' '.repeat(depth << 1)
    }}`
  }

  return JSON.stringify(value);
}

export const fromAST = node => {
  switch (node.type) {
    case 'Literal': return node.value;
    case 'UnaryExpression': {
      if (node.operator === '-') return -fromAST(node.argument);
      throw new Error('Unrecognized UnaryExpression node');
    }
    case 'EmptyElement': return undefined;
    case 'ArrayLiteral': return node.elements.map(fromAST);
    case 'ObjectLiteral': return Object.fromEntries(node.properties.map(({ name, value }) => [fromAST(name), fromAST(value)]));
    default: throw new Error('Unrecognized node type ' + node.type);
  }
}

export const deserialize = input => {
  const parser = Parser(Grammar);
  return fromAST(parser(input));
}

// We can have functions in the sheet. Make sure they are at least accounted for during serialization
const replacer = function(key, value) {
  if (isFlow(value) || isStale(value)) return PENDING_MARKER;
  if (typeof(value) === 'function') return FUNC_MARKER;
  if (value instanceof Error) return ERROR_MARKER;
  // TODO: treat properly Symbols, Dates, etc
  return value;
}

const reviver = function(key, value) {
  if (value === FUNC_MARKER) {
    return () => { throw new Error(`Function ${key} has not been constructed yet`); }
  }
  else if (value === ERROR_MARKER) return new Error('Evaluation or parsing error');
  else if (value === PENDING_MARKER) return new Error('Calculation was pending at save');
  return value;
}

// To and from JS plain old data objects
// TODO: manage recursive objects

export const toJS = (value, key) => {
  value = replacer(key, value);
  if (typeof value === 'object' && value !== null) {
    if (typeof value.toJS === 'function') return value.toJS();

    let result = value instanceof Array ? [] : {};
    for (let p of Object.keys(value)) result[p] = toJS(value[p], p);
    return result;
  }
  return value;
}

export const fromJS = (serializedValue, key) => {
  if (typeof serializedValue === 'object' && serializedValue !== null) {
    let result = serializedValue instanceof Array ? [] : {};
    for (let p of Object.keys(serializedValue)) result[p] = fromJS(serializedValue[p], p);
    return result;
  }
  return reviver(key, serializedValue);
}
