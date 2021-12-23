<script>
  import { onMount, tick } from 'svelte';
  import * as actions from '../runtime/lifecycle.js';
  import Worksheet from './Worksheet.svelte';
  import NodeNavigator from './NodeNavigator.svelte';
  import Tailwind from './Tailwind.svelte';
  import { combination } from '../runtime/utils/mod_keys.js';
  import { SET_ACTIVE_CONTENT } from '../runtime/mutations.js';

  import store, { Module, devServer, contents, getSheet } from '../runtime/store.js';
  import CalcGraph from '../runtime/engine/calc_graph.js';
  import mountEllxApp from '../runtime/mount_app.js';

  const htmlContentId = 'file:///src/index.html';

  const htmlCalcGraph = new CalcGraph(
    htmlContentId,
    url => Module.get(url),
    url => Module.require(url, htmlContentId)
  );

  Module.set(htmlContentId, htmlCalcGraph);
  htmlCalcGraph.autoCalc.set(true);

  setActiveContent(htmlContentId);

  let darkMode = false;

  $: activeContentId = $store.activeContentId;
  $: sheets = [...$contents.keys()];

  function setActiveContent(contentId) {
    store.commit(SET_ACTIVE_CONTENT, { contentId });
  }

  function escapeId(contentId) {
    return contentId.replace(/[^a-zA-Z0-9-_]+/g, '-');
  }

  function listen({ data }) {
    try {
      const { type, args } = JSON.parse(data);

      if (type in actions) {
        actions[type](...args);
      }
      else throw new Error('Unknown action', type);
    }
    catch (error) {
      console.error(error.message);
    }
  }

  let mountPoint;
  let devServerConnected = true;

  function disconnect() {
    devServerConnected = false;
  }

  onMount(() => {
    mountEllxApp(mountPoint, htmlCalcGraph);

    devServer.addEventListener('message', listen);
    devServer.addEventListener('close', disconnect);

    return () => {
      devServer.removeEventListener('message', listen);
      devServer.removeEventListener('close', disconnect);
    }
  });

  function kbListen(e) {
    const shortcut = combination(e);

    if (shortcut === 'Alt+KeyD') {
      e.preventDefault();
      toggleDark(darkMode = !darkMode);
      return;
    }

    const digit = (/^Alt\+Digit([1-9])$/.exec(shortcut) || [])[1];
    if (!digit) return;

    e.preventDefault();

    if (digit === '1') {
      setActiveContent(htmlContentId);
    }
    else if (digit - 2 < sheets.length) {
      const contentId = sheets[digit - 2];
      setActiveContent(contentId);
      tick().then(() => focus(contentId));
    }
  }

  function goToLine({ detail }) {
    // notifyParent({
    //   line: detail,
    //   type: 'go-to-line',
    // })
  }

  function navigate({ detail }) {
    // detail === 'ellx|md|html'
    // can use to navigate to node definition in VS code extension

    // notifyParent({
    //   type: 'anchor',
    //   href: process.env.CLIENT_URL
    //     + '/'
    //     + $activeTab.replace(/\.[^.]*$/, '.' + detail)
    // });
  }

  function toggleDark(v) {
    if (v) {
      document.body.classList.add('mode-dark');
    } else {
      document.body.classList.remove('mode-dark');
    }
  }

  function focus(contentId) {
    const container = document.querySelector(`#sheet-${escapeId(contentId)} .grid__container`);
    if (container) container.focus();
  }

</script>

<svelte:window
  on:keydown={kbListen}
/>

<style>
  /*! purgecss start ignore */
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    background-color: transparent !important;
  }
  .sheet {
    position: absolute;
    width: 100%;
    height: 100%;
  }
  /*! purgecss end ignore */
</style>

<NodeNavigator
  on:goToLine={goToLine}
  on:navigate={navigate}
/>

{#each sheets as contentId (contentId)}
  <div class="sheet" id="sheet-{escapeId(contentId)}" class:hidden={contentId !== activeContentId}>
    {#if devServerConnected}
      <Worksheet store={getSheet(contentId)}/>
    {:else}
      <div class="text-error-500">Dev server disconnected...</div>
    {/if}
  </div>
{/each}

<div id="md" bind:this={mountPoint} class:hidden={htmlContentId !== activeContentId}>
</div>

<Tailwind />
