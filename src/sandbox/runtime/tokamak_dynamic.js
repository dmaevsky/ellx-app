import { conclude, whenFinished } from 'conclure';
import { all } from 'conclure/combinators';
import { createAtom } from 'quarx';
import tokamak_dynamic from 'tokamak/dynamic';
import { fetchFile } from './fetch';
import { STALE_REQUIRE } from './engine/quack.js';

export default ({
  graph,
  resolverMeta,
  logger = console.debug,
  environment
}) => {

  function* hydrateNode(node) {
    const { text } = yield fetchFile(node.src, logger);
    return {
      ...node,
      code: text
    };
  }

  const loader = {
    *load(id) {
      if (id in resolverMeta) {
        return resolverMeta[id];
      }

      if (id.startsWith('file://')) {
        throw new Error(`Don't know how to load ${id}`);
      }

      // Fetching over the network
      const { url, text } = yield fetchFile(id, logger);

      if (url !== id) return loader.load(url);
      return text;
    },

    isFile(url) {
      return url in graph || url in resolverMeta;
    },

    isDirectory(url) {
      if (!url.endsWith('/')) url += '/';
      return Object.keys(graph).some(id => id.startsWith(url));
    }
  };

  const memoize = fn => (id, ...args) => {
    if (id in graph) return graph[id];

    return graph[id] = fn(id, ...args);
  }

  const onStale = (url, baseUrl, loadFlow, cancel) => {
    const name = `[loadModule]:${baseUrl}=>${url}`;

    const atom = createAtom(() => cancel, { name });
    whenFinished(loadFlow, ({ cancelled }) => !cancelled && atom.reportChanged());

    atom.reportObserved();

    throw STALE_REQUIRE;
  };

  const requireModule = tokamak_dynamic({
    loader,
    memoize,
    onStale,
    logger,
    environment
  });

  requireModule.hydrate = (nodes, cb) => conclude(all(nodes.map(node => graph[node.id] = hydrateNode(node))), cb);

  return requireModule;
}
