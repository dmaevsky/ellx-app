import MarkdownOutput from './sandbox/components/MarkdownOutput.svelte';
import getRequire from './sandbox/runtime/tokamak_dynamic.js';
import { exportCalcGraph } from './sandbox/runtime/engine/calc_graph_export.js';
import CalcGraph from './sandbox/runtime/engine/calc_graph.js';

export default function initializeEllxApp(requireGraph, sheets, environment) {
  const rootNamespace = 'file:///src/index';

  const require = getRequire({ graph: requireGraph, environment });

  require.hydrate(err => {
    if (err) throw err;
  });

  const htmlCalcGraph = new CalcGraph(
    [() => sheets[rootNamespace + '.ellx']],
    url => require(url, rootNamespace + '.js')
  );

  htmlCalcGraph.autoCalc.set(true);

  // initialize sheets
  for (let sheetId in sheets) {
    const ns = sheetId.slice(0, sheetId.lastIndexOf('.'));
    const siblings = ns === rootNamespace ? [() => htmlCalcGraph] : [];

    const bundleId = ns + '.js';

    const cg = new CalcGraph(siblings, url => url
      ? require(url, bundleId)
      : requireGraph[bundleId] && require(bundleId)
    );

    const nodes = sheets[sheetId];

    for (let name in nodes) {
      cg.insert(name, nodes[name]);
    }
    cg.autoCalc.set(true);

    sheets[sheetId] = cg;
    requireGraph[sheetId] = exportCalcGraph(sheetId, () => cg);
  }

  new MarkdownOutput({
    target: document.getElementById('ellx-app'),
    props: { cg: htmlCalcGraph }
  });
}
