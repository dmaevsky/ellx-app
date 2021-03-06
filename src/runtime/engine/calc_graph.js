import { batch, untracked } from 'quarx';
import { observableMap } from './observable_map.js';

import CalcNode from './calc_node.js';
import * as environment from './reserved_words.js';
import * as library from './library.js';

// This will only subscribe to the nodes map if the name is not currently resolvable -> no recalculation on rename
// runTime = false is used when statically checking for circular dependencies (and hence recalculated on node rename as well)
const lookupNode = (cg, identifier, runTime) => runTime && untracked(() => cg.nodes.get(identifier)) || cg.nodes.get(identifier);
const noRequire = url => { if (url) throw new Error('No support for require'); }

export default class CalcGraph {
  constructor(selfId, resolveSibling, require = noRequire) {
    this.nodes = observableMap(new Map(), { name: 'NodesMap' });

    [, this.namespace, this.type] = /^(.+)(\.[^.]+)$/.exec(selfId);
    this.resolveSibling = resolveSibling;
    this.require = require;

    this.maxAutoID = 0;
  }

  resolve(identifier, runTime = true) {
    if (identifier in library) {
      return library[identifier];
    }

    let node = lookupNode(this, identifier, runTime);
    if (node) return node;


    for (let ext of ['.html', '.md', '.ellx']) {
      if (this.type === ext) continue;

      const sibling = this.resolveSibling(this.namespace + ext);

      if (sibling && this !== sibling) {
        node = lookupNode(sibling, identifier, runTime);
        if (node) return node;
      }
    }

    if (!runTime) return null;

    if (typeof window === 'object' && window && identifier in window) return window[identifier];
    if (typeof global === 'object' && global && identifier in global) return global[identifier];

    if (identifier === 'require') return this.require;

    const bundle = this.require(this.namespace + '.js');
    if (bundle && identifier in bundle) return bundle[identifier];

    throw new Error(`${identifier} not defined`);
  }

  validate(identifier) {
    if (!identifier) identifier = '$' + (++this.maxAutoID);
    else {
      identifier = String(identifier);
      const match = /^\$([0-9]+)$/.exec(identifier);
      if (match) {
        const idx = +match[1];
        if (idx > this.maxAutoID) this.maxAutoID = idx;
      }
    }

    if (this.nodes.has(identifier)) {
      throw new Error(`Node ${identifier} is already present in the calculation graph`);
    }

    const restrictedNames = new Set([...environment.reserved, ...environment.builtin, ...Object.keys(library)]);

    if (restrictedNames.has(identifier)) {
      throw new Error(`${identifier} is a reserved word`);
    }
    return identifier;
  }

  insert(identifier, formula) {
    identifier = this.validate(identifier);

    const node = new CalcNode(
      identifier,
      this.resolve.bind(this)
    );
    node.initialize(formula);

    this.nodes.set(identifier, node);   // If there are any dependents already referring to identifier they will be recalculated here
    return node;
  }

  update(identifier, formula) {
    const node = this.nodes.get(identifier);
    if (!node) {
      throw new Error(`Node ${identifier} is not found on the graph`);
    }

    node.initialize(formula);
    return node;
  }

  remove(identifier) {
    const node = this.nodes.get(identifier);
    if (!node) return;

    this.nodes.delete(identifier);

    // This will unsubscribe the dependents from this node and subscribe them to the nodes map instead
    // so when a new node with the same name is inserted they will be recalculated
    node.evaluator.set(() => new Error());
  }

  rename(identifier, newIdentifier, newFormula) {
    const node = this.nodes.get(identifier);
    if (!node) {
      throw new Error(`Node ${identifier} is not found on the graph`);
    }
    node.name = newIdentifier = this.validate(newIdentifier);

    const renamesInOtherNodes = new Map();

    batch(() => {
      node.initialize(newFormula);

      // Rename it in dependent nodes' formulas
      for (let other of this.nodes.values()) if (other !== node && other.parser.dependencies().has(identifier)) {
        other.parser.rename(identifier, newIdentifier);
        renamesInOtherNodes.set(other.name, other.parser.input);
      }

      this.nodes.delete(identifier);         // The dependents will NOT be recalculated
      this.nodes.set(newIdentifier, node);   // If there are any other nodes already referring to newIdentifier they will be recalculated here
    });

    return renamesInOtherNodes;
  }

  merge(subGraph) {
    const newNodes = new Map();

    for (let { identifier, formula } of subGraph) {
      const node = new CalcNode(
        this.validate(this.nodes.has(identifier) ? null : identifier),
        this.resolve.bind(this)
      );
      node.initialize(formula);

      newNodes.set(identifier, node);
    }

    // We haven't calculated any new nodes so far
    // Now fix the internal sub-graph dependencies
    const visited = new Set();

    const rewireDependencies = node => {
      if (visited.has(node)) return;
      visited.add(node);

      for (let dep of node.parser.dependencies()) {
        const depNode = newNodes.get(dep);
        if (!depNode) continue;

        rewireDependencies(depNode);
        if (dep !== depNode.name) node.parser.rename(dep, depNode.name);
      }
    }

    for (let node of newNodes.values()) {
      rewireDependencies(node);

      this.nodes.set(node.name, node);
    }
    return newNodes;
  }

  dispose() {
    this.nodes.clear();
    this.maxAutoID = 0;
  }
}
