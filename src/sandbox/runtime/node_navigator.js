import store, { oActiveContentId, contents, graphs, namespaces } from './store';
import { UPDATE_CONTENT } from './mutations';
import { computed } from 'quarx';

const getNodes = graph => graph && graph.nodes ? [...graph.nodes.toJS()] : [];

function getNodeProcessor(allNodes) {
  return ([id, node]) => ({
    id,
    deps: [...node.parser.dependencies()],
    dependants: allNodes
      .filter(([, node]) => node.parser.dependencies().has(id))
      .map(([id]) => id),
    isError: node.currentValue.get() instanceof Error,
    size: node.parser.dependencies().size,
    toString: () => {
      const formula = node.parser.input;

      if (id.startsWith('$')) {
        return formula;
      }
      return `${id} = ${formula}`;
    }
  });
}

function processGraph(nodes, type, contentId) {
  return type !== 'ellx' ? nodes.reverse() : nodes.map(n => ({
    ...n,
    select: () => {
      const content = contents.get(contentId);
      if (!content.blocks) return;

      const block = [...content.blocks.values()].find(b => b.node === n.id);
      if (block) {
        store.commit(
          UPDATE_CONTENT,
          {
            contentId,
            selection: block.position
          }
        );
      }
    },
  }));
}

export const types = ['ellx', 'html', 'md'];

export const activeNodes = computed(() => {
  const activeContentId = oActiveContentId.get();
  const namespace = (namespaces.get() || []).find(r => Object.values(r).includes(activeContentId));

  if (!namespace) return {};

  const activeGraphs = Object.fromEntries(types.map(t => [t, graphs.get(namespace[t])]));
  const allNodes = Object.values(activeGraphs).reduce((acc, cur) => [...acc, ...getNodes(cur)], []);
  const processor = getNodeProcessor(allNodes);

  return Object.fromEntries(
    types
      .filter(t => activeGraphs[t])
      .map(t => [t, processGraph(getNodes(activeGraphs[t]).map(processor), t, namespace[t])])
  );
}, { name: 'activeNodes' });
