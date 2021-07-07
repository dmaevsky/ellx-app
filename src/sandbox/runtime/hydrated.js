import { observable, computed, createAtom } from 'quarx';
import { STALE_BUNDLE } from './engine/quack';
import { logByLevel, graphs, namespaces } from './store';
import getRequire from './tokamak_dynamic';
import { exportCalcGraph } from './engine/calc_graph_export';

const getCalcGraphByUrl = url => {
  if (!url.startsWith('ellx://')) {
    throw new Error(`Don't know how to resolve ${id} ¯\_(ツ)_/¯`);
  }

  const fullpath = url.slice(7);

  for (let family of namespaces.get() || []) {
    for (let type in family) {
      if (fullpath === family.fullpath + '.' + type) {
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

const combinedRequireGraph = computed(() => new Proxy(requireGraph.get() || {}, {
  get: (target, id) => /\.(html|md|ellx)$/.test(id)
    ? resolveCalcGraph(id)
    : target[id]
}), { name: 'combinedRequireGraph' });

const dynamicRequire = computed(() => getRequire({
  graph: combinedRequireGraph.get(),
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

  if (url && !/^(\.|~|\/|ellx:\/\/)/.test(url)) {
    return require(url);
  }

  const ns = namespaces.get();
  const family = ns && ns.find(r => r[type] === contentId);

  if (!family || family.js && !requireGraph.get()) throw STALE_BUNDLE;

  const bundleId = 'ellx://' + family.fullpath + '.js';
  return require(url, bundleId);
}
