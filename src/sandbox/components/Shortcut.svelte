<script>
  import { isMac } from "../../utils/ui.js";

  export let title, keys = [];
</script>

<div class="flex flex-row content-center items-baseline justify-between gap-4">
  <p class="flex-grow">{title}</p>
  <p class="flex flex-row flex-wrap justify-end gap-1">
  {#each keys as key}
    {#if key === ".." || key === "/" }
      <span class="opacity-40">{key}</span>
    {:else}
      <kbd class="px-1 pt-px pb-0 opacity-60 border border-gray-900 border-opacity-20 text-xs rounded dark:border dark:border-white dark:border-opacity-20" >
        {#if      key === "ArrowDown"}  {"↓"}
        {:else if key === "ArrowUp"}    {"↑"}
        {:else if key === "ArrowLeft"}  {"←"}
        {:else if key === "ArrowRight"} {"→"}
        {:else if key === "KeyC"}       {"C"}
        {:else if key === "KeyD"}       {"D"}
        {:else if key === "KeyV"}       {"V"}
        {:else if key === "KeyX"}       {"X"}
        {:else if key === "KeyZ"}       {"Z"}
        {:else if key === "Slash"}      {"/"}
        <!--{:else if key === "Cmd"}        {isMac() ? "⌘" : "Ctrl"}-->
        <!--{:else if key === "Alt"}        {isMac() ? "⎇" : "Alt"}-->
        {:else} {key} {/if}
      </kbd>
    {/if}
  {/each}
  </p>
</div>
