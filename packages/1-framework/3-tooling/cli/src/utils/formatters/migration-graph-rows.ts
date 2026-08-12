import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import {
  classifyMigrationGraphTopology,
  type MigrationEdgeKind,
  type MigrationListGraphTopology,
} from './migration-list-graph-topology';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A migration edge with its forward/rollback/self classification resolved.
 * `from` and `to` are contract hashes (EMPTY_CONTRACT_HASH for the baseline).
 */
export interface ClassifiedEdge {
  readonly migrationHash: string;
  readonly from: string;
  readonly to: string;
  readonly dirName: string;
  readonly kind: MigrationEdgeKind;
}

/**
 * The pure-data output of the row-model stage.
 *
 * `nodes` is the vertical ordering of contract nodes: index 0 is the topmost
 * row (the tip), the last non-null entry is the bottommost root. `null`
 * sentinels separate disjoint components (the blank row in the rendered
 * output). Ordering within each component is deterministic: longest forward-
 * path rank from forward roots (tips at rank max, roots at 0), with lex-
 * ascending tie-break among same-rank siblings.
 *
 * `edges` carries every classified migration. `edgesByFrom` and `edgesByTo`
 * are pre-built lookup maps for the column allocator.
 */
export interface MigrationGraphRowModel {
  readonly nodes: readonly (string | null)[];
  readonly edges: readonly ClassifiedEdge[];
  readonly edgesByFrom: ReadonlyMap<string, readonly ClassifiedEdge[]>;
  readonly edgesByTo: ReadonlyMap<string, readonly ClassifiedEdge[]>;
}

export interface BuildMigrationGraphRowsOptions {
  readonly contractHash?: string;
}

// ---------------------------------------------------------------------------
// Weak connectivity — identify disjoint components
// ---------------------------------------------------------------------------

/**
 * Return the weakly-connected components of `graph` as an array of node sets,
 * ordered so the component containing EMPTY_CONTRACT_HASH comes first (if
 * present), with remaining components sorted by their lex-smallest node hash.
 */
function weaklyConnectedComponents(graph: MigrationGraph): readonly ReadonlySet<string>[] {
  const visited = new Set<string>();
  const adjacency = new Map<string, string[]>();

  function addAdjacent(a: string, b: string): void {
    const aList = adjacency.get(a);
    if (aList) aList.push(b);
    else adjacency.set(a, [b]);
    const bList = adjacency.get(b);
    if (bList) bList.push(a);
    else adjacency.set(b, [a]);
  }

  for (const edges of graph.forwardChain.values()) {
    for (const edge of edges) {
      if (edge.from !== edge.to) {
        addAdjacent(edge.from, edge.to);
      }
    }
  }

  // Ensure all nodes (including isolated self-loops) are reachable
  for (const node of graph.nodes) {
    if (!adjacency.has(node)) {
      adjacency.set(node, []);
    }
  }

  const components: Set<string>[] = [];

  function bfsComponent(start: string): Set<string> {
    const component = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === undefined || visited.has(node)) continue;
      visited.add(node);
      component.add(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    return component;
  }

  // Deterministic: visit nodes in a fixed order (EMPTY first, then lex)
  const allNodes = [...graph.nodes].sort((a, b) => {
    if (a === EMPTY_CONTRACT_HASH) return -1;
    if (b === EMPTY_CONTRACT_HASH) return 1;
    return a.localeCompare(b);
  });

  for (const node of allNodes) {
    if (!visited.has(node)) {
      components.push(bfsComponent(node));
    }
  }

  // Order: EMPTY component first, others by lex-smallest node hash
  components.sort((a, b) => {
    const aHasEmpty = a.has(EMPTY_CONTRACT_HASH);
    const bHasEmpty = b.has(EMPTY_CONTRACT_HASH);
    if (aHasEmpty && !bHasEmpty) return -1;
    if (!aHasEmpty && bHasEmpty) return 1;
    const aMin = [...a].sort((x, y) => x.localeCompare(y))[0] ?? '';
    const bMin = [...b].sort((x, y) => x.localeCompare(y))[0] ?? '';
    return aMin.localeCompare(bMin);
  });

  return components;
}

// ---------------------------------------------------------------------------
// Longest forward-path node ordering within a component
// ---------------------------------------------------------------------------

function forwardRootsInComponent(
  componentNodes: ReadonlySet<string>,
  topology: MigrationListGraphTopology,
): readonly string[] {
  const roots: string[] = [];
  for (const node of componentNodes) {
    if ((topology.forwardInDegree.get(node) ?? 0) === 0) {
      roots.push(node);
    }
  }
  roots.sort((a, b) => {
    if (a === EMPTY_CONTRACT_HASH) return -1;
    if (b === EMPTY_CONTRACT_HASH) return 1;
    return a.localeCompare(b);
  });
  if (roots.length > 0) return roots;

  return [...componentNodes].sort((a, b) => {
    if (a === EMPTY_CONTRACT_HASH) return -1;
    if (b === EMPTY_CONTRACT_HASH) return 1;
    return a.localeCompare(b);
  });
}

