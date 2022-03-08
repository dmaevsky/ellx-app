export function createButton() {
  const button = document.createElement('button');
  button.innerText = 'Click me!!!';
  button.classList.add('text-blue-700');
  return button;
}
