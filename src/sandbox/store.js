import { select, derived } from 'tinyx';
import applyMiddleware from 'tinyx/middleware';
import { enableUndoRedo } from 'tinyx/middleware/undo_redo';
import withWritableTraits from "tinyx/middleware/writable_traits";
import { makeStore } from './make_store.js';
import cgConnect from './cg_connect.js';
import { toObservable } from '../runtime/engine/adapters.js';

const store = makeStore({
  contents: new Map(),
  activeContentId: null,
  nodeNavigatorOpen: false,
  shortcutsHelperOpen: false,
  contextMenuOpen: false
});

export default store;

window.__ellx.store = store;

export const notifyServer = payload => window.__ellx.devServer.send(JSON.stringify(payload));

export const getSheet = (contentId) => applyMiddleware(
  select(store, () => ['contents', contentId]),
  [enableUndoRedo, cgConnect(window.__ellx.Module.get(contentId))]
);

export const contents = select(store, () => ['contents']);
export const activeContent = select(store, ({ activeContentId }) => ['contents', activeContentId]);
export const activeContentId = derived(store, s => s.activeContentId);
export const nodeNavigatorOpen = withWritableTraits(select(store, () => 'nodeNavigatorOpen'));
export const shortcutsHelperOpen = withWritableTraits(select(store, () => 'shortcutsHelperOpen'));
export const contextMenuOpen = withWritableTraits(select(store, () => 'contextMenuOpen'));

export const oActiveContentId = toObservable(activeContentId, { name: 'activeContentId' });
