import { exec } from 'child_process';
import chokidar from 'chokidar';
import { cps } from 'conclure/effects';
import { all } from 'conclure/combinators';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import md5 from 'md5';
import reactiveBuild from './bundler/reactive_build.js';
import { abortableFetch } from './utils/fetch.js';
import { loadBody as parseEllx } from './sandbox/body_parse.js';

const execCommand = (cmd, cb) => {
  const child = exec(cmd, (err, stdout, stderr) => {
    console.log(stdout);
    console.error(stderr);
    cb(err);
  });
  return () => child.kill();
}

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

function build(entryPoints, rootDir, cb) {
  const watcher = chokidar.watch(rootDir);
  let off;

  function cancel() {
    if (off) off();
    return watcher.close();
  }

  watcher.on('ready', () => {
    off = reactiveBuild(
      () => entryPoints,
      watcher,
      rootDir,
      modules => cancel()
        .then(() => cb(null, modules))
        .catch(e => cb(e))
    );
  });

  return cancel;
}

const MODULE_MANAGER    = 'file:///node_modules/@ellx/app/src/runtime/module_manager.js';
const RUNTIME           = 'file:///node_modules/@ellx/app/src/runtime/runtime.js';

function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  return 'application/javascript';
}

export function* deploy(rootDir, env) {
  const files = (yield collectEntryPoints(`${rootDir}/src`))
    .map(path => path.slice(rootDir.length))
    .map(path => pathToFileURL(path).href)
    .concat([MODULE_MANAGER, RUNTIME]);

  // Load all sheets
  const sheets = Object.fromEntries(
    yield all(files
      .filter(id => id.endsWith('.ellx'))
      .map(function* loadSheet(id) {
        const { nodes } = parseEllx(yield readFile(join(rootDir, fileURLToPath(id)), 'utf8'));
        return [id, nodes];
      })
    )
  );

  // Make the bundle
  const jsFiles = files
    .filter(id => id.endsWith('.js'));

  const modules = yield cps(build, jsFiles, rootDir);

  console.log(`Bundle ready. Generated ${Object.keys(modules).length} entries`);

  // ****** DEPLOY ******

  const authJson = JSON.parse(yield readFile(`${rootDir}/.ellx_auth.json`, 'utf8'));

  const { apiUrl, appId, token, domain } = authJson[env] || {};

  if (!apiUrl || !appId || !token || !domain) {
    throw new Error(`Environment ${env} not found or incomplete in .ellx_auth.json`);
  }

  // Extract the files to deploy and calculate their hashes
  const toDeploy = new Map();

  const appendFile = (urlPath, code) => {
    const hash = md5(code);
    const hashedUrlPath = urlPath.replace(/\.[^.]*$/, ext => '-' + hash.slice(0, 8) + ext);

    toDeploy.set(hashedUrlPath, code);
    return 'https://' + domain + hashedUrlPath;
  }

  for (let id in modules) {
    const node = modules[id];
    if (!node) {
      throw new Error(`${id} could not be resolved`);
    }

    const { code } = node;

    if (typeof code === 'string') {
      delete node.code;
      node.src = appendFile(id.slice(7), code);
    }
  }

  const bootstrapSrc = appendFile('/bootstrap.js', yield readFile(join(rootDir, 'node_modules/@ellx/app/src/bootstrap/bootstrap.js'), 'utf8'));

  const modulesSrc = appendFile('/modules.js', 'export default ' + JSON.stringify(modules));
  const sheetsSrc = appendFile('/sheets.js', 'export default ' + JSON.stringify(sheets));

  // Prepare index.html body
  const injection = `<script type="module">
    import { bootstrapModule, asyncRetry, prefetch } from "${bootstrapSrc}";
    import modules from "${modulesSrc}";
    import sheets from "${sheetsSrc}";

    async function run() {
      const Module = await bootstrapModule(modules, '${env}');
      const Runtime = await asyncRetry(Module.require)("${RUNTIME}");

      Runtime.initializeEllxApp(Module, sheets);
    }

    prefetch(Object.values(modules));

    run().catch(console.error);
  </script>`;

  // Styles
  const twConfig = join(rootDir, 'tailwind.config.cjs');
  const twStylesIn = join(rootDir, 'node_modules/@ellx/app/src/input.css');
  const twStylesOut = join(rootDir, 'node_modules/@ellx/app/src/bootstrap/sandbox.css');

  console.log('Generating styles...');

  yield cps(execCommand,
    `npx tailwindcss -c ${twConfig} -i ${twStylesIn} -o ${twStylesOut}`
  );

  const cssSrc = appendFile('/styles.css', yield readFile(twStylesOut, 'utf8'));

  const indexHtml = (yield readFile(join(rootDir, 'node_modules/@ellx/app/src/bootstrap/index.html'), 'utf8'))
    .replace(`<script type="module" src="sandbox.js"></script>`, injection)
    .replace('sandbox.css', cssSrc);

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
        'Content-Type': getContentType(path),
        'Cache-Control': path === '/index.html' ? 'max-age=60' : 'max-age=31536000'
      },
    })
  ));

  console.log(`Deployed to https://${domain}`);
  console.log(`It should be available in a few minutes`);
}
