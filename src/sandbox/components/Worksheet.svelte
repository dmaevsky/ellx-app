<script>
  import { tick, setContext } from 'svelte';
  import { undo, redo } from 'tinyx/middleware/undo_redo';
  import query from '../blocks.js';
  import { editCell, clearRange, setSelection } from '../actions/edit.js';
  import { changeExpansion, shiftCellsH, shiftCellsV } from '../actions/expansion.js';
  import { clipboard, copyToClipboard, pasteFromClipboard, clearClipboard } from '../actions/copypaste.js';
  import { getCoords } from "../../utils/ui";

  import Grid from './Grid.svelte';
  import Shortcut from "./Shortcut.svelte";

  export let transparent;
  export let overflowHidden;
  export let store;

  let selection;
  let isEditMode;
  let container;
  let menu;
  let currentItem = -1;
  let isContextMenu = false;
  let x, y;

  const rowHeight = 20, columnWidth = 100;

  $: hidden = !isContextMenu;
  $: if (!isContextMenu) currentItem = -1;

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
      isContextMenu = false;
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

  function createSyntheticEvent(code, shiftKey = false, altKey = false, ctrlKey = false) {
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
    return event;
  }

  async function handleContextMenu(e) {
    e.preventDefault();
    isContextMenu = true;

    await tick();

    const windowInnerWidth = document.documentElement.clientWidth;
    const windowInnerHeight = document.documentElement.clientHeight;
    const menu = document.querySelector("#context-menu");

    if (e.buttons !== 2) {
      const [row, col] = selection;
      [x, y] = [(col + 1) * columnWidth, (row + 1) * rowHeight];
    }
    else {
      [x, y] = getCoords(container, e);
    }

    x = (x + menu.clientWidth >= windowInnerWidth) ? x - menu.clientWidth : x;
    y = (y + menu.clientHeight >= windowInnerHeight) ? y - menu.clientHeight : y;

    menu.focus();
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
    bind:isContextMenu
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

<div id="context-menu"
     bind:this={menu}
     on:contextmenu={(e) => e.preventDefault()}
     on:mousedown={(e) => e.preventDefault()}
     on:click={() => {isContextMenu = false}}
     on:keydown={(e) => {
       if (e.code === "Escape") return isContextMenu = false;

       const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== "");
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
     class:hidden
     tabindex="-1"
     class="absolute z-50 font-sans py-2 rounded-sm bg-gray-100 text-gray-900 border border-gray-500 border-opacity-20 text-xs
          dark:bg-gray-900 dark:text-white focus:outline-none" style="left: {x}px; top: {y}px">
  <ul class="flex flex-col">
    {#each [
      ["cut", ["Cmd", "X"]],
      ["copy", ["Cmd", "C"]],
      ["paste", ["Cmd", "V"]]
    ] as [title, keys] }
      <li class="px-4 py-1 focus:bg-blue-600 focus:text-white focus:border-white focus:outline-none cursor-pointer capitalize"
          tabindex="-1"
          on:click={() => {
            handleClipboard(title);
          }}
          on:mouseenter={(e) => {
            const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== "");
            const menuLength = menuItems.length;
            for (let i = 0; i < menuLength; i++) {
              if (menuItems[i] === e.target)  {
                currentItem = i;
                break;
              }
            }
            e.target.focus();
          }}
          on:keydown={(e) => {
            if (e.code === "Enter") {
              handleClipboard(title);
              isContextMenu = false;
            }
          }}
      >
        <Shortcut {title} {keys}/>
      </li>
    {/each}
    <hr class="my-2 opacity-60" />
    {#each [
      ["Shift cells right", ["Space"], ["Space"]],
      ["Shift cells left", ["Backspace"], ["Backspace"]],
      ["Insert row", ["Space", true], ["Shift", "Space"]],
      ["Remove row", ["Backspace", true], ["Shift", "Backspace"]],
      ["Shift cells down", ["Space", true, false, true], ["Cmd", "Shift", "Space"]],
      ["Shift cells up", ["Backspace", true, false, true], ["Cmd", "Shift", "Backspace"]],
      ["Insert column", ["Space", false, true, true], ["Cmd", "Alt", "Space"]],
      ["Remove column", ["Backspace", false, true, true], ["Backspace"]],
      ["Clear contents", ["Delete"], ["Delete"]]
    ] as [title, args, keys] }
      <li class="px-4 py-1 focus:bg-blue-600 focus:text-white focus:border-white focus:outline-none cursor-pointer capitalize"
          tabindex="-1"
          on:click={container.dispatchEvent(createSyntheticEvent(...args))}
          on:mouseenter={(e) => {
            const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== "");
            const menuLength = menuItems.length;
            for (let i = 0; i < menuLength; i++) {
              if (menuItems[i] === e.target)  {
                currentItem = i;
                break;
              }
            }
            e.target.focus();
          }}
          on:keydown={(e) => {
            if (e.code === "Enter") {
              container.dispatchEvent(createSyntheticEvent(...args));
              isContextMenu = false;
            }
          }}
      >
        <Shortcut {title} {keys}/>
      </li>
    {/each}
    <hr class="my-2 opacity-60" />
    {#each [
      ["Expand in row", ["ArrowRight", true, true], ["Shift", "Alt", "→"]],
      ["Collapse in row", ["ArrowLeft", true, true], ["Shift", "Alt", "←"]],
      ["Expand in column", ["ArrowDown", true, true], ["Shift", "Alt", "↓"]],
      ["Collapse in column", ["ArrowUp", true, true], ["Shift", "Alt", "↑"]],
      ["Toggle row labels", ["KeyZ", true, true], ["Shift", "Alt", "Z"]],
      ["Toggle column labels", ["KeyX", true, true], ["Shift", "Alt", "X"]],
      ["Toggle comments", ["Slash", false, false, true], ["Ctrl", "//"]]
    ] as [title, args, keys] }
      <li class="px-4 py-1 focus:bg-blue-600 focus:text-white focus:border-white focus:outline-none cursor-pointer capitalize"
          tabindex="-1"
          on:click={container.dispatchEvent(createSyntheticEvent(...args))}
          on:mouseenter={(e) => {
            const menuItems = [...menu.firstChild.children].filter(item => item.innerText !== "");
            const menuLength = menuItems.length;
            for (let i = 0; i < menuLength; i++) {
              if (menuItems[i] === e.target)  {
                currentItem = i;
                break;
              }
            }
            e.target.focus();
          }}
          on:keydown={(e) => {
            if (e.code === "Enter") {
              container.dispatchEvent(createSyntheticEvent(...args));
              isContextMenu = false;
            }
          }}
      >
        <Shortcut {title} {keys}/>
      </li>
    {/each}
  </ul>
</div>
