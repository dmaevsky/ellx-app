<script>
  import { tick, setContext } from 'svelte';
  import { undo, redo } from 'tinyx/middleware/undo_redo';
  import query from '../blocks.js';
  import { editCell, clearRange, setSelection } from '../actions/edit.js';
  import { changeExpansion, shiftCellsH, shiftCellsV } from '../actions/expansion.js';
  import { clipboard, copyToClipboard, pasteFromClipboard, clearClipboard } from '../actions/copypaste.js';

  import Grid from './Grid.svelte';

  export let transparent;
  export let overflowHidden;
  export let store;

  let selection;
  let isEditMode;

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

    const isMacOS = navigator.userAgent.includes("Mac");

    let modifiers = (e.altKey << 2) + ((isMacOS ? e.metaKey : e.ctrlKey) << 1) + e.shiftKey;

    modifiers = isNaN(modifiers) ? 0 : modifiers; // Default modifiers for synthetic keydown event

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

    let [rowStart, colStart, rowEnd, colEnd] = selection;

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
</script>

{#if blocks}
  <Grid
    {blocks}
    {calculated}
    {selection}
    {copySelection}
    {transparent}
    {overflowHidden}
    bind:isEditMode
    onkeydown={keyDown}
    on:change={({ detail: {row, col, value} }) => editCell(thisSheet, row, col, value)}
    on:copy={() => copyToClipboard(thisSheet, selection, false)}
    on:cut={() => copyToClipboard(thisSheet, selection, true)}
    on:paste={() => pasteFromClipboard(thisSheet, selection)}
  />
{/if}
