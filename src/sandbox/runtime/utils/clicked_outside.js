export default function clickedOutside(node, cb) {
  const onclick = e => !node.contains(e.target) && cb();

  window.addEventListener('mousedown', onclick, true);

  return {
    update(newCb) {
      cb = newCb;
    },
    destroy() {
      window.removeEventListener('mousedown', onclick, true);
    }
  };
}
