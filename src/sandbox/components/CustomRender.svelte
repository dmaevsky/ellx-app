<script>
  export let component;
  export let rowSpan;
  export let colSpan;
  export let rowHeight = 20;
  export let columnWidth = 100;

  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();

  let target = null;
  let [nRows, nCols] = [rowSpan, colSpan];

  onMount(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (target.offsetParent === null) return; // target is hidden

      [nRows, nCols] = [
        Math.ceil(target.scrollHeight / rowHeight) || 1,
        Math.ceil(target.scrollWidth / columnWidth) || 1
      ];
    });

    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  });

  $: if (target) {
    // This will run every time a new component is passed
    for (let el of target.childNodes) el.remove();
    component.render(target);
  }

  $: dispatch('resize', { nRows, nCols });    // Dispatch an event if width or height changes

  function mouseDown(e) {
    if (!e.shiftKey) e.stopPropagation();
  }
</script>

<div bind:this={target} on:mousedown={mouseDown}></div>
