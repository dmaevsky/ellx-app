import { all } from 'conclure/combinators';
import { fetchFile, getFetchFromJSDelivr, DELIVR_CDN } from './fetch';
import tokamak from '../../bundler/tokamak';
import { asyncCell } from './engine/reactive_cell';
import { STALE_REQUIRE } from './engine/quack';
import { conclude } from 'conclure';

function evalUMD(code) {
  return new Function('module', 'exports', 'process', 'global', 'require', code);
}

function instantiateModule(node, _require) {
  const instantiate = node.code;

  const module = node.code = {
    exports: {}
  };

  const process = {
    env: {
      NODE_ENV: 'production'
    },
    cwd: () => '.'
  };

  try {
    instantiate(module, module.exports, process, window, _require);
  }
  catch (error) {
    if (!error.requireStack) {
      error = new Error(`Error instantiating ${node.id}: ${error.message}`);
      error.requireStack = [node.id];
    }
    else error.requireStack.push(node.id);
    throw error;
  }
}

export default (options = {}) => {
  const {
    graph = {},
    logger = console.debug
  } = options;

  const fetchFromJSDelivr = getFetchFromJSDelivr(graph, logger);

  function* fetchModule(url) {
    const fetched = yield (url.startsWith('npm://') || url.startsWith(DELIVR_CDN)
      ? fetchFromJSDelivr(url)
      : fetchFile(url, logger)
    );

    if (url === fetched.url && url.endsWith('.json')) {
      return {
        url,
        text: `module.exports = ${fetched.text}`
      };
    }
    return fetched;
  }

  const loadModule = tokamak({ fetchModule, logger }, graph);

  function requireModule(url, baseUrl) {
    if (!url && baseUrl) {
      // Resolve bundle case
      return graph[baseUrl] && requireModule(baseUrl);
    }

    const node = asyncCell(
      loadModule(url, baseUrl),
      { STALE: STALE_REQUIRE }
    );

    const { id, code, imports = {} } = node;

    if (typeof code === 'object') {
      // Module already evaluated -> return it
      return code.exports;
    }

    if (typeof code !== 'function') {
      node.code = evalUMD(code);
    }

    // Check static dependencies are present
    for (let dependency in imports) {
      const imported = requireModule(dependency, id);

      for (let name of Object.keys(imports[dependency] || {})) {
        if (name !== '*' && name !== 'default' && !(name in imported)) {
          throw new Error(`${name} is not exported from ${dependency} (imported from ${id})`);
        }
      }
    }

    instantiateModule(node, p => requireModule(p, id));
    return node.code.exports;
  }

  requireModule.hydrate = (dependencies, cb) => conclude(all(dependencies.map(id => loadModule(id))), cb);

  return requireModule;
}
