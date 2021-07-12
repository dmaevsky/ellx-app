import { pathToFileURL } from '#url';

import {
  PACKAGE_RESOLVE,
  PACKAGE_IMPORTS_RESOLVE,
  defaultConditions,
  isValidURL
} from './pkg_loader.js';

export default function* resolveId(importee, importer, rootDir) {
  let resolved;

  if (isValidURL(importee)) {
    resolved = importee;
  }
  else if (/^(\.\/|\.\.\/)/.test(importee)) {
    // Otherwise, if importee starts with "./" or "../", then
    resolved = new URL(importee, importer).href;
  }
  else if (importee[0] === '~' && importer && importer.startsWith('ellx://')) {
    resolved = 'ellx://' + importee.slice(1);
  }
  else if (importee[0] === '/') {
    const projectKey = (/^ellx:\/\/([^/]+\/[^/]+)/.exec(importer) || [])[1];
    if (projectKey) {
      resolved = 'ellx://' + projectKey + importee;
    }
    else {
      resolved = new URL(importee, importer).href;
    }
  }
  else {
    // NPM module
    if (typeof self !== 'undefined') {
      // In a browser
      return 'npm://' + importee;
    }

    const rootURL = pathToFileURL(rootDir).href;

    if (importer.startsWith('ellx://')) {
      const [projectKey, path] = (/^ellx:\/\/([^/]+\/[^/]+)\/(.+)/.exec(importer) || []).slice(1);

      if (!projectKey) {
        throw new Error(`Assertion failure: invalid ellx URL (${importer})`);
      }

      if (projectKey === 'local/root') {
        importer = new URL(path, rootURL).href;
      }
      else {
        importer = new URL(`node_modules/~${projectKey}/${path}`, rootURL).href;
      }
    }

    if (importee[0] === '#') {
      ({ resolved } = yield PACKAGE_IMPORTS_RESOLVE(importee, importer, defaultConditions, rootURL));
    }
    else {
      // Note: importee is now a bare specifier.
      resolved = yield PACKAGE_RESOLVE(importee, importer, rootURL);
    }
    resolved = 'file://local/root/' + resolved.slice(rootURL.length);
  }

  if (resolved.includes('%2f') || resolved.includes('%5C')) {
    throw new Error(`Invalid Module Specifier (${importee})`);
  }
  return resolved;
}
