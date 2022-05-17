import { clearBlock, clearRange, editCell, normalize } from './edit.js';
import { undoable } from 'tinyx/middleware/undo_redo';

import { getPrimaryKeys, getSecondaryKeys } from '../../runtime/iterate.js';
import query from '../blocks.js';

import {
  CHANGE_EXPANSION,
  CHANGE_POSITION
} from '../mutations.js';

import {
  UNDOABLE_ACTION_START,
  UNDOABLE_ACTION_END
} from 'tinyx/middleware/undo_redo/mutations.js';

export const changeExpansion = undoable((thisSheet, blockId, { labels, step }) => {
  const { blocks, calculated, nRows, nCols } = thisSheet.get();
  let { value: blockValue, node, position, expansion } = blocks.get(blockId);
  const { value } = node && calculated.get(blockId) || { value: blockValue };

  // Make working copies
  position = [...position];
  expansion = expansion && {...expansion}

  // Get the current dimensions
  let [firstRow, firstCol, lastRow, lastCol] = position;
  firstRow += !!(expansion && expansion.labelsTop);
  firstCol += !!(expansion && expansion.labelsLeft);

  const currentHeight = lastRow - firstRow + 1;
  const currentWidth = lastCol - firstCol + 1;

  const triggerLabelsLeft = turnOn => {
    if (!expansion) return;

    if (turnOn) {
      if (expansion.labelsLeft) return;
      let col = position[1] - 1;
      if (col < 0) return;

      let leftNeighbor = blocks.get(query(blocks).neighbor(position, 1));
      if (leftNeighbor && leftNeighbor.position[3] === col) return;

      position[1]--;
    }
    else if (expansion.labelsLeft) position[1]++;
    expansion.labelsLeft = turnOn;
  }

  const triggerLabelsTop = turnOn => {
    if (!expansion) return;

    if (turnOn) {
      if (expansion.labelsTop) return;
      let row = position[0] - 1;
      if (row < 0) return;

      let topNeighbor = blocks.get(query(blocks).neighbor(position, 0));
      if (topNeighbor && topNeighbor.position[2] === row) return;

      position[0]--;
    }
    else if (expansion.labelsTop) position[0]++;
    expansion.labelsTop = turnOn;
  }

  const expandDown = (step, tabSize) => {
    let expandingPrimary = !expansion || expansion.vertical;
    let nowExpanded = expansion && (expandingPrimary || expansion.secondary);

    const primaryKeys = [...getPrimaryKeys(value, tabSize ? (expandingPrimary ? currentHeight + tabSize : currentWidth) : 1)];
    const keys = expandingPrimary ? primaryKeys : [...getSecondaryKeys(value, primaryKeys.length, tabSize ? currentHeight + tabSize : 1)];
    let currentLength = keys.length;

    if (!nowExpanded && !currentLength) return;   // Don't try to expand if current value is not Object or is an empty Object

    if (tabSize) {
      step = tabSize - currentHeight % tabSize;
      if (currentLength > currentHeight && currentLength < currentHeight + step) step = currentLength - currentHeight;
    }
    lastRow += step;
    if (lastRow >= nRows) lastRow = nRows - 1;

    let bottomNeighbor = blocks.get(query(blocks).neighbor(position, 2));
    if (bottomNeighbor && bottomNeighbor.position[0] <= lastRow) {
      lastRow = bottomNeighbor.position[0] - 1;
    }

    let createExpansion = lastRow > position[2] && !nowExpanded;
    position[2] = lastRow;

    if (createExpansion) {
      if (expandingPrimary) expansion = { vertical: true }
      else expansion.secondary = true;
      if (keys[0] !== 0) triggerLabelsLeft(true);
    }
  }

  const shrinkUp = (step, tabSize) => {
    let expandingPrimary = !expansion || expansion.vertical;
    let nowExpanded = expansion && (expandingPrimary || expansion.secondary);
    if (!nowExpanded) return;   // Nothing to shrink

    if (tabSize) {
      const primaryKeys = [...getPrimaryKeys(value, expandingPrimary ? currentHeight : currentWidth)];
      const keys = expandingPrimary ? primaryKeys : [...getSecondaryKeys(value, primaryKeys.length, currentHeight)];
      let currentLength = keys.length;

      step = -currentHeight % tabSize || -tabSize;
      if (currentLength < currentHeight && currentLength > currentHeight + step) step = currentLength - currentHeight;
    }
    lastRow += step;
    if (lastRow < firstRow) lastRow = firstRow;
    position[2] = lastRow;

    if (lastRow === firstRow) {
      let singleCell = (position[1] + !!expansion.labelsLeft === position[3]);

      if (!expandingPrimary || singleCell) {
        triggerLabelsLeft(false);
        expansion.secondary = false;
      }
      if (singleCell) {
        triggerLabelsTop(false);
        expansion = undefined;
      }
    }
  }

  const expandRight = (step, tabSize) => {
    let expandingPrimary = !expansion || !expansion.vertical;
    let nowExpanded = expansion && (expandingPrimary || expansion.secondary);

    const primaryKeys = [...getPrimaryKeys(value, tabSize ? (expandingPrimary ? currentWidth + tabSize : currentHeight) : 1)];
    const keys = expandingPrimary ? primaryKeys : [...getSecondaryKeys(value, primaryKeys.length, tabSize ? currentWidth + tabSize : 1)];
    let currentLength = keys.length;

    if (!nowExpanded && !currentLength) return;   // Don't try to expand if current value is not Object or is an empty Object

    if (tabSize) {
      step = tabSize - currentWidth % tabSize;
      if (currentLength > currentWidth && currentLength < currentWidth + step) step = currentLength - currentWidth;
    }
    lastCol += step;
    if (lastCol >= nCols) lastCol = nCols - 1;

    let rightNeighbor = blocks.get(query(blocks).neighbor(position, 3));
    if (rightNeighbor && rightNeighbor.position[1] <= lastCol) {
      lastCol = rightNeighbor.position[1] - 1;
    }

    let createExpansion = lastCol > position[3] && !nowExpanded;
    position[3] = lastCol;

    if (createExpansion) {
      // Create expansion
      if (expandingPrimary) expansion = { vertical: false }
      else expansion.secondary = true;
      if (keys[0] !== 0) triggerLabelsTop(true);
    }
  }

  const shrinkLeft = (step, tabSize) => {
    let expandingPrimary = !expansion || !expansion.vertical;
    let nowExpanded = expansion && (expandingPrimary || expansion.secondary);
    if (!nowExpanded) return;   // Nothing to shrink

    if (tabSize) {
      const primaryKeys = [...getPrimaryKeys(value, expandingPrimary ? currentWidth : currentHeight)];
      const keys = expandingPrimary ? primaryKeys : [...getSecondaryKeys(value, primaryKeys.length, currentWidth)];
      let currentLength = keys.length;

      step = -currentWidth % tabSize || -tabSize;
      if (currentLength < currentWidth && currentLength > currentWidth + step) step = currentLength - currentWidth;
    }
    lastCol += step;
    if (lastCol < firstCol) lastCol = firstCol;
    position[3] = lastCol;

    if (lastCol === firstCol) {
      let singleCell = (position[0] + !!expansion.labelsTop === position[2]);

      if (!expandingPrimary || singleCell) {
        triggerLabelsTop(false);
        expansion.secondary = false;
      }
      if (singleCell) {
        triggerLabelsLeft(false);
        expansion = undefined;
      }
    }
  }

  // Apply modifications here
  if (labels) {
    const { top, left } = labels;

    if (top !== undefined) triggerLabelsTop(top);
    if (left !== undefined) triggerLabelsLeft(left);
  }

  if (step) {
    const { h, v, hTabSize, vTabSize } = step;

    if (h > 0) expandRight(h, hTabSize);
    else if (h < 0) shrinkLeft(h, hTabSize);

    if (v > 0) expandDown(v, vTabSize);
    else if (v < 0) shrinkUp(v, vTabSize);
  }

  thisSheet.commit(CHANGE_EXPANSION, { position, expansion }, 'blocks', blockId);
});

