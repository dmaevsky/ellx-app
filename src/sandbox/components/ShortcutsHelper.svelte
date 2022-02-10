<script>
  import { shortcutsHelperOpen } from '../store.js';
  import { shortcuts } from "../../utils/shortcuts.js";

  import Shortcut from "./Shortcut.svelte";

  function getShortcuts(str) {
    return shortcuts.filter(i => i.tag.includes(str));
  }

  const shortcutsGroups = ["grid", "expansion", "interface", "common"].map(i => [i, getShortcuts(i)]);
</script>

<div id="ellx-shortcuts-helper"
  class="relative w-full py-4 px-16 overflow-auto pointer-events-auto
        text-xs bg-gray-100 text-gray-900 border-t border-gray-500 border-opacity-20
        flex flex-col md:px-24 xl:px-44 dark:bg-gray-900 dark:text-white"
  class:hidden={!$shortcutsHelperOpen}
  on:mousedown={(e) => e.preventDefault()}
>
  <div class="absolute top-4 right-4 stroke-current text-gray-900 dark:text-white opacity-40 hover:opacity-100"
    on:click={() => shortcutsHelperOpen.update(value => !value)}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 3.5L3.5 12.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.5 12.5L3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 md:gap-x-12 lg:gap-x-8 xl:gap-x-12 gap-8 w-full">
    {#each shortcutsGroups as [tag, item]}
      <div class="flex flex-col gap-2">
        <h4 class="opacity-40 text-sm font-normal capitalize">{tag}</h4>
          {#each item as { title, keys }}
              <Shortcut {title} {keys}/>
          {/each}
        </div>
    {/each}
  </div>
</div>
