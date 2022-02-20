<script>
  import { tick } from "svelte";

  import ProgressiveEval from "../../runtime/engine/progressive_assembly.js";
  import * as environment from "../../runtime/engine/reserved_words.js";
  import { getCaretPosition } from "../../utils/highlight.js";
  import { isFirefox } from "../../utils/ui.js"

  export let value = "";
  export let transparent = false;
  export let node = null;
  export let caretPosition = undefined;

  let isPartlyParsed = false;
  let innerHTML;

  function getTokens(str) {
    const parser = new ProgressiveEval(environment, () => {});

    try {
      parser.parse(str);
      return parser.nodes;
    }
    catch (e) {
      console.debug("Formula parsing error: ", e);
      return null;
    }
  }

  function spanify(str, type) {
    let node_class;
    switch (type) {
      case "Literal":
        node_class = "ellx-highlight__literal";
        break;
      case "Identifier":
        node_class = "ellx-highlight__identifier";
        break;
      case "BoundName":
        node_class = "ellx-highlight__bound-name";
        break;
    }

    return `<span${node_class ? ` class="${node_class}"` : ""}>${str}</span>`;
  }

  function highlightInput(str) {
    let match = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*=([^=>].*)/.exec(str);

    if (!match) {
      isPartlyParsed = false;
      return str;
    }

    const [formula, leftHand, rightHand] = match;
    const tokens = getTokens(rightHand);

    if (!tokens) return formula;

    const spacer = formula.substring(0, formula.length - rightHand.length - 1);

    let result = `<span id="ellx-highlight">`
        + (leftHand ? spanify(spacer)  : "" ) + spanify("=");

    let tokenPosition = 0;

    tokens.forEach(({ type, pos, text }) => {
      if (type === "Literal" || type === "Identifier" || type === "BoundName") {
        result += divideSpacer(rightHand.substring(tokenPosition, pos)) + spanify(text, type);
        tokenPosition = pos + text.length;
      }
    });

    result += divideSpacer(rightHand.substring(tokenPosition, rightHand.length)) + "</span>";

    isPartlyParsed = true;

    return result;
  }

  function divideSpacer(str) {
    let result = "";

    [...str.matchAll(/\s+|\S+/g)].map(i => i.forEach(item => result += spanify(item)));

    return result;
  }

  function setCaretPosition() {
    let caretNode = null;
    let caretOffset = 0;

    const highlight = document.querySelector("#ellx-highlight");
    let currentPosition = 0;

    if (highlight) {
      const nodes = highlight.childNodes;

      for (let i = 0; i < nodes.length; i++) {
        const nodeLength = nodes[i].textContent.length;
        currentPosition += nodeLength;

        if (caretPosition <= currentPosition) {
          caretNode = nodes[i].firstChild;
          caretOffset = caretPosition - (currentPosition - nodeLength);
          break;
        }
      }

      if (!caretNode) {
        caretNode = highlight.lastChild.lastChild;
        caretOffset = caretNode.textContent.length;
      }
    }
    else {
      caretNode = node.lastChild ? node.lastChild : node;
      caretOffset = caretPosition ? caretPosition : node.textContent.length;
    }
    
    document.getSelection().empty();
    document.getSelection().setBaseAndExtent(caretNode, caretOffset, caretNode, caretOffset);
  }

  function autoSizeEditor() {
    if (node) {
      node.style.removeProperty('width');
      if (node.scrollWidth > node.clientWidth) {
        node.style.width = node.scrollWidth + 5 + 'px';
      }
    }
  }

  function handleInput() {
    let { anchorNode, anchorOffset } = document.getSelection();
    const highlight = document.querySelector("#ellx-highlight");

    if (isFirefox()) {
      let brElement = highlight ? highlight.lastChild.lastChild : node.lastChild;

      if (brElement && (brElement.tagName === "BR")) {
        brElement.remove();
        const el = highlight ? highlight.lastChild : node.lastChild;
        if (el) el.textContent = el.textContent.substr(0, el.textContent.length - 1) + '\xa0';
      }
    }

    value = node.textContent;
    caretPosition = getCaretPosition(highlight, anchorNode, anchorOffset, value);
  }

  $: {
    innerHTML = highlightInput(value);

    tick().then(() => {
      setCaretPosition();
      autoSizeEditor();
    });
  }
</script>

<div
  tabindex="-1"
  id="ellx-cell-editor"
  class="grid__editor grid__selection-border bg-white"
  class:dark:text-white={!transparent}
  class:dark:text-gray-800={transparent}
  class:dark:bg-slate-800={!transparent}
  bind:this={node}
  bind:innerHTML
  contenteditable="true"
  on:input={handleInput}
  on:keydown
  on:paste={(e) => {
    e.preventDefault();
    let text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertHTML", false, text);
  }}
  spellcheck="false"
></div>

<style>
  .grid__selection-border {
    border: 2px solid rgb(0, 255, 77);
  }
  .grid__editor {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    outline: none;
    resize: none;
    white-space: nowrap;
    overflow: hidden;
  }
  :global(.ellx-highlight__identifier) {
    color: magenta;
  }
  :global(.ellx-highlight__literal) {
    color: dodgerblue;
  }
  :global(.ellx-highlight__bound-name) {
    color: teal;
  }
</style>
