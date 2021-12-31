<script>
  import { onMount, tick } from 'svelte';
  import * as actions from '../runtime/lifecycle';
  import Worksheet from './Worksheet';
  import NodeNavigator from './NodeNavigator';
  import HelpMenu from './HelpMenu';
  import ShortcutsHelper from "./ShortcutsHelper.svelte";
  import Tailwind from './Tailwind';
  import { combination } from '../runtime/utils/mod_keys';
  import { SET_ACTIVE_CONTENT } from '../runtime/mutations';

  import store, { devServer, contents, getSheet } from '../runtime/store';
  import CalcGraph from '../runtime/engine/calc_graph';
  import { graphs } from '../runtime/store';
  import { resolveSiblings, resolveRequire } from '../runtime/hydrated';
  import mountEllxApp from '../runtime/mount_app.js';

  const htmlContentId = 'mainApp';

  const htmlCalcGraph = new CalcGraph(
    resolveSiblings('html', htmlContentId),
    resolveRequire('html', htmlContentId)
  );

  graphs.set(htmlContentId, htmlCalcGraph);
  htmlCalcGraph.autoCalc.set(true);

  setActiveContent(htmlContentId);

  let darkMode = false;

  $: activeContentId = $store.activeContentId;
  $: sheets = [...$contents.keys()];

  function setActiveContent(contentId) {
    store.commit(SET_ACTIVE_CONTENT, { contentId });
  }

  function togglePanel(id) {
    document.getElementById(id).classList.toggle("hidden");
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

  onMount(() => {
    mountEllxApp(mountPoint, htmlCalcGraph);

    devServer.addEventListener('message', listen);
    return () => devServer.removeEventListener('message', listen);
  });

  function kbListen(e) {
    const shortcut = combination(e);

    switch (shortcut) {
      case 'Alt+KeyD':
        e.preventDefault();
        toggleDark(darkMode = !darkMode);
        return;
      case 'Shift+Alt+Slash':
        e.preventDefault();
        togglePanel("shortcuts-helper");
        return;
      case 'Shift+Alt+Period':
        e.preventDefault();
        togglePanel("node-navigator");
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
    const container = document.querySelector(`#sheet-${contentId} .grid__container`);
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

{#each sheets as contentId (contentId)}
  <div class="sheet" id="sheet-{contentId}" class:hidden={contentId !== activeContentId}>
    <Worksheet store={getSheet(contentId)}/>
  </div>
{/each}

<div id="md" bind:this={mountPoint} class:hidden={htmlContentId !== activeContentId}>
</div>

<HelpMenu/>

<div class="fixed top-0 left-0 z-100 pointer-events-none w-full h-screen flex flex-col justify-end items-end">
  <NodeNavigator
          on:goToLine={goToLine}
          on:navigate={navigate}
  />
  <ShortcutsHelper/>
</div>



<Tailwind/>
