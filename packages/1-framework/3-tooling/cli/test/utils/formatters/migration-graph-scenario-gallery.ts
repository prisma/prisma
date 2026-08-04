/**
 * Scenario catalogue for the migration-graph renderer.
 *
 * Serves two roles: snapshot fixture (`renderScenario` returns exact ANSI output)
 * and the source of truth for human gallery output (`pnpm gallery [filter]`).
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import { createColors } from 'colorette';
import { renderMigrationGraphCommand } from '../../../src/utils/formatters/migration-graph-command-render';
import { buildGrid } from '../../../src/utils/formatters/migration-graph-grid-layout';
import type { MigrationEdgeAnnotation } from '../../../src/utils/formatters/migration-graph-labels';
import { buildMigrationGraphRows } from '../../../src/utils/formatters/migration-graph-rows';
import { highlightFromEdgeAnnotations } from '../../../src/utils/formatters/migration-graph-space-render';

// ---------------------------------------------------------------------------
// Forced colour seam — matches the existing colour-matrix test's technique.
// ---------------------------------------------------------------------------
/** Forced-colour functions that always emit ANSI regardless of NO_COLOR. */
const { greenBright: forcedGreen, dim: forcedDim } = createColors({ useColor: true });

export { forcedDim, forcedGreen };

// ---------------------------------------------------------------------------
// Scenario variant descriptor
// ---------------------------------------------------------------------------

export interface ScenarioVariant {
  /** Variant name, e.g. "rotating", "trunk", "alt", "arc-1". */
  readonly name: string;
  /** One-line description for the gallery header. */
  readonly description: string;
  /**
   * Set of migration-hash values that are "on-path".
   * `undefined` = rotating/normal mode (no path highlight).
   * Empty set = all edges off-path.
   */
  readonly onPathHashes: ReadonlySet<string> | undefined;
}

export interface Scenario {
  /** Scenario name, e.g. "linear", "fork-2". */
  readonly name: string;
  /** All migration edges in this topology. */
  readonly edges: readonly MigrationEdge[];
  /** Named variants to render. */
  readonly variants: readonly ScenarioVariant[];
}

// ---------------------------------------------------------------------------
// Helper: build a MigrationGraph from an edge list
// ---------------------------------------------------------------------------
function buildGraph(edges: readonly MigrationEdge[]): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
    migrationByHash.set(e.migrationHash, e);
    const fwd = forwardChain.get(e.from);
    if (fwd) fwd.push(e);
    else forwardChain.set(e.from, [e]);
    const rev = reverseChain.get(e.to);
    if (rev) rev.push(e);
    else reverseChain.set(e.to, [e]);
  }
  return { nodes, forwardChain, reverseChain, migrationByHash };
}

// ---------------------------------------------------------------------------
// Helper: build edge annotations for path-highlight mode
// ---------------------------------------------------------------------------
function makeAnnotations(
  edges: readonly MigrationEdge[],
  onPathHashes: ReadonlySet<string>,
): Map<string, MigrationEdgeAnnotation> {
  return new Map(
    edges.map((e) => [
      e.migrationHash,
      {
        pathHighlight: onPathHashes.has(e.migrationHash)
          ? ('on-path' as const)
          : ('off-path' as const),
      },
    ]),
  );
}

// ---------------------------------------------------------------------------
// renderScenario — render a scenario variant to an exact ANSI string
// ---------------------------------------------------------------------------

/**
 * Render a scenario variant and return the exact ANSI string (including colour codes).
 * Force-colour is on: ANSI codes are emitted even in NO_COLOR environments.
 */
export function renderScenario(scenario: Scenario, variant: ScenarioVariant): string {
  const rowModel = buildMigrationGraphRows(buildGraph(scenario.edges), {});
  if (variant.onPathHashes !== undefined) {
    const edgeAnnotationsByHash = makeAnnotations(scenario.edges, variant.onPathHashes);
    const grid = buildGrid(rowModel, {}, highlightFromEdgeAnnotations(edgeAnnotationsByHash));
    return renderMigrationGraphCommand({
      grid,
      rowModel,
      colorize: true,
      glyphMode: 'unicode',
      edgeAnnotationsByHash,
    });
  }
  const grid = buildGrid(rowModel, {}, { mode: 'flat', onPath: new Set() });
  return renderMigrationGraphCommand({ grid, rowModel, colorize: true, glyphMode: 'unicode' });
}

