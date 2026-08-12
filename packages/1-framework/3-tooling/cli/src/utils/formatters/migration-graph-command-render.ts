/**
 * Command graph renderer: composes the gutter (from the grid) with per-row labels.
 *
 * Pipeline: buildMigrationGraphRows → buildGrid → renderMigrationGraphCommand
 *
 * Each grid row is classified by its cells: a node row gets a contract label;
 * a migration arrow row gets a migration label; connector rows get no label.
 * Label format and styling live in `./migration-graph-labels`.
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { ifDefined } from '@internal/utils/defined';
import stringWidth from 'string-width';
import type { GlyphMode } from '../glyph-mode';
import {
  formatMigrationLabel,
  formatNodeLabel,
  type MigrationEdgeAnnotation,
  type MigrationGraphLabelOptions,
} from './migration-graph-labels';
import type { Cell, CellLine, Grid } from './migration-graph-model';
import { renderGridRow } from './migration-graph-occlusion-render';
import type { MigrationGraphPalette } from './migration-graph-palette';
import type { ClassifiedEdge, MigrationGraphRowModel } from './migration-graph-rows';
import type { MigrationListStyler } from './migration-list-render';

const LABEL_GAP = 2;
const MIN_HASH_DATA_COLUMN = 25;

export interface RenderMigrationGraphCommandInput {
  readonly grid: Grid;
  readonly rowModel: MigrationGraphRowModel;
  readonly colorize: boolean;
  readonly glyphMode: GlyphMode;
  readonly refsByHash?: ReadonlyMap<string, readonly string[]>;
  readonly edgeAnnotationsByHash?: ReadonlyMap<string, MigrationEdgeAnnotation>;
  readonly dbHash?: string;
  readonly contractHash?: string;
  readonly isAppSpace?: boolean;
  readonly activeRefName?: string;
  readonly styler?: MigrationListStyler;
  /** Where the gutter and the labels get their colour. */
  readonly palette?: MigrationGraphPalette;
  /** Cross-space override for the gutter→label column (max gutter width). */
  readonly globalLabelColumn?: number;
  /** Cross-space override for the migration-name column width. */
  readonly globalMaxDirNameWidth?: number;
}

// ---------------------------------------------------------------------------
// Row classification — derive each grid row's identity from its own cells.
// ---------------------------------------------------------------------------

type RowIdentity =
  | { readonly kind: 'node'; readonly contractHash: string }
  | { readonly kind: 'migration'; readonly edge: ClassifiedEdge; readonly lane: number }
  | { readonly kind: 'none' };

/**
 * Classify a grid row by its own cells:
 *   - a cell carrying a NodeRef → node row (contract label);
 *   - a cell whose top line is an arrow ({up}/{down}/self-loop) → migration row;
 *   - otherwise → no label.
 *
 * A migration's arrow appears in exactly one grid row (the forward `↑` row, the
 * adjacent-rollback `↓` row, or the self-loop `⟲` row), so each migration gets
 * exactly one label, on the row that draws its arrow.
 *
 * Two distinct migrations with identical content (same from/to/ops) hash to the
 * SAME migration hash, so the arrow line is matched on BOTH its hash and its
 * `dirName` (which the LineRef carries per-row) — otherwise both rows would
 * resolve to one edge and the other migration's name would be lost.
 */
function classifyRow(
  row: readonly Cell[],
  edgesByHash: ReadonlyMap<string, readonly ClassifiedEdge[]>,
): RowIdentity {
  for (const cell of row) {
    if (cell.node !== undefined) {
      return { kind: 'node', contractHash: cell.node.contractHash };
    }
  }
  for (const cell of row) {
    const arrow = arrowLine(cell);
    if (arrow === undefined) continue;
    const candidates = edgesByHash.get(arrow.line.migrationHash) ?? [];
    const edge = candidates.find((e) => e.dirName === arrow.line.dirName) ?? candidates[0];
    if (edge !== undefined) return { kind: 'migration', edge, lane: arrow.line.lane };
  }
  return { kind: 'none' };
}

/**
 * Return the cell's arrow line if it carries one — a self-loop, or a line whose
 * directions are exactly `{up}` or `{down}` (the migration-direction arrows).
 * Connector/corner/vertical lines are not arrows and yield `undefined`.
 */
