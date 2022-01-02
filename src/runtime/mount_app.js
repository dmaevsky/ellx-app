import { show } from './renderNode.js';

function toggleError(target, on) {
  if (on) target.style.color = 'red';
  else target.style.removeProperty('color');
}

function renderComponent(component, target) {
  if (!component || typeof component.render !== 'function') return null;

  for (let el of target.childNodes) el.remove();
  toggleError(target, false);

  component.render(target);
}

export default function mountEllxApp(
  target,
  cg,
  formula = 'app()',
  identifier = 'init'
) {
  try {
    const calcNode = cg.insert(identifier, formula);

    calcNode.on('update', updated => {
      if ('component' in updated) {
        renderComponent(updated.component, target);
      }
      else if ('value' in updated) {
        const lastValue = show(updated.value);
        target.innerHTML = lastValue;

        toggleError(target, typeof lastValue === 'string' && lastValue.startsWith("#ERR"));
      }
    });
  }
  catch (err) {
    target.innerHTML = show(err);
    toggleError(target, true);
  }
}
