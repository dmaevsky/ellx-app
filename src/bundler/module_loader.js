import { join } from 'path';
import * as svelte from 'svelte/compiler';
import { transform as jsx } from 'sucrase';

import { fetchEllxProject } from './ellx_module_loader.js';

const ellxProjectPrefix = 'file:///node_modules/~';

export function* preloadEllxProject(id, rootDir) {
  if (!id.startsWith(ellxProjectPrefix)) return;

  const [owner, project] = id.slice(ellxProjectPrefix.length).split('/');

  if (!project || ['package.json', 'index.js', 'node_modules'].includes(project)) return;

  const packageDir = join(rootDir, `node_modules/~${owner}/${project}`);
  yield fetchEllxProject(`${owner}/${project}`, packageDir);
}

function appendStyle(str) {
  if (!str) return '';

  return `
    var css = ${JSON.stringify(str)};
    var head = document.getElementsByTagName('head')[0];
    var s = document.createElement('style');
    s.setAttribute('type', 'text/css');
    if (s.styleSheet) {
      s.styleSheet.cssText = css;
    } else {
      s.appendChild(document.createTextNode(css));
    }
    head.appendChild(s);
  `
}

export function transformModule(id, text) {
  if (id.endsWith('.svelte')) {
    const result = svelte.compile(text, {
      generate: 'dom',
      format: 'esm',
      filename: 'Component.svelte',
      immutable: true,
    });

    // TODO: report compile errors / warnings
    return result.js.code;
  }

  // TODO: write a proper loader for sheets instead of a runtime Proxy mumbo-jumbo
  if (id.endsWith('.ellx')) {
    return '';
  }

  if (id.endsWith('.json')) {
    return `module.exports=${text}`;
  }

  if (id.endsWith('.css')) {
    return appendStyle(text);
  }

  if (id.endsWith('.glsl')) {
    return `export default ${JSON.stringify(text)};`;
  }

  if (id.endsWith('.jsx')) {
    return jsx(text, { transforms: ['jsx'] }).code;
  }

  return text;
}
