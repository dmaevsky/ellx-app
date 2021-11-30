<script>
  import { tick, createEventDispatcher, onMount, getContext } from 'svelte';
  import query from '../runtime/blocks.js';
  import { setSelection } from '../runtime/actions/edit.js';
  import { CTRL, modifiers, combination } from '../runtime/utils/mod_keys.js';

  import GridLayout from './GridLayout.svelte';
  import CellEditor from './CellEditor.svelte';

  export let blocks;
  export let calculated;
  export let selection;
  export let copySelection = null;
  export let onkeydown;
  export let transparent = false;
  export let overflowHidden = false;
  export let isEditMode;

  const thisSheet = getContext('store');
  const { nRows, nCols } = $thisSheet;
  const rowHeight = 20, columnWidth = 100;

  let focused = false;
  let editorSession = null;
  let isFormula = false;

  let container = null, editor = null;
  const dispatch = createEventDispatcher();

  $: isEditMode = (editor !== null);

  $: if (editorSession !== null) isFormula = detectFormula(editorSession)

  $: selectedBlockId = query(blocks).getAt(...selection.slice(0, 2));
  $: selectedBlock = blocks.get(selectedBlockId);
  $: selectedNodeResult = calculated.get(selectedBlockId);

  $: if (selectedBlock) {
    const selectedValue = selectedBlock.node
      ? selectedNodeResult && selectedNodeResult.value
      : selectedBlock.value;
    console.log(selectedValue);
  }

  $: selectionStartStyle = (([rowStart, colStart]) => `
    top: ${rowStart * rowHeight}px;
    left: ${colStart * columnWidth}px;
    height: ${rowHeight}px;
    width: ${columnWidth}px;
  `)(selection);
  $: selectionStyle = (([rowStart, colStart, rowEnd, colEnd]) => {
    if (rowStart > rowEnd) [rowStart, rowEnd] = [rowEnd, rowStart];
    if (colStart > colEnd) [colStart, colEnd] = [colEnd, colStart];

    return `
      visibility: ${(focused && rowStart === rowEnd && colStart === colEnd) ? 'hidden' : 'visible'};
      top: ${rowStart * rowHeight}px;
      left: ${colStart * columnWidth}px;
      height: ${(rowEnd - rowStart + 1) * rowHeight}px;
      width: ${(colEnd - colStart + 1) * columnWidth}px;
    `
  })(selection);
  $: copySelectionStyle = copySelection && (([rowStart, colStart, rowEnd, colEnd]) => {
    return `
      top: ${rowStart * rowHeight - 1}px;
      left: ${colStart * columnWidth - 1}px;
      height: ${(rowEnd - rowStart + 1) * rowHeight + 2}px;
      width: ${(colEnd - colStart + 1) * columnWidth + 2}px;
    `
  })(copySelection);
  $: if (selection) requestAnimationFrame(scrollIntoView);

  let isNodeInserted = false;
  let caretPosition = null;

  $: if(!isEditMode) caretPosition = null;

  function getCaretPosition(e) {
    caretPosition = [e.target.selectionStart, e.target.selectionEnd];
  }

  // Mouse handling
  function gridClick(e) {
    if (e.target.nodeName === 'A') return;

    // In Edit mode pass click handling to editorClick()
    if (isEditMode) {
      editorClick(e)
    }
    else {
      mouseCellSelection(e)
    }
  }

  function getNodeContent(e) {
    let { left, top } = container.getBoundingClientRect();
    let { clientWidth, clientHeight } = container;

    let [x, y] = [e.pageX - left, e.pageY - top];
    if (x >= clientWidth || y >= clientHeight) {
      // Ignore clicks on scrollbars
      e.stopPropagation();
      return;
    }

    let [row, col] = getRowCol(x, y);
    let blockId = query(blocks).getAt(row, col);
    let block = blocks.get(blockId);
    if(blockId !== undefined && block.formula !== undefined) {
      return block.node;
    }
    return null;
  }

  function editorClick(e) {
    if (isFormula) {
      if (e.target !== editor) {
        e.preventDefault(); // Prevent select on drag
        if (!caretPosition) {
          closeEditor();
          return;
        }

        const node = getNodeContent(e);

        if (node !== null) {
          editorSession = [
            editorSession.substring(0, caretPosition[0]),
            node,
            editorSession.substring(caretPosition[1], editorSession.length)
          ].join("");

          const caret = caretPosition[0] + node.length; // Remember insertion position
          caretPosition[1] = caret;

          tick().then(() => {   // Restore caret position after editing input
            editor.selectionStart = editor.selectionEnd = caret;
          });

          autoSizeEditor();
        }
      }
      // else getCaretPosition(e);
    }
    else if (e.target !== editor) {
        takeFocus(container);
        jumpAway(e);
        editorSession = null;
        closeEditor();
      }
  }

  // Keyboard handling
  function keyDown(e) {
    if (e.target !== container) return;

    if (isEditMode) editorKeyDown(e)
    else {

      if (e.key === 'Enter') {
        e.preventDefault();
        return startEditing();
      }

      if (onkeydown && onkeydown(e)) {
        e.preventDefault();
        return;
      }

      let [rowStart, colStart, rowEnd, colEnd] = selection;

      const modKeys = modifiers(e);

      if (modKeys <= 1 && e.key.length === 1) {
        return startEditing('');
      }

      if (['F2', 'Alt+Enter'].includes(combination(e))) {
        return startEditing();
      }

      if (combination(e) === 'Ctrl+Slash') {
        let [row, col] = selection;
        dispatch('change', { row, col, value: toggleComment(getActiveCellValue()) });
        e.preventDefault();
        return;
      }

      if (e.altKey) return;

      if (!e.shiftKey) {
        rowEnd = rowStart;
        colEnd = colStart;
      }

      if (modKeys & CTRL) {
        let which = { ArrowUp: 0, ArrowLeft: 1, ArrowDown: 2, ArrowRight: 3 }[e.key];
        if (which === undefined) return;
        let direction = (which & 2) - 1;

        let origin = (which & 1) ? [rowStart, colEnd] : [rowEnd, colStart];
        let currentBlockId = query(blocks).getAt(...origin);
        let nextBlockId = query(blocks).neighbor([...origin, ...origin], which);

        let nextBlock = blocks.get(nextBlockId);
        let edge = nextBlock ? currentBlockId === nextBlockId ? nextBlock.position[which] : nextBlock.position[(which + 2) % 4] : direction * Infinity;

        if (which & 1) colEnd = Math.max(0, Math.min(nCols - 1, edge));
        else rowEnd = Math.max(0, Math.min(nRows - 1, edge));
      }
      else {
        switch (e.key) {
          case 'ArrowLeft':  if (colEnd > 0) colEnd--;  break;
          case 'ArrowRight': if (colEnd < nCols - 1) colEnd++;  break;
          case 'ArrowUp':    if (rowEnd > 0) rowEnd--;  break;
          case 'ArrowDown':  if (rowEnd < nRows - 1) rowEnd++;  break;
          case 'Home':       colEnd = 0;  break;
          case 'End':        colEnd = nCols - 1;  break;
          case 'PageUp':     rowEnd -= visibleLines();  if (rowEnd < 0) rowEnd = 0;  break;
          case 'PageDown':   rowEnd += visibleLines();  if (rowEnd >= nRows) rowEnd = nRows - 1;  break;
          default: return;
        }
      }

      if (!e.shiftKey) {
        rowStart = rowEnd;
        colStart = colEnd;
      }

      e.preventDefault();
      setSelection(thisSheet, [rowStart, colStart, rowEnd, colEnd]);
    }
  }

  function editorKeyDown(e) {
    // Prevent default Ctrl+A behavior when Editor is not in focus
    if (combination(e) === 'Ctrl+KeyA' && e.target !== editor) e.preventDefault();

    if (e.key === 'Escape') closeEditor();
    else if (e.key === 'Enter') closeEditor(editorSession);
    else if (e.key === 'Tab') closeEditor(editorSession, true);
    else if (combination(e) === 'Ctrl+Slash') closeEditor(toggleComment(editorSession));
    else return;
    e.preventDefault();
  }

  async function startEditing(value) {
    editorSession = value === undefined ? getActiveCellValue() : value;

    await tick();
    takeFocus(editor);
    autoSizeEditor();
  }

  function closeEditor(value, moveRight = false) {
    if (value !== undefined) {
      let [row, col] = selection;
      dispatch('change', { row, col, value });

      if (moveRight) {
        if (col < nCols - 1) col++;
      }
      else if (row < nRows - 1) row++;
      setSelection(thisSheet, [row, col, row, col]);
    }
    editorSession = null;
    takeFocus(container);
  }

  function scrollIntoView() {
    if (!container) return;
    let { clientWidth, clientHeight, scrollLeft, scrollTop } = container;

    let [rowEnd, colEnd] = selection.slice(2);
    let [ top, left ] = [ rowEnd * rowHeight, colEnd * columnWidth ];
    let [ bottom, right ] = [ top + rowHeight, left + columnWidth ];

    if (top < scrollTop) container.scrollTop = top - 0.5 * clientHeight;
    else if (bottom > scrollTop + clientHeight) container.scrollTop = bottom - clientHeight;

    if (left < scrollLeft) container.scrollLeft = left - 0.5 * clientWidth;
    else if (right > scrollLeft + clientWidth) container.scrollLeft = right - clientWidth;
  }

  function visibleLines() {
    return Math.round(container.clientHeight / rowHeight);
  }

  function takeFocus(el) {
    if (el) {
      let x = window.scrollX, y = window.scrollY;
      el.focus({ preventScroll: true });    // TODO: Remove hack when Safari and Safari iOS will support preventScrolling
      window.scrollTo(x, y);
    }
  }

  async function autoSizeEditor() {
    await tick();
    if (editor) {
      editor.style.removeProperty('width');
      if (editor.scrollWidth > editor.clientWidth) {
        editor.style.width = editor.scrollWidth + 5 + 'px';
      }
    }
  }

  function getActiveCellValue() {
    const [row, col] = selection;
    const block = blocks.get(query(blocks).getAt(row, col));
    return block ? (block.node ? `${block.node} = ${block.formula}` : block.formula || block.value) : '';
  }

  function jumpAway(e) {
    let { left, top } = container.getBoundingClientRect();
    let { clientWidth, clientHeight } = container;

    let [x, y] = [e.pageX - left, e.pageY - top];
    if (x >= clientWidth || y >= clientHeight) {
      // Ignore clicks on scrollbars
      e.stopPropagation();
      return;
    }

    let [row, col] = getRowCol(x, y);
    setSelection(thisSheet, [row, col, row, col]);
  }

  function detectFormula(str) {
    return (str === "=") ? true : /^\s*([a-z_$][a-z0-9_$]*)?\s*=([^=>].*)/gmi.test(str);
  }

  function getRowCol(x, y) {
    return [
      Math.floor((y + container.scrollTop) / rowHeight),
      Math.floor((x + container.scrollLeft) / columnWidth)
    ];
  }

  function mouseCellSelection(e) {
    takeFocus(container);

    let { left, top } = container.getBoundingClientRect();
    let { clientWidth, clientHeight } = container;

    let [x, y] = [e.pageX - left, e.pageY - top];
    if (x >= clientWidth || y >= clientHeight) {
      // Ignore clicks on scrollbars
      e.stopPropagation();
      return;
    }

    let [row, col] = getRowCol(x, y);

    setSelection(thisSheet, [row, col, row, col]);

    // === Start mouse selection ===
    e.preventDefault();
    let tickTimerX = null, tickTimerY = null;
    let mouseMoveRAF = 0;

    let mouseMove = e => {
      let { pageX, pageY } = e;
      if (mouseMoveRAF) return;

      mouseMoveRAF = requestAnimationFrame(() => {
        mouseMoveRAF = 0;
        let [x, y] = [pageX - left, pageY - top];
        let incX = 0, incY = 0;

        if (x < 0) incX = -1, x = 0;
        else if (x >= clientWidth) incX = 1, x = clientWidth - 1;

        if (y < 0) incY = -1, y = 0;
        else if (y >= clientHeight) incY = 1, y = clientHeight - 1;

        if (!tickTimerX && incX !== 0) {
          tickTimerX = setInterval(() => {
            let col = selection[3] + incX;
            if (col >= 0 && col < nCols) setSelection(thisSheet, Object.assign([...selection], {3: col}));
          }, 50);
        }

        if (tickTimerX && incX === 0) {
          clearInterval(tickTimerX);
          tickTimerX = null;
        }

        if (!tickTimerY && incY !== 0) {
          tickTimerY = setInterval(() => {
            let row = selection[2] + incY;
            if (row >= 0 && row < nRows) setSelection(thisSheet, Object.assign([...selection], {2: row}));
          }, 50);
        }

        if (tickTimerY && incY === 0) {
          clearInterval(tickTimerY);
          tickTimerY = null;
        }

        let [row, col] = getRowCol(x, y);
        setSelection(thisSheet, Object.assign([...selection], {2: row, 3: col}));
      });
    }

    let mouseUp = () => {
      if (mouseMoveRAF) cancelAnimationFrame(mouseMoveRAF);
      window.removeEventListener('mousemove', mouseMove);
      window.removeEventListener('mouseup', mouseUp);
      if (tickTimerX) clearInterval(tickTimerX);
      if (tickTimerY) clearInterval(tickTimerY);
    }

    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mouseup', mouseUp);
  }

  function toggleComment(str = "") {
    return str.trim().startsWith("//")
      ? str.trim().slice(2).trim()
      : "// " + str;
  }

  // Copy / Cut / Paste events subscription and forwarding
  const clipboardEvent = name => e => {
    if (!focused) return;
    dispatch(name, e);
    e.preventDefault();
  }

  onMount(() => {
    let handlers = {};
    ['copy', 'cut', 'paste'].forEach(name =>
      document.addEventListener(name, handlers[name] = clipboardEvent(name))
    );

    takeFocus(container);

    return () => {
      for (let name in handlers)
        document.removeEventListener(name, handlers[name]);
    }
  });
