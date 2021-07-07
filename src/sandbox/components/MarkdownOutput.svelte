<script>
  export let refresh = 'once';
  export let contentId = null;
  export let cg;

  import { tick } from 'svelte';
  import EllxCell from './EllxCell.svelte';

  let cells = [];

  $: selector = (contentId ? `div[data-ellx-content-id="${contentId}"] ` : '') + '[data-ellx-node-name]';
  $: if (refresh) rebuild();

  async function rebuild() {
    await tick();
    cells = [...document.querySelectorAll(selector)]
      .reduce((acc, node) => {
        const { ellxNodeName: name, ellxNodeFormula: formula } = node.dataset;

        if (acc.has(name)) acc.get(name).nodes.push(node);
        else acc.set(name, { formula, nodes: [node] });
        return acc;
      }, new Map());
  }

</script>

{#each [...cells] as [name, { formula, nodes }] (name)}
  <EllxCell {cg} identifier={name} {formula} {nodes}/>
{/each}
