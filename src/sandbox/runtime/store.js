import { select, derived } from 'tinyx';
import applyMiddleware from 'tinyx/middleware';
import { enableUndoRedo } from 'tinyx/middleware/undo_redo';
import { makeStore } from './utils/make_store';
import cgConnect from './cg_connect';
import { toObservable } from './adapters';
import { observableMap } from './observable_map';
import { observable } from 'quarx';

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

export const graphs = observableMap();
export const namespaces = observable.box(null, { name: 'namespaces' });

window.__ellx = {
  store, graphs, namespaces
};

export const getSheet = (contentId) => applyMiddleware(
  select(store, () => ['contents', contentId]),
  [enableUndoRedo, cgConnect(graphs.get(contentId))]
);

export const contents = select(store, () => ['contents']);
export const activeContent = select(store, ({ activeContentId }) => ['contents', activeContentId]);
export const activeContentId = derived(store, s => s.activeContentId);

export const oActiveContentId = toObservable(activeContentId, { name: 'activeContentId' });
