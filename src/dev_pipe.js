import { join, basename } from 'path';
// import { observable, computed } from 'quarx';
import { tx, derived } from 'tinyx';
import { logger } from 'tinyx/middleware/logger.js'
import { SET, UPDATE } from 'tinyx/middleware/writable_traits.js';
import { promises as fs } from 'fs';
import { nanoid } from 'nanoid';
import chokidar from 'chokidar';
import debounce from 'lodash-es/debounce.js';

import { loadBody } from './sandbox/runtime/body_parse.js';
import { deepEqual } from './sandbox/runtime/utils/object_id.js';

function REMOVE(path) {
  return ({ remove }) => remove(path);
}

export async function startDevPipe(ws, dir) {
  const send = what => ws.send(JSON.stringify(what));

  const projectKey = 'external/' + basename(dir);

  const projectItems = logger(console.log)(tx(new Map()));
  const hydratedSheets = new Map();

  console.log(`[ellx-app]: watching ${dir} for changes`);

  const globs = ['js', 'svelte', 'html', 'ellx', 'md'].map(ext => `${dir}/**/*.${ext}`);

  const watcher = chokidar.watch(globs);

  const add = async path => {
    const contentId = nanoid();
    projectItems.commit(SET, { contentId, hash: 0 }, path);

    if (path.endsWith('.ellx')) {
      const body = await fs.readFile(path, 'utf8');

      send({
        type: 'init',
        args: [contentId, loadBody(body.trim() || 'version: 1.1\nnodes:\nlayout:\n[]')]
      });
      hydratedSheets.set(contentId, path);
    }
  }

  const unlink = path => {
    if (path.endsWith('.ellx')) {
      const contentId = projectItems.get(path, 'contentId');

      send({
        type: 'dispose',
        args: [contentId]
      });
      hydratedSheets.delete(contentId);
    }
    projectItems.commit(REMOVE, path);
  }

  ws.on('message', msg => {
    try {
      const { type, contentId, body } = JSON.parse(msg);
      if (type !== 'serialize' || typeof body !== 'string') return;

      const path = hydratedSheets.get(contentId);
      if (!path) return;

      fs.writeFile(path, body, 'utf8').catch(console.error);
    }
    catch {}
  })

  const change = path => projectItems.commit(UPDATE, hash => hash + 1, path, 'hash');

  watcher
    .on('add', add)
    .on('change', change)
    .on('unlink', unlink);

  const bundleFiles = derived(
    projectItems,
    items => [...items]
      .map(([path, { hash }]) => /\.(js|svelte)$/.test(path) && [path, hash])
      .filter(Boolean),
    deepEqual
  );


  const graph = {
    'ellx://project/key/index.js': {
      code: 'export const app = () => "Welcome to Ellx, yay!!"'
    }
  }

  const namespaces = [
    {
      fullpath: 'project/key/index',
      js: 'mainBundle',
      html: 'mainApp'
    }
  ];

  send({
    type: 'namespaces',
    args: [namespaces]
  });

  send({
    type: 'bundle',
    args: [graph]
  });
}
