<script>
  import { tick, onMount, getContext } from 'svelte';
  import { contextMenuOpen } from '../store.js';
  import { getCoords, isMac } from "../../utils/ui.js";
  import { shortcuts } from "../../utils/shortcuts.js";
  import { handleClipboard } from "../actions/copypaste.js";

  import Shortcut from "./Shortcut.svelte";

  export let container;
  export let selection;
  export let event;

  let menu;
  let currentItem;
  let x, y;
  let menuNodes;
  let menuLength;

  const thisSheet = getContext('store');
  const rowHeight = 20, columnWidth = 100;

  const menuItems = [
    ...getShortcutsByTag("clipboard"),
    ["-"],
    ...getShortcutsByTag("grid"),
    ["-"],
    ...getShortcutsByTag("expansion")
  ];

  onMount(() => {
    menuNodes = [...menu.firstChild.children].filter(item => item.innerText !== ""); // Ignore dividers
    menuLength = menuNodes.length;
  });

  function dispatchSyntheticEvent(keys) {
    const event = new Event("keydown", {
      "bubbles" : true,
      "cancelable": true
    });

    // Event is dispatched only if all modifiers are explicitly set
    event.shiftKey = false;
    event.altKey = false;
    event.ctrlKey = false;
    event.metaKey = false;

    keys.forEach(key => {
      if (key === "Shift") event.shiftKey = true;
      else if (key === "Alt") event.altKey = true;
      else if (key === "Cmd") {
        event.ctrlKey = true;

        if (isMac()) {
          event.metaKey = true;
          event.ctrlKey = false;
        }
      }
      else {
        event.code = key;
      }
    });

    container.dispatchEvent(event);
  }

  function getShortcutsByTag(str) {
    return shortcuts.filter(i => i.tag.includes(str)).map(({ title, keys, tag }) => [title, keys, tag]);
  }

  function handleKeyDown(e) {
    if (e.code === "Escape") return contextMenuOpen.set(false);

    if (e.shiftKey) e.preventDefault(); // Prevent keyboard select

    if (e.code === "ArrowDown" || e.code === "ArrowUp") {
      if (e.code === "ArrowDown") currentItem = ++currentItem % menuLength;
      else currentItem = (currentItem > 0) ? --currentItem : menuLength - 1;

      menuNodes[currentItem].focus();
    }
  }

  function handleMouseHover(e) {
    for (let i = 0; i < menuLength; i++) {
      if (menuNodes[i] === e.target)  {
        currentItem = i;
        break;
      }
    }

    e.target.focus();
  }

  function handleMenuAction(title, keys, tag) {
    if (tag.includes("clipboard")) handleClipboard(title, thisSheet, selection);
    else dispatchSyntheticEvent(keys);
  }

  function positionMenu(e) {
    const windowHeight = document.documentElement.clientHeight;
    const windowWidth = document.documentElement.clientWidth;
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
      y = windowHeight - menuHeight;
    }
    else {
      if (y + menuHeight > windowHeight) {
        if (y >= menuHeight) y -= menuHeight;
        else y = windowHeight - (menuHeight + 2); // Prevent vertical scrollbar by excluding menu border
      }
    }

    if (x + menuWidth > windowWidth) {
      if (x >= menuWidth) x -= menuWidth;
      else x = windowWidth - menuWidth;
    }

    menu.focus();
  }

  $: if (event) {
    contextMenuOpen.set(true);
    currentItem = -1;

    tick().then(() => positionMenu(event));
  }

</script>

<div id="ellx-context-menu" class="absolute flex flex-col z-50 font-sans py-2 rounded-sm bg-gray-100 text-gray-900 border border-gray-500 border-opacity-20 text-xs dark:bg-gray-900 dark:text-white focus:outline-none max-h-screen overflow-y-auto" style="left: {x}px; top: {y}px"
  tabindex="-1"
  bind:this={menu}
  on:contextmenu={(e) => e.preventDefault()}
  on:mousedown={(e) => e.preventDefault()}
  on:click={() => contextMenuOpen.set(false)}
  on:keydown={handleKeyDown}
  class:hidden={!$contextMenuOpen}
>
  <ul class="flex flex-col">
    {#each menuItems as [title, keys, tag]}
      {#if title !== "-"}
        <li class="px-4 py-1 focus:bg-blue-600 focus:text-white focus:border-white focus:outline-none cursor-pointer capitalize"
          tabindex="-1"
          on:keydown={(e) => {
            if (e.code === "Enter") {
              handleMenuAction(title, keys, tag)
              contextMenuOpen.set(false);
            }
          }}
          on:mousedown={() => handleMenuAction(title, keys, tag)}
          on:mouseenter={handleMouseHover}
        >
          <Shortcut {title} {keys}/>
        </li>
      {:else}
        <hr class="my-2 opacity-60" />
      {/if}
    {/each}
  </ul>
</div>
