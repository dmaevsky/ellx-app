<script>
  import { tick, setContext } from 'svelte';
  import { undo, redo } from 'tinyx/middleware/undo_redo';
  import query from '../blocks.js';
  import { editCell, clearRange, setSelection, normalize } from '../actions/edit.js';

  import { changeExpansion, convertToObject, shiftCellsH, shiftCellsV } from '../actions/expansion.js';
  import { clipboard, clearClipboard, handleClipboard } from '../actions/copypaste.js';
  import { isMac } from "../../utils/ui.js";

  import Grid from './Grid.svelte';
  import ContextMenu from './ContextMenu.svelte';

  export let transparent;
  export let overflowHidden;
  export let store;

  let selection;
  let isEditMode;
  let container;
  let event;

  setContext('store', store);
  const thisSheet = store;

  $: ({ selection } = $thisSheet);

  $: blocks = $thisSheet && $thisSheet.blocks;
  $: calculated = $thisSheet && $thisSheet.calculated;
  $: copySelection = $clipboard
    && $clipboard.fromStore.get() === $thisSheet
    && $clipboard.copySelection;

  function keyDown(e) {
    // Returns true if the keystroke is handled here, false otherwise
    let modifiers = (e.altKey << 2) + ((isMac() ? e.metaKey : e.ctrlKey) << 1) + e.shiftKey;

    // Prevent default Select All behavior
    if (modifiers === 2 && e.code === 'KeyA') {
      e.preventDefault();
      return true;
    }

    // Edit mode keystrokes are handled in Grid.svelte
    if (isEditMode) return false;

    if (modifiers === 0 && e.code === 'Escape') {
      if (copySelection) clearClipboard();
      return true;
    }

    if (modifiers === 0 && e.code === 'Delete') {
      clearRange(thisSheet, selection);
      return true;
    }

    if (modifiers === 2 && e.code === 'KeyZ') {
      undo(thisSheet);
    }

    if (modifiers === 3 && e.code === 'KeyZ') {
      redo(thisSheet);
    }

    let [rowStart, colStart, rowEnd, colEnd] = normalize(selection);

    if (e.code === 'Backspace' || e.code === 'Space' || e.code === 'Tab') {
      let direction, shift;

      if (modifiers === 0 || modifiers === 6) { // No modifiers or Ctrl+Alt
        shift = shiftCellsH;

        if (e.code === 'Space') {
          colStart = colEnd = Math.min(colStart, colEnd);
          setSelection(thisSheet, [rowStart, colStart, rowEnd, colEnd]);
        }
        if (modifiers === 6) {  // Insert / delete columns
          rowStart = 0;
          rowEnd = Infinity;
        }
      }
      else if (modifiers === 1 || modifiers === 3) {  // Shift or Ctrl-Shift
        shift = shiftCellsV;

        if (e.code === 'Space') {
          rowStart = rowEnd = Math.min(rowStart, rowEnd);
          setSelection(thisSheet, [rowStart, colStart, rowEnd, colEnd]);
        }
        if (modifiers === 1) {  // Insert / delete rows
          colStart = 0;
          colEnd = Infinity;
        }
      }
      else return false;

      direction = e.code === 'Backspace' ? -1 : 1;

      shift(thisSheet, [rowStart, colStart, rowEnd, colEnd], direction);
      return true;
    }

    if (e.code === "BracketLeft" && (modifiers === 4 || modifiers === 6)) {
      const [rows, cols] = [rowEnd - rowStart, colEnd - colStart];
      const [isColumn, isRow] = [!cols, !rows];
      const isVector = isRow || isColumn; // Check array dimension
      const isArray = modifiers === 4;

      if (isRow && isColumn) return true; // No action on single cell
      if (modifiers === 6 && (isRow || isColumn)) return true; // Prevent object creation if vector

      const selectionSet = [...query(blocks).getInRange(normalize(selection))];
      if (!selectionSet.length) return true; // No action if selection is empty

      for (let i = 0; i < selectionSet.length; i++) {
        if (blocks.get(selectionSet[i]).node) return true; // No action if selection contains formula
      }

      let result = [];

      if (isArray) {
        if (isVector)  result = makeVector(rowStart, colStart, isColumn ? rows : cols, isColumn);
        else {
          for (let i = 0; i <= rows; i++) {
            result[i] = makeVector(rowStart + i, colStart, cols, isColumn);
          }
        }
      }
      else {
        const keys = [];

        for (let i = 0; i <= cols; i++) {
          keys[i] = getCellValue(rowStart, colStart + i);
        }

        for (let i = 0; i <= rows - 1; i++) {
          let obj = {};
          rowStart += 1;

          for (let j = 0; j < keys.length; j++) {
            obj[keys[j]] = parseCell(rowStart + i, colStart + j);
          }

          result[i] = obj;
        }
      }

      convertToObject(
        thisSheet, normalize(selection),
        "= " + JSON.stringify(result),
        isArray, isVector, isColumn);

      return true;
    }

    let blockId = query(blocks).getAt(rowStart, colStart);
    let block = blocks.get(blockId);

    if (!block) return false;

    let nodeExpansion = block.expansion;

    // Prevent default edit-on-type behaviour if an expanded block is selected
    if (modifiers <= 1 && e.key.length === 1) {
      return !!nodeExpansion;
    }

    if (modifiers === 5) {  // Alt+Shift
      let labels, step;

      switch (e.code) {
        case 'ArrowLeft':   step = { h: -5, hTabSize: 5 }; break;
        case 'ArrowRight':  step = { h: 5, hTabSize: 5 }; break;
        case 'ArrowUp':     step = { v: -10, vTabSize: 10 }; break;
        case 'ArrowDown':   step = { v: 10, vTabSize: 10 }; break;
        case 'KeyZ':        if (nodeExpansion) labels = { left: !nodeExpansion.labelsLeft }; break;
        case 'KeyX':        if (nodeExpansion) labels = { top: !nodeExpansion.labelsTop }; break;
        default:
      }

      if (labels || step) {
        changeExpansion(thisSheet, blockId, { labels, step });
      }
      tick().then(() => setSelection(thisSheet, [...blocks.get(blockId).position]));
      return true;
    }
    return false;
  }

  function parseValue(value) {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    if (value.match(/^-?\d+([.,]\d+)?(e[-+]\d+)*$/gim)) {
      return Number(value.replace(",", ".").toLowerCase());
    }

    return value;
  }

  function getCellValue(row, col) {
    const block = blocks.get(query(blocks).getAt(row, col));
    return block ? block.formula || block.value : '';
  }

  function parseCell(row, col) {
    return parseValue(getCellValue(row, col));
  }

  function makeVector(row, col, count, isColumn) {
    let res = [];

    if (isColumn) {
      for (let i = 0; i <= count; i++) {
        res[i] = parseCell(row + i, col);
      }
    }
    else {
      for (let i = 0; i <= count; i++) {
        res[i] = parseCell(row, col + i);
      }
    }

    return res;
  }

</script>

{#if blocks}
  <Grid
    {blocks}
    {calculated}
    {selection}
    {copySelection}
    {transparent}
    {overflowHidden}
    bind:container
    bind:isEditMode
    onkeydown={keyDown}
    on:change={({ detail: {row, col, value} }) => editCell(thisSheet, row, col, value)}
    on:copy={() => handleClipboard("copy", thisSheet, selection)}
    on:cut={() => handleClipboard("cut", thisSheet, selection)}
    on:paste={() => handleClipboard("paste", thisSheet, selection)}
    on:contextmenu={(e) => {
      if (!isEditMode) {
        e.preventDefault(); // Enable default context menu for editor only
        event = e;
      }
    }}
  />
{/if}

<ContextMenu
  {container}
  {event}
  {selection}
/>
