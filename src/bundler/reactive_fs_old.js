import chokidar from 'chokidar';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fs } from 'fs';
import { createAtom, batch } from 'quarx';
import { call } from 'conclure/effects';

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

    if (event === 'add') {
      file.exists = true;
      file.body = call(load, path);
      reportChanged(file.atom);
    }
    else if (event === 'change') {
      file.body = call(load, path);
      reportChanged(file.atomContents);
    }
    else if (event === 'unlink') {
      file.exists = false;
      file.body = undefined;
      reportChanged(file.atom);
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
          exists: exists(path),
          body: call(load, path)
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
    has(key) {
      if (reportObserved(key)) {
        return files.get(key).exists;
      }

      throw new Error(`[ReactiveFS]: unobserved ${key}`);
      return exists(getPath(key));
    },

    get(key) {
      if (reportObserved(key)) {
        const file = files.get(key);
        file.atomContents.reportObserved();
        return file.body;
      }

      throw new Error(`[ReactiveFS]: unobserved ${key}`);
      return load(getPath(key));
    }
  }
}
