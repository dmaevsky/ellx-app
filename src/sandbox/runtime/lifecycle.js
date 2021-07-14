import { derived } from 'tinyx';
import { UPDATE_CONTENT, REMOVE_CONTENT, INSERT_BLOCK } from './mutations';
import objectId from './utils/object_id';
import store, { getSheet, notifyParent, graphs as hydratedGraphs, namespaces as hydratedNamespaces } from './store';
import { resolveSiblings, resolveRequire, requireGraph } from './hydrated';

import CalcGraph from './engine/calc_graph';

import { buildBlocks, saveBody } from './body_parse';

const autoSave = new Map();

function sendContent(contentId, blocks) {
  notifyParent({
    type: 'serialize',
    contentId,
    body: blocks && saveBody(blocks.values())
  });
}

export function init(contentId, contents) {
  const cg = new CalcGraph(
    resolveSiblings('ellx', contentId),
    resolveRequire('ellx', contentId)
  );

  hydratedGraphs.set(contentId, cg);

  store.commit(UPDATE_CONTENT, {
    contentId,
    // Map(blockId -> { position: [startRow, startCol, endRow, endCol], expansion: { vertical: Bool, secondary: Bool }, (static)value, formula, node })
    blocks: new Map(),
    // Map(blockId -> { value, component })
    calculated: new Map(),
    nRows: 500,
    nCols: 100,
    history: [],
    future: [],
    selection: [0,0,0,0],
  });

  const thisSheet = getSheet(contentId);
  const thisSheetBlocks = derived(thisSheet, sh => sh.blocks);

  if (contents) {
    const blocks = buildBlocks(contents);

    for (let block of blocks) {
      thisSheet.commit(INSERT_BLOCK, { blockId: objectId(block), block });
    }
  }

  cg.autoCalc.set(true);

  const subscription = thisSheetBlocks.subscribe(blocks => sendContent(contentId, blocks));

  autoSave.set(contentId, subscription);
}

export function dispose(contentId) {
  const unsubscribe = autoSave.get(contentId);
  if (typeof unsubscribe === 'function') unsubscribe();
  autoSave.delete(contentId);

  const cg = hydratedGraphs.get(contentId);
  if (cg && cg.dispose) cg.dispose();

  hydratedGraphs.delete(contentId);

  store.commit(REMOVE_CONTENT, { contentId });
}

export function bundle(g) {
  console.debug('received bundle in the frame ***', g);
  requireGraph.set(g);
}

export function namespaces(families) {
  console.debug('received namespaces in the frame ***', families);
  hydratedNamespaces.set(families);
}
