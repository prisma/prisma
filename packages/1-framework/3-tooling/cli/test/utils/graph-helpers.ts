import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';

export function entry(from: string, to: string, dirName: string): MigrationEdge {
  return {
    from,
    to,
    dirName,
    migrationHash: `mid_${dirName}`,
    createdAt: '',
    invariants: [],
  };
}

export function buildGraph(entries: MigrationEdge[]): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();

  for (const e of entries) {
    nodes.add(e.from);
    nodes.add(e.to);
    if (!forwardChain.has(e.from)) forwardChain.set(e.from, []);
    forwardChain.get(e.from)!.push(e);
    if (!reverseChain.has(e.to)) reverseChain.set(e.to, []);
    reverseChain.get(e.to)!.push(e);
    migrationByHash.set(e.migrationHash, e);
  }

  return { nodes, forwardChain, reverseChain, migrationByHash };
}