/**
 * Render a scenario by combined key `"scenario:variant"` or just `"scenario"` (rotating variant).
 * Returns `undefined` if the scenario or variant is not found.
 */
export function renderScenarioByKey(key: string): string | undefined {
  const colonIdx = key.indexOf(':');
  const scenarioName = colonIdx === -1 ? key : key.slice(0, colonIdx);
  const variantName = colonIdx === -1 ? 'rotating' : key.slice(colonIdx + 1);
  const scenario = SCENARIOS.find((s) => s.name === scenarioName);
  if (scenario === undefined) return undefined;
  const variant = scenario.variants.find((v) => v.name === variantName);
  if (variant === undefined) return undefined;
  return renderScenario(scenario, variant);
}

// ---------------------------------------------------------------------------
// Helpers for building edge sets with realistic hashes
// ---------------------------------------------------------------------------

let _seq = 0;

function edge(from: string, to: string, dirName: string): MigrationEdge {
  return {
    from,
    to,
    migrationHash: `gal${String(_seq++).padStart(3, '0')}-${dirName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 32)}`,
    dirName,
    createdAt: '2026-06-06T17:01:00.000Z',
    invariants: [],
  };
}

// ---------------------------------------------------------------------------
// Scenario: linear   ∅ → a → b → c
// ---------------------------------------------------------------------------
function buildLinear(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'lin_a', '20260606T1700_init');
  const step = edge('lin_a', 'lin_b', '20260606T1701_add_users');
  const last = edge('lin_b', 'lin_c', '20260606T1702_add_posts');
  const edges = [init, step, last];
  const allHashes = new Set(edges.map((e) => e.migrationHash));
  return {
    name: 'linear',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'single-lane chain, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'full', description: 'all edges on-path', onPathHashes: allHashes },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: fork-2   ∅ → root → trunk (col 0) and ∅ → root → alt (col 1)
//   ∅ → root → trunk
//           → alt
// ---------------------------------------------------------------------------
function buildFork2(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'f2_root', '20260606T1703_init');
  const trunk = edge('f2_root', 'f2_trunk', '20260606T1704_trunk_feature');
  const alt = edge('f2_root', 'f2_alt', '20260606T1705_alt_feature');
  const edges = [init, trunk, alt];
  const trunkHashes = new Set([init.migrationHash, trunk.migrationHash]);
  const altHashes = new Set([init.migrationHash, alt.migrationHash]);
  return {
    name: 'fork-2',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'fork from root into two branches, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'trunk', description: 'highlight trunk branch', onPathHashes: trunkHashes },
      {
        name: 'alt',
        description: 'highlight alt branch (exposes bleed on off-path trunk corner)',
        onPathHashes: altHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: merge-2   ∅ → a → merge_node ← b ← ∅
//   Two independent chains merging.
//   ∅ --init_a--> node_a --merge_a--> merge_node
//   ∅ --init_b--> node_b --merge_b--> merge_node
// ---------------------------------------------------------------------------
function buildMerge2(): Scenario {
  const initA = edge(EMPTY_CONTRACT_HASH, 'm2_a', '20260606T1706_init_branch_a');
  const initB = edge(EMPTY_CONTRACT_HASH, 'm2_b', '20260606T1707_init_branch_b');
  const mergeA = edge('m2_a', 'm2_merge', '20260606T1708_merge_a');
  const mergeB = edge('m2_b', 'm2_merge', '20260606T1709_merge_b');
  const edges = [initA, initB, mergeA, mergeB];
  const trunkHashes = new Set([initA.migrationHash, mergeA.migrationHash]);
  const altHashes = new Set([initB.migrationHash, mergeB.migrationHash]);
  return {
    name: 'merge-2',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'two branches converging, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'trunk', description: 'highlight branch-a path', onPathHashes: trunkHashes },
      {
        name: 'alt',
        description: 'highlight branch-b path (exposes bleed on off-path corner)',
        onPathHashes: altHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: diamond   fork + merge
//   ∅ → root → alice (col 0) → merge
//           → bob   (col 1) → merge
// ---------------------------------------------------------------------------
function buildDiamond(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'dm_root', '20260606T1710_init');
  const alice = edge('dm_root', 'dm_alice', '20260606T1711_alice');
  const bob = edge('dm_root', 'dm_bob', '20260606T1712_bob');
  const mergeAlice = edge('dm_alice', 'dm_merge', '20260606T1713_merge_alice');
  const mergeBob = edge('dm_bob', 'dm_merge', '20260606T1714_merge_bob');
  const edges = [init, alice, bob, mergeAlice, mergeBob];
  const trunkHashes = new Set([init.migrationHash, alice.migrationHash, mergeAlice.migrationHash]);
  const altHashes = new Set([init.migrationHash, bob.migrationHash, mergeBob.migrationHash]);
  return {
    name: 'diamond',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'fork+merge diamond, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'trunk', description: 'highlight alice (col-0) path', onPathHashes: trunkHashes },
      {
        name: 'alt',
        description: 'highlight bob (col-1) alt path (connector bleed)',
        onPathHashes: altHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: fan-3   root fans into 3 branches
//   ∅ → root → trunk (col 0)
//           → altA  (col 1)
//           → altB  (col 2)
// ---------------------------------------------------------------------------
function buildFan3(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'fn_root', '20260606T1715_init');
  const trunk = edge('fn_root', 'fn_trunk', '20260606T1716_trunk');
  const altA = edge('fn_root', 'fn_altA', '20260606T1717_altA');
  const altB = edge('fn_root', 'fn_altB', '20260606T1718_altB');
  const edges = [init, trunk, altA, altB];
  const trunkHashes = new Set([init.migrationHash, trunk.migrationHash]);
  const altAHashes = new Set([init.migrationHash, altA.migrationHash]);
  const altBHashes = new Set([init.migrationHash, altB.migrationHash]);
  return {
    name: 'fan-3',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'three-way fan-out, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'trunk', description: 'highlight trunk (col-0)', onPathHashes: trunkHashes },
      { name: 'altA', description: 'highlight altA (col-1)', onPathHashes: altAHashes },
      { name: 'altB', description: 'highlight altB (col-2)', onPathHashes: altBHashes },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: wide-fan   root fans into 4+ branches then continues
//   ∅ → root → t0 (col 0) → tip
//           → t1 (col 1)
//           → t2 (col 2)
//           → t3 (col 3)
// ---------------------------------------------------------------------------
function buildWideFan(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'wf_root', '20260606T1719_init');
  const t0 = edge('wf_root', 'wf_t0', '20260606T1720_trunk');
  const t1 = edge('wf_root', 'wf_t1', '20260606T1721_branch_1');
  const t2 = edge('wf_root', 'wf_t2', '20260606T1722_branch_2');
  const t3 = edge('wf_root', 'wf_t3', '20260606T1723_branch_3');
  const tip = edge('wf_t0', 'wf_tip', '20260606T1724_tip_feature');
  const edges = [init, t0, t1, t2, t3, tip];
  const trunkHashes = new Set([init.migrationHash, t0.migrationHash, tip.migrationHash]);
  const altHashes = new Set([init.migrationHash, t2.migrationHash]);
  return {
    name: 'wide-fan',
    edges,
    variants: [
      {
        name: 'rotating',
        description: '4-branch fan-out, normal rotation',
        onPathHashes: undefined,
      },
      {
        name: 'trunk',
        description: 'highlight trunk path through col-0',
        onPathHashes: trunkHashes,
      },
      { name: 'alt', description: 'highlight col-2 alt branch', onPathHashes: altHashes },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-adjacent
//   ∅ → a → b → c (trunk)
//   b → a (adjacent rollback — lands on adjacent node)
// ---------------------------------------------------------------------------
function buildRollbackAdjacent(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'ra_a', '20260606T1725_init');
  const step = edge('ra_a', 'ra_b', '20260606T1726_add_users');
  const advance = edge('ra_b', 'ra_c', '20260606T1727_add_posts');
  const rollback = edge('ra_b', 'ra_a', '20260606T1728_rollback_users');
  const edges = [init, step, advance, rollback];
  const forwardHashes = new Set([init.migrationHash, step.migrationHash, advance.migrationHash]);
  const throughRollbackHashes = new Set([rollback.migrationHash]);
  return {
    name: 'rollback-adjacent',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'adjacent rollback arc, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'forward', description: 'highlight forward trunk path', onPathHashes: forwardHashes },
      {
        name: 'through-rollback',
        description: 'highlight the rollback arc only',
        onPathHashes: throughRollbackHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-arc
//   ∅ → a → b → c (trunk)
//   c → a (node-skipping rollback arc)
// ---------------------------------------------------------------------------
function buildRollbackArc(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'rbarc_a', '20260606T1729_init');
  const step = edge('rbarc_a', 'rbarc_b', '20260606T1730_add_users');
  const advance = edge('rbarc_b', 'rbarc_c', '20260606T1731_add_posts');
  const rollback = edge('rbarc_c', 'rbarc_a', '20260606T1732_rollback_to_a');
  const edges = [init, step, advance, rollback];
  const trunkHashes = new Set([init.migrationHash, step.migrationHash, advance.migrationHash]);
  const throughArcHashes = new Set([rollback.migrationHash]);
  return {
    name: 'rollback-arc',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'node-skipping rollback arc, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'trunk', description: 'highlight forward trunk', onPathHashes: trunkHashes },
      {
        name: 'through-arc',
        description: 'highlight rollback arc (arc body bleed bug)',
        onPathHashes: throughArcHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-merge   two rollbacks landing on the same node
//   ∅ → a → b → c (trunk)
//   c → a (rollback A)
//   c → b (rollback B — lands on same target as the step above b)
//
// In this slice: rendered as two separate back-lanes (convergence = geometry slice).
// ---------------------------------------------------------------------------
function buildRollbackMerge(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'rbm_a', '20260606T1733_init');
  const step = edge('rbm_a', 'rbm_b', '20260606T1734_add_users');
  const advance = edge('rbm_b', 'rbm_c', '20260606T1735_add_posts');
  const rollbackA = edge('rbm_c', 'rbm_a', '20260606T1736_rollback_a');
  const rollbackB = edge('rbm_c', 'rbm_b', '20260606T1737_rollback_b');
  const edges = [init, step, advance, rollbackA, rollbackB];
  const viaAHashes = new Set([rollbackA.migrationHash]);
  const viaBHashes = new Set([rollbackB.migrationHash]);
  return {
    name: 'rollback-merge',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'two rollbacks to different targets, normal rotation',
        onPathHashes: undefined,
      },
      { name: 'via-A', description: 'highlight rollback-A arc', onPathHashes: viaAHashes },
      { name: 'via-B', description: 'highlight rollback-B arc', onPathHashes: viaBHashes },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-cross   one back-arc crosses another
//   ∅ → a → b → c → d (trunk)
//   d → a (arc-1: long arc spanning b,c)
//   c → b (arc-2: short arc, crossed by arc-1)
// ---------------------------------------------------------------------------
function buildRollbackCross(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'rbc_a', '20260606T1738_init');
  const step1 = edge('rbc_a', 'rbc_b', '20260606T1739_step1');
  const step2 = edge('rbc_b', 'rbc_c', '20260606T1740_step2');
  const step3 = edge('rbc_c', 'rbc_d', '20260606T1741_step3');
  const arc1 = edge('rbc_d', 'rbc_a', '20260606T1742_rollback_long');
  const arc2 = edge('rbc_c', 'rbc_b', '20260606T1743_rollback_short');
  const edges = [init, step1, step2, step3, arc1, arc2];
  const arc1Hashes = new Set([arc1.migrationHash]);
  const arc2Hashes = new Set([arc2.migrationHash]);
  return {
    name: 'rollback-cross',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'crossing rollback arcs, normal rotation',
        onPathHashes: undefined,
      },
      // arc-1 on-path: the long arc should stay green while crossing the short arc (off-path)
      {
        name: 'arc-1',
        description: 'highlight long arc (arc-1) — off-path arc-2 must not bleed green',
        onPathHashes: arc1Hashes,
      },
      // arc-2 on-path: the short arc should be green while arc-1 (off-path) must be dim at crossing
      { name: 'arc-2', description: 'highlight short arc (arc-2)', onPathHashes: arc2Hashes },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-converge-2   two skipping rollbacks landing on ONE target
//
// Trunk: ∅→a→b→c→d
// Display order (rank desc): d(0), c(1), b(2), a(3), ∅(4)
//   d→a: si=0, ti=3 → not adjacent (3≠1) → node-skipping ✓
//   c→a: si=1, ti=3 → not adjacent (3≠2) → node-skipping ✓
//
// Today: 2 skipping rollbacks → numBackLanes=2, totalCols=(1+2)*2=6
// Converged: 1 target group → numBackLanes=1, totalCols=(1+1)*2=4
// ---------------------------------------------------------------------------
function buildRollbackConverge2(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'rcv2_a', '20260606T1748_init');
  const step1 = edge('rcv2_a', 'rcv2_b', '20260606T1749_step1');
  const step2 = edge('rcv2_b', 'rcv2_c', '20260606T1750_step2');
  const step3 = edge('rcv2_c', 'rcv2_d', '20260606T1751_step3');
  const arc1 = edge('rcv2_d', 'rcv2_a', '20260606T1752_rollback_d_to_a');
  const arc2 = edge('rcv2_c', 'rcv2_a', '20260606T1753_rollback_c_to_a');
  const edges = [init, step1, step2, step3, arc1, arc2];
  return {
    name: 'rollback-converge-2',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'two skipping rollbacks to same target, normal rotation',
        onPathHashes: undefined,
      },
      {
        name: 'arc-1',
        description: 'highlight d→a rollback',
        onPathHashes: new Set([arc1.migrationHash]),
      },
      {
        name: 'arc-2',
        description: 'highlight c→a rollback',
        onPathHashes: new Set([arc2.migrationHash]),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: rollback-converge-3   three skipping rollbacks landing on ONE target
//
// Trunk: ∅→a→b→c→d→e
// Display order (rank desc): e(0), d(1), c(2), b(3), a(4), ∅(5)
//   e→a: si=0, ti=4 → not adjacent (4≠1) → node-skipping ✓
//   d→a: si=1, ti=4 → not adjacent (4≠2) → node-skipping ✓
//   c→a: si=2, ti=4 → not adjacent (4≠3) → node-skipping ✓
//
// Today: 3 skipping rollbacks → numBackLanes=3, totalCols=(1+3)*2=8
// Converged: 1 target group → numBackLanes=1, totalCols=(1+1)*2=4
// ---------------------------------------------------------------------------
function buildRollbackConverge3(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'rcv3_a', '20260606T1754_init');
  const step1 = edge('rcv3_a', 'rcv3_b', '20260606T1755_step1');
  const step2 = edge('rcv3_b', 'rcv3_c', '20260606T1756_step2');
  const step3 = edge('rcv3_c', 'rcv3_d', '20260606T1757_step3');
  const step4 = edge('rcv3_d', 'rcv3_e', '20260606T1758_step4');
  const arc1 = edge('rcv3_e', 'rcv3_a', '20260606T1759_rollback_e_to_a');
  const arc2 = edge('rcv3_d', 'rcv3_a', '20260606T1760_rollback_d_to_a');
  const arc3 = edge('rcv3_c', 'rcv3_a', '20260606T1761_rollback_c_to_a');
  const edges = [init, step1, step2, step3, step4, arc1, arc2, arc3];
  return {
    name: 'rollback-converge-3',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'three skipping rollbacks to same target, normal rotation',
        onPathHashes: undefined,
      },
      {
        name: 'arc-1',
        description: 'highlight e→a rollback',
        onPathHashes: new Set([arc1.migrationHash]),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: self-loop
//   ∅ → a → b (trunk)
//   b → b (self-loop)
// ---------------------------------------------------------------------------
function buildSelfLoop(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, 'sl2_a', '20260606T1744_init');
  const step = edge('sl2_a', 'sl2_b', '20260606T1745_add_users');
  const selfLoop = edge('sl2_b', 'sl2_b', '20260606T1746_noop_invariant');
  const edges = [init, step, selfLoop];
  const throughLoopHashes = new Set([selfLoop.migrationHash]);
  return {
    name: 'self-loop',
    edges,
    variants: [
      {
        name: 'rotating',
        description: 'self-loop (from === to), normal rotation',
        onPathHashes: undefined,
      },
      {
        name: 'through-loop',
        description: 'highlight self-loop edge',
        onPathHashes: throughLoopHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Scenario: showcase   reuses the existing showcaseEdges() topology from
//   the colour-matrix test: @db→prod multi-space complex graph.
// ---------------------------------------------------------------------------
function buildShowcase(): Scenario {
  const init = edge(EMPTY_CONTRACT_HASH, '3bfce91', '20260601T0719_init');
  const addName = edge('3bfce91', '419c099', '20260601T0725_add_name');
  const alicePhone = edge('419c099', 'f5aa17d', '20260601T0725_alice_phone');
  const bobAvatar = edge('419c099', '935a023', '20260601T0725_bob_avatar');
  const addBio = edge('83a1ded', '3705eb1', '20260601T0726_add_bio');
  const addLocale = edge('3705eb1', 'bf158ef', '20260601T0726_add_locale');
  const fastForward = edge('3bfce91', '83a1ded', '20260601T0726_fast_forward');
  const mergeAlice = edge('f5aa17d', '83a1ded', '20260601T0726_merge_alice');
  const mergeBob = edge('935a023', '83a1ded', '20260601T0726_merge_bob');
  const rollbackAlice = edge('f5aa17d', '3bfce91', '20260601T0727_rollback_alice');
  const rollbackLocale = edge('bf158ef', '3705eb1', '20260601T0727_rollback_locale');
  const rollbackUsers = edge('bf158ef', '419c099', '20260601T0727_rollback_users');
  const hotfix = edge('bf158ef', 'f660984', '20260601T0727_hotfix');
  const promoteBob = edge('935a023', 'f660984', '20260601T0728_promote_bob');
  const reapplyNoop = edge('f660984', 'f660984', '20260601T0729_reapply_noop');
  const edges = [
    init,
    addName,
    alicePhone,
    bobAvatar,
    addBio,
    addLocale,
    fastForward,
    mergeAlice,
    mergeBob,
    rollbackAlice,
    rollbackLocale,
    rollbackUsers,
    hotfix,
    promoteBob,
    reapplyNoop,
  ];
  // Trunk: init → addName → bobAvatar → promoteBob (@db→prod path)
  const trunkHashes = new Set([
    init.migrationHash,
    addName.migrationHash,
    bobAvatar.migrationHash,
    promoteBob.migrationHash,
  ]);
  // Alt: init → addName → alicePhone → mergeAlice → addBio → addLocale
  const altHashes = new Set([
    init.migrationHash,
    addName.migrationHash,
    alicePhone.migrationHash,
    mergeAlice.migrationHash,
    addBio.migrationHash,
    addLocale.migrationHash,
  ]);
  return {
    name: 'showcase',
    edges,
    variants: [
      {
        name: 'rotating',
        description: '@db→prod multi-space complex graph, normal rotation',
        onPathHashes: undefined,
      },
      {
        name: 'trunk',
        description: 'highlight @db→prod trunk path (init+addName+bobAvatar+promoteBob)',
        onPathHashes: trunkHashes,
      },
      {
        name: 'alt',
        description: 'highlight alice+locale alt path (exposes rollback-arc body bleed)',
        onPathHashes: altHashes,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// The catalogue — BUILD ORDER MATTERS for hash sequence stability.
// Call all builders in deterministic order; the _seq counter makes hashes stable.
// ---------------------------------------------------------------------------
export const SCENARIOS: readonly Scenario[] = [
  buildLinear(),
  buildFork2(),
  buildMerge2(),
  buildDiamond(),
  buildFan3(),
  buildWideFan(),
  buildRollbackAdjacent(),
  buildRollbackArc(),
  buildRollbackMerge(),
  buildRollbackCross(),
  buildRollbackConverge2(),
  buildRollbackConverge3(),
  buildSelfLoop(),
  buildShowcase(),
];
