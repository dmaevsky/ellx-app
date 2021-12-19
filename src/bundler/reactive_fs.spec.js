import test from 'ava';
import { autorun } from 'quarx';
import { conclude } from 'conclure';
import { delay } from 'conclure/effects';
import reactveFS from './reactive_fs.js';
import { join, dirname } from 'path';
import { promisify } from 'util';
import chokidar from 'chokidar';

import { fileURLToPath } from 'url';
import { writeFile, unlink } from 'fs/promises';

const rootDir = dirname(fileURLToPath(import.meta.url));

const watcher = chokidar.watch(rootDir);

const gc = new Set();

const files = reactveFS(watcher, {
  rootDir,
  logger: console.debug,
  gc
});

const key = 'file:///test.txt';
const filename = join(rootDir, fileURLToPath(key));

const run = promisify(conclude);

test.after(() => watcher.unwatch(rootDir));

// This test passes, just needs long delays to work properly (because of chokidar)
test.skip('reactive FS', async t => {
  const existsEvents = [];
  const changeEvents = [];

  const stop1 = autorun(() => {
    const flow = files.get(key);
    conclude(flow, (err, body) => changeEvents.push({ err, body }));
  });

  const stop2 = autorun(() => {
    const flow = files.has(key);
    conclude(flow, (err, exists) => existsEvents.push({ err, exists }));
  });

  const steps = [
    () => writeFile(filename, 'FOO'),
    () => writeFile(filename, 'BAR'),
    () => unlink(filename)
  ];

  function* allSteps() {
    for (let step of steps) {
      yield delay(500);
      yield step();
    }
    yield delay(500);
  }

  await run(allSteps());
  stop1();
  stop2();
  for (let dispose of gc) dispose();

  t.deepEqual(existsEvents, [false, true, false].map(exists => ({ err: null, exists })));
  t.deepEqual(changeEvents, [undefined, 'FOO', 'BAR', undefined].map(body => ({ err: null, body })));
});
