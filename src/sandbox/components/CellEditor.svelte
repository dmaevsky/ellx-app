<script>
  import { tick, onMount } from "svelte";

  import ProgressiveEval from "../../runtime/engine/progressive_assembly.js";
  import * as environment from "../../runtime/engine/reserved_words.js";

  export let value;
  export let transparent = false;
  export let node = null;

  let unparsed = false;

  let innerHTML;

  const parser = new ProgressiveEval(environment, () => {});

  function spanify(str, type) {
    let node_class;
    switch (type) {
      case "Literal":
        node_class = "highlight_literal";
        break;
      case "Identifier":
        node_class = "highlight_identifier";
        break;
      case "BoundName":
        node_class = "highlight_bound-name";
        break;
    }

    return `<span${node_class ? ` class="${node_class}"` : ""}>${str}</span>`;
  }

  function getTokens(str) {
    try {
      parser.parse(str);
      return parser.nodes;
    } catch {
      console.log("~ ❌ Parser failed!", getCaret());
      return null;
    }
  }

  function highlight(str) {
    let match = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*=([^=>].*)/.exec(str);

    if (!match) return str;

    const [formula, leftHand, rightHand] = match;
    const tokens = getTokens(rightHand);

    if (!tokens) return unparsed ? innerHTML : formula;

    const spacer = formula.substring(0, formula.length - rightHand.length - 1);

    let result = `<span id="highlight" class="highlighted_string">`
        + (leftHand ? spanify(spacer)  : "" ) + spanify("=");

    let tokenPosition = 0;

    tokens.forEach(({ type, pos, text }) => {
      if (type === "Literal" || type === "Identifier" || type === "BoundName") {
        result += divideSpacer(rightHand.substring(tokenPosition, pos)) + spanify(text, type);
        tokenPosition = pos + text.length;
      }
    });

    result += divideSpacer(rightHand.substring(tokenPosition, rightHand.length)) + "</span>";

    return result;
  }

  function divideSpacer(str) {
    let result = "";

    [...str.matchAll(/\s+|\S+/g)].map(i => i.forEach(item => result += spanify(item)));

    return result;
  }

  function getCaret() {
    // Input field is empty
    // if (!document.querySelector("#highlight")) return value.length;

    // Get current caret position
    const { anchorNode, anchorOffset } = document.getSelection();
    const highlight = document.querySelector("#highlight");

    if (!highlight) return anchorOffset;

    const anchorParent = anchorNode.parentNode;
    const nodes = highlight.childNodes;

    let caretPosition = 0;
    let found = false;

    for (let i = 0; i < nodes.length; i++) {
      const children = nodes[i].childNodes;

      if (nodes[i] === anchorParent || nodes[i] === anchorNode) {
        found = true;
        caretPosition += anchorOffset;
        break;
      } else if (children.length > 1) {
        for (let j = 0; j < children.length; j++) {
          caretPosition += children[j].textContent.length;
          if (children[j] === anchorParent) {
            found = true;
            break;
          }
        }
      }
      if (found) break;
      caretPosition += nodes[i].textContent.length;
    }

    if (!found) caretPosition = value.length;

    return caretPosition;
  }

  function handleHighlight() {
    // Keep focus in editor on empty input
    if (!node || !node.textContent.length) return;

    // Read editor input as plain text
    value = node.textContent;

    // Store current caret position
    const caretPosition = getCaret();

    // Parse plain text and insert combination of spans as editor's inner HTML
    innerHTML = highlight(node.textContent);
    // value = node.textContent;

    // Wait until browser updates the DOM
    tick().then(() => {
      // Now initial range is reset and we have to restore caret position
      // to provide a flawless user experience

      // Detect which node resides at computed caretPosition
      const highlight = document.querySelector("#highlight");

      let caretNode = null;
      let caretOffset = 0;
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
      }
      else {
        caretNode = node.lastChild;
        caretOffset = caretPosition;
      }

      // Empty selection range and restore caret position
      document.getSelection().empty();
      document.getSelection().setBaseAndExtent(caretNode, caretOffset, caretNode, caretOffset);
    });
  }

  onMount(() => {
    innerHTML = highlight(value);
    unparsed = true;

    tick().then(() => {
      let anchor = node;
      let offset = 0;

      if (value !== '') {
        const str = document.querySelector("#highlight");
        anchor = str? str.lastChild.lastChild : node.lastChild;
        offset = str? str.lastChild.textContent.length : node.textContent.length;
      }

      document.getSelection().empty();
      document.getSelection().setBaseAndExtent(anchor, offset, anchor, offset);
    })
    autoSizeEditor();
  })

  async function autoSizeEditor() {
    await tick();
    if (node) {
      node.style.removeProperty('width');
      if (node.scrollWidth > node.clientWidth) {
        node.style.width = node.scrollWidth + 5 + 'px';
      }
    }
  }

</script>

<div
  tabindex="-1"
  id="editor"
  class="grid__editor grid__selection-border bg-white"
  class:dark:text-white={!transparent}
  class:dark:text-gray-800={transparent}
  class:dark:bg-dark-500={!transparent}
  bind:this={node}
  bind:innerHTML
  contenteditable="true"
  on:input={() => {
    handleHighlight();
    autoSizeEditor();
  }}
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
  :global(.highlight_identifier) {
    color: magenta;
  }
  :global(.highlight_literal) {
    color: dodgerblue;
  }
  :global(.highlight_bound-name) {
    color: teal;
  }
</style>
