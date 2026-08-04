/**
 * Grid layout for the line/plane/occlusion migration-graph renderer.
 *
 * Produces a Grid (rows × cells) from a MigrationGraphRowModel. Each node
 * emits: fork connector, self-loop rows, node row, merge connector, and
 * inbound migration rows — in display order (tips first, then roots).
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { InternalError } from '@internal/utils/internal-error';
import {
  type Cell,
  type CellLine,
  DEFAULT_COLS_PER_LANE,
  type Direction,
  type Grid,
  type GridOptions,
  type Highlight,
  type LineRef,
  type NodeRef,
  type PathRole,
} from './migration-graph-model';
import type { ClassifiedEdge, MigrationGraphRowModel } from './migration-graph-rows';

// ---------------------------------------------------------------------------
// Internal: lane + rank assignment
// ---------------------------------------------------------------------------

interface LaneAssignment {
  nodeLane: Map<string, number>;
  nodeRank: Map<string, number>;
  /**
   * Per-edge lane override. Set for "direct fork-to-merge" branch edges whose
   * endpoints both land on lane 0 after merge reconciliation, but whose BFS
   * traversal allocated them a non-zero branch lane. Using this override lets
   * the branch edge render in its branch column even when the merge tip was
   * pulled back to the trunk lane.
   */
  edgeLane: Map<string, number>;
  /** Total number of lanes allocated. */
  numLanes: number;
}

