import { join } from 'path';
import { promises as fs } from '#fs';
import { allSettled } from 'conclure/combinators';
import { fetchFile } from '../sandbox/runtime/fetch.js';
import memoize from './memoize_flow.js';
import apiUrl from '../api_url.js';

// TODO: get it from a Dependency Injection service
function logByLevel(level, ...messages) {
  console.log(`[${level.toUpperCase()}]`, ...messages);
}

function* makeOne(filePath, contents, secondTry = false) {
  try {
    // TODO: set proper access rights mode
    if (filePath.endsWith('/')) yield fs.mkdir(filePath);
    else yield fs.writeFile(filePath, contents, 'utf8');
  }
  catch (e) {
    if (e.code === 'ENOENT') {
      if (secondTry) throw e;

      yield makeOne(join(filePath, '../'));
      return makeOne(filePath, contents, true);
    }
    if (e.code !== 'EEXIST') throw e;
  }
}

function parseAwsError(text) {
  return (/<Message>([^<]*)<\/Message>/.exec(text) || [])[1] || 'Network error';
}

export const fetchEllxProject = memoize(function* fetchEllxProject(projectKey, packageDir) {
  // First check if it has been downloaded already
  try {
    const stats = yield fs.stat(packageDir);

    if (!stats.isDirectory()) {
      throw new Error(`${packageDir} exists but is not a directory`);
    }
    return;
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  // Package directory does not exist -> download from cloud

  const resourceUrl = `${apiUrl}/resource/${projectKey}`;

  const { text } = yield fetchFile(resourceUrl, logByLevel, {
    credentials: 'include',
    headers: {
      'Cookie': 'samesite=1'
    }
  });

  const { files } = JSON.parse(text);

  const results = yield allSettled(
    files.map(({ path, hash, url }) => fetchFromAWS(url, hash, join(packageDir, path)))
  );

  let firstError;
  for (let { error } of results) {
    if (!error) continue;

    logByLevel('error', error);
    if (!firstError) firstError = error;
  }

  if (firstError) {
    throw new Error(firstError);
  }
});

const fetchFromAWS = memoize(function* fetchFromAWS(awsUrl, hash, filePath) {
  const headers = awsUrl.endsWith(hash) ? {} : {
    'If-Match': hash
  };

  try {
    const { text } = yield fetchFile(awsUrl, logByLevel, { headers });
    yield makeOne(filePath, text);
  }
  catch (error) {
    throw new Error(parseAwsError(error.message));
  }
});
