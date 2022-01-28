export function togglePanel(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.toggle("hidden");
}
