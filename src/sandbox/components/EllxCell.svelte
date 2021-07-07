<script>
  import { onDestroy } from 'svelte';
  import { show } from '../runtime/renderNode';
  import { STALE } from '../runtime/engine/quack';
  import Spinner from './Spinner';

  export let cg;
  export let identifier;
  export let formula;
  export let nodes;

  let calcNode;
  let render;
  let lastValue;
  let isStale = false;
  const spinners = [];

  $: try {
    if (!calcNode) {
      console.debug(`cgLogger(MD): insert node ${identifier} = ${formula}`);
      calcNode = cg.insert(identifier, formula);

      calcNode.on('update', updated => {
        if ('component' in updated) render = renderComponent(updated.component);
        if ('value' in updated) {
          lastValue = show(updated.value);
          isStale = typeof updated.value === 'string' && updated.value.startsWith(STALE);
        }
      });
    }
    else {
      console.debug(`cgLogger(MD): update node ${identifier} = ${formula}`);
      cg.update(identifier, formula);
    }
  }
  catch (err) {
    lastValue = show(err);
    dispose();
  }

  function dispose() {
    if (cg.nodes.has(identifier)) {
      console.debug(`cgLogger(MD): remove node ${identifier}`);
      cg.remove(identifier);
    }
    clearSpinners();
    calcNode = null;
  }

  function renderComponent(component) {
    if (!component || typeof component.render !== 'function') return null;
    return target => {
      for (let el of target.childNodes) el.remove();
      component.render(target);
    };
  }

  function clearSpinners() {
    let spinner;

    while (spinner = spinners.shift()) spinner.$destroy();
  }

  function renderSpinner(target) {
    for (let el of target.childNodes) el.remove();
    spinners.push(new Spinner({ target, props: { size: 24 } }));
  }

  $: if (!isStale) clearSpinners();

  $: if (nodes && render) {
    nodes.forEach(render);
  }
  $: if (nodes && isStale && !render) {
    nodes.forEach(renderSpinner);
  }

  $: if (nodes && !render && !isStale && lastValue !== undefined) {
    nodes.forEach(node => {
      node.innerHTML = lastValue;
    });
  }

  function toggleError(on) {
    nodes.forEach(node => node.classList[on ? 'add' : 'remove']('ellx-cell-error'));
  }

  $: if (nodes) {
    toggleError(typeof lastValue === 'string' && lastValue.startsWith("#ERR") && !render);
  }

  onDestroy(dispose);

</script>

<style>
  :global(.ellx-cell-error) {
    color: red;
  }
</style>
