import { all } from 'conclure/combinators';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import md5 from 'md5';
import { build } from './bundler/builder.js';
import { abortableFetch } from './sandbox/runtime/fetch.js';
import { loadBody as parseEllx } from './sandbox/runtime/body_parse.js';

function* collectEntryPoints(dir) {
  const items = yield readdir(dir, { withFileTypes: true });

  const files = yield all(items.map(function* (item) {
    const fullname = join(dir, item.name);

    if (item.isDirectory()) {
      return collectEntryPoints(fullname);
    }

    if (item.isFile() && /\.(ellx|js)$/.test(item.name)) {
      return [fullname];
    }
  }));
  return files.filter(Boolean).flat();
}

export function *deploy(rootDir, env) {
  const authJson = JSON.parse(yield readFile(`${rootDir}/.ellx_auth.json`, 'utf8'));

  const { apiUrl, appId, token, domain } = authJson[env] || {};

  if (!apiUrl || !appId || !token || !domain) {
    throw new Error(`Environment ${env} not found or incomplete in .ellx_auth.json`);
  }

  const localPrefix = 'ellx://local/root';

  const files = (yield collectEntryPoints(`${rootDir}/src`))
    .map(path => path.slice(rootDir.length));

  // Make the bundle
  const jsFiles = files
    .map(path => localPrefix + path)
    .filter(id => id.endsWith('.js'));

  console.log('Start bundling...');

  const graph = yield build(jsFiles, rootDir);

  console.log(`Bundle ready. Generated ${Object.keys(graph).length} entries`);

  // Extract the files to deploy and calculate their hashes
  const toDeploy = new Map();

  const appendFile = (path, code) => {
    const hash = md5(code);
    const hashedPath = path.replace(/\.[^.]*$/, ext => '-' + hash.slice(0, 8) + ext);

    toDeploy.set(hashedPath, code);
    return 'https://' + domain + hashedPath;
  }

  for (let id in graph) {
    const { code } = graph[id];

    if (code !== undefined) {
      delete graph[id].code;

      const path = id.startsWith('ellx://') && !id.startsWith('ellx://local/root/')
        ? '/node_modules/~' + id.slice(7)
        : id.slice(localPrefix.length);

      graph[id].src = appendFile(path, code);
    }
  }

  // Load all sheets
  const sheets = Object.fromEntries(
    yield all(files
      .filter(path => path.endsWith('.ellx'))
      .map(function* loadSheet(path) {
        const { nodes } = parseEllx(yield readFile(join(rootDir, path), 'utf8'));
        return [localPrefix + path, nodes];
      })
    )
  );

  const requireGraphSrc = appendFile('/requireGraph.js', 'var requireGraph = ' + JSON.stringify(graph));
  const sheetsSrc = appendFile('/sheets.js', 'var sheets = ' + JSON.stringify(sheets));
  const runtimeSrc = appendFile('/Runtime.js', yield readFile(join(rootDir, 'node_modules/@ellx/app/dist/runtime.js'), 'utf8'));

  // Prepare index.html body
  const injection = `
      <script src="${requireGraphSrc}" defer></script>
      <script src="${sheetsSrc}" defer></script>
      <script src="${runtimeSrc}" defer onload="Runtime(requireGraph, sheets, '${env}')"></script>
  `;

  const indexHtml = (yield readFile(join(rootDir, 'node_modules/@ellx/app/public/sandbox.html'), 'utf8'))
    .replace(`<link rel="stylesheet" href="/sandbox.css">`, injection)
    .replace('</body>', `<div id="ellx-app"><div data-ellx-node-name="init" data-ellx-node-formula="app()"></div></div>
      </body>`);

  toDeploy.set('/index.html', indexHtml);

  console.log(`Deploying ${toDeploy.size} files...`);
  console.log('Get deployment URLs...');

  const publishUrl = `${apiUrl}/publish/${appId}`;

  const { body } = yield abortableFetch(publishUrl, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Cookie': `samesite=1; token=${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [...toDeploy].map(([path]) => path),
      domain,
      enable: true
    })
  });

  console.log('Deploy to S3...');

  yield all(JSON.parse(body)
    .map(({ path, url }) => abortableFetch(url, {
      method: 'PUT',
      body: toDeploy.get(path),
      headers: {
        'Content-Type': path.endsWith('.html') ? 'text/html' : 'application/javascript',
        'Cache-Control': path === '/index.html' ? 'max-age=60' : 'max-age=31536000'
      },
    })
  ));

  console.log(`Deployed to ${domain}`);
  console.log(`It should be available in a few minutes`);
}
