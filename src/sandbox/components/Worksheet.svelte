<script>
  import { undo, redo } from 'tinyx/middleware/undo_redo';
  import query from '../runtime/blocks';
  import { tick, setContext } from 'svelte';
  import { editCell, clearRange, setSelection } from '../runtime/actions/edit';
  import { changeExpansion, shiftCellsH, shiftCellsV } from '../runtime/actions/expansion';
  import { clipboard, copyToClipboard, pasteFromClipboard, clearClipboard } from '../runtime/actions/copypaste';
  import Grid from './Grid.svelte';

  export let transparent;
  export let overflowHidden;
  export let store;

  let selection;

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

    let modifiers = (e.altKey << 2) + (e.ctrlKey << 1) + e.shiftKey;

    if (modifiers === 0 && e.code === 'Escape') {
      if (copySelection) clearClipboard();
      return true;
    }

    let [rowStart, colStart, rowEnd, colEnd] = selection;

    if (modifiers === 0 && e.code === 'Delete') {
      clearRange(thisSheet, selection);
      return true;
    }

    if (modifiers === 2 && e.code === 'KeyZ') {
      undo(thisSheet);
    }

    if (modifiers === 2 && e.code === 'KeyY' || modifiers === 3 && e.code === 'KeyZ') {
      redo(thisSheet);
    }

    if (e.code === 'Backspace' || e.code === 'Space' || e.code === 'Tab') {
      let direction, shift;
      if (modifiers === 0 || modifiers === 6) {
        // No modifiers or Ctrl-Alt
        shift = shiftCellsH;

        if (e.code === 'Space') {
          colStart = colEnd = Math.min(colStart, colEnd);
          setSelection(thisSheet, [rowStart, colStart, rowEnd, colEnd]);
        }
        if (modifiers === 6) rowStart = 0, rowEnd = Infinity;   // Insert / delete columns
      }
      else if (modifiers === 1 || modifiers === 3) {
        // Shift or Ctrl-Shift
        shift = shiftCellsV;

        if (e.code === 'Space') {
          rowStart = rowEnd = Math.min(rowStart, rowEnd);
          setSelection(thisSheet, [rowStart, colStart, rowEnd, colEnd]);
        }
        if (modifiers === 1) colStart = 0, colEnd = Infinity;   // Insert / delete rows
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

    if (modifiers === 5) {    // Alt-Shift
      let labels, step;

      switch (e.code) {
        case 'ArrowLeft':  step = { h: -5, hTabSize: 5 };  break;
        case 'ArrowRight': step = { h: 5, hTabSize: 5 };  break;
        case 'ArrowUp': step = { v: -10, vTabSize: 10 };  break;
        case 'ArrowDown': step = { v: 10, vTabSize: 10 };  break;
        case 'KeyZ': if (nodeExpansion) labels = { left: !nodeExpansion.labelsLeft };  break;
        case 'KeyX': if (nodeExpansion) labels = { top: !nodeExpansion.labelsTop };  break;
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
    onkeydown={keyDown}
    {transparent}
    {overflowHidden}
    on:change={({ detail: {row, col, value} }) => editCell(thisSheet, row, col, value)}
    on:copy={() => copyToClipboard(thisSheet, selection, false)}
    on:cut={() => copyToClipboard(thisSheet, selection, true)}
    on:paste={() => pasteFromClipboard(thisSheet, selection)}
  />
{/if}
