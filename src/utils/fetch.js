import { whenFinished } from 'conclure';
import fetch from 'node-fetch';
import AbortController from 'node-abort-controller';
import memoize from './memoize_flow.js';

export function* abortableFetch(url, options) {
  const controller = new AbortController();

  const promise = fetch(url, { ...options, signal: controller.signal });
  whenFinished(promise, ({ cancelled }) => cancelled && controller.abort());

  const res = yield promise;
  const contentType = res.headers.get('Content-Type');

  const body = yield res.text();
  const isJSON = contentType && contentType.includes('application/json');

  if (!res.ok) {
    throw new Error(isJSON && JSON.parse(body).error || res.statusText);
  }

  return {
    url: res.url,
    body,
    isJSON
  };
}

export const fetchFile = memoize(function* doFetch(url, logByLevel = console.debug, options = {}) {
  logByLevel('info', 'Fetching ' + url);

  try {
    const { url: actualUrl, body } = yield abortableFetch(url, options);

    logByLevel('info', 'Fetched ' + url);

    return {
      url: actualUrl,
      text: actualUrl === url && body
    };
  }
  catch (err) {
    logByLevel('info', err.message, url);
    throw err;
  }
}, typeof self !== 'undefined' ? 0 : Infinity); // In the browser rely on browser cache instead

function exists(path, files) {
  const parts = path.split('/').filter(Boolean);
  let item;

  for (let part of parts) {
    item = Array.isArray(files) && files.find(f => f.name === part);
    if (!item) return false;
    files = item.files;
  }
  return item && item.type === 'file';
}

function loadAsFile(path, files) {
  if (path.endsWith('/')) path = path.slice(0, -1);

  if (exists(path, files)) {
    return path;
  }
  if (exists(path + '.js', files)) {
    return path + '.js';
  }

  return loadAsDirectory(path, files);
}

function loadAsDirectory(path, files) {
  if (exists(path + '/package.json', files)) {
    return path + '/package.json';
  }

  if (exists(path + '/index.js', files)) {
    return path + '/index.js';
  }

  throw new Error(`${path} could not be resolved`);
}

export const DELIVR_API = 'https://data.jsdelivr.com/v1/package/';
export const DELIVR_CDN = 'https://cdn.jsdelivr.net/npm/';

export const getFetchFromJSDelivr = (graph, logByLevel = console.debug) => {

  const fetchJSON = memoize(function* fetch(url) {
    const { text } = yield fetchFile(url, logByLevel);
    return JSON.parse(text);
  }, Infinity, graph);

  function* resolveUrl(path, files, packageName) {
    if (!path.endsWith('.min.js')) {
      path = loadAsFile(path, files);
    }
    const resolved = new URL(packageName + path, DELIVR_CDN).href;

    if (resolved.endsWith('/package.json')) {
      const { main, module, svelte } = yield fetchJSON(resolved);

      return new URL(main || svelte || module, resolved).href;
    }
    return resolved;
  }

  function* resolveVersion(packageName, version) {
    if (version) {
      const resolved = yield fetchJSON(DELIVR_API + 'resolve/npm/' + packageName + version);
      return packageName + '@' + resolved.version;
    }

    const { tags } = yield fetchJSON(DELIVR_API + 'npm/' + packageName);
    return packageName + '@' + tags.latest;
  }

  return function* fetchFromJSDelivr(url) {
    const prefix = url.startsWith(DELIVR_CDN) && DELIVR_CDN
      || url.startsWith('npm://') && 'npm://';

    if (!prefix) {
      throw new Error('Not a valid NPM url: ', url);
    }

    const match = /^((?:@[^/]+\/)?[^/@]+)(@[0-9][^/]*)?(.*)/.exec(url.slice(prefix.length));

    const [packageName, version, path] = match.slice(1);

    const resolved = prefix === 'npm://' || !version
      ? yield resolveVersion(packageName, version)
      : packageName + version;

    const { default: entryPoint, files } = yield fetchJSON(DELIVR_API + 'npm/' + resolved);

    if (!files) throw new Error(`JSdelivr API returned no files for ${resolved}`);

    const resolvedUrl = yield resolveUrl(path || entryPoint || '/index.js', files, resolved);

    const body = resolvedUrl === url && (yield fetchFile(url, logByLevel));

    return { url: resolvedUrl, ...body };
  }
}
