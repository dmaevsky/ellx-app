<script>
  import { isMac } from "../../utils/ui.js";

  export let title, keys = [];

  const switchCmd = isMac() ? "Cmd" : "Ctrl";
</script>

<div class="flex flex-row content-center items-baseline justify-between gap-4">
  <p class="flex-grow">{title}</p>
  <p class="flex flex-row gap-1">
  {#each keys as key}
    {#if key === ".." || key === "/" }
      <span class="opacity-40">{key}</span>
    {:else if key === "//" }
      <kbd
        class="px-1 border border-gray-900 border-opacity-40 text-xs rounded-sm dark:border dark:border-white dark:border-opacity-40"
      >/</kbd>
    {:else}
      <kbd
        class="px-1 border border-gray-900 border-opacity-40 text-xs rounded-sm dark:border dark:border-white dark:border-opacity-40"
      >{key === "Cmd" ? `${switchCmd}` : key}</kbd>
    {/if}
  {/each}
  </p>
</div>
