import { join } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { getResult } from 'conclure';
import { allSettled } from 'conclure/combinators';
import tokamak from 'tokamak';
import * as svelte from 'svelte/compiler';
import { transform as jsx } from 'sucrase';

import { fetchEllxProject } from './ellx_module_loader.js';
import memoize from '../common/memoize_flow.js';

function logByLevel(level, ...messages) {
  console.log(`[${level.toUpperCase()}]`, ...messages);
}

const ellxProjectPrefix = 'file:///node_modules/~';

function* preloadEllxProject(id, rootDir) {
  if (!id.startsWith(ellxProjectPrefix)) return;

  const [owner, project] = id.slice(ellxProjectPrefix.length).split('/');

  if (!project || ['package.json', 'index.js', 'node_modules'].includes(project)) {
    return 'partial';
  }

  const packageDir = join(rootDir, `node_modules/~${owner}/${project}`);
  yield fetchEllxProject(`${owner}/${project}`, packageDir);
}

function* fetchLocally(id, rootDir) {
  yield preloadEllxProject(id, rootDir);

  return fs.readFile(join(rootDir, fileURLToPath(id)), 'utf8');
}

function* isDirectory(id, rootDir) {
  if ((yield preloadEllxProject(id, rootDir)) === 'partial') return true;

  try {
    const stats = yield fs.stat(join(rootDir, fileURLToPath(id)));
    return stats.isDirectory();
  }
  catch {
    return false;
  }
}

function* isFile(id, rootDir) {
  yield preloadEllxProject(id, rootDir);

  try {
    const stats = yield fs.stat(join(rootDir, fileURLToPath(id)));
    return stats.isFile();
  }
  catch {
    return false;
  }
}

function appendStyle(str) {
  if (!str) return '';

  return `
    var css = ${JSON.stringify(str)};
    var head = document.getElementsByTagName('head')[0];
    var s = document.createElement('style');
    s.setAttribute('type', 'text/css');
    if (s.styleSheet) {
      s.styleSheet.cssText = css;
    } else {
      s.appendChild(document.createTextNode(css));
    }
    head.appendChild(s);
  `
}

function transformModule(id, text) {
  if (id.endsWith('.svelte')) {
    const result = svelte.compile(text, {
      generate: 'dom',
      format: 'esm',
      filename: 'Component.svelte'
    });

    // TODO: report compile errors / warnings
    return result.js.code;
  }

  // TODO: write a proper loader for sheets instead of a runtime Proxy mumbo-jumbo
  if (id.endsWith('.ellx')) {
    return '';
  }

  if (id.endsWith('.json')) {
    return JSON.parse(text);  // NOT returning a string but an already evaluated code
  }

  if (id.endsWith('.css')) {
    return appendStyle(text);
  }

  if (id.endsWith('.glsl')) {
    return `export default ${JSON.stringify(text)};`;
  }

  if (id.endsWith('.jsx')) {
    return jsx(text, { transforms: ['jsx'] }).code;
  }

  return text;
}

// ================================================================
export function* build(entryPoints, rootDir) {
  const requireGraph = {};

  const loader = {
    load: memoize(function* load(url) {
      if (!url.startsWith('file://')) {
        throw new Error(`Don't know how to load ${url}`);
      }

      return {
        id: url,
        code: transformModule(url, yield fetchLocally(url, rootDir))
      }
    }, Infinity, requireGraph),

    isDirectory(url) {
      if (!url.endsWith('/')) url += '/';

      if (Object.keys(requireGraph).some(id => id.startsWith(url))) {
        return true;
      }

      return isDirectory(url, rootDir);
    },

    isFile(url) {
      if (url in requireGraph) return true;

      return isFile(url, rootDir);
    }
  };

  const loadModule = tokamak({
    loader,
    logger: logByLevel
  });

  yield allSettled(entryPoints.map(id => loadModule(id)));

  const output = {};

  for (let id in requireGraph) {
    const { error, result } = getResult(requireGraph[id]);
    if (error) {
      output[id] = {
        id,
        code: `throw new Error(${JSON.stringify(error.message || 'Unknown error: ' + error)})`
      };
    }
    else output[id] = result;
  }
  return output;
}
