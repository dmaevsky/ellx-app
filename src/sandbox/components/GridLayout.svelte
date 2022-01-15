<script>
  import { getContext } from 'svelte';
  import { makeSpace } from '../actions/expansion.js';
  import query from '../blocks.js';
  import {
    expandable,
    getPrimaryKeys,
    getSecondaryKeys,
    expandOnce,
    expandTwice
  } from '../../runtime/iterate.js';

  import CustomRender from './CustomRender.svelte';
  import TextCell from './TextCell.svelte';

  export let blocks;
  export let calculated;
  export let nRows;
  export let nCols;
  export let rowHeight = 20;
  export let columnWidth = 100;
  export let tileSize = 10;
  export let transparent;

  const thisSheet = getContext('store');

  $: tiles = [...blocks].reduce((acc, [id, {
    position: [firstRow, firstCol, lastRow, lastCol],
    value: blockValue, expansion, node
  }]) => {
    const nodeResult = node && calculated.get(id);
    const { value, component } = nodeResult || { value: blockValue };

    if (component && typeof component.render === 'function') {
      acc.push({
        id: id + ':component',
        pos: [firstRow, firstCol, lastRow - firstRow + 1, lastCol - firstCol + 1],
        component
      });
      return acc;
    }

    const core = value;

    let rightNeighbor = blocks.get(query(blocks).neighbor([firstRow, firstCol, lastRow, lastCol], 3));
    let maxColSpan = rightNeighbor && rightNeighbor.position[1] - lastCol;

    if (!expansion) {
      acc.push({
        id: id + ':core',
        pos: [firstRow, firstCol, 1, maxColSpan],
        data: [core],
        node
      });
      return acc;
    }

    let labelsTop = Boolean(expansion.labelsTop);
    let labelsLeft = Boolean(expansion.labelsLeft);

    acc.push({
      id: id + ':background',
      pos: [firstRow, firstCol, lastRow - firstRow + 1, lastCol - firstCol + 1]
    });

    const sliceBlock = columns => {

      for (let j = +!labelsLeft; j < columns.length; j++) {
        let c = columns[j];

        if (labelsTop) {
          acc.push({
            id: id + ':header:' + j,
            pos: [firstRow, firstCol - !labelsLeft + j, 1, (j === columns.length - 1 ? maxColSpan : 1)],
            data: [ c[0] ],
            header: true,
          });
        }

        for (let k = 0, startRow = 1; startRow < c.length; k++, startRow += tileSize) {
          let data = c.slice(startRow, startRow + tileSize);

          acc.push({
            id: id + `:[${startRow},${startRow + tileSize}):` + j,
            pos: [firstRow - !labelsTop + startRow, firstCol - !labelsLeft + j, data.length, (j === columns.length - 1 ? maxColSpan : 1)],
            data,
            node: j > 0,
            header: j === 0
          });
        }
      }
    }

    let dataHeight = lastRow - firstRow + 1 - labelsTop;
    let dataWidth = lastCol - firstCol + 1 - labelsLeft;

    const transpose = !expansion.vertical;
    const maxPrimaryLength = transpose ? dataWidth : dataHeight;
    const maxSecondaryLength = transpose ? dataHeight : dataWidth;

    const primaryKeys = [...getPrimaryKeys(value, maxPrimaryLength)];
    const secondaryKeys = expansion.secondary
            ? [...getSecondaryKeys(value, primaryKeys.length, maxSecondaryLength)] : [];

    if (!primaryKeys.length) {
      if (!expansion.secondary) {
        sliceBlock(transpose ?
          [...Array(dataWidth + 1)].map(_ => [core, core]) :
          (c => [c, c])([...Array(dataHeight + 1)].map(_ => core))
        );
      } else {
        sliceBlock([...Array(dataWidth + 1)].map(_ => [...Array(dataHeight + 1)].map(_ => core)));
      }

    } else if (!secondaryKeys.length) {
      // Primary expansion
      const expanded = new Map(expandOnce(value, maxPrimaryLength));

      sliceBlock(transpose ?
        [ ['#', node], ...primaryKeys.map(k => [ k, expanded.get(k) ]) ] :
        [ ['#', ...primaryKeys], [ node, ...primaryKeys.map(k => expanded.get(k)) ] ]
      );
    } else {
      // Secondary expansion
      const expanded = new Map(expandTwice(value, maxPrimaryLength, maxSecondaryLength));

      sliceBlock(transpose ?
        [
          ['#', ...secondaryKeys],
          ...primaryKeys.map(k1 => [ k1, ...secondaryKeys.map(k2 => expandable(expanded.get(k1))
                  ? expanded.get(k1).get(k2) : expanded.get(k1)) ])
        ] :
        [
          ['#', ...primaryKeys],
          ...secondaryKeys.map(k2 => [ k2, ...primaryKeys.map(k1 => expandable(expanded.get(k1))
                  ? expanded.get(k1).get(k2) : expanded.get(k1)) ])
        ]
      );
    }
    return acc;
  }, []);
