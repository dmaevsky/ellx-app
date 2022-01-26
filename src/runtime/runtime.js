import CalcGraph from './engine/calc_graph.js';
import mountEllxApp from './mount_app.js';

export function initializeEllxApp(Module, sheets) {
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

  document.body.innerHTML = '';
  mountEllxApp(document.body, htmlCalcGraph);
}
