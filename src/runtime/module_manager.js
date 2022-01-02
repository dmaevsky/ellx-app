import resolver from 'tokamak/resolve';
import { isFlow } from 'conclure';
import { asyncCell } from './engine/reactive_cell.js';
import { exportCalcGraph } from './engine/calc_graph_export.js';
import CalcGraph from './engine/calc_graph.js';
import { observableMap } from './engine/observable_map.js';

function removeScript(id) {
  const existingScript = document.getElementById(id);
  if (existingScript) {
    existingScript.remove();
  }
}

function evalScript(id, code) {
  removeScript(id);

  const script = document.createElement('script');
  script.id = id;
  script.append(`//@ sourceURL=${id}\nwindow["${id}"] = function(module, exports, process, global, require){\n${code}\n}`);
  document.body.append(script);

  const result = window[id];
  delete window[id];
  return result;
}

export default (map = new Map(), environment = 'staging') => {
  const moduleMap = observableMap(map, { name: 'moduleMap' });

  const resolveId = resolver({
    isFile: url => moduleMap.has(url),
    loadPkgJSON: url => moduleMap.get(url)?.code?.exports
  });

  function requireModule(url, baseUrl) {
    if (baseUrl && baseUrl !== url) {
      const resolvedUrl = asyncCell(resolveId(url, baseUrl), { name: `[Resolve]: ${url} <- ${baseUrl}`});

      if (!resolvedUrl) {
        throw new Error(`Cannot resolve ${url} from ${baseUrl}`);
      }
      url = resolvedUrl;
    }

    const getModule = () => {
      const node = moduleMap.get(url);

      if (!node) {
        throw new Error(`Module ${url} is not found`);
      }

      return node;
    }

    if (/\.(html|md|ellx)$/.test(url)) {
      return exportCalcGraph(url, getModule);
    }

    const node = getModule();

    if (isFlow(node.code)) {
      node.code = asyncCell(node.code, { name: `Loading ${url}`});
    }

    if (typeof node.code === 'object') {
      return node.code.exports;
    }

    if (typeof node.code === 'string') {
      node.code = evalScript(url, node.code);
    }

    const instantiate = node.code;

    // We need to put an empty module first in order to handle circular deps
    const module = {
      exports: {}
    };

    node.code = module;

    try {
        // Check static dependencies are present
      for (let dependency in node.imports) {
        const imported = requireModule(dependency, url);

        for (let name in node.imports[dependency] || {}) {
          if (name !== '*' && name !== 'default' && !(name in imported)) {
            throw new Error(`${name} is not exported from ${dependency} (imported from ${url})`);
          }
        }
      }

      const process = {
        env: {
          NODE_ENV: environment
        },
        cwd: () => '.'
      };

      instantiate(module, module.exports, process, window, id => requireModule(id, url));
      return module.exports;
    }
    catch (error) {
      // Revert state to "uninstantiated" on error
      node.code = instantiate;

      if (error instanceof Error) {
        if (!error.requireStack) {
          error.requireStack = [url];
        }
        else error.requireStack.push(url);
      }
      throw error;
    }
  }

  function removeModule(id) {
    const module = map.get(id);
    if (!module) return;

    if (module instanceof CalcGraph) {
      if (module.dispose) module.dispose();
    }
    else {
      removeScript(id);
    }
    moduleMap.delete(id);
  }

  return {
    get: url => moduleMap.get(url),
    set: (url, module) => moduleMap.set(url, module),
    require: requireModule,
    remove: removeModule
  };
}
