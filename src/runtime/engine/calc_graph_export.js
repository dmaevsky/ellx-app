import { fromObservable } from './adapters.js';

export function exportCalcGraph(id, getCalcGraph) {
  let exportCount = 0;

  return new Proxy({}, {
    has() {
      return true;
    },
    get(_, name) {
      const node = getCalcGraph(id).nodes.get(name);
      if (!node) throw new Error(`${name} not found in ${id}`);

      const nodeId = id + ':' + name;

      return fromObservable(node.currentValue, { name: `Export node: ${nodeId} @${exportCount++}` });
    }
  });
}
