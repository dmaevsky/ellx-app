import ModuleManager from './sandbox/runtime/module_manager.js';
import CalcGraph from './sandbox/runtime/engine/calc_graph.js';
import mountEllxApp from './sandbox/runtime/mount_app.js';

function hydrate(node) {
  if (!node.src || node.code) return;

  node.code = fetch(node.src)
    .then(res => res.text())
    .catch(console.error);
}

export default function initializeEllxApp(modules, sheets, environment) {
  const Module = ModuleManager(new Map(Object.entries(modules)), environment);

  Object.values(modules).forEach(hydrate);

  const htmlContentId = 'file:///src/index.html';

  const htmlCalcGraph = new CalcGraph(
    htmlContentId,
    url => Module.get(url),
    url => Module.require(url, htmlContentId)
  );

  htmlCalcGraph.autoCalc.set(true);
  Module.set(htmlContentId, htmlCalcGraph);

  // initialize sheets
  for (let sheetId in sheets) {
    const cg = new CalcGraph(
      sheetId,
      url => Module.get(url),
      url => Module.require(url, sheetId)
    );

    const nodes = sheets[sheetId];

    for (let name in nodes) {
      cg.insert(name, nodes[name]);
    }

    cg.autoCalc.set(true);
    Module.set(sheetId, cg);
  }

  mountEllxApp(document.body, htmlCalcGraph);
}