// ----- Shifting cells ----- //

export const shiftCellsH = undoable((thisSheet, position, direction) => {
  let [rowStart, colStart, rowEnd, colEnd] = normalize(position);

  const blocks = thisSheet.get().blocks;

  // First collect all affected blocks, sorting them in a proper shifting sequence
  let affected = [...query(blocks).getInRange([rowStart, colStart, rowEnd, Infinity])]
    .map(blockId => ({ blockId, ...blocks.get(blockId) }))
    .sort(({ position: [, colA] }, { position: [, colB] }) => (colB - colA) * direction);

  const h = direction * (colEnd - colStart + 1);

  for (let { blockId, position, expansion } of affected) {
    let [nodeTop, nodeLeft, nodeBottom, nodeRight] = position;
    let haircut = !!(expansion && expansion.labelsTop);
    let sidekick = !!(expansion && expansion.labelsLeft);

    if (nodeTop + haircut < rowStart) changeExpansion(thisSheet, blockId, { step: { v: rowStart - nodeBottom - 1 } });
    else if (nodeTop + haircut > rowEnd) changeExpansion(thisSheet, blockId, { labels: { top: false } });
    else if (nodeLeft + sidekick < colStart) changeExpansion(thisSheet, blockId, { step: { h: colStart - nodeRight - 1 } });
    else if (direction < 0 && nodeLeft + sidekick <= colEnd) clearBlock(thisSheet, blockId);
    else {
      // Block is moving
      let step = {}, labels = {};
      if (nodeLeft < (direction > 0 ? colStart : colEnd + 1)) labels.left = false;
      if (nodeTop < rowStart) labels.top = false;
      if (nodeBottom > rowEnd) step.v = rowEnd - nodeBottom;
      let trimmed = 'left' in labels || 'top' in labels || 'v' in step;

      // Trim expansion first, and then move the block
      if (trimmed) changeExpansion(thisSheet, blockId, { labels, step });
      thisSheet.commit(CHANGE_POSITION, { h }, 'blocks', blockId, 'position');

      // Re-apply trimmed expansions (if possible and vertical only)
      if (trimmed) {
        delete labels.left;
        if (labels.top !== undefined) labels.top = !labels.top;
        if (step.v !== undefined) step.v = -step.v;
        changeExpansion(thisSheet, blockId, { labels, step });
      }
    }
  }
});

