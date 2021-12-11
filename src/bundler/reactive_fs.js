import chokidar from 'chokidar';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import { createAtom, batch } from 'quarx';
import autoMemo from '../common/auto_memoize.js';

export default (rootDir, options = {}) => {
  const {
    logger = () => {},
    changeDebounce = 50
  } = options;

  const files = new Map();
  const getPath = key => join(rootDir, fileURLToPath(key));

  const exists = path => fs.stat(path)
    .then(stats => stats.isFile())
    .catch(() => false);

  const load = path => fs.readFile(path, 'utf8')
    .catch((e) => undefined);

  let changedAtoms = new Set();
  let debounceTimeout;

  function reportChanged(atom) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    changedAtoms.add(atom);

    debounceTimeout = setTimeout(() => batch(() => {
      for (let a of changedAtoms) a.reportChanged();
      changedAtoms = new Set();
    }), changeDebounce);
  }

  const watcher = chokidar.watch([], {
    ignoreInitial: true
  });

  watcher.on('all', (event, path) => {
    logger('[ReactiveFS]', event, path);

    const key = pathToFileURL(path.slice(rootDir.length)).href;

    const file = files.get(key);

    if (!file) return;  // Event emitted after the file is unwatched -> just ignore it

    if (event === 'add' || event === 'unlink') {
      reportChanged(file.atom);
    }
    else if (event === 'change') {
      reportChanged(file.atomContents);
    }
  });

  function reportObserved(key) {
    if (files.has(key)) {
      return files.get(key).atom.reportObserved();
    }

    const atom = createAtom(
      () => {
        const path = getPath(key);

        const file = {
          atom,
          atomContents: createAtom(),
        }

        files.set(key, file);
        watcher.add(path);

        logger('[ReactiveFS]', 'watching', path);

        return () => {
          logger('[ReactiveFS]', 'unwatching', path);
          watcher.unwatch(path);
          files.delete(key);
        }
      },
      { name: key }
    );

    return atom.reportObserved();
  }

  return {
    has: autoMemo(key => {
      if (!reportObserved(key)) {
        throw new Error(`[ReactiveFS]: unobserved ${key}`);
      }
      return exists(getPath(key));
    }),

    get: autoMemo(key => {
      if (!reportObserved(key)) {
        throw new Error(`[ReactiveFS]: unobserved ${key}`);
      }

      files.get(key).atomContents.reportObserved();
      return load(getPath(key));
    })
  }
}
