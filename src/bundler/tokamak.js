import { allSettled } from 'conclure/combinators';
import { transform } from './cjs.js';
import resolveId from './resolve_id.js';
import memoize from './memoize_flow.js';

export default ({ fetchModule, logger }, requireGraph = {}, rootDir = '/') => {

  const resolveCached = memoize(function* resolveCached(fromTo) {
    const [baseUrl, url] = fromTo.split('=>');
    try {
      return yield resolveId(url, baseUrl, rootDir);
    }
    catch {
      return null;
    }
  }, Infinity, requireGraph);

  const loadCached = memoize(load, Infinity, requireGraph);

  function* load(url) {
    const { url: finalUrl, text } = yield fetchModule(url);

    if (finalUrl !== url) {
      return finalUrl;
    }

    return { id: url, code: text };
  }

  function* loadModule(url, baseUrl, loadStack = []) {
    const id = yield resolveCached(`${baseUrl || ''}=>${url}`);
    if (!id || typeof id !== 'string') {
      throw new Error(`Failed to resolve ${url} from ${baseUrl}`);
    }

    try {
      const node = yield loadCached(id);

      if (typeof node === 'string') {
        return loadModule(node, null, loadStack);
      }

      if (loadStack.includes(id)) {
        // Circular reference
        return node;
      }

      if (!node.imports) {
        const {
          code,
          imports = {},
          required = []
        } = transform(node.code);     // node.code is either esm, umd or cjs

        Object.assign(node, { code, imports, required });
      }
      else if (node.src && node.code === undefined) {
        const { text } = yield loadCached(node.src);
        node.code = text;
      }

      loadStack = loadStack.concat(id);

      yield allSettled(Object.keys(node.imports).concat(node.required || [])
        .map(module => loadModule(module, id, loadStack)),
      );

      return node;
    }
    catch (error) {
      const { loc, parserError: e } = error;
      const message = [
        loc && loc.file,
        e && e.loc && `${e.loc.line}:${e.loc.column}`,
        error
      ].filter(Boolean).join(' ');

      logger('info', error, url, baseUrl, loadStack);

      return {
        id,
        code: `throw new Error(${JSON.stringify(message)})`,
        imports: {}
      };
    }
  }

  return loadModule;
}