function arrowLine(cell: Cell): CellLine | undefined {
  for (const line of cell.lines) {
    if (line.selfLoop === true) return line;
    if (line.landingArrow === true) continue;
    const dirs = line.directions;
    if (dirs.size !== 1) continue;
    if (dirs.has('up') || dirs.has('down')) return line;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Node path-highlight resolution (focus mode).
// ---------------------------------------------------------------------------

/**
 * Resolve each contract's path-highlight role from the edges incident on it.
 * On-path wins: a contract touched by any on-path edge is on-path. Empty unless
 * focus-mode annotations are present.
 */
function resolveNodeHighlights(
  rowModel: MigrationGraphRowModel,
  edgeAnnotationsByHash: ReadonlyMap<string, MigrationEdgeAnnotation> | undefined,
): Map<string, 'on-path' | 'off-path'> {
  const result = new Map<string, 'on-path' | 'off-path'>();
  if (edgeAnnotationsByHash === undefined) return result;
  for (const edge of rowModel.edges) {
    const highlight = edgeAnnotationsByHash.get(edge.migrationHash)?.pathHighlight;
    if (highlight === undefined) continue;
    for (const hash of [edge.from, edge.to]) {
      if (hash === EMPTY_CONTRACT_HASH) continue;
      if (result.get(hash) !== 'on-path') result.set(hash, highlight);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Width helpers
// ---------------------------------------------------------------------------

function maxDirNameLength(edges: readonly ClassifiedEdge[]): number {
  let max = 0;
  for (const edge of edges) max = Math.max(max, edge.dirName.length);
  return max;
}

/**
 * The label column for a render: the widest gutter (visible width) across every
 * row, plus the label gap. Labels begin here so they line up regardless of how
 * deep the lane structure runs on any one row. A cross-space override widens it
 * so sibling space sections share one column.
 */
export function computeLabelColumn(grid: Grid, glyphMode: GlyphMode): number {
  let maxGutter = 0;
  for (const row of grid) {
    const gutter = renderGridRow(row, { colorize: false, glyphMode });
    maxGutter = Math.max(maxGutter, stringWidth(gutter));
  }
  return maxGutter + LABEL_GAP;
}

export function computeMaxDirNameWidth(rowModel: MigrationGraphRowModel): number {
  return maxDirNameLength(rowModel.edges);
}

function padVisible(text: string, targetWidth: number): string {
  const padding = Math.max(0, targetWidth - stringWidth(text));
  return text + ' '.repeat(padding);
}

const ANSI_ESCAPE = '\x1b';

function trimTrailingWhitespace(line: string): string {
  const trailingSpaceBeforeReset = new RegExp(`[\\t ]+((?:${ANSI_ESCAPE}\\[[0-9;]*m)+)$`);
  return line.replace(trailingSpaceBeforeReset, '$1').replace(/\s+$/, '');
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderMigrationGraphCommand(input: RenderMigrationGraphCommandInput): string {
  const { grid, rowModel } = input;
  const glyphMode = input.glyphMode;

  // Edges grouped by hash — a list, not a single entry, because two distinct
  // migrations with identical content collide on one hash. classifyRow then
  // disambiguates by the row's own dirName.
  const edgesByHash = new Map<string, ClassifiedEdge[]>();
  for (const edge of rowModel.edges) {
    const bucket = edgesByHash.get(edge.migrationHash);
    if (bucket) bucket.push(edge);
    else edgesByHash.set(edge.migrationHash, [edge]);
  }

  const labelOpts: MigrationGraphLabelOptions = {
    colorize: input.colorize,
    glyphMode,
    ...ifDefined('refsByHash', input.refsByHash),
    ...ifDefined('edgeAnnotationsByHash', input.edgeAnnotationsByHash),
    ...ifDefined('dbHash', input.dbHash),
    ...ifDefined('contractHash', input.contractHash),
    ...ifDefined('isAppSpace', input.isAppSpace),
    ...ifDefined('activeRefName', input.activeRefName),
    ...ifDefined('styler', input.styler),
    ...ifDefined('palette', input.palette),
  };

  const nodeHighlights = resolveNodeHighlights(rowModel, input.edgeAnnotationsByHash);

  const labelColumn = input.globalLabelColumn ?? computeLabelColumn(grid, glyphMode);
  const maxDirNameLen = input.globalMaxDirNameWidth ?? maxDirNameLength(rowModel.edges);
  // The migration-name column is at least wide enough to push the `from → to`
  // hash column to MIN_HASH_DATA_COLUMN, matching the historical layout.
  const dirNameWidth = Math.max(maxDirNameLen + LABEL_GAP, MIN_HASH_DATA_COLUMN - labelColumn);

  const lines: string[] = [];
  for (const row of grid) {
    const gutter = renderGridRow(row, {
      colorize: input.colorize,
      glyphMode,
      ...ifDefined('palette', input.palette),
    });
    const identity = classifyRow(row, edgesByHash);

    if (identity.kind === 'none') {
      // Connector / pass-through / back-arc rows carry no label. A wholly empty
      // grid row (the blank line between disjoint components) renders as a blank.
      lines.push(trimTrailingWhitespace(gutter));
      continue;
    }

    const gutterPad = padVisible(gutter, labelColumn);
    if (identity.kind === 'node') {
      const label = formatNodeLabel(
        identity.contractHash,
        labelOpts,
        nodeHighlights.get(identity.contractHash),
      );
      lines.push(trimTrailingWhitespace(label.length === 0 ? gutter : `${gutterPad}${label}`));
      continue;
    }

    const label = formatMigrationLabel(identity.edge, dirNameWidth, labelOpts, identity.lane);
    lines.push(trimTrailingWhitespace(`${gutterPad}${label}`));
  }

  return lines.join('\n');
}
