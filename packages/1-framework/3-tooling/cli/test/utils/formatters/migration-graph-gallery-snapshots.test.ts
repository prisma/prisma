/**
 * Scenario gallery snapshots — verbatim ANSI output for every scenario/variant.
 *
 * Two structural invariants are asserted: no legacy tee glyphs (├ ┬ ┴ ┼); and
 * focus variants carry both on-path green (`\x1b[92m`) and off-path dim (`\x1b[2m`).
 *
 * A convergence invariant (marked it.fails until convergence is implemented) asserts
 * that skipping rollbacks sharing a target occupy one back-lane, not one per arc.
 *
 * Never run `vitest --update-snapshots` blindly — always `pnpm gallery` first.
 */

import type { MigrationGraph } from '@internal/migration-tools/graph';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../../src/utils/formatters/migration-graph-grid-layout';
import { buildMigrationGraphRows } from '../../../src/utils/formatters/migration-graph-rows';
import {
  renderScenario,
  SCENARIOS,
  type Scenario,
  type ScenarioVariant,
} from './migration-graph-scenario-gallery';

function buildGraph(scenario: Scenario): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, (typeof scenario.edges)[number][]>();
  const reverseChain = new Map<string, (typeof scenario.edges)[number][]>();
  const migrationByHash = new Map<string, (typeof scenario.edges)[number]>();
  for (const e of scenario.edges) {
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

function buildScenarioGrid(scenarioName: string) {
  const scenario = SCENARIOS.find((s) => s.name === scenarioName);
  if (scenario === undefined) throw new Error(`scenario not found: ${scenarioName}`);
  return buildGrid(
    buildMigrationGraphRows(buildGraph(scenario), {}),
    {},
    {
      mode: 'flat',
      onPath: new Set(),
    },
  );
}

const GREEN_BRIGHT = '\x1b[92m'; // on-path colour
const DIM = '\x1b[2m'; // off-path colour

function variantKey(scenario: Scenario, variant: ScenarioVariant): string {
  return `${scenario.name}:${variant.name}`;
}

function safeRender(scenario: Scenario, variant: ScenarioVariant): string | null {
  try {
    return renderScenario(scenario, variant);
  } catch {
    return null;
  }
}

/** A focus variant whose on-path set splits the graph (some on, some off). */
function isMixedFocusVariant(scenario: Scenario, variant: ScenarioVariant): boolean {
  if (variant.onPathHashes === undefined) return false;
  const allHashes = new Set(scenario.edges.map((e) => e.migrationHash));
  const onPath = variant.onPathHashes;
  if (onPath.size === 0 || onPath.size >= allHashes.size) return false;
  // At least one edge off-path.
  return scenario.edges.some((e) => !onPath.has(e.migrationHash));
}

describe('migration-graph scenario gallery', () => {
  // =========================================================================
  // Verbatim ANSI snapshots — every scenario/variant
  // =========================================================================
  describe('verbatim ANSI snapshots', () => {
    for (const scenario of SCENARIOS) {
      describe(scenario.name, () => {
        for (const variant of scenario.variants) {
          const key = variantKey(scenario, variant);
          it(key, () => {
            const rendered = safeRender(scenario, variant);
            expect(rendered, `renderer must produce output for ${key}`).not.toBeNull();
            expect(rendered).toMatchSnapshot();
          });
        }
      });
    }
  });

  // =========================================================================
  // Corner alphabet only — never legacy tees.
  // =========================================================================
  describe('corner alphabet (no tees)', () => {
    for (const scenario of SCENARIOS) {
      for (const variant of scenario.variants) {
        const key = variantKey(scenario, variant);
        it(key, () => {
          const rendered = safeRender(scenario, variant);
          if (rendered === null) return;
          expect(stripAnsi(rendered)).not.toMatch(/[├┬┴┼]/u);
        });
      }
    }
  });

  // =========================================================================
  // Focus variants carry both on-path green and off-path dim.
  // =========================================================================
  describe('focus colours present', () => {
    for (const scenario of SCENARIOS) {
      for (const variant of scenario.variants) {
        if (!isMixedFocusVariant(scenario, variant)) continue;
        const key = variantKey(scenario, variant);
        it(key, () => {
          const rendered = safeRender(scenario, variant);
          if (rendered === null) return;
          expect(rendered, `${key}: on-path green present`).toContain(GREEN_BRIGHT);
          expect(rendered, `${key}: off-path dim present`).toContain(DIM);
        });
      }
    }
  });

  // =========================================================================
  // Convergence structural assertions (RED until convergence is implemented).
  //
  // For rollback-converge-2 and rollback-converge-3, all skipping rollbacks
  // land on the same target node. After convergence they share one back-lane,
  // so: totalCols = (numForwardLanes + numTargetGroups) * colsPerLane = (1+1)*2 = 4.
  //
  // Today one back-lane is allocated per arc:
  //   rollback-converge-2: (1 + 2) * 2 = 6
  //   rollback-converge-3: (1 + 3) * 2 = 8
  //
  // grid[0].length equals totalCols (colsPerLane=2, one Cell per column).
  //
  // The tip-topmost check is bundled with the width check in each test so the
  // width mismatch makes the whole it.fails block RED today; once convergence
  // lands both conditions must pass together before the it.fails wrapper is removed.
  // =========================================================================
  describe('convergence structural assertions', () => {
    it('rollback-converge-2: same-target arcs share one back-lane (grid width = 4, tip topmost)', () => {
      const grid = buildScenarioGrid('rollback-converge-2');
      // Width: converged = (1 forward + 1 target-group) * 2 = 4
      expect(grid[0]!.length).toBe(4);
      // Tip topmost: the first grid row's node cell is the highest-rank tip (rcv2_d)
      const firstNodeCell = grid[0]!.find((cell) => cell.node !== undefined);
      expect(firstNodeCell, 'first grid row must be a node row').toBeDefined();
      expect(
        firstNodeCell!.node!.contractHash,
        'highest-rank tip (rcv2_d) must be the first node in grid[0]',
      ).toBe('rcv2_d');
    });

    it('rollback-converge-3: same-target arcs share one back-lane (grid width = 4, tip topmost)', () => {
      const grid = buildScenarioGrid('rollback-converge-3');
      // Width: converged = (1 forward + 1 target-group) * 2 = 4
      expect(grid[0]!.length).toBe(4);
      // Tip topmost: the first grid row's node cell is the highest-rank tip (rcv3_e)
      const firstNodeCell = grid[0]!.find((cell) => cell.node !== undefined);
      expect(firstNodeCell, 'first grid row must be a node row').toBeDefined();
      expect(
        firstNodeCell!.node!.contractHash,
        'highest-rank tip (rcv3_e) must be the first node in grid[0]',
      ).toBe('rcv3_e');
    });
  });
});
