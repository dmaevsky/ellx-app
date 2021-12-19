import { autorun } from 'quarx';
import { reactiveFlow } from 'conclure-quarx';
import { conclude, getResult } from 'conclure';
import { allSettled } from 'conclure/combinators';
import tokamak from 'tokamak';
import resolver from 'tokamak/resolve';
import reactiveFS from './reactive_fs.js';
import { preloadEllxProject, transformModule } from './module_loader.js';
import autoMemo from '../common/auto_memoize.js';

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

  const memoize = fn => autoMemo((key, ...args) => {
    return reactiveFlow(bundle[key] = fn(key, ...args));
  }, { gc });

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
      for (let id in bundle) {
        if (/\.(html|md|ellx)$/.test(id)) {
          delete bundle[id];
          continue;
        }

        const { error, result } = getResult(bundle[id]) || { result: 'deleted' };
        if (error) {
          bundle[id] = {
            id,
            code: `throw new Error(${JSON.stringify(error.message || 'Unknown error: ' + error)})`
          };
        }
        else bundle[id] = result;
      }

      updateModules({
        ...bundle,
        ...pjsons
      });

      bundle = {};
      pjsons = {};

      for (let dispose of gc) dispose();
      gc.clear();
    });
  }, { name: 'reactiveBuild' });
}
