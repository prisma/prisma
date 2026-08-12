import { EMPTY_CONTRACT_HASH } from './constants';
import { errorHashNotInGraph } from './errors';
import type { MigrationGraph } from './graph';

export function isGraphNode(hash: string, graph: MigrationGraph): boolean {
  if (hash === EMPTY_CONTRACT_HASH) {
    return true;
  }
  return graph.nodes.has(hash);
}

export function assertHashIsGraphNode(hash: string, graph: MigrationGraph): asserts hash is string {
  if (isGraphNode(hash, graph)) {
    return;
  }
  throw errorHashNotInGraph(hash, graph);
}
