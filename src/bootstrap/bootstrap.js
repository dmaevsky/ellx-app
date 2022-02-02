const npmDependencies = {
  'conclure':             'file:///node_modules/conclure/src/conclude.js',
  'quarx':                'file:///node_modules/quarx/index.js',
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

const isPromise = p => p && typeof p.then === 'function';

export const asyncRetry = f => async (...args) => {
  while (true) {
    try {
      return f(...args);
    }
    catch (e) {
      if (!isPromise(e)) throw e;
      await e;
    }
  }
}

const retry = f => {
  const retryf = asyncRetry(f);

  return (...args) => {
    try {
      return f(...args);
    }
    catch (e) {
      if (!isPromise(e)) throw e;
      throw e.then(() => retryf(...args));
    }
  }
}

export const bootstrapRequire = (resolveNode, environment = 'staging') => {

  const requireModule = retry((url, baseUrl) => requireNode(resolveNode(url, baseUrl)));

  function requireNode(node) {
    if (typeof node.code === 'object') {
      if (isPromise(node.code)) {
        throw node.code;
      }

      return node.code.exports;
    }

    if (typeof node.code === 'string') {
      node.code = evalScript(node.id, node.code);
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
        const imported = requireModule(dependency, node.id);

        for (let name in node.imports[dependency] || {}) {
          if (name !== '*' && name !== 'default' && !(name in imported)) {
            throw new Error(`${name} is not exported from ${dependency} (imported from ${node.id})`);
          }
        }
      }

      const process = {
        env: {
          NODE_ENV: environment
        },
        cwd: () => '.'
      };

      instantiate(module, module.exports, process, window, id => requireModule(id, node.id));
      return module.exports;
    }
    catch (e) {
      // Revert state to "uninstantiated"
      node.code = instantiate;

      if (e instanceof Error) {
        if (!e.requireStack) {
          e.requireStack = [node.id];
        }
        else e.requireStack.push(node.id);
      }
      throw e;
    }
  }

  return requireModule;
}

export function prefetch(nodes) {
  for (let node of nodes) {
    if (!node.src || node.code) continue;

    node.code = fetch(node.src)
      .then(res => res.text())
      .then(code => node.code = code)
      .catch(console.error);
  }
}

const MODULE_MANAGER = 'file:///node_modules/@ellx/app/src/runtime/module_manager.js';

export async function bootstrapModule(modules, environment = 'staging') {
  const moduleMap = new Map(Object.entries(modules));

  const resolveNode = (url, baseUrl) => {
    url = bootstrapResolve(url, baseUrl);

    const node = moduleMap.get(url);

    if (!node) {
      throw new Error(`Module ${url} is not found`);
    }
    return node;
  }

  const asyncRequire = asyncRetry(bootstrapRequire(resolveNode, environment));

  const { default: ModuleManager } = await asyncRequire(MODULE_MANAGER);

  return ModuleManager(moduleMap, bootstrapRequire, environment);
}
