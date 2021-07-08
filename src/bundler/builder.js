import { join } from 'path';
import { promises as fs } from 'fs';
import { getResult } from 'conclure';
import { allSettled } from 'conclure/combinators';
import * as svelte from 'svelte/compiler';
import { transform as jsx } from 'sucrase';

import { DELIVR_CDN, getFetchFromJSDelivr, fetchFile } from '../sandbox/runtime/fetch.js';
import tokamak from './tokamak.js';

function parseAwsError(text) {
  return (/<Message>([^<]*)<\/Message>/.exec(text) || [])[1] || 'Network error';
}

function logByLevel(level, ...messages) {
  console.log(`[${level.toUpperCase()}]`, ...messages);
}

function getFetchCloudFile() {
  const cache = new Map();

  function fromFetchCache(path) {
    return cache.get(path) || cache.get(path + '.js')
      || cache.get(path + '/index.js');
  }

  function setFetchCache(path, value) {
    [path, path + '.js', path + '/index.js'].forEach(i => cache.set(i, value));
  }

  function* fetchFromEllxCDN(fullpath) {
    let paths = [fullpath];

    if (/\/[^.]+$/.test(fullpath)) {
      const isNotRoot = fullpath.split('/')[2];

      paths = [isNotRoot && fullpath + '.js', fullpath + '/index.js'].filter(Boolean);
    }

    const apiUrl = process.env.API_URL || 'https://api.ellx.io';
    const resourceUrl = `${apiUrl}/cdn?${paths.map(i => `paths=` + i).join('&')}`;

    const { text } = yield fetchFile(resourceUrl, logByLevel);

    if (!text) {
      throw new Error(`${fullpath} not found`);
    }

    const item = JSON.parse(text).find(a => a.hash);
    if (!item) {
      throw new Error(`${fullpath} not found`);
    }
    if (item.error) {
      throw new Error(item.error);
    }
    return item;
  }

  return function* fetchCloudFile(id) {
    const fullpath = (/^ellx:\/\/(.+)/.exec(id) || [])[1];
    if (!fullpath) throw new Error(`${id} is not an Ellx cloud URL`);


    const fromCache = fromFetchCache(fullpath);
    const flow = fromCache || fetchFromEllxCDN(fullpath);

    if (!fromCache) {
      setFetchCache(fullpath, flow);
    }

    const {
      url: awsUrl,
      fullpath: resolved,
      hash,
    } = yield flow;

    if (resolved !== fullpath) {
      return { url: 'ellx://' + resolved };
    }

    if (!awsUrl) {
      throw new Error('Could not get a URL for ' + fullpath);
    }

    const headers = awsUrl.endsWith(hash) ? {} : {
      'If-Match': hash
    };

    try {
      const { text } = yield fetchFile(awsUrl, logByLevel, { headers });

      return {
        text,
        url: 'ellx://' + resolved,
      };
    }
    catch (error) {
      throw new Error(parseAwsError(error.message));
    }
  }
}

function* fetchLocally(id, rootDir) {
  const path = (/^ellx:\/\/external\/[^/]+(\/.+)/.exec(id) || [])[1];
  if (!path) throw new Error(`${id} is not a local file`);

  const filename = join(rootDir, path);

  return fs.readFile(filename, 'utf8');
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

  const fetchCloudFile = getFetchCloudFile();
  const fetchFromJSDelivr = getFetchFromJSDelivr(requireGraph, logByLevel);

  function* fetchModule(url) {
    let fetched;

    if (url.startsWith('npm://') || url.startsWith(DELIVR_CDN)) {
      fetched = yield fetchFromJSDelivr(url);
    }
    else if (!url.startsWith('ellx://')) {
      fetched = yield fetchFile(url);
    }
    else if (url.startsWith('ellx://external/')) {
      fetched = {
        url,
        text: yield fetchLocally(url, rootDir)
      };
    }
    else {
      fetched = yield fetchCloudFile(url);
    }

    if (fetched.url !== url) return fetched;  // redirect

    return {
      url,
      text: transformModule(url, fetched.text)
    };
  }

  const loadModule = tokamak({ fetchModule, logger: logByLevel }, requireGraph);

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