</script>

<div
  class="w-full h-full grid__container text-black"
  class:overflow-auto={!overflowHidden}
  class:overflow-hidden={overflowHidden}
  class:bg-white={!transparent}
  class:dark:bg-dark-500={!transparent}
  class:bg-transparent={transparent}
  class:blurred-bg={transparent}
  class:dark:text-white={!transparent}
  class:dark:text-gray-800={transparent}
  tabindex="0"
  bind:this={container}
  on:keydown={keyDown}
  on:focus={() => focused = true}
  on:blur={() => focused = false}
  on:mousedown={gridClick}
  on:dblclick={(e) => {
    e.preventDefault();
    if (!editorSession) { startEditing() }
    else if (e.target !== editor) {
      jumpAway(e);
      editorSession = null;
      closeEditor();
    }
  }}
>
  <GridLayout
    {blocks}
    {calculated}
    {nRows}
    {nCols}
    {rowHeight}
    {columnWidth}
    {transparent}
  />

  <div
    style={selectionStartStyle}
    class="grid__selection-start"
    class:grid__selection-border={focused && editorSession === null}
  >
    {#if editorSession !== null}
      <CellEditor
        {transparent}
        {isFormula}
        {closeEditor}
        bind:node={editor}
        on:click={(e) => {
          getCaretPosition(e);
        }}
        bind:value={editorSession}
        on:select={(e)=> {
          if(e.target.selectionStart !== e.target.selectionEnd) getCaretPosition(e);
        }}
        on:input={(e) => {
          getCaretPosition(e);
          autoSizeEditor()
        }}
        on:keydown={editorKeyDown}
      />
    {/if}
  </div>
  <div class="grid__selection" style={selectionStyle}></div>
  {#if copySelection}
    <div class="grid__copy-selection" style={copySelectionStyle}></div>
  {/if}
</div>

<style>
  .grid__container {
    position: relative;
    padding: 0;
    margin: 0;
    outline: none;
    border: none;
    font-size: 12px;
    font-family: Consolas, monaco, monospace;
    color: black;
  }
  .grid__selection-border {
    border: 2px solid rgb(0, 128, 255);
  }
  .grid__copy-selection {
    position: absolute;
    border: 2px dashed rgb(0, 128, 255);
    background: rgba(0, 0, 0, 0);
    z-index: 10;
  }
  .grid__selection-start {
    position: absolute;
    background: rgba(0, 0, 0, 0);
    z-index: 20;
  }
  .grid__selection {
    position: absolute;
    border: 1px solid rgb(0, 128, 255);
    background: rgba(14, 101, 235, 0.1);
    z-index: 10;
  }
</style>
