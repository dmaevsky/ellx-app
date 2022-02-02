<script>
  import { onDestroy } from 'svelte';
  import { pull } from '../../runtime/engine/pull.js';
  import { show } from '../../runtime/renderNode.js';
  import replaceAll from '../../utils/replace_all.js';

  export let cell;
  let value = '[Cancelled]';
  let stop;

  $: {
    if (stop) stop();
    stop = pull(cell, r => value = show(r));
  }

  onDestroy(() => stop && stop());

  const URLs = /\[([^\[]+)\]\(([^)]*)\)/g;
  const parseLinks = v => replaceAll(v, URLs, (_, text, href) => `<a href="${href}">${text}</a>`);

</script>

<div
  class:text-red-500={value.startsWith("#ERR")}
  class:text-gray-500={value.startsWith("//")}
>
{@html parseLinks(value)}
</div>

<style>
  :global(.gridlines a) {
    color: rgb(30, 64, 175);
    text-decoration: underline;
  }
  :global(.gridlines a:hover) {
    color: rgb(66, 166, 245);
  }
</style>
