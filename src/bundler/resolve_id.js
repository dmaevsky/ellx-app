export default function resolveId(importee, importer) {
  if (importee[0] === '.') {
    return new URL(importee, importer).href;
  }

  if (importee[0] === '~' && importer && importer.startsWith('ellx://')) {
    return 'ellx://' + importee.slice(1);
  }

  if (importee[0] === '/') {
    const key = (/^ellx:\/\/([^/]+\/[^/]+)/.exec(importer) || [])[1];
    if (key) {
      return 'ellx://' + key + importee;
    }
    return new URL(importee, importer).href;
  }

  if (!/^[^:]+:\/\//.test(importee)) {
    // Everything else with no protocol is treated as an NPM module
    return 'npm://' + importee;
  }
  return importee;
}
