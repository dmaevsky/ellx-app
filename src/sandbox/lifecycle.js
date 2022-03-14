import { batch } from 'quarx';
import { derived } from 'tinyx';
import { UPDATE_CONTENT, REMOVE_CONTENT, INSERT_BLOCK } from './mutations.js';
import objectId from '../utils/object_id.js';
import store, { getSheet, notifyServer } from './store.js';

import CalcGraph from '../runtime/engine/calc_graph.js';

import { buildBlocks, saveBody } from './body_parse.js';

const Module = window.__ellx.Module;

const autoSave = new Map();

function sendContent(contentId, blocks) {
  notifyServer({
    type: 'serialize',
    contentId,
    body: blocks && saveBody(blocks.values())
  });
}

export function init(contentId, contents) {
  const cg = new CalcGraph(
    contentId,
    url => Module.get(url),
    url => Module.require(url, contentId)
  );

  Module.set(contentId, cg);

  store.commit(UPDATE_CONTENT, {
    contentId,
    // Map(blockId -> { position: [startRow, startCol, endRow, endCol], expansion: { vertical: Bool, secondary: Bool }, (static)value, formula, node })
    blocks: new Map(),
    // Map(blockId -> { value })
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

  const subscription = thisSheetBlocks.subscribe(blocks => sendContent(contentId, blocks));

  autoSave.set(contentId, subscription);
}

export function dispose(contentId) {
  const unsubscribe = autoSave.get(contentId);
  if (typeof unsubscribe === 'function') unsubscribe();
  autoSave.delete(contentId);

  Module.remove(contentId);

  store.commit(REMOVE_CONTENT, { contentId });
}

export function updateModules(modules) {
  console.debug('UPDATE modules ***', modules);

  batch(() => {
    for (let id in modules) {

      if (modules[id] === 'deleted') {
        Module.remove(id);
      }
      else {
        Module.set(id, modules[id]);
      }
    }
  });
}
