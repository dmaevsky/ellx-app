<script>
  import { onDestroy } from 'svelte';
  import { pull } from '../runtime/engine/pull';
  import { show } from '../runtime/renderNode';
  import replaceAll from '../runtime/utils/replace_all';

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
  class:text-error-900={value.startsWith("#ERR")}
  class:text-gray-600={value.startsWith("//")}
>
{@html parseLinks(value)}
</div>
