import { select, derived } from 'tinyx';
import applyMiddleware from 'tinyx/middleware';
import { enableUndoRedo } from 'tinyx/middleware/undo_redo';
import { makeStore } from './make_store.js';
import cgConnect from './cg_connect.js';
import { toObservable } from '../runtime/engine/adapters.js';
import ModuleManager from '../runtime/module_manager.js';

export const Module = ModuleManager();

const store = makeStore({
  contents: new Map(),
  activeContentId: null,
});

if (window.location.origin === 'null') {
  throw new Error('This page should be served by an ellx-app server');
}

export const devServer = new WebSocket(window.location.origin.replace(/^http/, 'ws') + '/@@dev');

export const notifyParent = payload => devServer.send(JSON.stringify(payload));

export function logByLevel(level, ...messages) {
  notifyParent({ type: 'log', messages, level });
}

export default store;

window.__ellx = {
  store
};

export const getSheet = (contentId) => applyMiddleware(
  select(store, () => ['contents', contentId]),
  [enableUndoRedo, cgConnect(Module.get(contentId))]
);

export const contents = select(store, () => ['contents']);
export const activeContent = select(store, ({ activeContentId }) => ['contents', activeContentId]);
export const activeContentId = derived(store, s => s.activeContentId);

export const oActiveContentId = toObservable(activeContentId, { name: 'activeContentId' });
