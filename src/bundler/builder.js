import { join } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { getResult } from 'conclure';
import { allSettled } from 'conclure/combinators';
import * as svelte from 'svelte/compiler';
import { transform as jsx } from 'sucrase';

import { fetchEllxProject } from './ellx_module_loader.js';
import { DELIVR_CDN, getFetchFromJSDelivr, fetchFile } from '../sandbox/runtime/fetch.js';
import tokamak from './tokamak.js';

function logByLevel(level, ...messages) {
  console.log(`[${level.toUpperCase()}]`, ...messages);
}

function* fetchLocally(id, rootDir) {
  if (id.startsWith('ellx://')) {
    const [projectKey, path] = (/^ellx:\/\/([^/]+\/[^/]+)\/(.+)/.exec(id) || []).slice(1);

    if (!projectKey) {
      throw new Error(`Ellx URL ${id} does not correspond to a file`);
    }

    let packageDir;

    if (projectKey === 'local/root') {
      packageDir = rootDir;
    }
    else {
      packageDir = join(rootDir, 'node_modules/~' + projectKey);
      yield fetchEllxProject(projectKey, packageDir);
    }

    id = join(packageDir, path);
  }
  else {
    id = fileURLToPath(id.replace('file://local/root', 'file://' + rootDir));
  }
  return fs.readFile(id, 'utf8');
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
    return `module.exports = ${text}`;
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

  // if (id.endsWith('.vue')) {
  //   if (!self.vue) {
  //     importScripts("$(CLIENT_URL)/module/VueTransform");
  //   }

  //   return self.vue(text, id, appendStyle);
  // }

  return text;
}

// ================================================================
export function* build(entryPoints, rootDir) {
  const requireGraph = {};

  const fetchFromJSDelivr = getFetchFromJSDelivr(requireGraph, logByLevel);

  function* fetchModule(url) {
    let fetched;

    if (url.startsWith('npm://') || url.startsWith(DELIVR_CDN)) {
      fetched = yield fetchFromJSDelivr(url);
    }
    else if (url.startsWith('ellx://') || url.startsWith('file://')) {
      fetched = {
        url,
        text: yield fetchLocally(url, rootDir)
      };
    }
    else {
      fetched = yield fetchFile(url);
    }

    if (fetched.url !== url) return fetched;  // redirect

    return {
      url,
      text: transformModule(url, fetched.text)
    };
  }

  const loadModule = tokamak({ fetchModule, logger: logByLevel }, requireGraph, rootDir + '/');

  yield allSettled(entryPoints.map(id => loadModule(id)));

  const output = {};

  for (let id in requireGraph) {
    const { error, result } = getResult(requireGraph[id]);
    if (error) {
      output[id] = { code: `throw new Error(${JSON.stringify(error.message || 'Unknown error: ' + error)})` };
    }
    else output[id] = result;
  }
  return output;
}