function compareNodesTipsFirst(a: string, b: string, rank: ReadonlyMap<string, number>): number {
  const rankA = rank.get(a) ?? 0;
  const rankB = rank.get(b) ?? 0;
  if (rankA !== rankB) return rankB - rankA;
  if (a === EMPTY_CONTRACT_HASH) return 1;
  if (b === EMPTY_CONTRACT_HASH) return -1;
  return a.localeCompare(b);
}

/**
 * Layer nodes by longest forward-path rank from forward roots within the
 * component. Rank 0 is the root (bottom row); the maximum rank is the tip
 * (top row). Emits rank-descending with lex-ascending tie-break among siblings
 * at the same rank — stable across edge-insertion order and correct under
 * diamonds, cross-links, and rollbacks.
 */
function maxRank(rank: ReadonlyMap<string, number>): number {
  let max = 0;
  for (const value of rank.values()) {
    if (value > max) max = value;
  }
  return max;
}

function layerNodesByLongestForwardPath(
  componentNodes: ReadonlySet<string>,
  topology: MigrationListGraphTopology,
  graph: MigrationGraph,
  contractHash: string | undefined,
): readonly string[] {
  const forwardOut = new Map<string, string[]>();

  for (const node of componentNodes) {
    forwardOut.set(node, []);
  }

  for (const edges of graph.forwardChain.values()) {
    for (const edge of edges) {
      if (!componentNodes.has(edge.from) || !componentNodes.has(edge.to)) continue;
      if (edge.from === edge.to) continue;
      if (topology.kindByMigrationHash.get(edge.migrationHash) !== 'forward') continue;
      const bucket = forwardOut.get(edge.from);
      if (bucket) bucket.push(edge.to);
    }
  }

  const roots = forwardRootsInComponent(componentNodes, topology);
  const rank = new Map<string, number>();
  for (const root of roots) {
    rank.set(root, 0);
  }

  const maxPasses = componentNodes.size;
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const node of componentNodes) {
      const base = rank.get(node);
      if (base === undefined) continue;
      for (const to of forwardOut.get(node) ?? []) {
        const next = base + 1;
        const prev = rank.get(to) ?? -1;
        if (next > prev) {
          rank.set(to, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  for (const node of componentNodes) {
    if (!rank.has(node)) {
      rank.set(node, 0);
    }
  }

  if (
    contractHash !== undefined &&
    contractHash !== EMPTY_CONTRACT_HASH &&
    componentNodes.has(contractHash) &&
    (forwardOut.get(contractHash) ?? []).length === 0
  ) {
    rank.set(contractHash, maxRank(rank) + 1);
  }

  return [...componentNodes].sort((a, b) => compareNodesTipsFirst(a, b, rank));
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build the row model from a tolerant `MigrationGraph`.
 *
 * The row model is the first pure-data stage of the `migration graph` render
 * pipeline. It:
 * - classifies every edge as `forward`, `rollback`, or `self`;
 * - produces a deterministic vertical node ordering (tips at index 0, roots
 *   at the end) within each weakly-connected component;
 * - separates disjoint components with `null` sentinels;
 * - optionally prepends a detached current contract as its own single-node
 *   component when `contractHash` is not already in the graph.
 *
 * No columns, no lane allocation, no glyphs, no rendering.
 */
/**
 * Resolve the detached current contract, if any: a real contract (not the
 * empty baseline) that no migration on disk produces, so it is absent from
 * the graph. Such a contract renders as a floating node rather than
 * decorating an existing one. Returns the hash when detached, else undefined.
 */
function detachedContractHash(
  graph: MigrationGraph,
  contractHash: string | undefined,
): string | undefined {
  return contractHash !== undefined &&
    contractHash !== EMPTY_CONTRACT_HASH &&
    !graph.nodes.has(contractHash)
    ? contractHash
    : undefined;
}

function isForwardLeaf(node: string, edges: readonly ClassifiedEdge[]): boolean {
  return !edges.some((e) => e.kind === 'forward' && e.from === node && e.from !== e.to);
}

function forwardReachableFrom(
  start: string,
  forwardTo: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  const reachable = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) continue;
    for (const next of forwardTo.get(node) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  return reachable;
}

function buildForwardToMap(edges: readonly ClassifiedEdge[]): Map<string, string[]> {
  const forwardTo = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.kind !== 'forward' || edge.from === edge.to) continue;
    const bucket = forwardTo.get(edge.from);
    if (bucket) bucket.push(edge.to);
    else forwardTo.set(edge.from, [edge.to]);
  }
  return forwardTo;
}

function sortEdgesForContractHashTrunk(
  edges: ClassifiedEdge[],
  contractHash: string | undefined,
): ClassifiedEdge[] {
  if (
    contractHash === undefined ||
    contractHash === EMPTY_CONTRACT_HASH ||
    !isForwardLeaf(contractHash, edges)
  ) {
    return edges;
  }

  const preferredLeaf = contractHash;
  const forwardTo = buildForwardToMap(edges);
  const reachability = new Map<string, ReadonlySet<string>>();
  function canReachContractHash(from: string): boolean {
    let cached = reachability.get(from);
    if (cached === undefined) {
      cached = forwardReachableFrom(from, forwardTo);
      reachability.set(from, cached);
    }
    return cached.has(preferredLeaf);
  }

  function trunkBias(edge: ClassifiedEdge): number {
    if (edge.kind !== 'forward' || edge.from === edge.to) return 0;
    if (edge.to === preferredLeaf) return 2;
    if (canReachContractHash(edge.to)) return 1;
    return 0;
  }

  return edges
    .map((edge, index) => ({ edge, index, bias: trunkBias(edge) }))
    .sort((a, b) => {
      if (a.edge.from !== b.edge.from) return a.index - b.index;
      if (a.bias !== b.bias) return b.bias - a.bias;
      return a.index - b.index;
    })
    .map(({ edge }) => edge);
}

function rebuildEdgeLookupMaps(edges: readonly ClassifiedEdge[]): {
  edgesByFrom: Map<string, ClassifiedEdge[]>;
  edgesByTo: Map<string, ClassifiedEdge[]>;
} {
  const edgesByFrom = new Map<string, ClassifiedEdge[]>();
  const edgesByTo = new Map<string, ClassifiedEdge[]>();
  for (const classified of edges) {
    const fromBucket = edgesByFrom.get(classified.from);
    if (fromBucket) fromBucket.push(classified);
    else edgesByFrom.set(classified.from, [classified]);

    const toBucket = edgesByTo.get(classified.to);
    if (toBucket) toBucket.push(classified);
    else edgesByTo.set(classified.to, [classified]);
  }
  return { edgesByFrom, edgesByTo };
}

export function buildMigrationGraphRows(
  graph: MigrationGraph,
  options: BuildMigrationGraphRowsOptions = {},
): MigrationGraphRowModel {
  const emptyModel: MigrationGraphRowModel = {
    nodes: [],
    edges: [],
    edgesByFrom: new Map(),
    edgesByTo: new Map(),
  };

  if (graph.nodes.size === 0) {
    const detached = detachedContractHash(graph, options.contractHash);
    return detached !== undefined ? { ...emptyModel, nodes: [detached] } : emptyModel;
  }

  // 1. Classify all edges (shared classifier: DFS plus a peel pass that demotes
  //    node-skipping rollbacks, so the forward subgraph is acyclic)
  const topology = classifyMigrationGraphTopology(graph);

  // 2. Build classified edge list
  const edges: ClassifiedEdge[] = [];

  for (const edgeList of graph.forwardChain.values()) {
    for (const edge of edgeList) {
      const kind = topology.kindByMigrationHash.get(edge.migrationHash) ?? 'forward';
      edges.push({
        migrationHash: edge.migrationHash,
        from: edge.from,
        to: edge.to,
        dirName: edge.dirName,
        kind,
      });
    }
  }

  const sortedEdges = sortEdgesForContractHashTrunk(edges, options.contractHash);
  const { edgesByFrom, edgesByTo } = rebuildEdgeLookupMaps(sortedEdges);

  // 3. Find weakly-connected components (ordered: EMPTY first, then lex)
  const components = weaklyConnectedComponents(graph);

  // 4. Layer nodes by longest forward path per component, separate with null
  const nodes: (string | null)[] = [];
  for (let i = 0; i < components.length; i++) {
    if (i > 0) nodes.push(null);
    const component = components[i];
    if (component === undefined) continue;
    const ordered = layerNodesByLongestForwardPath(
      component,
      topology,
      graph,
      options.contractHash,
    );
    for (const node of ordered) {
      nodes.push(node);
    }
  }

  const detached = detachedContractHash(graph, options.contractHash);
  if (detached !== undefined) {
    if (nodes.length > 0) {
      nodes.unshift(null);
    }
    nodes.unshift(detached);
  }

  return {
    nodes,
    edges: sortedEdges,
    edgesByFrom,
    edgesByTo,
  };
}
