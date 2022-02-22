import { isMac } from "./ui.js";

export const SHIFT = 1;
export const CTRL = 2;
export const ALT = 4;

export const modifiers = e => e.shiftKey + ((isMac() ? e.metaKey : e.ctrlKey) << 1) + (e.altKey << 2);

export const combination = e => {
  const mod = modifiers(e);

  return ['Shift', 'Ctrl', 'Alt']
    .map((k, i) => ((1 << i) & mod) && k)
    .filter(Boolean)
    .concat(e.code)
    .join('+');
};
