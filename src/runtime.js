import getRequire from './sandbox/runtime/tokamak_dynamic.js';
import { exportCalcGraph } from './sandbox/runtime/engine/calc_graph_export.js';
import CalcGraph from './sandbox/runtime/engine/calc_graph.js';
import mountEllxApp from './sandbox/runtime/mount_app.js';

export default function initializeEllxApp({ requireGraph, resolverMeta }, sheets, environment) {
  const rootNamespace = 'file:///src/index';
  const graph = {};

  const require = getRequire({ graph, resolverMeta, environment });

  require.hydrate(Object.values(requireGraph), err => {
    if (err) throw err;
  });

  const resolveRequire = bundleId => url => url
    ? require(url, bundleId)
    : graph[bundleId] && require(bundleId);

  const htmlCalcGraph = new CalcGraph(
    [() => sheets[rootNamespace + '.ellx']],
    resolveRequire(rootNamespace + '.js')
  );

  htmlCalcGraph.autoCalc.set(true);

  // initialize sheets
  for (let sheetId in sheets) {
    const ns = sheetId.slice(0, sheetId.lastIndexOf('.'));
    const siblings = ns === rootNamespace ? [() => htmlCalcGraph] : [];

    const cg = new CalcGraph(siblings, resolveRequire(ns + '.js'));

    const nodes = sheets[sheetId];

    for (let name in nodes) {
      cg.insert(name, nodes[name]);
    }
    cg.autoCalc.set(true);

    sheets[sheetId] = cg;
    graph[sheetId] = exportCalcGraph(sheetId, () => cg);
  }

  mountEllxApp(document.body, htmlCalcGraph);
}
