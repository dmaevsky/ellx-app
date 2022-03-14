import { autorun } from 'quarx';
import { show } from './renderNode.js';

function toggleError(target, on) {
  if (on) target.style.color = 'red';
  else target.style.removeProperty('color');
}

export default function mountEllxApp(
  target,
  cg,
  formula = 'app()',
  identifier = 'init'
) {
  try {
    const calcNode = cg.insert(identifier, formula);

    autorun(() => {
      const value = calcNode.currentValue.get();

      if (value instanceof HTMLElement) {
        target.innerHTML = '';
        toggleError(target, false);

        target.appendChild(value);
      }
      else {
        target.innerHTML = show(value);
        toggleError(target, value instanceof Error);
      }
    });
  }
  catch (err) {
    target.innerHTML = show(err);
    toggleError(target, true);
  }
}
