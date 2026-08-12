/**
 * Greedy lane colouring rules.
 *
 * Rule 1: for any grid row, no two simultaneously-active lane rails share the
 *   same colour index (palette index = lane % 6).
 *
 * Rule 2: for every routed back-arc, its colour index ≠ its origin node's
 *   lane colour index, and ≠ green (palette index 5).
 *
 * These properties are asserted on graphs built through the real pipeline
 * (buildMigrationGraphRows → buildGrid flat). The test also constructs a
 * minimal graph that provably triggers the Rule-2 violation in the current
 * flat-mode renderer (numLanes=4, arc index 2 → colourLane=6 → 6%6=0 =
 * white = same as trunk), confirming the bug before the fix.
 */

import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../../src/utils/formatters/migration-graph-grid-layout';
import type { Cell } from '../../../src/utils/formatters/migration-graph-model';
import { buildMigrationGraphRows } from '../../../src/utils/formatters/migration-graph-rows';

// Palette size — must match LANE_COLORIZERS.length in migration-graph-occlusion-render.ts
const PALETTE_SIZE = 6;
// Green is palette index 5 — reserved for on-path in focus mode; back-arcs must
// not reuse it so flat-mode arcs don't accidentally look like focus highlights.
const GREEN_INDEX = 5;

// ---------------------------------------------------------------------------
// Graph builder helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function edge(from: string, to: string, dirName: string): MigrationEdge {
  return {
    from,
    to,
    migrationHash: `lc${String(_seq++).padStart(3, '0')}-${dirName.replace(/\W/g, '_').slice(0, 20)}`,
    dirName,
    createdAt: '2026-06-08T00:00:00.000Z',
    invariants: [],
  };
}

function buildGraph(edges: readonly MigrationEdge[]): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
    migrationByHash.set(e.migrationHash, e);
    const fc = forwardChain.get(e.from);
    if (fc) fc.push(e);
    else forwardChain.set(e.from, [e]);
    const rc = reverseChain.get(e.to);
    if (rc) rc.push(e);
    else reverseChain.set(e.to, [e]);
  }
  return { nodes, forwardChain, reverseChain, migrationByHash };
}

// ---------------------------------------------------------------------------
// Colour-index extraction helpers
//
// colour index = lane % PALETTE_SIZE (the same formula as laneColor in the renderer).
// A CellLine's colour comes from its line.lane.
// ---------------------------------------------------------------------------

function colourIndex(lane: number): number {
  return lane % PALETTE_SIZE;
}

// ---------------------------------------------------------------------------
// Rule checkers on Grid
// ---------------------------------------------------------------------------

/**
 * Rule 1: for every row, the set of colour indices among simultaneously-active
 * lane rails has no duplicate when comparing DISTINCT lanes.
 *
 * "Active" means: a node cell occupies its lane, or a rail line (up+down
 * directions, not left/right) passes through. The same lane can appear in
 * multiple cells in a row (e.g. the back-arc body spans columns) so we
 * collect distinct active lanes first, then check for palette collisions.
 *
 * Returns a list of violations.
 */
function checkRule1(grid: readonly (readonly Cell[])[]): string[] {
  const violations: string[] = [];
  for (let rowIdx = 0; rowIdx < grid.length; rowIdx++) {
    const row = grid[rowIdx]!;
    const activeLanes = new Set<number>();
    for (const cell of row) {
      if (cell.node !== undefined) {
        activeLanes.add(cell.node.lane);
      }
      for (const cl of cell.lines) {
        if (cl.line.role !== undefined) continue; // skip focus-mode lines
        if (
          cl.directions.has('up') &&
          cl.directions.has('down') &&
          !cl.directions.has('left') &&
          !cl.directions.has('right')
        ) {
          activeLanes.add(cl.line.lane);
        }
      }
    }
    const lanesByColour = new Map<number, number[]>();
    for (const lane of activeLanes) {
      const ci = colourIndex(lane);
      const bucket = lanesByColour.get(ci);
      if (bucket) bucket.push(lane);
      else lanesByColour.set(ci, [lane]);
    }
    for (const [ci, lanes] of lanesByColour) {
      if (lanes.length > 1) {
        violations.push(`row ${rowIdx}: colour index ${ci} shared by lanes [${lanes.join(', ')}]`);
      }
    }
  }
  return violations;
}

