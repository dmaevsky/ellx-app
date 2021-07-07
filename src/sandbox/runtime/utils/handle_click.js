function findAnchor(node) {
  while (node && node.nodeName.toUpperCase() !== 'A') node = node.parentNode; // SVG <a> elements have a lowercase name
  return node;
}

export default (base, internalHandler, externalHandler) => function handleClick(event) {
  // Borrowed from Sapper: https://github.com/sveltejs/sapper/blob/bcf6ac3a6f4468b71c506617ee2d6d0921add4bf/runtime/src/app/start/index.ts
  // Adapted from https://github.com/visionmedia/page.js
  // MIT license https://github.com/visionmedia/page.js#license
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  if (event.defaultPrevented) return;

  const a = findAnchor(event.target);

  if (!a || !a.href) return;

  // Ignore if tag has
  // 1. 'download' attribute
  // 2. rel='external' attribute
  if (a.hasAttribute('download')) return;
  if (a.target) return;

  if (a.getAttribute('rel') === 'external' || !a.href.startsWith(base + '/')) {
    if (externalHandler) {
      event.preventDefault();
      externalHandler(a.href);
    }
    return;
  }

  event.preventDefault();
  internalHandler(a.href.slice(base.length));
}
