import { pathToFileURL, fileURLToPath } from 'url';
import { join } from 'path';
import { promises as fs } from 'fs';
import chokidar from 'chokidar';

import { createAtom, computed } from 'quarx';

import { loadBody } from './sandbox/body_parse.js';
import reactiveBuild from './bundler/reactive_build.js';
import * as devEntryPoints from './bootstrap/entry_points.js';

export function startDevPipe(ws, rootDir) {
  const send = what => ws.send(JSON.stringify(what));

  const watchList = new Set();
  const entryPointsAtom = createAtom();

  const entryPoints = computed(() => {
    entryPointsAtom.reportObserved();
    return new Set([...watchList].map(id => id.replace(/[^.]+$/, 'js')))
  }, {
    equals: (a, b) => a && b && a.size === b.size && [...a].every(el => b.has(el))
  });

  const watcher = chokidar.watch(rootDir);
  const srcPath = join(rootDir, 'src');

  const add = async path => {
    if (!path.startsWith(srcPath) || !/\.(html|md|ellx)$/.test(path)) return;

    const id = pathToFileURL(path.slice(rootDir.length)).href;

    watchList.add(id);
    entryPointsAtom.reportChanged();

    if (path.endsWith('.ellx')) {
      const body = await fs.readFile(path, 'utf8');

      send({
        type: 'init',
        args: [id, loadBody(body.trim() || 'version: 1.1\nnodes:\nlayout:\n[]')]
      });
    }
  }

  const unlink = path => {
    const id = pathToFileURL(path.slice(rootDir.length)).href;

    if (!watchList.has(id)) return;

    if (path.endsWith('.ellx')) {
      send({
        type: 'dispose',
        args: [id]
      });
    }

    watchList.delete(id);
    entryPointsAtom.reportChanged();
  }

  ws.on('message', msg => {
    try {
      const { type, contentId, body } = JSON.parse(msg);
      if (type !== 'serialize' || typeof body !== 'string') return;

      const path = join(rootDir, fileURLToPath(contentId));
      fs.writeFile(path, body, 'utf8').catch(console.error);
    }
    catch {}
  });

  let cancelBuild;
  ws.on('close', () => {
    if (cancelBuild) cancelBuild();

    watcher.close()
      .catch(console.error);
  });

  function getEntryPoints() {
    return [
      ...Object.values(devEntryPoints),
      ...entryPoints.get()
    ];
  }

  watcher
    .on('add', add)
    .on('unlink', unlink)
    .on('ready', () => cancelBuild = reactiveBuild(
      getEntryPoints,
      watcher,
      rootDir,
      modules => send({
        type: 'updateModules',
        args: [modules]
      })
    ));
}