export const shiftCellsV = undoable((thisSheet, position, direction) => {
  let [rowStart, colStart, rowEnd, colEnd] = normalize(position);

  const blocks = thisSheet.get().blocks;

  // First collect all affected blocks, sorting them in a proper shifting sequence
  let affected = [...query(blocks).getInRange([rowStart, colStart, Infinity, colEnd])]
    .map(blockId => ({ blockId, ...blocks.get(blockId) }))
    .sort(({ position: [rowA] }, { position: [rowB] }) => (rowB - rowA) * direction);

  const v = direction * (rowEnd - rowStart + 1);

  for (let { blockId, position, expansion } of affected) {
    let [nodeTop, nodeLeft, nodeBottom, nodeRight] = position;
    let haircut = !!(expansion && expansion.labelsTop);
    let sidekick = !!(expansion && expansion.labelsLeft);

    if (nodeLeft + sidekick < colStart) changeExpansion(thisSheet, blockId, { step: { h: colStart - nodeRight - 1 } });
    else if (nodeLeft + sidekick > colEnd) changeExpansion(thisSheet, blockId, { labels: { left: false }  });
    else if (nodeTop + haircut < rowStart) changeExpansion(thisSheet, blockId, { step: { v: rowStart - nodeBottom - 1 } });
    else if (direction < 0 && nodeTop + haircut <= rowEnd) clearBlock(thisSheet, blockId);
    else {
      // Block is moving
      let step = {}, labels = {};
      if (nodeTop < (direction > 0 ? rowStart : rowEnd + 1)) labels.top = false;
      if (nodeLeft < colStart) labels.left = false;
      if (nodeRight > colEnd) step.h = colEnd - nodeRight;
      let trimmed = 'left' in labels || 'top' in labels || 'h' in step;

      // Trim expansion first, and then move the block
      if (trimmed) changeExpansion(thisSheet, blockId, { labels, step });
      thisSheet.commit(CHANGE_POSITION, { v }, 'blocks', blockId, 'position');

      // Re-apply trimmed expansions (if possible and horizontal only)
      if (trimmed) {
        delete labels.top;
        if (labels.left !== undefined) labels.left = !labels.left;
        if (step.h !== undefined) step.h = -step.h;
        changeExpansion(thisSheet, blockId, { labels, step });
      }
    }
  }
});

export const makeSpace = (thisSheet, blockId, { newHeight, newWidth }) => {
  // TODO: take nCols & nRows into account
  const { blocks/*, nRows, nCols*/ } = thisSheet.get();

  let [firstRow, firstCol, lastRow, lastCol] = blocks.get(blockId).position;
  let curHeight = lastRow - firstRow + 1;
  let curWidth = lastCol - firstCol + 1;

  let bottomNeighbor = blocks.get(query(blocks).neighbor([firstRow, firstCol, lastRow, firstCol + newWidth - 1], 2));
  let rightNeighbor = blocks.get(query(blocks).neighbor([firstRow, firstCol, lastRow, lastCol], 3));

  let h = rightNeighbor && (newWidth - (rightNeighbor.position[1] - firstCol));
  let v = bottomNeighbor && (newHeight - (bottomNeighbor.position[0] - firstRow));

  if (h > 0 || v > 0) thisSheet.commit(UNDOABLE_ACTION_START);

  if (h > 0) shiftCellsH(thisSheet, [firstRow, lastCol + 1, lastRow, lastCol + h], 1);
  if (v > 0) shiftCellsV(thisSheet, [lastRow + 1, 0, lastRow + v, Infinity], 1);

  if (newHeight !== curHeight || newWidth !== curWidth) {
    thisSheet.commit(CHANGE_POSITION, { dh: newWidth - curWidth, dv: newHeight - curHeight }, 'blocks', blockId, 'position');
  }

  if (h > 0 || v > 0) thisSheet.commit(UNDOABLE_ACTION_END);
}

export const convertToObject = undoable((thisSheet, selection, value, dataType, isVector, isColumn, rows, cols) => {
  clearRange(thisSheet, selection);

  const [isObject, isArray, isFrame] = [dataType === "object", dataType === "array", dataType === "frame"];
  let [row, col] = selection;

  if (isObject)  col++;
  if (isFrame)   row++;

  editCell(thisSheet, row, col, value);

  const blockId = query(thisSheet.get().blocks).getAt(row, col);
  const labels = {
    top:  !isArray,
    left: isObject
  };
  let step = { v: rows - isFrame };

  if (isArray && isVector && !isColumn) step = { h: cols };
  changeExpansion(thisSheet, blockId, { labels, step });

  if (isFrame || isArray) {
    step = { h: cols || 1 };
    changeExpansion(thisSheet, blockId, { labels, step });
  }
});
