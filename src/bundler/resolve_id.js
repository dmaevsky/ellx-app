import { pathToFileURL } from '#url';

import {
  RESOLVE_AS_FILE_OR_DIRECTORY,
  PACKAGE_RESOLVE,
  PACKAGE_IMPORTS_RESOLVE,
  defaultConditions,
  isValidURL
} from './pkg_loader.js';

const localPrefix = 'file://local/root/';

export default function* resolveId(importee, importer, rootDir) {
  const rootURL = rootDir && pathToFileURL(rootDir).href;

  if (importer.startsWith(localPrefix)) {
    if (!rootURL) {
      throw new Error(`Assertion failure: resolving ${importee} from ${importer}: rootURL must be present`);
    }
    importer = rootURL + importer.slice(localPrefix.length);
  }

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

  if (resolved) {
    if (resolved.startsWith('file://')) {

      if (!resolved.startsWith(rootURL)) {
        throw new Error(`Resolving ${importee} from ${importer}: got ${resolved} which is outside the rootURL ${rootURL}`);
      }

      resolved = yield RESOLVE_AS_FILE_OR_DIRECTORY(resolved, rootURL);
    }
  }
  else {
    // Bare module specifier
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
    else if (!importer.startsWith(rootURL)) {
      return null;
    }

    if (importee[0] === '#') {
      ({ resolved } = yield PACKAGE_IMPORTS_RESOLVE(importee, importer, defaultConditions, rootURL));
    }
    else {
      // Note: importee is now a bare specifier.
      resolved = yield PACKAGE_RESOLVE(importee, importer, rootURL);
    }
  }

  if (resolved.startsWith('file://')) {
    if (!resolved.startsWith(rootURL)) {
      throw new Error(`Assertion failure: resolving ${importee} from ${importer}: got ${resolved} which is outside of ${rootURL}`);
    }
    resolved = localPrefix + resolved.slice(rootURL.length);
  }

  if (resolved.includes('%2f') || resolved.includes('%5C')) {
    throw new Error(`Invalid Module Specifier (${importee})`);
  }
  return resolved;
}
