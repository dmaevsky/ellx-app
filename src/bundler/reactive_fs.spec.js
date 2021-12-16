import test from 'ava';
import { autorun, createAtom } from 'quarx';
import { conclude } from 'conclure';
import { delay } from 'conclure/effects';
import reactveFS from './reactive_fs.js';
import { join, dirname } from 'path';
import { promisify } from 'util';

import { fileURLToPath } from 'url';
import { writeFile, unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

const purgeSignal = createAtom();

const files = reactveFS(__dirname, {
  logger: console.debug,
  invalidator: purgeSignal
});

const key = 'file:///test.txt';
const filename = join(__dirname, fileURLToPath(key));

const run = promisify(conclude);

// This test passes, just needs long delays to work properly (because of chokidar)
test('reactive FS', async t => {
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
  purgeSignal.reportChanged();

  t.deepEqual(existsEvents, [false, true, false].map(exists => ({ err: null, exists })));
  t.deepEqual(changeEvents, [undefined, 'FOO', 'BAR', undefined].map(body => ({ err: null, body })));
});