</script>

<div
  class="gridlayout__container gridlines"
  style={`width: ${nCols * columnWidth}px; height: ${nRows * rowHeight}px;`}
>
  {#each tiles as { id, pos: [row, col, rowSpan, colSpan], data, component, node, header } (id)}
    <div
      class:node={node}
      class={ data || component ? 'gridlayout__tile' : 'gridlayout__block-bg' }
      style={`
        transform: translate(${col * columnWidth}px, ${row * rowHeight}px);
        height: ${rowSpan * rowHeight}px;
        width: ${(colSpan || 1) * columnWidth}px;
        overflow: ${colSpan ? 'hidden' : 'visible'};
      `}
    >
    {#if component}
      <CustomRender
        component={component}
        rowSpan={rowSpan}
        colSpan={colSpan}
        rowHeight={rowHeight}
        columnWidth={columnWidth}
        on:resize={({ detail: { nRows: newHeight, nCols: newWidth } }) =>
          makeSpace(thisSheet, parseInt(id), { newHeight, newWidth })}
      />
    {:else if data}
      {#each data as cell}
        <div
          class:bg-white={!transparent}
          class:dark:bg-dark-500={!transparent}
          class:bg-transparent={transparent}
          class:text-gray-700={header}
          class:italic={header}
          class:text-xs={header}
          class="gridlayout__cell gridlines"
        >
          <TextCell {cell}/>
        </div>
      {/each}
    {/if}
    </div>
  {/each}
</div>

<style>
  .gridlines {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' fill='transparent' height='20'%3E%3Crect width='100' height='20' style='stroke-width:1;stroke:rgb(239,239,239)' /%3E%3C/svg%3E");
  }

  .gridlayout__container {
    position: relative;
  }

  .node {
    color: #00325f;
  }

  .gridlines :global(a) {
    @apply text-blue-800 transition duration-100 underline;
  }

  .gridlines :global(.a:hover) {
    @apply text-blue-400;
  }

  .gridlayout__tile {
    position: absolute;
    background: rgba(0, 0, 0, 0);
    line-height: 16px;
    white-space: nowrap;
  }

  .gridlayout__cell {
    cursor: default;
    padding: 2px;
    width: 100px;
    height: 20px;
  }

  .gridlayout__block-bg {
    position: absolute;
    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFElEQVQImWNgQAIpKSkNpHIYGBgA4vwGscjvFCUAAAAASUVORK5CYII=),
      linear-gradient(white, white);
    background-repeat: repeat;
  }
  /*! purgecss start ignore */
  :global(.mode-dark) .node {
    color: #b3dbff;
  }

  :global(.mode-dark) .gridlayout__block-bg {
    position: absolute;
    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFElEQVQImWNgQAIpKSkNpHIYGBgA4vwGscjvFCUAAAAASUVORK5CYII=),
      linear-gradient(#212121, #212121);
    background-repeat: repeat;
  }

  :global(.mode-dark) .gridlines {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' fill='transparent' height='20'%3E%3Crect width='100' height='20' style='stroke-width:1;stroke:rgb(50,50,50)' /%3E%3C/svg%3E");
  }
  /*! purgecss end ignore */
</style>
