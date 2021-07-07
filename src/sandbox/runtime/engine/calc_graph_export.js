import { fromObservable } from '../adapters';

export function exportCalcGraph(id, getCalcGraph) {
  let exportCount = 0;

  const exports = new Proxy({}, {
    has() {
      return true;
    },
    get(_, name) {
      const node = getCalcGraph().nodes.get(name);
      if (!node) throw new Error(`${name} not found in ${id}`);

      const nodeId = id + ':' + name;

      return {
        id: nodeId,
        ...fromObservable(node.currentValue, { name: `Export node: ${nodeId} @${exportCount++}` })
      };
    }
  });

  return {
    id,
    code: { exports },
    imports: {}
  };
}
