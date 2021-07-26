import tokamak_dynamic from 'tokamak/dynamic';
import { fetchFile } from './fetch';
import { STALE_REQUIRE } from './engine/quack.js';

export default ({
  graph,
  logger = console.debug,
  environment
}) => {
  const loader = {
    *load(id) {
      if (id in graph) return graph[id];

      if (id.startsWith('file://')) {
        throw new Error(`Don't know how to load ${id}`);
      }

      const { url, text } = yield fetchFile(id, logger);

      if (url !== id) return loader.load(url);

      return { id, code: text };
    },

    isFile(url) {
      return url in graph;
    },

    isDirectory(url) {
      if (!url.endsWith('/')) url += '/';
      return Object.keys(graph).some(id => id.startsWith(url));
    }
  };

  const onStale = () => { throw STALE_REQUIRE };

  const requireModule = tokamak_dynamic({ loader, onStale, logger, environment });

  return Object.assign(requireModule, {
    hydrate: cb => requireModule.hydrate(Object.keys(graph), cb)
  });
}
