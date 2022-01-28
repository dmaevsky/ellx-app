<script>
  import { activeNodes, types } from '../node_navigator.js';
  import { createEventDispatcher } from 'svelte';
  import { fromObservable } from '../../runtime/engine/adapters.js';

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
  class="flex-1 text-xs overflow-y-auto pointer-events-auto
       bg-gray-100 text-gray-900 border-l border-gray-500 border-opacity-20 dark:bg-gray-900 dark:text-white"
  class:hidden
  on:mouseleave={() => { deps = [] }}
>
  <div id="node-nav-toggle"
       class="absolute top-4 right-4 cursor-pointer stroke-current text-gray-900 dark:text-white opacity-40 hover:opacity-100"
       on:click={() => document.getElementById("node-navigator").classList.toggle("hidden")}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 3.5L3.5 12.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12.5 12.5L3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  <div class="nodes flex flex-col items-end align-center relative px-4 mt-6">
    {#each types as type}
      {#if $nodes[type] && $nodes[type].length}
        <div class="mt-4 caps">{type}</div>
        {#each $nodes[type] as node}
          <div
            on:mouseenter={() => highlightDeps(node)}
            on:click={() => goTo(node, type)}
            class="node flex items-center cursor-pointer relative w-full"
            class:dependant={dependants.includes(node.id)}
            class:dep={deps.includes(node.id)}
            class:error={node.isError}
          >
            <span
              class="id mr-1 text-right truncate"
              class:text-red-500={node.isError}
            >{String(node)}</span>

            <div class="flex-grow" />
            <svg class="svg" height="20" width="20">
              <circle cx="12" cy="12" r="4" stroke-width={node.size > 0 ? 4 : 2} />
            </svg>
          </div>
        {/each}
      {/if}
    {/each}
  </div>
</div>

<style>
  .id {
    opacity: 0.4;
    max-width: 16rem;
  }

  .node:hover .id {
    opacity: 1;
  }

  .node:hover .svg {
    fill: #237EB3;
    stroke: lightGray;
  }

  .svg {
    fill: #aaa;
    stroke: #eee;
  }

  :global(.dark) #node-navigator .svg {
    fill: #333;
    stroke: #666;
  }

  .nodes:hover .dep .id {
    opacity: 1;
    color: #237EB3;
  }

  .nodes:hover .dep .svg {
    fill: #237EB3;
    stroke: #237EB3;
  }

  .nodes:hover .dependant .id {
    opacity: 1;
    color: #ff9800;
  }

  .nodes:hover .dependant .svg {
    fill: #ff9800;
    stroke: #ff9800;
  }

  .nodes .error .svg {
    fill: #f44336;
    stroke: #f44336;
  }

  @media (max-width: 768px) {
    #node-navigator {
      display: none;
    }
  }
</style>
