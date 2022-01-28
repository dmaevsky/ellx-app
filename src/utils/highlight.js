export function getCaretPosition(highlight, anchor, offset, str) {

  if (!highlight) return offset;

  const anchorParent = anchor.parentNode;
  const nodes = highlight.childNodes;

  let caretPosition = 0;
  let found = false;

  for (let i = 0; i < nodes.length; i++) {
    const children = nodes[i].childNodes;

    if (nodes[i] === anchorParent || nodes[i] === anchor) {
      found = true;
      caretPosition += offset;
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

  if (!found) caretPosition = str.length;

  return caretPosition;
}