import {
  UPDATE_BLOCK,
  UPDATE_CALCULATED,
  DELETE_CALCULATED
} from './mutations';

const cgConnect = cg => (inner) => {
  const nodeRenderer = (blockId) => updated => {
    inner.commit(UPDATE_CALCULATED, { blockId, ...updated });
  };

  const logger = process.env.NODE_ENV !== 'production' ? message => console.debug(message) : () => {};

  return {
    ...inner,
    commit: (transaction, payload, ...keyPath) => {
      let cgRecalculate = payload && payload.cgRecalculate;
      if (cgRecalculate) delete payload.cgRecalculate;

      let changes = inner.commit(transaction, payload, ...keyPath);

      let toMerge = new Map(); // cg -> descriptions of nodes to merge

      for (let change of changes) {
        let { path, oldValue: oldBlock, newValue: newBlock } = change;
        let [_blocks, blockId] = path.slice(-2);

        if (_blocks !== 'blocks') continue;

        // A single block has been inserted / deleted or updated
        let oldNode = oldBlock && oldBlock.node;
        let newNode = newBlock && newBlock.node;

        if (oldNode !== undefined && newNode === undefined) {
          // A node has been deleted
          logger(`[cgConnect]: remove node ${oldNode}`);
          cg.remove(oldNode);

          inner.commit(DELETE_CALCULATED, { blockId });
        }
        else if (newNode !== undefined) {
          try {
            if (oldNode === undefined) {
              if (typeof newNode === 'string' && newNode.startsWith('?')) {
                // The node is part of a sub-graph to merge in one go
                let subGraph = toMerge.get(cg);
                if (!subGraph) toMerge.set(cg, subGraph = []);
                subGraph.push({
                  blockId,
                  identifier: newNode.slice(1),
                  formula: newBlock.formula,
                  initValue: newBlock.value
                });
                continue;
              }

              // A node has been inserted
              logger(`[cgConnect]: insert node ${newNode}`);

              cg.insert(newNode, newBlock.formula)
                .on('update', nodeRenderer(blockId));
            }
            else if (newNode && oldNode !== newNode) {
              // A node has been renamed
              logger(`[cgConnect]: rename node ${oldNode} to ${newNode}`);

              cg.rename(oldNode, newNode, newBlock.formula);
            }
            else if (oldBlock.formula !== newBlock.formula || cgRecalculate) {
              // Node's formula changed, or recalculation requested
              logger(`[cgConnect]: update node ${oldNode}`);

              cg.update(oldNode, newBlock.formula);
            }
          }
          catch (e) {
            if (oldNode) {
              logger(`[cgConnect]: remove node ${oldNode}`);
              cg.remove(oldNode);

              inner.commit(DELETE_CALCULATED, { blockId });
            }
            change.newValue = inner.commit(UPDATE_BLOCK, {
              blockId,
              value: e,
              formula: `${newNode || oldNode || ''} = ${newBlock.formula}`,
              node: undefined
            })[0].newValue;
          }
        }
      }

      // Merge calculation sub-graph
      for (let [cg, subGraph] of toMerge) {
        let newNodes = cg.merge(subGraph);

        for (let { identifier, blockId } of subGraph) {
          let node = newNodes.get(identifier);

          // A node has been merged
          logger(`[cgConnect]: merged node ${identifier} as ${node.name}`);

          node.on('update', nodeRenderer(blockId));
        }
      }
      return changes;
    },
  };
};

export default cgConnect;
