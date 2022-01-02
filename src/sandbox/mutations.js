export function UPDATE_CONTENT({ contentId, ...updates }) {
  return ({ update }) => update('contents', contentId, content => ({ ...content, ...updates }));
}

export function SET_SELECTION({ selection }) {
  return ({ set }) => set('selection', selection);
}

export function REMOVE_CONTENT({ contentId }) {
  return ({ remove }) => remove('contents', contentId);
}

export function SET_ACTIVE_CONTENT({ contentId }) {
  return ({ set }) => set('activeContentId', contentId);
}

export function INSERT_BLOCK({ blockId, block }) {
  return ({ set }) => set('blocks', blockId, block);
}

export function UPDATE_BLOCK({ blockId, ...blockUpdate }) {
  return ({ update }) => update('blocks', blockId, block => block && ({ ...block, ...blockUpdate }));
}

export function UPDATE_CALCULATED({ blockId, ...nodeUpdate }) {
  return ({ update, apply }) => {
    const { value, component, ...blockUpdate } = nodeUpdate;

    const calculatedUpdate = {
      ...('value' in nodeUpdate && { value }),
      ...('component' in nodeUpdate && { component })
    };

    if (Object.keys(calculatedUpdate).length) {
      update('calculated', blockId, calculated => ({ ...calculated, ...calculatedUpdate }));
    }

    if (Object.keys(blockUpdate).length) {
      apply(UPDATE_BLOCK({ blockId, ...blockUpdate }));
    }
  };
}

export function DELETE_BLOCK({ blockId }) {
  return ({ remove }) => remove('blocks', blockId);
}

export function DELETE_CALCULATED({ blockId }) {
  return ({ remove }) => remove('calculated', blockId);
}

export function BULK_UPDATE_BLOCKS({ toInsert, toUpdate, toRemove }) {
  return ({ apply }) => {
    (toUpdate || []).forEach(payload => apply(UPDATE_BLOCK(payload)));
    (toRemove || []).forEach(payload => apply(DELETE_BLOCK(payload)));
    (toInsert || []).forEach(payload => apply(INSERT_BLOCK(payload)));
  }
}

export function CHANGE_EXPANSION({ position, expansion }) {
  return ({ set, remove }) => {
    set('position', position);
    if (expansion) set('expansion', expansion);
    else remove('expansion')
  }
}

export function CHANGE_POSITION({ h, v, dh, dv }) {
  h = h || 0;
  v = v || 0;
  dh = dh || 0;
  dv = dv || 0;
  return ({ update }) => update(([top, left, bottom, right]) => [top + v, left + h, bottom + v + dv, right + h + dh]);
}
