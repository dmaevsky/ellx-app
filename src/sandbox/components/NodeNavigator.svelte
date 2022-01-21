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
  let match = "";

  $: hasNodes = Object.values($nodes).some(i => i.length > 0);
</script>

<div id="node-navigator"
  class="flex-1 pb-4 w-80 text-xs overflow-y-auto pointer-events-auto bg-gray-100 border-l border-gray-500 border-opacity-20 dark:bg-gray-900 dark:text-white"
  class:hidden
  on:mouseleave={() => { deps = [] }}
>
  <div class="z-50 sticky top-0 pl-2 pr-4 pt-4 flex flex-row w-full gap-4 items-center bg-gray-100 dark:bg-gray-900">
    <input class="w-full h-6 px-2 text-opacity-100 bg-white border border-gray-500 border-opacity-40 rounded-sm dark:border dark:border-white dark:border-opacity-40 dark:bg-gray-900"
           type="text" placeholder="Search..." bind:value={match}/>
    <div id="node-nav-toggle"
         class="cursor-pointer stroke-current text-gray-900 dark:text-white opacity-40 hover:opacity-100"
         on:click={() => document.getElementById("node-navigator").classList.toggle("hidden")}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 3.5L3.5 12.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12.5 12.5L3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>

  <div class="nodes px-4 flex flex-col align-center relative">
    {#each types as type}
      {#if $nodes[type] && $nodes[type].length}
        <div class="mt-2 caps">{type}</div>
        {#each $nodes[type] as node}
          {#if !match.trim().length || String(node).toLowerCase().includes(match.trim().toLowerCase())}
            <div
                on:mouseenter={() => highlightDeps(node)}
                on:click={() => goTo(node, type)}
                class="node flex items-center gap-2 cursor-pointer relative w-full"
                class:dependant={dependants.includes(node.id)}
                class:dep={deps.includes(node.id)}
                class:error={node.isError}
            >
              <span class="id truncate opacity-40 hover:opacity-100 w-full">{String(node)}</span>
              <svg class="svg" height="16" width="16">
                <circle cx="8" cy="8" r="4" stroke-width={node.size > 0 ? 4 : 2} />
              </svg>
            </div>
          {/if}
        {/each}
      {/if}
    {/each}
  </div>
</div>

<style>
  .hidden {
    display: none;
  }

  .node:hover .svg {
    fill: #237EB3;
    stroke: #eee;
  }

  .svg {
    fill: #aaa;
    stroke: #eee;
  }

  :global(.dark) .svg {
    fill: #333;
    stroke: #666;
  }

  .nodes:hover .dep .id {
    color: #237EB3;
    opacity: 1.0;
  }

  .nodes:hover .dep .svg {
    fill: #237EB3;
    stroke: #237EB3;
  }

  .nodes:hover .dependant .id {
    opacity: 1.0;
    color: #f44336;
  }

  .nodes:hover .dependant .svg {
    fill: #ff9800;
    stroke: #ff9800;
  }

  .nodes .error {
    color: #f44336;
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
