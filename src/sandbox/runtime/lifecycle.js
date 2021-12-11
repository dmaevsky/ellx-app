import { batch } from 'quarx';
import { derived } from 'tinyx';
import { UPDATE_CONTENT, REMOVE_CONTENT, INSERT_BLOCK } from './mutations';
import objectId from './utils/object_id';
import store, { getSheet, notifyParent } from './store';
import { requireModule, moduleMap, evalUMD } from './module_manager';

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
    contentId,
    url => moduleMap.get(url),
    url => requireModule(url, contentId)
  );

  moduleMap.set(contentId, cg);

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

  const cg = moduleMap.get(contentId);
  if (cg && cg.dispose) cg.dispose();

  moduleMap.delete(contentId);

  store.commit(REMOVE_CONTENT, { contentId });
}

export function updateModules(modules) {
  console.debug('UPDATE modules ***', modules);

  batch(() => {
    for (let id in modules) {

      if (modules[id] === undefined) {
        moduleMap.delete(id);
      }
      else if (id.endsWith('/package.json')) {
        moduleMap.set(id, { code: { exports: modules[id] } });
      }
      else {
        const node = modules[id];
        node.code = evalUMD(id, node.code);
        moduleMap.set(id, node);
      }
    }
  });
}
