const clipboardActions = [
  {
    "title": "Copy",
    "keys": ["Cmd", "KeyC"],
    "tag": "common clipboard"
  },
  {
    "title": "Cut",
    "keys": ["Cmd", "KeyX"],
    "tag": "common clipboard"
  },
  {
    "title": "Paste",
    "keys": ["Cmd", "KeyV"],
    "tag": "common clipboard"
  }
];

const conversionActions = [
  {
    "title": "Convert to Array",
    "keys": ["Alt", "BracketLeft"],
    "tag": "conversion"
  },
  {
    "title": "Convert to Object",
    "keys": ["Alt", "BracketRight"],
    "tag": "conversion"
  },
  {
    "title": "Convert to Data Frame",
    "keys": ["Alt", "Backslash"],
    "tag": "conversion"
  },
];

export const shortcuts = [
  // Common
  ...clipboardActions,

  // Conversion
  ...conversionActions,

  // Expansion and Labels
  {
    "title": "Expand in Row",
    "keys": ["Shift", "Alt", "ArrowRight"],
    "tag": "expansion"
  },
  {
    "title": "Collapse in Row",
    "keys": ["Shift", "Alt", "ArrowLeft"],
    "tag": "expansion"
  },
  {
    "title": "Expand in Column",
    "keys": ["Shift", "Alt", "ArrowDown"],
    "tag": "expansion"
  },
  {
    "title": "Collapse in Column",
    "keys": ["Shift", "Alt", "ArrowUp"],
    "tag": "expansion"
  },
  {
    "title": "Toggle Row Labels",
    "keys": ["Shift", "Alt", "KeyZ"],
    "tag": "expansion"
  },
  {
    "title": "Toggle Column Labels",
    "keys": ["Shift", "Alt", "KeyX"],
    "tag": "expansion"
  },
  {
    "title": "Toggle Comments",
    "keys": ["Cmd", "Slash"],
    "tag": "expansion"
  },
  {
    "title": "Clear Contents",
    "keys": ["Delete"],
    "tag": "expansion"
  },

  // Grid
  {
    "title": "Shift Cells Right",
    "keys": ["Space"],
    "tag": "grid"
  },
  {
    "title": "Shift Cells Left",
    "keys": ["Backspace"],
    "tag": "grid"
  },
  {
    "title": "Shift Cells Down",
    "keys": ["Cmd", "Shift", "Space"],
    "tag": "grid"
  },
  {
    "title": "Shift Cells Up",
    "keys": ["Cmd", "Shift", "Backspace"],
    "tag": "grid"
  },
  {
    "title": "Insert Row",
    "keys": ["Shift", "Space"],
    "tag": "grid"
  },
  {
    "title": "Remove Row",
    "keys": ["Shift", "Backspace"],
    "tag": "grid"
  },
  {
    "title": "Insert Column",
    "keys": ["Cmd", "Alt", "Space"],
    "tag": "grid"
  },
  {
    "title": "Remove Column",
    "keys": ["Cmd", "Alt", "Backspace"],
    "tag": "grid"
  }
];

export const helperShortcuts = [
  // Grid
  {
    "title": "Shift Right / Left",
    "keys": ["Space", "/", "Backspace"],
    "tag": "grid"
  },
  {
    "title": "Shift Down / Up",
    "keys": ["Cmd", "Shift", "Space", "/", "Backspace"],
    "tag": "grid"
  },
  {
    "title": "Insert / Remove Row",
    "keys": ["Shift", "Space", "/", "Backspace"],
    "tag": "grid"
  },
  {
    "title": "Insert / Remove Column",
    "keys": ["Cmd", "Alt", "Space", "/", "Backspace"],
    "tag": "grid"
  },

  // Expansion
  {
    "title": "Expand / Collapse in Row",
    "keys": ["Shift", "Alt", "ArrowRight", "/", "ArrowLeft"],
    "tag": "expansion"
  },
  {
    "title": "Expand / Collapse in Column",
    "keys": ["Shift", "Alt", "ArrowDown", "/", "ArrowUp"],
    "tag": "expansion"
  },
  {
    "title": "Toggle Row / Column Labels",
    "keys": ["Shift", "Alt", "KeyZ", "/", "KeyX"],
    "tag": "expansion"
  },
  {
    "title": "Convert to Array / Object / Data Frame",
    "keys": ["Alt", "BracketLeft", "/", "BracketRight", "/", "Backslash"],
    "tag": "expansion"
  },

  // Interface
  {
    "title": "Toggle Shortcuts",
    "keys": ["Alt", "?"],
    "tag": "interface"
  },
  {
    "title": "Toggle Node Navigator",
    "keys": ["Alt", "."],
    "tag": "interface"
  },
  {
    "title": "Switch to Layout",
    "keys": ["Alt", "1"],
    "tag": "interface"
  },
  {
    "title": "Switch to Sheet",
    "keys": ["Alt", "2", "..", "9"],
    "tag": "interface"
  },
  {
    "title": "Toggle Dark Mode",
    "keys": ["Alt", "KeyD"],
    "tag": "interface"
  },

  // Common
  {
    "title": "Undo",
    "keys": ["Cmd", "KeyZ"],
    "tag": "common"
  },
  {
    "title": "Redo",
    "keys": ["Cmd", "Shift", "KeyZ"],
    "tag": "common"
  },
  ...clipboardActions
]
