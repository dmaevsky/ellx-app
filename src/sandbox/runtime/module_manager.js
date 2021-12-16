import resolver from 'tokamak/resolve';
import { asyncCell } from './engine/reactive_cell.js';
import { exportCalcGraph } from './engine/calc_graph_export.js';
import { observableMap } from './observable_map.js';

export const moduleMap = observableMap(new Map(), { name: 'moduleMap' });

const resolveId = resolver({
  isFile: url => moduleMap.has(url),
  loadPkgJSON: url => moduleMap.get(url)?.code?.exports
});

export function requireModule(url, baseUrl) {
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

  if (typeof node.code === 'object') {
    return node.code.exports;
  }

  const instantiate = node.code;
  const environment = process.env.NODE_ENV || "staging";

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

export function removeModule(id) {
  const existingScript = document.getElementById(id);
  if (existingScript) {
    existingScript.remove();
  }
}

export function evalUMD(id, code) {
  removeModule(id);

  const script = document.createElement('script');
  script.id = id;
  script.append(`//@ sourceURL=${id}\nwindow["${id}"] = function(module, exports, process, global, require){\n${code}\n}`);
  document.body.append(script);

  const result = window[id];
  delete window[id];
  return result;
}
