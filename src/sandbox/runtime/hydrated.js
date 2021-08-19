import { observable, computed, createAtom } from 'quarx';
import { STALE_BUNDLE } from './engine/quack.js';
import { logByLevel, graphs, namespaces } from './store.js';
import getRequire from './tokamak_dynamic.js';
import { exportCalcGraph } from './engine/calc_graph_export.js';

const getCalcGraphByUrl = url => {
  if (!url.startsWith('file://') || !url.endsWith('.ellx')) {
    throw new Error(`Don't know how to resolve ${id} ¯\_(ツ)_/¯`);
  }

  for (let family of namespaces.get() || []) {
    for (let type in family) {
      if (url === family.fullpath + '.' + type) {
        const cg = graphs.get(family[type]);
        if (!cg) {
          throw new Error(`${url} is not hydrated`);
        }
        return cg;
      }
    }
  }
  throw new Error(`${url} is not found`);
}

const graphsById = new Map();

const resolveCalcGraph = id => {
  if (graphsById.has(id)) {
    return graphsById.get(id).get();
  }

  const watchId = createAtom(() => {
    console.debug(`${id} observed`, graphsById);
    graphsById.set(id, graph);

    return () => {
      graphsById.delete(id);
      console.debug(`${id} unobserved`, graphsById);
    };
  }, { name: id });

  const graph = computed(() => {
    watchId.reportObserved();
    return exportCalcGraph(id, () => getCalcGraphByUrl(id));
  }, {
    name: 'Export graph:' + id
  });

  return graph.get();
}

export const requireGraph = observable.box(null, { name: 'requireGraph' });
export const resolverMeta = observable.box(null, { name: 'resolverMeta' });

const combinedRequireGraph = computed(() => new Proxy(requireGraph.get() || {}, {
  get: (target, id) => /\.(html|md|ellx)$/.test(id)
    ? resolveCalcGraph(id)
    : target[id]
}), { name: 'combinedRequireGraph' });

const dynamicRequire = computed(() => getRequire({
  graph: combinedRequireGraph.get(),
  resolverMeta: resolverMeta.get(),
  logger: logByLevel
}), { name: 'dynamicRequire' });

const precedence = ['html', 'md', 'ellx'];

export const resolveSiblings = (type, contentId) => precedence.map(member => () => {
  const ns = namespaces.get();
  const family = ns && ns.find(r => r[type] === contentId);

  return family && graphs.get(family[member]);
});

export const resolveRequire = (type, contentId) => url => {
  const require = dynamicRequire.get();

  if (url && !/^(\.|~|\/)/.test(url)) {
    return require(url);
  }

  const ns = namespaces.get();
  const family = ns && ns.find(r => r[type] === contentId);

  if (!family || family.js && !requireGraph.get()) throw STALE_BUNDLE;

  const bundleId = family.fullpath + '.js';

  if (!url) {
    return requireGraph.get()[bundleId] && require(bundleId);
  }

  return require(url, bundleId);
}
