import {
  BULK_UPDATE_BLOCKS
} from '../mutations';

import { derived } from 'tinyx';
import { makeStore } from '../utils/make_store';

import objectId from '../utils/object_id';
import query from '../blocks';

import { undoable } from 'tinyx/middleware/undo_redo';
import { normalize } from './edit';
import { changeExpansion } from './expansion';

export const clipboard = makeStore(null);

function SET_CLIPBOARD(data) {
  return ({ set }) => set(data);
}

export function copyToClipboard(fromStore, selection, cut) {
  const copySelection = normalize(selection);

  const unsubscribe = derived(fromStore, ({ blocks }) => blocks).subscribe(clearClipboard);
  clipboard.commit(SET_CLIPBOARD, { fromStore, copySelection, cut, unsubscribe });
}

export const pasteFromClipboard = undoable((destStore, selection) => {
  const { fromStore, copySelection, cut } = clipboard.get() || {};
  if (!fromStore) return;

  const srcSheet = fromStore.get();
  const destSheet = destStore.get();

  const clippedBlocks = query(srcSheet.blocks).getInRange(copySelection);

  const shift = normalize(selection).map((c, i) => c - copySelection[i]);

  let toInsert = new Set(), toUpdate = new Map(), toRemove = new Set();

  for (let blockId of clippedBlocks) {
    let block = srcSheet.blocks.get(blockId);

    let blockUpdate = {
      position: block.position.map((c, i) => ((c - copySelection[i]) * (i - 1.5) > 0 ? copySelection[i] : c) + shift[i & 1])
    };

    if (block.expansion) {
      let expansion = { ...block.expansion };     // Make a working copy
      let [top, left, bottom, right] = blockUpdate.position;

      if (top === bottom && expansion.labelsTop) delete expansion.labelsTop;
      if (left === right && expansion.labelsLeft) delete expansion.labelsLeft;

      top += !!expansion.labelsTop;
      left += !!expansion.labelsLeft;

      if (top === bottom && left === right) {
        expansion = undefined;    // Single cell -> remove expansion
        blockUpdate.position = [top, left, bottom, right];
      }
      else if (top === bottom && !expansion.vertical || left === right && expansion.vertical) {
        expansion.secondary = false;
      }
      blockUpdate.expansion = expansion;
    }

    const conflictingBlocks = query(destSheet.blocks).getInRange(blockUpdate.position);
    const [rowStart, colStart, rowEnd, colEnd] = blockUpdate.position;

    for (let conflictingId of conflictingBlocks) {
      if (clippedBlocks.has(conflictingId) && cut) continue;

      // See if we can just trim the expansion in a non-destructive fashion
      let { position: [top, left, bottom, right], expansion } = destSheet.blocks.get(conflictingId);
      let haircut = !!(expansion && expansion.labelsTop);
      let sidekick = !!(expansion && expansion.labelsLeft);

      if (top + haircut > rowEnd) changeExpansion(destStore, conflictingId, { labels: { top: false } });
      else if (left + sidekick > colEnd) changeExpansion(destStore, conflictingId, { labels: { left: false } });
      else if (top + haircut < rowStart) changeExpansion(destStore, conflictingId, { step: { v: rowStart - bottom - 1 } });
      else if (left + sidekick < colStart) changeExpansion(destStore, conflictingId, { step: { h: colStart - right - 1 } });
      else toRemove.add(conflictingId);
    }

    if (srcSheet === destSheet && cut) toUpdate.set(blockId, blockUpdate);
    else {
      if (block.node) blockUpdate.node = '?' + block.node;
      toInsert.add({ ...block, ...blockUpdate });
    }
  }

  destStore.commit(BULK_UPDATE_BLOCKS, {
    toUpdate: [...toUpdate].map(([blockId, blockUpdate]) => ({ blockId, ...blockUpdate })),
    toRemove: [...toRemove].map(blockId => ({ blockId })),
    toInsert: [...toInsert].map(block => ({ blockId: objectId(block), block }))
  });
});

export function clearClipboard() {
  const { unsubscribe } = clipboard.get() || {};
  if (unsubscribe) unsubscribe();
  clipboard.commit(SET_CLIPBOARD, null);
}
