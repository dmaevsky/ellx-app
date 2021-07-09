import { basename } from 'path';
import { conclude } from 'conclure';
import { call } from 'conclure/effects';
import { tx, derived } from 'tinyx';
import { logger } from 'tinyx/middleware/logger.js'
import { SET, UPDATE } from 'tinyx/middleware/writable_traits.js';
import { promises as fs } from 'fs';
import { nanoid } from 'nanoid';
import chokidar from 'chokidar';
import debounce from 'lodash-es/debounce.js';

import { loadBody } from './sandbox/runtime/body_parse.js';
import { deepEqual } from './sandbox/runtime/utils/object_id.js';
import { build } from './bundler/builder.js';

function REMOVE(path) {
  return ({ remove }) => remove(path);
}

export function startDevPipe(ws, dir) {
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

  let cancelBundle;

  bundleFiles.subscribe(debounce(files => {
    if (cancelBundle) cancelBundle();

    console.log('Building a new bundle', files);

    const jsFiles = files
      .map(([path]) => 'ellx://' + projectKey + path.slice(dir.length))
      .filter(id => id.endsWith('.js'));

    cancelBundle = conclude(call(function* () {
      // Signal stale bundle
      send({
        type: 'bundle',
        args: [null]
      });

      const graph = yield build(jsFiles, dir);

      send({
        type: 'bundle',
        args: [graph]
      });
    }), e => e && console.error(e));

  }, 50));

  const namespaces = derived(
    projectItems,
    items => {
      const groupByNamespace = [...items]
        .reduce((acc, [path, { contentId }]) => {
          if (!contentId) return acc;

          const type = (/\.(js|md|ellx|html)$/.exec(path) || [])[1];
          if (!type) return acc;

          const ns = projectKey + path.slice(dir.length, path.lastIndexOf('.'));
          const nsRecord = acc.get(ns) || (ns === `${projectKey}/index` ? { html: 'mainApp' } : {});

          acc.set(ns, {
            ...nsRecord,
            [type]: contentId
          });
          return acc;
        }, new Map());

      return [...groupByNamespace].map(([fullpath, family]) => ({ fullpath, ...family }));
    },
    deepEqual
  );

  namespaces.subscribe(debounce(nss => {
    send({
      type: 'namespaces',
      args: [nss]
    });
  }, 10));
}
