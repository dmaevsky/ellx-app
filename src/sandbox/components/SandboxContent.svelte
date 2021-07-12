<script>
  import { onMount, tick } from 'svelte';
  import * as actions from '../runtime/lifecycle';
  import Worksheet from './Worksheet';
  import NodeNavigator from './NodeNavigator';
  import MarkdownOutput from './MarkdownOutput';
  import Tailwind from './Tailwind';
  import { combination } from '../runtime/utils/mod_keys';
  import { SET_ACTIVE_CONTENT } from '../runtime/mutations';

  import store, { devServer, contents, getSheet, notifyParent } from '../runtime/store';
  import CalcGraph from '../runtime/engine/calc_graph';
  import { graphs } from '../runtime/store';
  import { resolveSiblings, resolveRequire } from '../runtime/hydrated';

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

  onMount(() => {
    devServer.addEventListener('message', listen);
    return () => devServer.removeEventListener('message', listen);
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

<NodeNavigator
  on:goToLine={goToLine}
  on:navigate={navigate}
/>

{#each sheets as contentId (contentId)}
  <div class="sheet" id="sheet-{contentId}" class:hidden={contentId !== activeContentId}>
    <Worksheet store={getSheet(contentId)}/>
  </div>
{/each}

<div id="md" class:hidden={htmlContentId !== activeContentId}>
  <div data-ellx-node-name="init" data-ellx-node-formula="app()">
  </div>

  <MarkdownOutput cg={htmlCalcGraph}/>
</div>

<Tailwind />
