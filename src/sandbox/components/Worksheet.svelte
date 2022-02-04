<script>
  import { tick, setContext } from 'svelte';
  import { undo, redo } from 'tinyx/middleware/undo_redo';
  import query from '../blocks.js';
  import { editCell, clearRange, setSelection } from '../actions/edit.js';
  import { changeExpansion, shiftCellsH, shiftCellsV } from '../actions/expansion.js';
  import { clipboard, copyToClipboard, pasteFromClipboard, clearClipboard } from '../actions/copypaste.js';
  import { getCoords } from "../../utils/ui";
  import { contextMenuOpen } from '../store.js';

  import Grid from './Grid.svelte';
  import MenuItem from './MenuItem.svelte';

  export let transparent;
  export let overflowHidden;
  export let store;

  let selection;
  let isEditMode;
  let container;
  let menu;
  let currentItem = -1;
  let x, y;

  const rowHeight = 20, columnWidth = 100;

  $: if (!$contextMenuOpen) currentItem = -1;

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
      contextMenuOpen.set(false);
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

  function handleClipboard(action) {
    switch (action) {
      case "copy":  copyToClipboard(thisSheet, selection, false); break;
      case "cut":   copyToClipboard(thisSheet, selection, true); break;
      case "paste": pasteFromClipboard(thisSheet, selection);
    }
  }

  function dispatchSyntheticEvent(code, shiftKey = false, altKey = false, ctrlKey = false) {
    const event = new Event("keydown", {
      "bubbles" : true,
      "cancelable": true
    });

    event.code = code;
    event.shiftKey = shiftKey;
    event.altKey = altKey;
    event.ctrlKey = ctrlKey;

    if (navigator.platform.match('Mac') && ctrlKey) {
      event.metaKey = true;
      event.ctrlKey = false;
    }

    container.dispatchEvent(event);
  }

  function positionMenu(e) {
    const windowHeight = document.documentElement.clientHeight;
    const windowWidth = document.documentElement.clientWidth;

    const menu = document.querySelector("#ellx-context-menu");
    const menuHeight = menu.clientHeight;
    const menuWidth = menu.clientWidth;

    if (e.buttons !== 2) {
      const [row, col] = selection;
      [x, y] = [(col + 1) * columnWidth, (row + 1) * rowHeight];
    }
    else {
      [x, y] = getCoords(container, e);
    }

    if (windowHeight < menuHeight) {
      menu.style = (windowHeight < menuHeight) ? "height: 100vh; overflow-y: scroll" : "";
      y = windowHeight - menuHeight;
    }
    else {
      if (y + menuHeight > windowHeight) {
        if (y >= menuHeight) y -= menuHeight;
        else y = windowHeight - (menuHeight + 2); // Prevent vertical scrollbar by excluding menu border width
      }
    }

    if (x + menuWidth > windowWidth) {
      if (x >= menuWidth) x -= menuWidth;
      else x = windowWidth - menuWidth;
    }

    menu.focus();
  }

  async function handleContextMenu(e) {
    e.preventDefault();
    $contextMenuOpen = true;

    await tick();

    positionMenu(e);
  }

  function handleMouseHover(e) {
    const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== "");
    const menuLength = menuItems.length;
    for (let i = 0; i < menuLength; i++) {
      if (menuItems[i] === e.target)  {
        currentItem = i;
        break;
      }
    }
    e.target.focus();
  }

  const menuItems = [
    ["cut", ["Cmd", "X"]],
    ["copy", ["Cmd", "C"]],
    ["paste", ["Cmd", "V"]],
    ["-"],
    ["Shift cells right", ["Space"], ["Space"]],
    ["Shift cells left", ["Backspace"], ["Backspace"]],
    ["Insert row", ["Shift", "Space"], ["Space", true]],
    ["Remove row", ["Shift", "Backspace"], ["Backspace", true]],
    ["Shift cells down", ["Cmd", "Shift", "Space"], ["Space", true, false, true]],
    ["Shift cells up", ["Cmd", "Shift", "Backspace"], ["Backspace", true, false, true]],
    ["Insert column", ["Cmd", "Alt", "Space"], ["Space", false, true, true]],
    ["Remove column", ["Backspace"], ["Backspace", false, true, true]],
    ["Clear contents", ["Delete"], ["Delete"]],
    ["-"],
    ["Expand in row", ["Shift", "Alt", "→"], ["ArrowRight", true, true]],
    ["Collapse in row", ["Shift", "Alt", "←"], ["ArrowLeft", true, true]],
    ["Expand in column", ["Shift", "Alt", "↓"], ["ArrowDown", true, true]],
    ["Collapse in column", ["Shift", "Alt", "↑"], ["ArrowUp", true, true]],
    ["Toggle row labels", ["Shift", "Alt", "Z"], ["KeyZ", true, true]],
    ["Toggle column labels", ["Shift", "Alt", "X"], ["KeyX", true, true]],
    ["Toggle comments", ["Ctrl", "//"], ["Slash", false, false, true]]
  ];

  function onkeydown(e, fn) {
    if (e.code === "Enter") {
     fn();
     contextMenuOpen.set(false);
    }
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
    on:copy={() => handleClipboard("copy")}
    on:cut={() => handleClipboard("cut")}
    on:paste={() => handleClipboard("paste")}
    on:contextmenu={(e) => {
      if (!isEditMode) handleContextMenu(e);
      currentItem = -1;
    }}
  />
{/if}

<div id="ellx-context-menu"
  bind:this={menu}
  on:contextmenu={(e) => e.preventDefault()}
  on:mousedown={(e) => e.preventDefault()}
  on:click={() => {contextMenuOpen.set(false)}}
  on:keydown={(e) => {
    if (e.code === "Escape") return contextMenuOpen.set(false);
    if (e.shiftKey) e.preventDefault(); // Prevent keyboard select

    const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== ""); // Ignore dividers
    const menuLength = menuItems.length;

    if (e.code === "ArrowDown") {
      currentItem++;
      currentItem %= menuLength;
      menuItems[currentItem].focus();
    }

    if (e.code === "ArrowUp") {
      currentItem = Math.abs(--currentItem + menuLength);
      currentItem %= menuLength;
      menuItems[currentItem].focus();
    }
  }}
  class:hidden={!$contextMenuOpen}
  tabindex="-1"
  class="absolute z-50 font-sans py-2 rounded-sm bg-gray-100 text-gray-900 border border-gray-500 border-opacity-20 text-xs
      dark:bg-gray-900 dark:text-white focus:outline-none" style="left: {x}px; top: {y}px"
>
  <ul class="flex flex-col">
    {#each menuItems as [title, keys, args] }
      {#if title !== "-"}
        {#if !args}
          <MenuItem
            {title} {keys}
            onmousedown={() => handleClipboard(title)}
            onmouseenter={handleMouseHover}
            onkeydown={(e) => onkeydown(e, () => handleClipboard(title))}
          />
        {:else}
          <MenuItem
            {title} {keys}
            onmousedown={() => dispatchSyntheticEvent(...args)}
            onmouseenter={handleMouseHover}
            onkeydown={(e) => onkeydown(e, () => dispatchSyntheticEvent(...args))}
          />
        {/if}
      {:else}
        <hr class="my-2 opacity-60" />
      {/if}
    {/each}
  </ul>
</div>
