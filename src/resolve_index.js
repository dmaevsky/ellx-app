import { join } from 'path';
import { readFile } from 'fs/promises';

export async function resolveIndex(publicDir, rootDir) {
  let indexHTML;

  try {
    indexHTML = await readFile(join(rootDir, 'src/index.html'), 'utf8');
  }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    indexHTML = await readFile(join(publicDir, 'default_index.html'), 'utf8');
  }

  if (!indexHTML.includes('</head>')) {
    throw new Error('index.html should have a <head>...</head> section');
  }

  return indexHTML.replace('</head>', `
    <script type="module" src="/sandbox.js"></script>
    <link id="stylesheet" rel="stylesheet" type="text/css" href="/sandbox.css">
    </head>
  `);
}
