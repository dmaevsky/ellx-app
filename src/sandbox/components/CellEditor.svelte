<script>
  export let value;
  export let transparent = false;
  export let node = null;
</script>

<style>
  .grid__selection-border {
    border: 2px solid rgb(0, 128, 255);
  }
  .grid__editor {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    outline: none;
    resize: none;
    white-space: nowrap;
    overflow: hidden;
  }
</style>

<textarea
        tabindex="-1"
        class="grid__editor grid__selection-border bg-white"
        class:dark:text-white={!transparent}
        class:dark:text-gray-800={transparent}
        class:dark:bg-dark-500={!transparent}
        bind:this={node}
        bind:value
        on:input
        on:keydown
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
/>
