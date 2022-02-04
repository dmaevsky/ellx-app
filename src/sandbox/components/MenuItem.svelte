<script>
  import Shortcut from "./Shortcut.svelte";

  export let onmousedown;
  export let onmouseenter;
  export let onkeydown;
  export let title, keys = [];
</script>

<li class="px-4 py-1 focus:bg-blue-600 focus:text-white focus:border-white focus:outline-none cursor-pointer capitalize"
    tabindex="-1"
    on:mousedown={onmousedown}
    on:mouseenter={onmouseenter}
    on:keydown={onkeydown}
>
  <Shortcut {title} {keys}/>
</li>