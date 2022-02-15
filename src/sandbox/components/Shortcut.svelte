<script>
  import { isMac } from "../../utils/ui.js";

  export let title, keys = [];

  function substituteKey(key) {
    switch (key) {
      case "ArrowDown":   return "↓";
      case "ArrowUp":     return "↑";
      case "ArrowLeft":   return "←";
      case "ArrowRight":  return "→";
      case "KeyC":        return "C";
      case "KeyD":        return "D";
      case "KeyV":        return "V";
      case "KeyX":        return "X";
      case "KeyZ":        return "Z";
      case "Slash":       return "/";
      case "Cmd":         return isMac() ? "⌘" : "Ctrl";
      case "Alt":         return isMac() ? "⎇" : "Alt";
      default:            return key;
    }
  }
</script>

<div class="flex flex-row content-center items-baseline justify-between gap-4">
  <p class="flex-grow">{title}</p>
  <p class="flex flex-row flex-wrap justify-end gap-1">
  {#each keys as key}
    {#if key === ".." || key === "/" }
      <span class="opacity-40">{key}</span>
    {:else}
      <kbd class="px-1 pt-px pb-0 opacity-60 border border-gray-900 border-opacity-20 text-xs rounded dark:border dark:border-white dark:border-opacity-20" >
        {substituteKey(key)}
      </kbd>
    {/if}
  {/each}
  </p>
</div>
