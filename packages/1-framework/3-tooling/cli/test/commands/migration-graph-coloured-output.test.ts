/**
 * Verbatim-coloured snapshots of the command renderer's output.
 *
 * Renders each command's real entry point with colour forced on and stores the
 * verbatim ANSI string. Never run `vitest --update-snapshots` blindly — these
 * are the colour contract.
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { formatMigrationGraphHumanOutput } from '../../src/commands/migration-graph';
import { renderMigrationGraphCommand } from '../../src/utils/formatters/migration-graph-command-render';
import { buildGrid } from '../../src/utils/formatters/migration-graph-grid-layout';
import type { MigrationEdgeAnnotation } from '../../src/utils/formatters/migration-graph-labels';
import { buildMigrationGraphRows } from '../../src/utils/formatters/migration-graph-rows';
import type { MigrationGraphTreeSection } from '../../src/utils/formatters/migration-graph-sections';
import {
  highlightFromEdgeAnnotations,
  renderMigrationGraphSpaceTree,
} from '../../src/utils/formatters/migration-graph-space-render';
import type { MigrationListEntry } from '../../src/utils/formatters/migration-list-types';

// ---------------------------------------------------------------------------
// Fixture builders — small in-memory graphs, no on-disk I/O.
// ---------------------------------------------------------------------------

const LIVE_CONTRACT_HASH = `c0ffee${'0'.repeat(58)}`;

let edgeSeq = 0;

function makeEdge(from: string, to: string, dirName: string): MigrationEdge {
  return {
    from,
    to,
    migrationHash: `edge${String(edgeSeq++).padStart(4, '0')}${'0'.repeat(53)}`,
    dirName,
    createdAt: '2026-06-06T17:01:00.000Z',
    invariants: [],
  };
}

function buildGraph(edges: readonly MigrationEdge[]): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    migrationByHash.set(edge.migrationHash, edge);
    (forwardChain.get(edge.from) ?? forwardChain.set(edge.from, []).get(edge.from)!).push(edge);
    (reverseChain.get(edge.to) ?? reverseChain.set(edge.to, []).get(edge.to)!).push(edge);
  }
  return { nodes, forwardChain, reverseChain, migrationByHash };
}

function entriesFromEdges(edges: readonly MigrationEdge[]): MigrationListEntry[] {
  return edges.map((edge) => ({
    name: edge.dirName,
    hash: edge.migrationHash,
    fromContract: edge.from === EMPTY_CONTRACT_HASH ? null : edge.from,
    toContract: edge.to,
    operationCount: 1,
    createdAt: edge.createdAt,
    refs: [],
    providedInvariants: [],
  }));
}

// ∅ → root → trunk (col 0) → alt (col 1): two lanes exercise the rotating palette.
function buildForkFixture(): { graph: MigrationGraph; entries: MigrationListEntry[] } {
  const init = makeEdge(EMPTY_CONTRACT_HASH, 'fork_root', '20260606T1700_init');
  const trunk = makeEdge('fork_root', 'fork_trunk', '20260606T1701_trunk_feature');
  const alt = makeEdge('fork_root', 'fork_alt', '20260606T1702_alt_feature');
  const edges = [init, trunk, alt];
  return { graph: buildGraph(edges), entries: entriesFromEdges(edges) };
}

// ∅ → a → b  (linear) with refs + a live @db marker distinct from @contract.
function buildOverlayFixture(): {
  graph: MigrationGraph;
  entries: MigrationListEntry[];
  refsByHash: ReadonlyMap<string, readonly string[]>;
  dbHash: string;
} {
  const init = makeEdge(EMPTY_CONTRACT_HASH, 'ov_a', '20260606T1703_init');
  const step = makeEdge('ov_a', LIVE_CONTRACT_HASH, '20260606T1704_add_users');
  const edges = [init, step];
  const refsByHash = new Map<string, readonly string[]>([
    ['ov_a', ['staging']],
    [LIVE_CONTRACT_HASH, ['prod']],
  ]);
  return {
    graph: buildGraph(edges),
    entries: entriesFromEdges(edges),
    refsByHash,
    dbHash: 'ov_a',
  };
}

// ∅ → base, then THREE parallel branches (b1/b2/b3) that all converge on `conv`
// via a three-way multi-lane fold (4 lanes total). This is the topology that
// surfaces the empty-top-line + one-row label offset the old splice produced.
function buildWideMultiBranchFixture(): {
  graph: MigrationGraph;
  entries: MigrationListEntry[];
} {
  const init = makeEdge(EMPTY_CONTRACT_HASH, 'wide_base', '20260606T1700_init');
  const b1 = makeEdge('wide_base', 'wide_f1', '20260606T1701_branch_one');
  const b2 = makeEdge('wide_base', 'wide_f2', '20260606T1702_branch_two');
  const b3 = makeEdge('wide_base', 'wide_f3', '20260606T1703_branch_three');
  const m1 = makeEdge('wide_f1', LIVE_CONTRACT_HASH, '20260606T1710_merge_one');
  const m2 = makeEdge('wide_f2', LIVE_CONTRACT_HASH, '20260606T1711_merge_two');
  const m3 = makeEdge('wide_f3', LIVE_CONTRACT_HASH, '20260606T1712_merge_three');
  const edges = [init, b1, b2, b3, m1, m2, m3];
  return { graph: buildGraph(edges), entries: entriesFromEdges(edges) };
}

// ∅ → a → b → c (forward chain) plus a node-skipping rollback c → a, routed on
// its own back-lane to the right.
function buildRollbackFixture(): { graph: MigrationGraph; entries: MigrationListEntry[] } {
  const init = makeEdge(EMPTY_CONTRACT_HASH, 'rb_a', '20260606T1700_init');
  const f1 = makeEdge('rb_a', 'rb_b', '20260606T1701_add_users');
  const f2 = makeEdge('rb_b', LIVE_CONTRACT_HASH, '20260606T1702_add_posts');
  const rb = makeEdge(LIVE_CONTRACT_HASH, 'rb_a', '20260606T1710_rollback_all');
  const edges = [init, f1, f2, rb];
  return { graph: buildGraph(edges), entries: entriesFromEdges(edges) };
}

function focusAnnotations(
  graph: MigrationGraph,
  onPathHashes: ReadonlySet<string>,
): Map<string, MigrationEdgeAnnotation> {
  const edgeAnnotations = new Map<string, MigrationEdgeAnnotation>();
  for (const edge of graph.migrationByHash.values()) {
    edgeAnnotations.set(edge.migrationHash, {
      pathHighlight: onPathHashes.has(edge.migrationHash) ? 'on-path' : 'off-path',
    });
  }
  return edgeAnnotations;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('verbatim-coloured command output', () => {
  it('flat graph with multiple lanes (renderMigrationGraphSpaceTree)', () => {
    const { graph, entries } = buildForkFixture();
    const rendered = renderMigrationGraphSpaceTree({
      graph,
      migrations: entries,
      liveContractHash: LIVE_CONTRACT_HASH,
      glyphMode: 'unicode',
      colorize: true,
    });
    expect(rendered).toContain('\x1b[');
    expect(rendered).toMatchSnapshot();
  });

  it('graph with @db/@contract markers and user refs (renderMigrationGraphSpaceTree)', () => {
    const { graph, entries, refsByHash, dbHash } = buildOverlayFixture();
    const rendered = renderMigrationGraphSpaceTree({
      graph,
      migrations: entries,
      liveContractHash: LIVE_CONTRACT_HASH,
      glyphMode: 'unicode',
      colorize: true,
      refsByHash,
      dbHash,
    });
    expect(rendered).toContain('\x1b[');
    expect(rendered).toContain('@contract');
    expect(rendered).toContain('@db');
    expect(rendered).toMatchSnapshot();
  });

  it('multi-space graph with per-space headings (formatMigrationGraphHumanOutput)', () => {
    const { graph: appGraph, entries: appEntries } = buildForkFixture();
    const extInit = makeEdge(EMPTY_CONTRACT_HASH, 'ext_head', '20260606T1705_install_extension');
    const extGraph = buildGraph([extInit]);
    const extEntries = entriesFromEdges([extInit]);

    const sectionFor = (
      space: string,
      graph: MigrationGraph,
      entries: MigrationListEntry[],
      isAppSpace: boolean,
    ): MigrationGraphTreeSection => ({
      space,
      tree: renderMigrationGraphSpaceTree({
        graph,
        migrations: entries,
        liveContractHash: LIVE_CONTRACT_HASH,
        glyphMode: 'unicode',
        colorize: true,
        isAppSpace,
      }),
      showHeading: true,
    });

    const rendered = formatMigrationGraphHumanOutput({
      ok: true,
      graph: appGraph,
      spaces: [],
      treeSections: [
        sectionFor('app', appGraph, appEntries, true),
        sectionFor('pgvector', extGraph, extEntries, false),
      ],
      summary: '2 space(s), 4 contract(s), 4 migration(s)',
    });

    expect(rendered).toContain('\x1b[');
    expect(rendered).toContain('app:');
    expect(rendered).toContain('pgvector:');
    expect(rendered).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // migrate --show focus: replicates the render call `planMigrateShow` makes —
  // per-edge `pathHighlight` annotations lift the chosen route to focus mode,
  // then the command renderer draws rows + gutter + labels from the one grid.
  // -------------------------------------------------------------------------
  it('migrate --show focus: on-path green, off-path dim (renderMigrationGraphCommand)', () => {
    const init = makeEdge(EMPTY_CONTRACT_HASH, 'show_root', '20260606T1706_init');
    const trunk = makeEdge('show_root', LIVE_CONTRACT_HASH, '20260606T1707_on_path');
    const alt = makeEdge('show_root', 'show_alt', '20260606T1708_off_path');
    const edges = [init, trunk, alt];
    const graph = buildGraph(edges);

    const onPathHashes = new Set([init.migrationHash, trunk.migrationHash]);
    const edgeAnnotations = focusAnnotations(graph, onPathHashes);

    const rowModel = buildMigrationGraphRows(graph, { contractHash: LIVE_CONTRACT_HASH });
    const grid = buildGrid(rowModel, {}, highlightFromEdgeAnnotations(edgeAnnotations));
    const rendered = renderMigrationGraphCommand({
      grid,
      rowModel,
      contractHash: LIVE_CONTRACT_HASH,
      isAppSpace: true,
      edgeAnnotationsByHash: edgeAnnotations,
      colorize: true,
      glyphMode: 'unicode',
    });

    expect(rendered).toContain('\x1b[92m'); // on-path green
    expect(rendered).toContain('\x1b[2m'); // off-path dim
    expect(rendered).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // WIDE multi-branch fold (4 lanes converging). The case that exposed the
  // empty-top-line + label offset under the old splice.
  // -------------------------------------------------------------------------
  it('wide multi-branch fold renders aligned with unified lane colour', () => {
    const { graph, entries } = buildWideMultiBranchFixture();
    const rendered = renderMigrationGraphSpaceTree({
      graph,
      migrations: entries,
      liveContractHash: LIVE_CONTRACT_HASH,
      glyphMode: 'unicode',
      colorize: true,
    });
    expect(rendered).toContain('\x1b[');
    expect(rendered).toMatchSnapshot();

    const lines = rendered.split('\n');
    // No empty top line.
    expect(stripAnsi(lines[0] ?? '').trim().length).toBeGreaterThan(0);
    // Every branch/merge migration label sits on a line carrying an arrow.
    for (const name of ['merge_one', 'merge_two', 'merge_three', 'branch_one', 'init']) {
      const line = lines.find((l) => l.includes(name));
      expect(line, `label ${name} must be present`).toBeDefined();
      expect(stripAnsi(line ?? '')).toMatch(/[↑↓⟲]/u);
    }
  });

  // -------------------------------------------------------------------------
  // Rollback: a node-skipping back-arc routed on its own lane.
  // -------------------------------------------------------------------------
  it('rollback back-arc renders aligned with the rollback arrow on its label row', () => {
    const { graph, entries } = buildRollbackFixture();
    const rendered = renderMigrationGraphSpaceTree({
      graph,
      migrations: entries,
      liveContractHash: LIVE_CONTRACT_HASH,
      glyphMode: 'unicode',
      colorize: true,
    });
    expect(rendered).toContain('\x1b[');
    expect(rendered).toMatchSnapshot();

    const lines = rendered.split('\n');
    expect(stripAnsi(lines[0] ?? '').trim().length).toBeGreaterThan(0);
    const rollbackLine = lines.find((l) => l.includes('rollback_all'));
    expect(rollbackLine).toBeDefined();
    expect(stripAnsi(rollbackLine ?? '')).toMatch(/[↑↓]/u);
  });

  it('ascii glyph mode renders corners in ASCII', () => {
    const { graph, entries } = buildForkFixture();
    const rendered = renderMigrationGraphSpaceTree({
      graph,
      migrations: entries,
      liveContractHash: LIVE_CONTRACT_HASH,
      glyphMode: 'ascii',
      colorize: false,
    });
    // ASCII corner alphabet only — no unicode box glyphs, no tees.
    expect(rendered).not.toMatch(/[│╭╮╰╯├┬┴○↑↓⟲]/u);
    expect(rendered).toMatch(/[\\/|*^v@]/u);
    expect(rendered).toMatchSnapshot();
  });

  it('corner-glyph guard: unicode renders use corners, never tees', () => {
    const fixtures = [buildForkFixture(), buildWideMultiBranchFixture(), buildRollbackFixture()];
    for (const { graph, entries } of fixtures) {
      const rendered = renderMigrationGraphSpaceTree({
        graph,
        migrations: entries,
        liveContractHash: LIVE_CONTRACT_HASH,
        glyphMode: 'unicode',
        colorize: true,
      });
      expect(rendered).not.toMatch(/[├┬┴┼]/u);
    }
  });
});
