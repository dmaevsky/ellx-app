import { undoable } from "tinyx/middleware/undo_redo";

import objectId from "../../utils/object_id.js";
import query from "../blocks.js";

import {
  INSERT_BLOCK,
  UPDATE_BLOCK,
  DELETE_BLOCK,
  SET_SELECTION,
} from "../mutations.js";

export function setSelection(thisSheet, selection) {
  thisSheet.commit(SET_SELECTION, { selection });
}

export const editCell = undoable((thisSheet, row, col, cellValue) => {
  let blocks = thisSheet.get("blocks");
  let blockId = query(blocks).getAt(row, col);

  if (!cellValue) {
    if (blockId !== undefined) thisSheet.commit(DELETE_BLOCK, { blockId });
    return;
  }

  let block = blocks.get(blockId);
  let blockUpdate = { value: cellValue, formula: undefined };

  // Try to parse cellValue as a formula
  let match = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*=([^=>].*)/.exec(cellValue); // Match [identifier] = anything

  if (cellValue.trim().startsWith("//"))
    blockUpdate = {
      value: cellValue.trim(),
      formula: undefined,
      node: undefined,
    };
  else if (match)
    blockUpdate = {
      node: match[1] || (block && block.node) || null,
      formula: match[2].trim(),
    };
  else if (block && block.node !== undefined)
    blockUpdate = { formula: cellValue.trim() };

  if (blockId !== undefined)
    thisSheet.commit(UPDATE_BLOCK, {
      blockId,
      cgRecalculate: true,
      ...blockUpdate,
    });
  else {
    block = { position: [row, col, row, col], ...blockUpdate };
    thisSheet.commit(INSERT_BLOCK, { blockId: objectId(block), block });
  }
});

export function clearBlock(thisSheet, blockId) {
  thisSheet.commit(DELETE_BLOCK, { blockId });
}

export function normalize([rowStart, colStart, rowEnd, colEnd]) {
  if (rowStart > rowEnd) [rowStart, rowEnd] = [rowEnd, rowStart];
  if (colStart > colEnd) [colStart, colEnd] = [colEnd, colStart];

  return [rowStart, colStart, rowEnd, colEnd];
}

export const clearRange = undoable((thisSheet, range) => {
  const found = query(thisSheet.get().blocks).getInRange(normalize(range));
  for (let blockId of found) clearBlock(thisSheet, blockId);
});

export function toggleComment(str = "") {
  return str.trim().startsWith("//")
      ? str.trim().slice(2).trim()
      : "// " + str;
}

export const commentRange = undoable((thisSheet, range) => {
  const blocks = thisSheet.get("blocks");
  const found = query(blocks).getInRange(normalize(range));

  for (let blockId of found) {
    const block = blocks.get(blockId);
    const [row, col] = block.position;
    const value = block.node ? `${block.node} = ${block.formula}` : block.formula || block.value;

    editCell(thisSheet, row, col, toggleComment(value));
  }
});
