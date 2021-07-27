import { conclude, whenFinished } from 'conclure';
import { all } from 'conclure/combinators';
import { createAtom } from 'quarx';
import tokamak_dynamic from 'tokamak/dynamic';
import { fetchFile } from './fetch';
import { STALE_REQUIRE } from './engine/quack.js';

export default ({
  graph,
  logger = console.debug,
  environment
}) => {

  function* hydrateNode(node) {
    const { text } = yield fetchFile(node.src, logger);
    node.code = text;
  }

  const loader = {
    *load(id) {
      if (id in graph) {
        const node = graph[id];

        if (node.src && node.code === undefined) {
          yield hydrateNode(node);
        }
        return node;
      }

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

  const onStale = (url, baseUrl, loadFlow, cancel) => {
    const name = `[loadModule]:${baseUrl}=>${url}`;

    const atom = createAtom(() => cancel, { name });
    whenFinished(loadFlow, ({ cancelled }) => !cancelled && atom.reportChanged());

    atom.reportObserved();

    throw STALE_REQUIRE;
  };

  const requireModule = tokamak_dynamic({ loader, onStale, logger, environment });

  requireModule.hydrate = cb => conclude(all(Object.values(graph).map(hydrateNode)), cb);

  return requireModule;
}
