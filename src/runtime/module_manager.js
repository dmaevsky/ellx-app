import resolver from 'tokamak/resolve';
import { asyncCell } from './engine/reactive_cell.js';
import { exportCalcGraph } from './engine/calc_graph_export.js';
import { observableMap } from './engine/observable_map.js';

export default (map = new Map(), bootstrapRequire, environment = 'staging') => {
  const moduleMap = observableMap(map, { name: 'moduleMap' });

  const getModule = url => {
    const node = moduleMap.get(url);

    if (!node) {
      throw new Error(`Module ${url} is not found`);
    }

    return node;
  }

  const resolveId = resolver({
    isFile: url => moduleMap.has(url),
    loadPkgJSON: url => moduleMap.get(url)?.code?.exports
  });

  function resolveNode(url, baseUrl) {
    if (baseUrl && baseUrl !== url) {
      const resolvedUrl = asyncCell(resolveId(url, baseUrl), { name: `[Resolve]: ${url} <- ${baseUrl}`});

      if (!resolvedUrl) {
        throw new Error(`Cannot resolve ${url} from ${baseUrl}`);
      }
      url = resolvedUrl;
    }

    if (/\.(html|md|ellx)$/.test(url)) {
      return {
        code: {
          exports: exportCalcGraph(url, getModule),
        },
        imports: {}
      };
    }

    const node = getModule(url);

    // Make sure we retry reactively
    asyncCell(node.code, { name: `Loading ${url}`});

    return node;
  }

  function removeModule(id) {
    const module = map.get(id);
    if (!module) return;

    if (/\.(html|md|ellx)$/.test(id)) {
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
    require: bootstrapRequire(resolveNode, environment),
    remove: removeModule
  };
}