/**
 * Rule 2: for every back-arc line, its colour index ≠ its origin node's lane
 * colour index, and ≠ GREEN_INDEX.
 *
 * We identify back-arc lines as those placed in the "back-lane" columns
 * (geomLane > highest forward lane). A simpler approach: find all CellLines
 * where landingArrow === true (the back-arc landing marker) and trace their
 * lane/colour. But a more robust approach uses the arc's migrationHash from
 * the rowModel's rollback edges:
 *
 * For each rollback edge, look up its cells in the grid. The line.lane of that
 * edge's cells is the colourLane. The origin node's lane is the node with that
 * contractHash on the grid.
 *
 * Returns a list of violations.
 */
function checkRule2(
  grid: readonly (readonly Cell[])[],
  rollbackEdgeMigHashes: ReadonlySet<string>,
  originLaneByMigHash: ReadonlyMap<string, number>,
): string[] {
  const violations: string[] = [];

  for (const row of grid) {
    for (const cell of row) {
      for (const cl of cell.lines) {
        if (!rollbackEdgeMigHashes.has(cl.line.migrationHash)) continue;
        if (cl.line.role !== undefined) continue; // skip focus mode

        const arcColourIdx = colourIndex(cl.line.lane);
        const originLane = originLaneByMigHash.get(cl.line.migrationHash);

        if (originLane !== undefined) {
          const originColourIdx = colourIndex(originLane);
          if (arcColourIdx === originColourIdx) {
            violations.push(
              `back-arc ${cl.line.dirName} (lane ${cl.line.lane}, colourIdx ${arcColourIdx}) ` +
                `matches origin lane ${originLane} colourIdx ${originColourIdx}`,
            );
          }
        }

        if (arcColourIdx === GREEN_INDEX) {
          violations.push(
            `back-arc ${cl.line.dirName} (lane ${cl.line.lane}, colourIdx ${arcColourIdx}) uses green (reserved for on-path)`,
          );
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(violations)];
}

// ---------------------------------------------------------------------------
// Minimal triggering topology — 4 forward lanes + 3 skipping rollbacks
//
// ∅ → root → post_root → t0 (lane 0, trunk)
//                      → t1 (lane 1)
//                      → t2 (lane 2)
//                      → t3 (lane 3)
//
// Rollback arcs (all node-skipping; origin at t1/t2/t3, target at root):
//   r1: t1 → root  (dirName a_r1 → arc index 0 → colourLane = 4+0 = 4, magenta)
//   r2: t2 → root  (dirName b_r2 → arc index 1 → colourLane = 4+1 = 5, green ← bug: Rule 2 violated)
//   r3: t3 → root  (dirName c_r3 → arc index 2 → colourLane = 4+2 = 6, 6%6=0=white ← bug: Rule 1 violated)
//
// With the CURRENT renderer:
//   r2 → colourLane=5 → green index → Rule 2 (green exclusion) VIOLATED
//   r3 → colourLane=6 → 6%6=0 → white → same colour as trunk (lane 0) → Rule 1 VIOLATED
//   r3 origin is t3 (lane 3, blueBright) → colours differ, but Rule 1 still catches it.
// ---------------------------------------------------------------------------

function buildMinimalTriggeringGraph() {
  _seq = 0; // reset for deterministic hashes
  const fwdInit = edge('∅', 'root', '20260608T0001_init');
  const fwdPost = edge('root', 'post_root', '20260608T0002_post');
  const fwdT0 = edge('post_root', 't0', '20260608T0003_trunk');
  const fwdT1 = edge('post_root', 't1', '20260608T0004_branch1');
  const fwdT2 = edge('post_root', 't2', '20260608T0005_branch2');
  const fwdT3 = edge('post_root', 't3', '20260608T0006_branch3');
  // rollbacks — dirName order determines arc index (a < b < c)
  const rbR1 = edge('t1', 'root', '20260608T0007_a_r1');
  const rbR2 = edge('t2', 'root', '20260608T0008_b_r2');
  const rbR3 = edge('t3', 'root', '20260608T0009_c_r3');

  const all = [fwdInit, fwdPost, fwdT0, fwdT1, fwdT2, fwdT3, rbR1, rbR2, rbR3];
  return {
    graph: buildGraph(all),
    rollbackHashes: new Set([rbR1.migrationHash, rbR2.migrationHash, rbR3.migrationHash]),
    rollbackEdges: [rbR1, rbR2, rbR3],
  };
}

describe('migration-graph greedy lane colours', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Minimal triggering graph — proves the current bug and pins both rules.
  // ────────────────────────────────────────────────────────────────────────────
  describe('minimal 4-forward-lane + 3-arc graph (triggers current bug)', () => {
    const { graph, rollbackHashes, rollbackEdges } = buildMinimalTriggeringGraph();
    const rowModel = buildMigrationGraphRows(graph, {});
    const grid = buildGrid(rowModel, {}, { mode: 'flat', onPath: new Set() });

    // Build originLaneByMigHash from the grid (look up the node cell for each rollback source)
    const nodeLaneByHash = new Map<string, number>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.node !== undefined) {
          nodeLaneByHash.set(cell.node.contractHash, cell.node.lane);
        }
      }
    }
    const originLaneByMigHash = new Map<string, number>();
    for (const rbEdge of rollbackEdges) {
      const originLane = nodeLaneByHash.get(rbEdge.from);
      if (originLane !== undefined) {
        originLaneByMigHash.set(rbEdge.migrationHash, originLane);
      }
    }

    it('Rule 2: back-arc colour ≠ origin lane colour and ≠ green — FAILS on current renderer', () => {
      const violations = checkRule2(grid, rollbackHashes, originLaneByMigHash);
      // With the CURRENT renderer, arc r2 (colourLane=5) violates green exclusion,
      // and arc r3 (colourLane=6 → 0) may collide with trunk. We expect at least one
      // Rule-2 violation in the current renderer (green index collision at minimum).
      expect(violations.length).toBe(0);
    });

    it('Rule 1: concurrent active lane rails have distinct colour indices — FAILS on current renderer', () => {
      const violations = checkRule1(grid);
      // With the CURRENT renderer, arc r3 colourLane=6%6=0 = white = trunk lane 0;
      // at rows where both are active we get duplicate colour index 0.
      expect(violations.length).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // The concrete existing scenarios with rollback arcs (re-run after fix).
  // ────────────────────────────────────────────────────────────────────────────
  describe('rollback-arc scenario (1 forward lane, 1 arc)', () => {
    const e0 = edge('∅', 'ra_a', 'z_init');
    const e1 = edge('ra_a', 'ra_b', 'z_fwd_ab');
    const e2 = edge('ra_b', 'ra_c', 'z_fwd_bc');
    const rb = edge('ra_c', 'ra_a', 'z_rollback'); // node-skipping
    const all = [e0, e1, e2, rb];
    const rowModel = buildMigrationGraphRows(buildGraph(all), {});
    const grid = buildGrid(rowModel, {}, { mode: 'flat', onPath: new Set() });

    const nodeLaneByHash = new Map<string, number>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.node !== undefined) nodeLaneByHash.set(cell.node.contractHash, cell.node.lane);
      }
    }
    const originLane = nodeLaneByHash.get(rb.from) ?? 0;
    const originLaneByMigHash = new Map([[rb.migrationHash, originLane]]);

    it('Rule 1 holds', () => {
      expect(checkRule1(grid)).toEqual([]);
    });
    it('Rule 2 holds', () => {
      expect(checkRule2(grid, new Set([rb.migrationHash]), originLaneByMigHash)).toEqual([]);
    });
  });

  describe('rollback-merge scenario (1 forward lane, 2 arcs)', () => {
    const e0 = edge('∅', 'rm_a', 'z_init');
    const e1 = edge('rm_a', 'rm_b', 'z_ab');
    const e2 = edge('rm_b', 'rm_c', 'z_bc');
    const e3 = edge('rm_c', 'rm_d', 'z_cd');
    const rb1 = edge('rm_c', 'rm_a', 'z_rb_c'); // node-skipping
    const rb2 = edge('rm_d', 'rm_a', 'z_rb_d'); // node-skipping
    const all = [e0, e1, e2, e3, rb1, rb2];
    const rowModel = buildMigrationGraphRows(buildGraph(all), {});
    const grid = buildGrid(rowModel, {}, { mode: 'flat', onPath: new Set() });

    const nodeLaneByHash = new Map<string, number>();
    for (const row of grid) {
      for (const cell of row) {
        if (cell.node !== undefined) nodeLaneByHash.set(cell.node.contractHash, cell.node.lane);
      }
    }
    const originLaneByMigHash = new Map([
      [rb1.migrationHash, nodeLaneByHash.get(rb1.from) ?? 0],
      [rb2.migrationHash, nodeLaneByHash.get(rb2.from) ?? 0],
    ]);

    it('Rule 1 holds', () => {
      expect(checkRule1(grid)).toEqual([]);
    });
    it('Rule 2 holds', () => {
      expect(
        checkRule2(grid, new Set([rb1.migrationHash, rb2.migrationHash]), originLaneByMigHash),
      ).toEqual([]);
    });
  });
});
