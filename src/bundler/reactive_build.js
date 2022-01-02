import { autorun, createAtom } from 'quarx';
import { reactiveFlow } from 'conclure-quarx';
import { conclude } from 'conclure';
import { allSettled } from 'conclure/combinators';
import tokamak from 'tokamak';
import resolver from 'tokamak/resolve';
import reactiveFS from './reactive_fs.js';
import { preloadEllxProject, transformModule } from './module_loader.js';
import autoMemo from '../utils/auto_memoize.js';

export default function reactiveBuild(getEntryPoints, fsWatcher, rootDir, updateModules) {
  const gc = new Set();

  const files = reactiveFS(fsWatcher, {
    rootDir,
    logger: console.debug,
    gc
  });

  let bundle = {};
  let pjsons = {};

  function* loadPkgJSON(url) {
    const pjson = yield files.get(url);
    return pjsons[url] = pjson && JSON.parse(pjson);
  }

  function* load(url) {
    if (!url.startsWith('file://')) {
      throw new Error(`Don't know how to load ${url}`);
    }

    if (/\.(html|md|ellx)$/.test(url)) {
      return '';
    }

    yield preloadEllxProject(url, rootDir);

    const body = yield files.get(url);

    if (body === undefined) {
      throw new Error(`${url} not found`);
    }

    return transformModule(url, body);
  }

  function* isFile(url) {
    if (/\.(html|md|ellx)$/.test(url)) {
      return true;
    }

    yield preloadEllxProject(url, rootDir);
    return files.has(url);
  }

  const resolveId = resolver({
    isFile,
    loadPkgJSON: autoMemo(loadPkgJSON, { gc })
  });

  function* assembleBundle(fn, key, ...args) {
    createAtom(() => () => {
      if (!bundle[key]) bundle[key] = 'deleted';
    }).reportObserved();

    try {
      bundle[key] = yield fn(key, ...args);
    }
    catch (error) {
      bundle[key] = {
        id: key,
        code: `throw new Error(${JSON.stringify(error.message || 'Unknown error: ' + error)})`
      };
    }
    return bundle[key];
  }

  const memoize = fn => autoMemo((...args) => reactiveFlow(assembleBundle(fn, ...args)), { gc });

  const loadModule = tokamak({
    resolveId,
    load,
    memoize,
    logger: console.debug
  });

  let cancel;

  return autorun(() => {
    if (cancel) cancel();

    const entryPoints = getEntryPoints();
    console.log('Incremental build', entryPoints);

    cancel = conclude(reactiveFlow(allSettled(entryPoints.map(id => loadModule(id)))), () => {
      for (let dispose of gc) dispose();
      gc.clear();

      for (let id in bundle) {
        if (/\.(html|md|ellx)$/.test(id)) {
          delete bundle[id];
          continue;
        }
      }

      updateModules({
        ...bundle,
        ...pjsons
      });

      bundle = {};
      pjsons = {};
    });
  }, { name: 'reactiveBuild' });
}
