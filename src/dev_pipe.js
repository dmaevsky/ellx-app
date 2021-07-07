import { join, basename } from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';

const { stat, readFile, readdir, mkdir, writeFile, rmdir, unlink, rename, copyFile } = fs.promises;

// import { observableMap } from './sandbox/runtime/observable_map.js';

import chokidar from 'chokidar';

async function collectAppFiles(dir) {
  const items = await readdir(dir, { withFileTypes: true });

  const files = await Promise.all(items.map(async item => {
    const fullname = join(dir, item.name);

    if (item.isDirectory()) {
      return collectAppFiles(fullname);
    }

    if (item.isFile() && /\.(ellx|js|svelte)$/.test(item.name)) {
      return [[fullname, nanoid()]];
    }
  }));
  return files.filter(Boolean).flat();
}


export async function startDevPipe(ws, dir) {
  // const projectKey = 'external/' + basename(dir);

  const files = await collectAppFiles(dir);
  console.log(files);

  console.log(`[ellx-app]: watching ${dir} for changes`);

  // const globs = ['js', 'svelte'].map(ext => `${dir}/**/*.${ext}`);

  // const watcher = chokidar.watch(globs);

  const send = what => ws.send(JSON.stringify(what));


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


// ws => {
//   ws.on('message', message => {
//     console.log('received: %s', message);
//   });

// });



// import { filterMessages, sendToFrame } from 'ellx/utils/messaging';
// import { loadBody } from './body_parse';

// export default function Spreadsheet(frameId, contentId) {
//   const select = what => ({ contentId: cid, type }) => cid === contentId && type === what;

//   function init(body, onChange) {
//     sendToFrame(frameId, {
//       type: 'init',
//       args: [contentId, body && loadBody(body)]
//     });

//     const listener = filterMessages(
//       frameId,
//       select('serialize'),
//       ({ body: b }) => onChange(b)
//     );
//     window.addEventListener('message', listener);

//     serialize();

//     return function dispose() {
//       window.removeEventListener('message', listener);

//       sendToFrame(frameId, {
//         type: 'dispose',
//         args: [contentId]
//       });
//     };
//   }

//   function update() {
//     throw new Error('Update is not implemented for the sheet model');
//   }

//   async function serialize() {
//     const { body } = await sendToFrame(
//       frameId, {
//         type: 'serialize',
//         args: [contentId]
//       },
//       select('serialize')
//     );
//     return body;
//   }

//   return { init, serialize, update };
// }
