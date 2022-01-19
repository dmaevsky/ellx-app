import { MODULE_MANAGER } from './entry_points.js';

const npmDependencies = {
  'conclure':             'file:///node_modules/conclure/src/conclude.js',
  'conclure/combinators': 'file:///node_modules/conclure/src/combinators.js',
  'conclure/effects':     'file:///node_modules/conclure/src/effects.js',
  'quarx':                'file:///node_modules/quarx/index.js',
  'conclure-quarx':       'file:///node_modules/conclure-quarx/src/index.js',
  'rd-parse':             'file:///node_modules/rd-parse/src/index.js',
  'rd-parse-jsexpr':      'file:///node_modules/rd-parse-jsexpr/src/grammar.js',
  'tokamak/resolve':      'file:///node_modules/tokamak/src/resolver.js'
}

function bootstrapResolve(importee, importer) {
  if (importee in npmDependencies) {
    return npmDependencies[importee];
  }

  if (importee.startsWith('file://')) {
    return importee;
  }

  if (/^(\/|\.\/|\.\.\/)/.test(importee)) {
    return new URL(importee, importer).href;
  }

  throw new Error(`Failed to resolve ${importee} from ${importer}`);
}

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

export const bootstrapModules = modules => {
  const exports = {
    removeScript, evalScript
  };

  modules.set('file:///node_modules/@ellx/app/src/bootstrap/bootstrap.js', {
    code: { exports },
    imports: {}
  });

  function requireModule(url, baseUrl) {
    url = bootstrapResolve(url, baseUrl);

    const node = modules.get(url);

    if (!node) {
      throw new Error(`Module ${url} is not found`);
    }

    if (typeof node.code === 'object') {
      return node.code.exports;
    }

    if (typeof node.code === 'string') {
      node.code = evalScript(url, node.code);
    }

    const instantiate = node.code;

    const module = {
      exports: {}
    };

    node.code = module;

    instantiate(module, module.exports, null, window, id => requireModule(id, url));
    return module.exports;
  }

  const { default: ModuleManager } = requireModule(MODULE_MANAGER);

  return exports.Module = ModuleManager(modules);
}
