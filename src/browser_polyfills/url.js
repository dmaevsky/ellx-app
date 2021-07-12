export function pathToFileURL(path) {
  return 'file://' + path;
}

export function fileURLToPath(url) {
  return url.slice('file://'.length);
}
