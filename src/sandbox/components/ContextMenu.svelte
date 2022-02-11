<script>
  import { tick, onMount } from 'svelte';
  import { contextMenuOpen } from '../store.js';
  import { getCoords, isMac } from "../../utils/ui.js";
  import { shortcuts } from "../../utils/shortcuts.js";

  import MenuItem from './MenuItem.svelte';

  export let handleClipboard;
  export let container;
  export let selection;
  export let event;

  let menu;
  let currentItem;
  let x, y;
  let menuNodes;
  let menuLength;

  function getShortcutsByTag(str) {
    return shortcuts.filter(i => i.tag.includes(str)).map(({ title, keys }) => [title, keys]);
  }

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

  function handleMouseHover(e) {
    for (let i = 0; i < menuLength; i++) {
      if (menuNodes[i] === e.target)  {
        currentItem = i;
        break;
      }
    }

    e.target.focus();
  }

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
      menu.style = (windowHeight < menuHeight) ? "height: 100vh; overflow-y: scroll" : "";
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

  function handleKeyDown(e) {
    if (e.code === "Escape") return contextMenuOpen.set(false);

    if (e.shiftKey) e.preventDefault(); // Prevent keyboard select

    if (e.code === "ArrowDown" || e.code === "ArrowUp") {
      if (e.code === "ArrowDown") currentItem = ++currentItem % menuLength;
      else currentItem = (currentItem > 0) ? --currentItem : menuLength - 1;

      menuNodes[currentItem].focus();
    }
  }

  $: if (event) {
    contextMenuOpen.set(true);
    currentItem = -1;

    tick().then(() => positionMenu(event));
  }

</script>

<div id="ellx-context-menu"
  bind:this={menu}
  on:contextmenu={(e) => e.preventDefault()}
  on:mousedown={(e) => e.preventDefault()}
  on:click={() => contextMenuOpen.set(false)}
  on:keydown={handleKeyDown}
  class:hidden={!$contextMenuOpen}
  tabindex="-1"
  class="absolute z-50 font-sans py-2 rounded-sm bg-gray-100 text-gray-900 border border-gray-500 border-opacity-20 text-xs
  dark:bg-gray-900 dark:text-white focus:outline-none" style="left: {x}px; top: {y}px"
>
  <ul class="flex flex-col">
    {#each menuItems as [title, keys, args]}
      {#if title !== "-"}
        {#if (title === "Copy" || title === "Cut" || title === "Paste")}
          <MenuItem
            {title} {keys}
            onmousedown={() => handleClipboard(title)}
            onmouseenter={handleMouseHover}
            onkeydown={(e) => {
              if (e.code === "Enter") {
                handleClipboard(title);
                contextMenuOpen.set(false);
              }
            }}
          />
        {:else}
          <MenuItem
            {title} {keys}
            onmousedown={() => {
              dispatchSyntheticEvent(keys)
            }}
            onmouseenter={handleMouseHover}
            onkeydown={(e) => {
              if (e.code === "Enter") {
                dispatchSyntheticEvent(keys)
                contextMenuOpen.set(false);
              }
            }}
          />
        {/if}
      {:else}
        <hr class="my-2 opacity-60" />
      {/if}
    {/each}
  </ul>
</div>
