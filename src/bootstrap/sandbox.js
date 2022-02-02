import { bootstrapModule } from './bootstrap.js';

import {
  LIFECYCLE,
  SANDBOX_CONTENT
} from './entry_points.js';

if (window.location.origin === 'null') {
  throw new Error('This page should be served by an ellx-app server');
}

const devServer = new WebSocket(window.location.origin.replace(/^http/, 'ws') + '/@@dev');

window.__ellx = {
  devServer
};

let sandboxComponent;

const initSheetsQueue = new Map();

function listen({ data }) {
  try {
    const { type, args } = JSON.parse(data);

    if (type === "updateStyles") return updateStyles();

    const actions = window.__ellx.Module
      ? window.__ellx.Module.require(LIFECYCLE)
      : { init, dispose, updateModules };

    if (type in actions) {
      return actions[type](...args);
    }
    else throw new Error('Unknown action', type);
  }
  catch (error) {
    console.error(error.message);
  }
}

function init(contentId, nodes, layout) {
  initSheetsQueue.set(contentId, { nodes, layout });
}

function dispose(contentId) {
  initSheetsQueue.delete(contentId);
}

function updateModules(modules) {
  console.debug('INITIAL modules ***', modules);

  bootstrapModule(modules)
    .then(Module => {
      window.__ellx.Module = Module;

      const lifecycle = Module.require(LIFECYCLE);
      const { default: SandboxContent } = Module.require(SANDBOX_CONTENT);

      document.body.innerHTML = '';
      sandboxComponent = new SandboxContent({ target: document.body });

      for (let [contentId, { nodes, layout }] of initSheetsQueue.entries()) {
        lifecycle.init(contentId, nodes, layout);
      }
    })
    .catch(error => {
      console.error(error);
      devServer.close();
    });
}

function updateStyles() {
  console.debug('STYLESHEET update ***');

  const styleSheet = document.getElementById('stylesheet');
  styleSheet.href = "sandbox.css?reload" + Math.random();
}

function disconnect() {
  if (sandboxComponent) {
    sandboxComponent.$destroy();
  }

  document.body.innerHTML = '<div style="color:red">Dev server disconnected...</div>';
}

devServer.addEventListener('message', listen);
devServer.addEventListener('close', disconnect);
