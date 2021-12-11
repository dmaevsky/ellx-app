import { autorun } from 'quarx';
import { conclude } from 'conclure';
import { delay } from 'conclure/effects';
import reactveFS from './reactive_fs.js';
import { join, dirname } from 'path';

import { fileURLToPath } from 'url';
import { writeFile, unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

const files = reactveFS(__dirname, {
  logger: console.log
});

const key = 'file:///test.txt';
const filename = join(__dirname, fileURLToPath(key));

console.log('Reactively loading', filename);

autorun(() => {
  const flow = files.get(key);
  conclude(flow, (err, body) => console.log({ err, body }));
});

autorun(() => {
  const flow = files.has(key);
  conclude(flow, (err, exists) => console.log({ err, exists }));
});


// const steps = [
//   () => writeFile(filename, 'FOO'),
//   () => writeFile(filename, 'BAR'),
//   () => unlink(filename)
// ];

// function* run() {
//   for (let step of steps) {
//     yield delay(500);
//     yield step();
//   }
// }

// conclude(run(), console.log);
