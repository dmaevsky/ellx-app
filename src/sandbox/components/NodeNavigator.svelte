<script>
  import { activeNodes, types } from '../runtime/node_navigator';
  import { createEventDispatcher } from 'svelte';
  import { fromObservable } from '../runtime/adapters';

  const dispatch = createEventDispatcher();
  let deps = [], dependants = [];

  const nodes = fromObservable(activeNodes);

  function scrollToNode(id) {
    const el = document.querySelector(`[data-ellx-node-name="${id}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      const parentWithLine = el.closest("[data-line-from]");
      if (parentWithLine) {
        dispatch('goToLine', parentWithLine.getAttribute('data-line-from'));
      }
    }
  }

  function goTo(node, type) {
    dispatch('navigate', type);

    if (type === 'ellx') {
      node.select();
    } else {
      scrollToNode(node.id);
    }
  }

  function highlightDeps(node) {
    ({ deps, dependants } = node);

    if (node.select) node.select();
  }

  let hidden = true;

  $: hasNodes = Object.values($nodes).some(i => i.length > 0);
</script>

<div id="node-navigator"
  class="dark:text-white text-black fixed top-0 right-0 h-screen bg-white dark:bg-dark-600 transition duration-150 z-50 nodes border-l border-gray-200 dark:border-gray-700 overflow-y-auto"
  class:hidden
  on:mouseleave={() => { deps = []}}
>
  <span id="node-nav-toggle"
    class="p-1 select-none rounded-full flex items-center justify-center h-4 w-4 mr-2 absolute top-0 right-0 m-2 text-red-500 bg-red-100 z-50 cursor-pointer hover:bg-primary-500 hover:text-white transition duration-150"
    style="font-size: 12px"
    on:click={() => {
      //hidden = true;
      document.getElementById("node-navigator").classList.toggle("hidden");
    }}>&times;</span>
  <div class="flex flex-col items-end align-center relative px-3 mt-4">
    {#each types as type}
      {#if $nodes[type] && $nodes[type].length}
        <div class="mt-4 caps">{type}</div>
        {#each $nodes[type] as node}
          <div
            on:mouseenter={() => highlightDeps(node)}
            on:click={() => goTo(node, type)}
            class="node"
            class:dependant={dependants.includes(node.id)}
            class:dep={deps.includes(node.id)}
            class:error={node.isError}
          >
            <span class="id">{String(node)}</span>
            <div class="flex-grow" />
            <svg height="20" width="20">
              <circle cx="10" cy="10" r="3" stroke-width={node.size > 0 ? 3 : 1} />
            </svg>
          </div>
        {/each}
      {/if}
    {/each}
  </div>
</div>

<style>
  .hidden {
    display: none;
  }

  .id {
    opacity: 0.3;
  }

  .nodes {
    font-size: 0.6rem;
  }

  .nodes:hover .id {
    opacity: 0.5;
  }

  .node:hover .id {
    opacity: 1;
  }

  .node:hover svg {
    fill: #237EB3;
    stroke: lightGray;
  }

  svg {
    fill: #aaa;
    stroke: #eee;
    @apply transition duration-300;
  }

  :global(.mode-dark) svg {
    fill: #333;
    stroke: #666;
  }

  .nodes:hover .dep .id {
    @apply opacity-100 text-primary-500;
  }

  .nodes:hover .dep svg {
    fill: #237EB3;
    stroke: #237EB3;
  }

  .nodes:hover .dependant .id {
    @apply opacity-100 text-alert-500;
  }

  .nodes:hover .dependant svg {
    fill: #ff9800;
    stroke: #ff9800;
  }

  .nodes .error {
    @apply text-error-500;
  }

  .nodes .error svg {
    fill: #f44336;
    stroke: #f44336;
  }

  .id {
    @apply transition duration-150 mr-1 text-right truncate;
    max-width: 16rem;
  }

  .node {
    @apply flex items-center cursor-pointer relative w-full;
  }

  @media (max-width: 768px) {
    #node-navigator {
      display: none;
    }
  }
</style>