function buildLaneAssignment(
  nodes: readonly (string | null)[],
  edges: readonly ClassifiedEdge[],
): LaneAssignment {
  // Separate forward (non-self) edges
  const fwdEdges = edges.filter((e) => e.kind === 'forward' && e.from !== e.to);

  // Build outbound/inbound adjacency sorted by dirName
  const outbound = new Map<string, ClassifiedEdge[]>();
  const inbound = new Map<string, ClassifiedEdge[]>();
  for (const edge of fwdEdges) {
    const ob = outbound.get(edge.from);
    if (ob) ob.push(edge);
    else outbound.set(edge.from, [edge]);

    const ib = inbound.get(edge.to);
    if (ib) ib.push(edge);
    else inbound.set(edge.to, [edge]);
  }
  for (const list of outbound.values()) list.sort((a, b) => a.dirName.localeCompare(b.dirName));
  for (const list of inbound.values()) list.sort((a, b) => a.dirName.localeCompare(b.dirName));

  // Split nodes into per-component groups (null sentinels separate components)
  const components: string[][] = [];
  let current: string[] = [];
  for (const n of nodes) {
    if (n === null) {
      if (current.length > 0) components.push(current);
      current = [];
    } else {
      current.push(n);
    }
  }
  if (current.length > 0) components.push(current);

  // Global rank map (longest-forward-path; computed across all nodes together
  // so rollback edges crossing components don't interfere with rank within each)
  const allNodes = new Set<string>();
  for (const n of nodes) {
    if (n !== null) allNodes.add(n);
  }
  const nodeRank = new Map<string, number>();
  for (const n of allNodes) nodeRank.set(n, 0);
  for (let pass = 0; pass < allNodes.size; pass++) {
    let changed = false;
    for (const [from, es] of outbound) {
      const base = nodeRank.get(from) ?? 0;
      for (const e of es) {
        const next = base + 1;
        if (next > (nodeRank.get(e.to) ?? 0)) {
          nodeRank.set(e.to, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Lane assignment: BFS per component, resetting nextLane to 0 for each.
  // Each component's roots start at lane 0, so disconnected components never
  // interleave lanes.
  const nodeLane = new Map<string, number>();
  // Per-edge lane: records the BFS-allocated branch lane for each edge. Used
  // to preserve branch-column rendering even after merge-tip reconciliation.
  const edgeLane = new Map<string, number>();
  let totalLanes = 0;

  for (const componentNodes of components) {
    const componentSet = new Set(componentNodes);
    let nextLane = 0;

    const roots: string[] = [];
    for (const n of componentNodes) {
      if ((inbound.get(n) ?? []).length === 0) roots.push(n);
    }
    roots.sort((a, b) => {
      if (a === EMPTY_CONTRACT_HASH) return -1;
      if (b === EMPTY_CONTRACT_HASH) return 1;
      return a.localeCompare(b);
    });

    const bfsQueue: Array<{ node: string; lane: number }> = [];
    for (const root of roots) {
      if (!nodeLane.has(root)) {
        nodeLane.set(root, nextLane++);
        bfsQueue.push({ node: root, lane: nodeLane.get(root)! });
      }
    }

    let head = 0;
    while (head < bfsQueue.length) {
      const item = bfsQueue[head++]!;
      const { node, lane } = item;
      const children = outbound.get(node) ?? [];
      let first = true;
      for (const childEdge of children) {
        const child = childEdge.to;
        if (!componentSet.has(child)) continue;
        if (!nodeLane.has(child)) {
          const childLane = first ? lane : nextLane++;
          nodeLane.set(child, childLane);
          bfsQueue.push({ node: child, lane: childLane });
          edgeLane.set(childEdge.migrationHash, childLane);
        } else {
          // Child already assigned — record this edge's lane as the max of the
          // parent's lane and the child's current lane (same as the original
          // Math.max formula). May be updated by reconciliation below for trunk
          // edges into reconciled merge nodes.
          edgeLane.set(childEdge.migrationHash, Math.max(lane, nodeLane.get(child)!));
        }
        first = false;
      }
    }

    // Isolated nodes within the component
    for (const n of componentNodes) {
      if (!nodeLane.has(n)) nodeLane.set(n, nextLane++);
    }

    // Merge-node lane reconciliation: a node with multiple inbound forward edges
    // should sit on the lane of its highest-rank parent (furthest along the
    // longest path). When a short arm and a long arm converge, the merge node
    // follows the long arm's lane.
    //
    // When a merge node's lane changes, update the edgeLane for all edges
    // pointing TO that node so they reflect the reconciled column. Edges from
    // nodes that were on a BRANCH (non-trunk) lane keep their original branch
    // lane so the branch column renders correctly.
    for (const n of componentNodes) {
      const parents = inbound.get(n);
      if (!parents || parents.length <= 1) continue;
      let trunkParent = parents[0]!.from;
      let trunkRank = nodeRank.get(trunkParent) ?? 0;
      let trunkLane = nodeLane.get(trunkParent) ?? 0;
      for (let i = 1; i < parents.length; i++) {
        const parent = parents[i]!.from;
        const rank = nodeRank.get(parent) ?? 0;
        const lane = nodeLane.get(parent) ?? 0;
        if (rank > trunkRank || (rank === trunkRank && lane < trunkLane)) {
          trunkParent = parent;
          trunkRank = rank;
          trunkLane = lane;
        }
      }
      const trunkParentLane = nodeLane.get(trunkParent) ?? 0;
      const currentNodeLane = nodeLane.get(n) ?? 0;
      if (currentNodeLane === trunkParentLane) continue;

      nodeLane.set(n, trunkParentLane);

      // Update edgeLane for each inbound edge:
      // - Trunk edge (from the highest-rank parent): use the trunk lane
      // - Branch edges: keep the ORIGINAL edgeLane (the branch column), so
      //   the branch edge still renders in its allocated branch column.
      for (const parentEdge of parents) {
        const isFromTrunkParent = parentEdge.from === trunkParent;
        if (isFromTrunkParent) {
          edgeLane.set(parentEdge.migrationHash, trunkParentLane);
        }
        // Branch edges keep whatever lane they were assigned during BFS.
      }

      // Propagate the lane change to forward descendants that inherited the
      // old lane. BFS from this merge node through outbound edges: any
      // descendant still on oldLane moves to the new (trunk) lane. Stop the
      // traversal at nodes that are already on a different lane — they belong
      // to branches that forked independently and must not move.
      const bfsDescendants: string[] = [n];
      let descHead = 0;
      while (descHead < bfsDescendants.length) {
        const current = bfsDescendants[descHead++]!;
        const children = outbound.get(current) ?? [];
        for (const childEdge of children) {
          const child = childEdge.to;
          if (!componentSet.has(child)) continue;
          if ((nodeLane.get(child) ?? 0) !== currentNodeLane) continue;
          nodeLane.set(child, trunkParentLane);
          // Update the edge lane for the edge from current→child
          const existingEdgeLane = edgeLane.get(childEdge.migrationHash);
          if (existingEdgeLane !== undefined && existingEdgeLane === currentNodeLane) {
            edgeLane.set(childEdge.migrationHash, trunkParentLane);
          }
          bfsDescendants.push(child);
        }
      }
    }

    if (nextLane > totalLanes) totalLanes = nextLane;
  }

  return { nodeLane, nodeRank, edgeLane, numLanes: totalLanes };
}

// ---------------------------------------------------------------------------
// Internal: display order
// ---------------------------------------------------------------------------

interface NodeDisplay {
  hash: string;
  lane: number;
  rank: number;
}

/**
 * A `null` sentinel in the display order marks a component boundary.
 * The grid builder emits a separator row at each boundary.
 */
type NodeDisplayOrSeparator = NodeDisplay | null;

function computeDisplayOrder(
  nodes: readonly (string | null)[],
  nodeLane: Map<string, number>,
  nodeRank: Map<string, number>,
): NodeDisplayOrSeparator[] {
  const seen = new Set<string>();
  const result: NodeDisplayOrSeparator[] = [];

  // Collect each component's nodes then sort within it (rank desc, lane asc).
  // null sentinels mark component boundaries; they become separator entries.
  let componentBuffer: NodeDisplay[] = [];

  function flushComponent(): void {
    componentBuffer.sort((a, b) => b.rank - a.rank || a.lane - b.lane);
    for (const d of componentBuffer) result.push(d);
    componentBuffer = [];
  }

  for (const n of nodes) {
    if (n === null) {
      flushComponent();
      result.push(null);
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    componentBuffer.push({ hash: n, lane: nodeLane.get(n) ?? 0, rank: nodeRank.get(n) ?? 0 });
  }
  flushComponent();

  return result;
}

// ---------------------------------------------------------------------------
// Internal: grid row builder
// ---------------------------------------------------------------------------

type CellsRow = Cell[];

/** Create an empty cell. */
function emptyCell(): Cell {
  return { lines: [] };
}

// ---------------------------------------------------------------------------
// buildGrid — main entry point
// ---------------------------------------------------------------------------

export function buildGrid(
  rowModel: MigrationGraphRowModel,
  opts: GridOptions = {},
  highlight: Highlight = { mode: 'flat', onPath: new Set() },
): Grid {
  const colsPerLane = opts.colsPerLane ?? DEFAULT_COLS_PER_LANE;
  const isFocus = highlight.mode === 'focus';

  const { nodeLane, nodeRank, edgeLane, numLanes } = buildLaneAssignment(
    rowModel.nodes,
    rowModel.edges,
  );

  const displayOrder = computeDisplayOrder(rowModel.nodes, nodeLane, nodeRank);

  // Display index per node (0 = topmost position; nulls skipped).
  const displayIndex = new Map<string, number>();
  let nodeIdx = 0;
  for (const d of displayOrder) {
    if (d !== null) {
      displayIndex.set(d.hash, nodeIdx++);
    }
  }

  // ── Back-arc planning ────────────────────────────────────────────────────
  // Each rollback edge runs against the forward grain. An *adjacent* rollback
  // (target is the display-neighbour directly below the source) is a plain ↓ in
  // the source's own lane. A *node-skipping* rollback is routed on its own
  // back-lane to the right: it tees off the source node row (○─╮), runs a
  // vertical │ down its back-lane, and lands into the target node (◂╯).
  //
  // Three independent numbers per routed back-arc:
  //   geomLane   — the column its rail occupies. Outermost (largest) goes to the
  //                arc reaching the lowest target (ties: higher source first), so
  //                interleaving spans cross and nested spans nest cleanly.
  //   colourLane — the lane index used purely for colour (flat mode). Assigned
  //                by greedy colouring (bottom-up walk; see below) so that no
  //                two concurrently-active lanes/arcs share a palette colour,
  //                and no arc reuses its origin branch's colour or green.
  //   planeLane  — the z-order index for occlusion within a shared back-lane.
  //                Arcs sharing the same geomLane are sorted by sourceIndex
  //                descending: the arc whose source is lowest in display
  //                (largest sourceIndex = bottom-most visually) draws on top
  //                (smallest planeLane number). Decoupled from colourLane.
  interface RoutedBackArc {
    readonly edge: ClassifiedEdge;
    readonly sourceIndex: number;
    readonly targetIndex: number;
    readonly geomLane: number;
    readonly colourLane: number;
    readonly planeLane: number;
  }

  const rollbackEdges = rowModel.edges.filter((e) => e.kind === 'rollback' && e.from !== e.to);

  const adjacentRollbacks: ClassifiedEdge[] = [];
  const skippingRollbacks: ClassifiedEdge[] = [];
  for (const e of rollbackEdges) {
    const si = displayIndex.get(e.from);
    const ti = displayIndex.get(e.to);
    if (si === undefined || ti === undefined) continue;
    // Adjacent: target sits directly below the source in display order.
    if (ti === si + 1) adjacentRollbacks.push(e);
    else skippingRollbacks.push(e);
  }

  // Convergence: group skipping rollbacks by their target node. Arcs sharing a
  // target share one geometric lane (rail column). Each distinct target gets its
  // own rail; arcs within the group compose via occlusion.
  //
  // geomLane ordering: outermost rail goes to the group whose target is lowest
  // in display order (largest target index — deepest in the chain). Within a
  // group, the group's representative target index drives the ordering.
  const targetGroups = new Map<string, ClassifiedEdge[]>();
  for (const e of skippingRollbacks) {
    const group = targetGroups.get(e.to);
    if (group) group.push(e);
    else targetGroups.set(e.to, [e]);
  }
  // Sort target-group keys: largest target index (lowest in display) → outermost lane.
  const sortedTargetKeys = [...targetGroups.keys()].sort((a, b) => {
    const ta = displayIndex.get(a) ?? 0;
    const tb = displayIndex.get(b) ?? 0;
    return tb - ta; // largest index first = outermost
  });
  const numTargetGroups = sortedTargetKeys.length;
  const geomLaneOf = new Map<string, number>();
  const outermostGroup = numLanes + numTargetGroups - 1;
  sortedTargetKeys.forEach((targetHash, i) => {
    const groupGeomLane = outermostGroup - i;
    for (const e of targetGroups.get(targetHash)!) {
      geomLaneOf.set(e.migrationHash, groupGeomLane);
    }
  });

  // ── planeLane: z-order for back-arcs ────────────────────────────────────
  // The arc whose source is furthest down the display (largest sourceIndex)
  // draws on top (lowest planeLane). This applies both within shared back-lanes
  // and at crossing points where arcs on different geomLanes overlap.
  // planeLane = totalNodes - sourceIndex gives: larger sourceIndex → smaller value.
  const totalDisplayNodes = displayOrder.filter((d) => d !== null).length;
  const planeLaneOf = new Map<string, number>();
  for (const e of skippingRollbacks) {
    const si = displayIndex.get(e.from) ?? 0;
    planeLaneOf.set(e.migrationHash, totalDisplayNodes - si);
  }

  // ── colourLane: greedy assignment (flat mode) ─────────────────────────────
  // Walk displayOrder bottom → top. Maintain the set of concurrently-active
  // palette-colour indices (forward lanes + active back-arc assignments). When
  // a new arc first becomes visible (at its target node, going upward), pick the
  // lowest palette index not in use. Additionally exclude:
  //   - the arc's origin lane's colour (nodeLane.get(from) % PALETTE_SIZE)
  //   - index 5 (green — reserved for focus on-path)
  // When the arc's source node is processed, release its colour.
  //
  // Forward lanes hold colour = laneIndex % PALETTE_SIZE (unchanged); back-arc
  // colourLane is set to the chosen palette index directly (0–5), so that
  // `colourLane % 6 == chosenIndex`.
  const PALETTE_SIZE = 6;
  const GREEN_PALETTE_IDX = 5;

  // Precompute per-arc display indices for the walk.
  const arcSourceIndex = new Map<string, number>();
  const arcTargetIndex = new Map<string, number>();
  for (const e of skippingRollbacks) {
    arcSourceIndex.set(e.migrationHash, displayIndex.get(e.from) ?? 0);
    arcTargetIndex.set(e.migrationHash, displayIndex.get(e.to) ?? 0);
  }

  // Build lookup: arcs by target node hash and source node hash.
  const arcsByTarget = new Map<string, ClassifiedEdge[]>();
  const arcsBySource = new Map<string, ClassifiedEdge[]>();
  for (const e of skippingRollbacks) {
    const tb = arcsByTarget.get(e.to);
    if (tb) tb.push(e);
    else arcsByTarget.set(e.to, [e]);
    const sb = arcsBySource.get(e.from);
    if (sb) sb.push(e);
    else arcsBySource.set(e.from, [e]);
  }

  // Greedy walk: bottom → top through displayOrder.
  const colourLaneOf = new Map<string, number>();
  // activeArcColours: migHash → palette index currently in use by that arc.
  const activeArcColours = new Map<string, number>();
  // activeFwdLaneColours: set of palette indices held by currently-active forward lanes.
  const activeFwdLaneColours = new Set<number>();

  for (let i = displayOrder.length - 1; i >= 0; i--) {
    const nd = displayOrder[i];
    if (nd === null || nd === undefined) continue; // separator or missing — skip

    const { hash: nodeHash } = nd;
    const nodeFwdLane = nodeLane.get(nodeHash) ?? 0;

    // 1. Activate this node's forward lane (if not already active from a lower node).
    activeFwdLaneColours.add(nodeFwdLane % PALETTE_SIZE);

    // 2. Assign colour to arcs that TARGET this node. They become visible
    //    starting here, running upward to their source.
    const incomingArcs = arcsByTarget.get(nodeHash) ?? [];
    // Process in a stable order (dirName) for determinism.
    const sortedIncoming = [...incomingArcs].sort((a, b) => a.dirName.localeCompare(b.dirName));
    for (const arc of sortedIncoming) {
      const originLaneColour = (nodeLane.get(arc.from) ?? 0) % PALETTE_SIZE;
      // Colours currently occupied.
      const occupied = new Set<number>(activeFwdLaneColours);
      for (const c of activeArcColours.values()) occupied.add(c);
      occupied.add(GREEN_PALETTE_IDX);
      occupied.add(originLaneColour);
      // Pick the lowest free index; if all are taken, pick lowest excluding green.
      let chosen = -1;
      for (let ci = 0; ci < PALETTE_SIZE; ci++) {
        if (!occupied.has(ci)) {
          chosen = ci;
          break;
        }
      }
      if (chosen === -1) {
        // Palette exhausted — forced reuse. Pick lowest excluding green.
        for (let ci = 0; ci < PALETTE_SIZE; ci++) {
          if (ci !== GREEN_PALETTE_IDX) {
            chosen = ci;
            break;
          }
        }
      }
      colourLaneOf.set(arc.migrationHash, chosen === -1 ? 0 : chosen);
      activeArcColours.set(arc.migrationHash, chosen === -1 ? 0 : chosen);
    }

    // 3. Release arcs that SOURCE at this node. Their rail runs from here
    //    downward; above this node they're gone.
    for (const arc of arcsBySource.get(nodeHash) ?? []) {
      activeArcColours.delete(arc.migrationHash);
    }
  }

  const routedBackArcs: RoutedBackArc[] = skippingRollbacks.map((e) => ({
    edge: e,
    sourceIndex: displayIndex.get(e.from) ?? 0,
    targetIndex: displayIndex.get(e.to) ?? 0,
    geomLane: geomLaneOf.get(e.migrationHash) ?? numLanes,
    colourLane: colourLaneOf.get(e.migrationHash) ?? 0,
    planeLane: planeLaneOf.get(e.migrationHash) ?? numLanes,
  }));

  const backArcsBySource = new Map<string, RoutedBackArc[]>();
  const backArcsByTarget = new Map<string, RoutedBackArc[]>();
  for (const arc of routedBackArcs) {
    const sb = backArcsBySource.get(arc.edge.from);
    if (sb) sb.push(arc);
    else backArcsBySource.set(arc.edge.from, [arc]);
    const tb = backArcsByTarget.get(arc.edge.to);
    if (tb) tb.push(arc);
    else backArcsByTarget.set(arc.edge.to, [arc]);
  }

  const adjacentBySource = new Map<string, ClassifiedEdge[]>();
  const adjacentByTarget = new Map<string, ClassifiedEdge[]>();
  for (const e of adjacentRollbacks) {
    const b = adjacentBySource.get(e.from);
    if (b) b.push(e);
    else adjacentBySource.set(e.from, [e]);
    const t = adjacentByTarget.get(e.to);
    if (t) t.push(e);
    else adjacentByTarget.set(e.to, [e]);
  }
  for (const list of adjacentBySource.values())
    list.sort((a, b) => a.dirName.localeCompare(b.dirName));

  const numBackLanes = numTargetGroups;
  const totalCols = (numLanes + numBackLanes) * colsPerLane;

  // Build edge lookup maps (classified)
  const fwdEdges = rowModel.edges.filter((e) => e.kind === 'forward' && e.from !== e.to);
  const selfEdges = rowModel.edges.filter((e) => e.kind === 'self');

  // outbound sorted by migrationHash
  const outboundFwd = new Map<string, ClassifiedEdge[]>();
  const inboundFwd = new Map<string, ClassifiedEdge[]>();
  for (const e of fwdEdges) {
    const ob = outboundFwd.get(e.from);
    if (ob) ob.push(e);
    else outboundFwd.set(e.from, [e]);
    const ib = inboundFwd.get(e.to);
    if (ib) ib.push(e);
    else inboundFwd.set(e.to, [e]);
  }
  for (const list of outboundFwd.values()) list.sort((a, b) => a.dirName.localeCompare(b.dirName));
  for (const list of inboundFwd.values()) list.sort((a, b) => a.dirName.localeCompare(b.dirName));

  const selfEdgesByNode = new Map<string, ClassifiedEdge[]>();
  for (const e of selfEdges) {
    const bucket = selfEdgesByNode.get(e.from);
    if (bucket) bucket.push(e);
    else selfEdgesByNode.set(e.from, [e]);
  }
  for (const list of selfEdgesByNode.values())
    list.sort((a, b) => a.dirName.localeCompare(b.dirName));

  // ── Role + plane: mode/z-order seam ──────────────────────────────────────
  // role(migrationHash): focus → on-path/off-path from highlight.onPath; flat → undefined.
  function roleOf(migrationHash: string): PathRole | undefined {
    if (!isFocus) return undefined;
    return highlight.onPath.has(migrationHash) ? 'on-path' : 'off-path';
  }

  // On-path node set: a node is on-path iff an on-path edge touches it (from or
  // to) — forward, self, OR rollback (a back-arc's endpoints are on its route).
  const onPathNodes = new Set<string>();
  if (isFocus) {
    for (const e of [...fwdEdges, ...selfEdges, ...rollbackEdges]) {
      if (highlight.onPath.has(e.migrationHash)) {
        onPathNodes.add(e.from);
        onPathNodes.add(e.to);
      }
    }
  }
  function nodeRoleOf(hash: string): PathRole | undefined {
    if (!isFocus) return undefined;
    return onPathNodes.has(hash) ? 'on-path' : 'off-path';
  }

  // planeOf — z-order. Lower number = drawn on top.
  //   flat:  trunk on top → plane = lane (lane 0 topmost).
  //   focus: on-path on top → on-path = plane 0; off-path sits beneath it,
  //          ordered by lane so a deterministic owner survives among off-path lines.
  function planeOf(lane: number, role: PathRole | undefined): number {
    if (!isFocus) return lane;
    return role === 'on-path' ? 0 : lane + 1;
  }

  // ── LineRef + cell builders (role-aware) ─────────────────────────────────
  function lineRefFor(edge: ClassifiedEdge, lane: number): LineRef {
    return {
      migrationHash: edge.migrationHash,
      dirName: edge.dirName,
      lane,
      role: roleOf(edge.migrationHash),
    };
  }

  /** Synthetic LineRef for a lane carrying a representative edge's role (pass-through). */
  function passLineRef(lane: number, dirName: string, migHash: string): LineRef {
    return { migrationHash: migHash, dirName, lane, role: roleOf(migHash) };
  }

  function vertCell(line: LineRef): Cell {
    return {
      lines: [
        {
          line,
          directions: new Set<Direction>(['up', 'down']),
          plane: planeOf(line.lane, line.role),
        },
      ],
    };
  }

  function dirCell(line: LineRef, dirs: ReadonlySet<Direction>): Cell {
    return { lines: [{ line, directions: dirs, plane: planeOf(line.lane, line.role) }] };
  }

  function nodeCell(nodeRef: NodeRef): Cell {
    return { node: nodeRef, lines: [] };
  }

  // Pass-through colour follows the edge CURRENTLY occupying a lane at this row,
  // not a lane-wide average. A single lane carries different edges (with different
  // roles) over its vertical extent — e.g. lane 0 below a fork carries the trunk
  // branch (off-path) above the fork node and the trunk's parent edge (on-path)
  // below it. We track the active edge per lane as we descend top-to-bottom and
  // colour pass-through verticals from it. `laneCurrentEdge[L]` = the edge whose
  // vertical body currently runs through lane L at the row being emitted.
  const laneCurrentEdge = new Map<number, ClassifiedEdge>();

  function getRepLine(lane: number): LineRef {
    const e = laneCurrentEdge.get(lane);
    if (e) return lineRefFor(e, lane);
    return passLineRef(lane, `lane${lane}`, `lane${lane}`);
  }

  // Active lanes: set of lane indices currently visible (vertical passes through them)
  const activeLanes = new Set<number>();

  const grid: Cell[][] = [];

  function makeRow(): CellsRow {
    return Array.from({ length: totalCols }, () => emptyCell());
  }

  // Place vertical pass-throughs for all active lanes in a row, skipping specified lanes.
  function placeVerticals(row: CellsRow, skip: Set<number>): void {
    for (const lane of activeLanes) {
      if (skip.has(lane)) continue;
      const railCol = lane * colsPerLane;
      const cell = row[railCol];
      if (cell !== undefined && cell.lines.length === 0 && !cell.node) {
        row[railCol] = vertCell(getRepLine(lane));
      }
    }
  }

  // ── Back-arc helpers ──────────────────────────────────────────────────────
  // Active routed back-arcs whose vertical currently runs through their geomLane.
  const activeBackArcs = new Set<RoutedBackArc>();

  // A back-arc's LineRef carries its colourLane (not its geomLane) so colour is
  // read off the lane that drives the rotation, independent of column placement.
  function backArcLine(arc: RoutedBackArc): LineRef {
    return {
      migrationHash: arc.edge.migrationHash,
      dirName: arc.edge.dirName,
      lane: arc.colourLane,
      role: roleOf(arc.edge.migrationHash),
    };
  }

  function backArcPlane(arc: RoutedBackArc): number {
    const role = roleOf(arc.edge.migrationHash);
    if (!isFocus) return arc.planeLane;
    return role === 'on-path' ? 0 : arc.planeLane + 1;
  }

  // Compose a CellLine into a row cell (never overwrite — occlusion arbitrates).
  function composeLine(
    row: CellsRow,
    col: number,
    line: LineRef,
    dirs: ReadonlySet<Direction>,
    plane: number,
    extra?: { landingArrow?: boolean },
  ): void {
    const existing = row[col];
    const cellLine: CellLine = {
      line,
      directions: dirs,
      plane,
      ...(extra?.landingArrow ? { landingArrow: true } : {}),
    };
    if (existing && (existing.lines.length > 0 || existing.node)) {
      row[col] = { ...existing, lines: [...existing.lines, cellLine] };
    } else {
      row[col] = { lines: [cellLine] };
    }
  }

  // Place verticals for every active back-arc on this row (in its geomLane rail).
  function placeBackVerticals(row: CellsRow): void {
    for (const arc of activeBackArcs) {
      const railCol = arc.geomLane * colsPerLane;
      composeLine(
        row,
        railCol,
        backArcLine(arc),
        new Set<Direction>(['up', 'down']),
        backArcPlane(arc),
      );
    }
    placeAdjacentOverlays(row);
  }

  // Adjacent rollbacks share the source's own lane: their vertical body overlays
  // the forward trunk between source and target. In focus, an on-path adjacent
  // rollback lifts that segment of the trunk to the top plane (drawn green); in
  // flat it sits at the same plane/colour as the trunk, so it is a no-op there.
  interface ActiveAdjacent {
    readonly lane: number;
    readonly edge: ClassifiedEdge;
  }
  const activeAdjacent = new Set<ActiveAdjacent>();

  function placeAdjacentOverlays(row: CellsRow): void {
    for (const adj of activeAdjacent) {
      const railCol = adj.lane * colsPerLane;
      const cell = row[railCol];
      if (cell?.node) continue; // never overlay a node marker
      const line = lineRefFor(adj.edge, adj.lane);
      composeLine(
        row,
        railCol,
        line,
        new Set<Direction>(['up', 'down']),
        planeOf(adj.lane, line.role),
      );
    }
  }

  // Tee a routed back-arc off its source node row: a horizontal bridge from the
  // node's connector column across to the back-lane rail, ending in a ╮ corner
  // (down+left). Composed (not overwritten) so it occludes / is occluded by any
  // back-arc vertical it crosses.
  function emitBackArcTee(row: CellsRow, nodeLaneNum: number, arc: RoutedBackArc): void {
    const nodeRail = nodeLaneNum * colsPerLane;
    const geomRail = arc.geomLane * colsPerLane;
    const line = backArcLine(arc);
    const plane = backArcPlane(arc);
    for (let col = nodeRail + 1; col < geomRail; col++) {
      composeLine(row, col, line, new Set<Direction>(['left', 'right']), plane);
    }
    composeLine(row, geomRail, line, new Set<Direction>(['down', 'left']), plane);
  }

  // Land a routed back-arc into its target node row: a ◂ arrowhead in the node's
  // connector column, a horizontal bridge across to the back-lane rail, ending in
  // a ╯ corner (up+left). Composed so the on-top arc draws the anchor and the
  // others yield their corners beneath it (occlusion arbitrates).
  function emitBackArcLanding(row: CellsRow, nodeLaneNum: number, arc: RoutedBackArc): void {
    const nodeRail = nodeLaneNum * colsPerLane;
    const geomRail = arc.geomLane * colsPerLane;
    const line = backArcLine(arc);
    const plane = backArcPlane(arc);
    composeLine(row, nodeRail + 1, line, new Set<Direction>(['left', 'right']), plane, {
      landingArrow: true,
    });
    for (let col = nodeRail + 2; col < geomRail; col++) {
      composeLine(row, col, line, new Set<Direction>(['left', 'right']), plane);
    }
    composeLine(row, geomRail, line, new Set<Direction>(['up', 'left']), plane);
  }

  // Emit a connector row (fork or merge).
  //
  // The CONTINUOUS lane gets the unbroken vertical/sweep; every other
  // participating lane yields into its own corner. In flat mode the continuous
  // lane is the trunk (lane of the node); in focus mode it is the on-path lane
  // (the inbound/outbound edge whose migration is on-path), so the chosen route
  // is drawn as one continuous green line sweeping the merge/fork.
  //
  // Geometry is identical regardless of which lane is continuous; only the
  // NODE-ANCHOR glyph at the trunk rail changes:
  //   continuous == trunk    → │  (vertical, the trunk passes straight through)
  //   continuous == a branch → corner toward that branch
  //       merge: ╰ (up+right)   fork: ╭ (down+right)
  // The branch's own rail always carries its yield corner (merge ╮ / fork ╯), and
  // the cells between carry horizontals. The continuous (on-path) sweep is placed
  // on the top plane so it occludes the trunk's vertical at the node anchor.
  function emitConnectorRow(
    trunkLane: number,
    branchEntries: readonly { lane: number; edge: ClassifiedEdge }[],
    connectorType: 'fork' | 'merge',
    trunkEdge: ClassifiedEdge | undefined,
  ): CellsRow {
    const row = makeRow();
    const sorted = [...branchEntries].sort((a, b) => a.lane - b.lane);
    if (sorted.length === 0) return row;

    const branchByLane = new Map<number, ClassifiedEdge>();
    for (const b of sorted) branchByLane.set(b.lane, b.edge);

    // Continuous lane: the on-path participant in focus, else the trunk.
    let continuousLane = trunkLane;
    if (isFocus) {
      if (trunkEdge && highlight.onPath.has(trunkEdge.migrationHash)) {
        continuousLane = trunkLane;
      } else {
        const onPathBranch = sorted.find((b) => highlight.onPath.has(b.edge.migrationHash));
        if (onPathBranch) continuousLane = onPathBranch.lane;
      }
    }

    const trunkRailCol = trunkLane * colsPerLane;
    const continuousRailCol = continuousLane * colsPerLane;

    // Add a CellLine to a cell (compose, don't overwrite) so occlusion arbitrates.
    function addLine(col: number, line: LineRef, dirs: ReadonlySet<Direction>): void {
      const existing = row[col];
      const cellLine: CellLine = { line, directions: dirs, plane: planeOf(line.lane, line.role) };
      row[col] =
        existing && existing.lines.length > 0
          ? { ...existing, lines: [...existing.lines, cellLine] }
          : { lines: [cellLine] };
    }

    const cornerLeftDown: ReadonlySet<Direction> =
      connectorType === 'merge'
        ? new Set<Direction>(['left', 'down'])
        : new Set<Direction>(['left', 'up']);

    // ── Base plane: every yielding branch lays its own corner + the horizontal
    //    segment to its left (up to the previous branch's rail). These sit on the
    //    branch's lane plane; where the continuous sweep crosses them it occludes.
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i]!;
      if (b.lane === continuousLane) continue; // continuous drawn separately, on top
      const branchLine = lineRefFor(b.edge, b.lane);
      const railCol = b.lane * colsPerLane;
      addLine(railCol, branchLine, cornerLeftDown);
      const leftBound = i === 0 ? trunkRailCol + 1 : sorted[i - 1]!.lane * colsPerLane + 1;
      for (let col = leftBound; col < railCol; col++) {
        addLine(col, branchLine, new Set<Direction>(['left', 'right']));
      }
    }

    // ── The continuous line ──────────────────────────────────────────────────
    const continuousLine: LineRef =
      continuousLane === trunkLane
        ? trunkEdge
          ? lineRefFor(trunkEdge, trunkLane)
          : getRepLine(trunkLane)
        : lineRefFor(branchByLane.get(continuousLane)!, continuousLane);

    if (continuousLane === trunkLane) {
      // Trunk passes straight through the node anchor (│), branches yield to it.
      addLine(trunkRailCol, continuousLine, new Set<Direction>(['up', 'down']));
    } else {
      // A branch is continuous: it sweeps from the node anchor across to its own
      // rail, on the TOP plane, occluding the trunk vertical and any intermediate
      // yielding branch corners it passes over.
      const anchorDirs: ReadonlySet<Direction> =
        connectorType === 'merge'
          ? new Set<Direction>(['up', 'right'])
          : new Set<Direction>(['down', 'right']);
      addLine(trunkRailCol, continuousLine, anchorDirs);
      for (let col = trunkRailCol + 1; col < continuousRailCol; col++) {
        addLine(col, continuousLine, new Set<Direction>(['left', 'right']));
      }
      addLine(continuousRailCol, continuousLine, cornerLeftDown);
    }

    // Other active lanes (not trunk, not branch): vertical pass-through.
    const skipSet = new Set<number>([trunkLane, ...sorted.map((b) => b.lane)]);
    placeVerticals(row, skipSet);
    placeBackVerticals(row);

    return row;
  }

  // Process each node in display order; null = component boundary → separator row
  for (const nodeDisplay of displayOrder) {
    if (nodeDisplay === null) {
      // Emit one blank separator row between disconnected components.
      const sepRow = makeRow();
      sepRow[0] = { lines: [], separator: true };
      grid.push(sepRow);
      continue;
    }

    const { hash: nodeHash } = nodeDisplay;
    const nodeLaneNum = nodeLane.get(nodeHash) ?? 0;

    activeLanes.add(nodeLaneNum);

    // ── 1. Fork connector (BEFORE the node row) ──────────────────────────
    const outEdges = outboundFwd.get(nodeHash) ?? [];
    if (outEdges.length > 1) {
      // Use the per-edge lane for branch children so that "direct fork-to-merge"
      // edges (whose target was reconciled back to trunk lane) still appear in
      // their allocated branch column.
      const trunkEdgeForFork = outEdges[0]!;
      const trunkChildLane =
        edgeLane.get(trunkEdgeForFork.migrationHash) ??
        nodeLane.get(trunkEdgeForFork.to) ??
        nodeLaneNum;
      const branchEntries = outEdges
        .slice(1)
        .map((e) => ({ lane: edgeLane.get(e.migrationHash) ?? nodeLane.get(e.to) ?? 0, edge: e }))
        .filter((b) => b.lane !== trunkChildLane && activeLanes.has(b.lane));

      if (branchEntries.length > 0) {
        const trunkEdge = outEdges[0];
        const connRow = emitConnectorRow(nodeLaneNum, branchEntries, 'fork', trunkEdge);
        grid.push(connRow);
        assertSingleOwner(connRow, isFocus);

        for (const b of branchEntries) activeLanes.delete(b.lane);
      }
    }

    // ── 2. Self-loop rows (BEFORE the node row) ───────────────────────────
    const selfMigrations = selfEdgesByNode.get(nodeHash) ?? [];
    for (const selfEdge of selfMigrations) {
      const row = makeRow();
      const railCol = nodeLaneNum * colsPerLane;
      const connCol = nodeLaneNum * colsPerLane + 1;
      const line = lineRefFor(selfEdge, nodeLaneNum);
      row[railCol] = vertCell(line);
      row[connCol] = {
        lines: [
          {
            line,
            directions: new Set<Direction>(),
            plane: planeOf(nodeLaneNum, line.role),
            selfLoop: true,
          },
        ],
      };
      placeVerticals(row, new Set([nodeLaneNum]));
      placeBackVerticals(row);
      grid.push(row);
    }

    // ── 3. Node row ────────────────────────────────────────────────────────
    {
      const row = makeRow();
      const railCol = nodeLaneNum * colsPerLane;
      const nodeRef: NodeRef = {
        contractHash: nodeHash,
        isEmpty: nodeHash === EMPTY_CONTRACT_HASH,
        lane: nodeLaneNum,
        role: nodeRoleOf(nodeHash),
      };
      row[railCol] = nodeCell(nodeRef);
      placeVerticals(row, new Set([nodeLaneNum]));

      // A back-arc landing ends its vertical at this row, replacing it with a ╯
      // corner — so deactivate landing arcs BEFORE placing back verticals. An
      // adjacent rollback's overlay likewise ends at its target node.
      const landingArcs = backArcsByTarget.get(nodeHash) ?? [];
      for (const arc of landingArcs) activeBackArcs.delete(arc);
      for (const adj of [...activeAdjacent]) {
        if (adj.edge.to === nodeHash) activeAdjacent.delete(adj);
      }

      placeBackVerticals(row);

      // Back-arc landing: arcs targeting this node sweep from the node anchor
      // (◂ arrowhead) across to their own rail corner (╯). The on-top arc draws
      // the anchor; others yield their corners beneath (occlusion arbitrates).
      for (const arc of landingArcs) {
        emitBackArcLanding(row, nodeLaneNum, arc);
      }

      // Back-arc tee: arcs sourced at this node tee off the node row into their
      // back-lane (─ bridge + ╮ corner). The vertical begins on the next row.
      const teeArcs = backArcsBySource.get(nodeHash) ?? [];
      for (const arc of teeArcs) {
        emitBackArcTee(row, nodeLaneNum, arc);
      }

      grid.push(row);

      // Activate the back-arc verticals AFTER the node row so the rail runs from
      // the next row down to (but not including) the target landing row.
      for (const arc of teeArcs) activeBackArcs.add(arc);

      // Activate adjacent-rollback overlays sourced here (their trunk overlay
      // runs from the next row down to the target node).
      for (const adj of adjacentBySource.get(nodeHash) ?? []) {
        activeAdjacent.add({ lane: nodeLaneNum, edge: adj });
      }
    }

    // Inbound forward edges run down their lanes below this node. Record each as
    // its lane's current edge NOW (before emitting the back-arc arrow rows, merge
    // connector, and migration rows) so pass-through verticals colour from the
    // forward edge actually occupying the trunk below this node.
    //
    // edgeLaneFor: resolve the lane for an inbound forward edge. Uses the
    // per-edge override from edgeLane (set during BFS for branch edges) when
    // available; falls back to Max(fromLane, toLane) for edges not in the map.
    function edgeLaneFor(edge: ClassifiedEdge): number {
      const override = edgeLane.get(edge.migrationHash);
      if (override !== undefined) return override;
      return Math.max(nodeLane.get(edge.from) ?? 0, nodeLane.get(edge.to) ?? 0);
    }

    // Sort inEdges so the trunk edge (lowest edgeLane = trunk column) comes
    // first. Ties broken by dirName. This ensures the merge connector treats
    // the trunk-column edge as the trunk regardless of alphabetical order.
    const inEdges = inboundFwd.get(nodeHash) ?? [];
    inEdges.sort((a, b) => {
      const aLane = edgeLaneFor(a);
      const bLane = edgeLaneFor(b);
      if (aLane !== bLane) return aLane - bLane;
      return a.dirName.localeCompare(b.dirName);
    });
    for (const edge of inEdges) {
      laneCurrentEdge.set(edgeLaneFor(edge), edge);
    }

    // ── 3b. Back-arc arrow rows ──────────────────────────────────────────────
    // For each routed arc sourced here, a │↓ arrow row in its back-lane sits
    // directly below the source node (before the source node's forward inbound
    // migration rows).
    {
      const teeArcs = backArcsBySource.get(nodeHash) ?? [];
      for (const arc of teeArcs) {
        const row = makeRow();
        const railCol = arc.geomLane * colsPerLane;
        const connCol = railCol + 1;
        const line = backArcLine(arc);
        const plane = backArcPlane(arc);
        composeLine(row, railCol, line, new Set<Direction>(['up', 'down']), plane);
        composeLine(row, connCol, line, new Set<Direction>(['down']), plane);
        placeVerticals(row, new Set<number>());
        placeBackVerticals(row);
        grid.push(row);
      }
    }

    // ── 4. Merge connector (AFTER the node row) ────────────────────────────
    if (inEdges.length > 1) {
      const branchEntries = inEdges.slice(1).map((e) => ({ lane: edgeLaneFor(e), edge: e }));

      const trunkEdge = inEdges[0];
      const connRow = emitConnectorRow(nodeLaneNum, branchEntries, 'merge', trunkEdge);
      grid.push(connRow);
      assertSingleOwner(connRow, isFocus);

      for (const b of branchEntries) activeLanes.add(b.lane);
    }

    // ── 5. Migration rows (one per inbound edge, ordered by edge lane) ─────
    for (const edge of inEdges) {
      const eLane = edgeLaneFor(edge);
      const row = makeRow();
      const railCol = eLane * colsPerLane;
      const connCol = eLane * colsPerLane + 1;
      const line = lineRefFor(edge, eLane);

      row[railCol] = vertCell(line);
      row[connCol] = dirCell(line, new Set<Direction>(['up']));

      placeVerticals(row, new Set([eLane]));
      placeBackVerticals(row);
      grid.push(row);
    }

    // ── 5b. Adjacent rollback ↓ rows ─────────────────────────────────────────
    // An adjacent rollback (target is the display-neighbour directly below) is a
    // plain ↓ in the source's own lane — mirror of the forward ↑ — emitted after
    // the source node's forward inbound rows, directly above the target node.
    {
      const adjacents = adjacentBySource.get(nodeHash) ?? [];
      for (const adj of adjacents) {
        const row = makeRow();
        const connCol = nodeLaneNum * colsPerLane + 1;
        const line = lineRefFor(adj, nodeLaneNum);
        const plane = planeOf(nodeLaneNum, line.role);
        // The rail │ belongs to the trunk passing through (drawn by placeVerticals
        // from the lane's current forward edge); only the ↓ arrow is the rollback.
        composeLine(row, connCol, line, new Set<Direction>(['down']), plane);
        placeVerticals(row, new Set<number>());
        placeBackVerticals(row);
        grid.push(row);
      }
    }

    // ── 6. Root lane deactivation ─────────────────────────────────────────
    if (inEdges.length === 0) {
      activeLanes.delete(nodeLaneNum);
    }
  }

  return grid;
}

// ---------------------------------------------------------------------------
// Single-owner invariant — after building a connector row, assert that every
// cell has at most one DRAWABLE owner once occlusion (topmost plane) is applied.
// In focus mode a tie at the same plane between an on-path and an off-path line
// would be a colour ambiguity, so we additionally assert that at the top plane
// of each cell exactly one role survives.
// ---------------------------------------------------------------------------
function assertSingleOwner(row: CellsRow, isFocus: boolean): void {
  for (const cell of row) {
    if (cell.lines.length <= 1) continue;
    let topPlane = Number.POSITIVE_INFINITY;
    for (const cl of cell.lines) if (cl.plane < topPlane) topPlane = cl.plane;
    const top = cell.lines.filter((cl: CellLine) => cl.plane === topPlane);
    if (top.length > 1) {
      if (isFocus) {
        const roles = new Set(top.map((cl) => cl.line.role));
        if (roles.size > 1) {
          throw new InternalError(
            'migration-graph layout: single-owner invariant violated — two differently-roled lines share the top plane in one cell',
          );
        }
      }
    }
  }
}
