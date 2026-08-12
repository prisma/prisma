import type { MigrationGraph } from '@internal/migration-tools/graph';
import type { GlyphMode } from '../glyph-mode';
import {
  computeLabelColumn,
  computeMaxDirNameWidth,
  renderMigrationGraphCommand,
} from './migration-graph-command-render';
import { buildGrid } from './migration-graph-grid-layout';
import type { MigrationEdgeAnnotation } from './migration-graph-labels';
import type { Highlight } from './migration-graph-model';
import type { MigrationGraphPalette } from './migration-graph-palette';
import { buildMigrationGraphRows } from './migration-graph-rows';
import {
  buildEdgeAnnotationsByHashFromListEntries,
  buildRefsByHashFromListEntries,
  type MigrationListStyler,
} from './migration-list-render';
import type { MigrationListEntry } from './migration-list-types';

export { buildEdgeAnnotationsByHashFromListEntries } from './migration-list-render';

export function mergeMigrationEdgeAnnotations(
  listOverlay: ReadonlyMap<string, MigrationEdgeAnnotation>,
  statusOverlay: ReadonlyMap<string, MigrationEdgeAnnotation>,
): ReadonlyMap<string, MigrationEdgeAnnotation> {
  const merged = new Map<string, MigrationEdgeAnnotation>();
  for (const [migrationHash, listAnnotation] of listOverlay) {
    const statusAnnotation = statusOverlay.get(migrationHash);
    merged.set(migrationHash, {
      ...listAnnotation,
      ...(statusAnnotation?.status !== undefined ? { status: statusAnnotation.status } : {}),
    });
  }
  return merged;
}

/**
 * Translate `migrate --show` per-edge path-highlight annotations into a
 * {@link Highlight}. With any `pathHighlight` present the result is focus mode
 * (on-path lifted green, off-path dim); otherwise flat (lane-rotation colour).
 */
export function highlightFromEdgeAnnotations(
  edgeAnnotationsByHash: ReadonlyMap<string, MigrationEdgeAnnotation>,
): Highlight {
  const onPath = new Set<string>();
  let anyPathHighlight = false;
  for (const [migrationHash, annotation] of edgeAnnotationsByHash) {
    if (annotation.pathHighlight === undefined) continue;
    anyPathHighlight = true;
    if (annotation.pathHighlight === 'on-path') onPath.add(migrationHash);
  }
  return anyPathHighlight ? { mode: 'focus', onPath } : { mode: 'flat', onPath: new Set() };
}

export interface RenderMigrationGraphSpaceTreeInput {
  readonly graph: MigrationGraph;
  readonly migrations: readonly MigrationListEntry[];
  readonly liveContractHash: string;
  readonly glyphMode: GlyphMode;
  readonly colorize: boolean;
  readonly refsByHash?: ReadonlyMap<string, readonly string[]>;
  readonly statusOverlayByHash?: ReadonlyMap<string, MigrationEdgeAnnotation>;
  readonly dbHash?: string;
  readonly styler?: MigrationListStyler;
  /** Where the tree gets its colour. Defaults to the ANSI palette. */
  readonly palette?: MigrationGraphPalette;
  /**
   * Cross-space override for the gutter→label column (the widest gutter across
   * sibling space sections, plus the label gap). Named for historical
   * continuity with the previous renderer's prefix-width input.
   */
  readonly globalMaxEdgeTreePrefixWidth?: number;
  readonly globalMaxDirNameWidth?: number;
  /**
   * Whether this render is for the app space. When false, `contractHash` is not
   * forwarded to `buildMigrationGraphRows` (suppressing the floating working-
   * contract node) and the `@contract` marker is suppressed. Defaults to `true`.
   */
  readonly isAppSpace?: boolean;
}

export interface ComputeGlobalMaxEdgeTreePrefixWidthInput {
  readonly graph: MigrationGraph;
  readonly liveContractHash: string;
}

function buildGridForInput(input: ComputeGlobalMaxEdgeTreePrefixWidthInput): {
  readonly grid: ReturnType<typeof buildGrid>;
  readonly rowModel: ReturnType<typeof buildMigrationGraphRows>;
} {
  const rowModel = buildMigrationGraphRows(input.graph, { contractHash: input.liveContractHash });
  const grid = buildGrid(rowModel, {}, { mode: 'flat', onPath: new Set() });
  return { grid, rowModel };
}

/**
 * The widest gutter→label column across the given space layouts. Cross-space
 * callers pass this back in so every section's labels share one column.
 */
export function computeGlobalMaxEdgeTreePrefixWidth(
  inputs: readonly ComputeGlobalMaxEdgeTreePrefixWidthInput[],
  glyphMode: GlyphMode = 'unicode',
): number {
  let globalMax = 0;
  for (const input of inputs) {
    const { grid } = buildGridForInput(input);
    globalMax = Math.max(globalMax, computeLabelColumn(grid, glyphMode));
  }
  return globalMax;
}

export function computeGlobalMaxDirNameWidth(
  inputs: readonly ComputeGlobalMaxEdgeTreePrefixWidthInput[],
): number {
  let globalMax = 0;
  for (const input of inputs) {
    const { rowModel } = buildGridForInput(input);
    globalMax = Math.max(globalMax, computeMaxDirNameWidth(rowModel));
  }
  return globalMax;
}

function renderMigrationGraphSpaceTreeInternal(input: RenderMigrationGraphSpaceTreeInput): string {
  const appSpace = input.isAppSpace !== false;
  const rowModel = buildMigrationGraphRows(input.graph, {
    ...(appSpace ? { contractHash: input.liveContractHash } : {}),
  });
  const listOverlay = buildEdgeAnnotationsByHashFromListEntries(input.migrations);
  const edgeAnnotationsByHash =
    input.statusOverlayByHash === undefined
      ? listOverlay
      : mergeMigrationEdgeAnnotations(listOverlay, input.statusOverlayByHash);
  const highlight = highlightFromEdgeAnnotations(edgeAnnotationsByHash);
  const grid = buildGrid(rowModel, {}, highlight);

  return renderMigrationGraphCommand({
    grid,
    rowModel,
    colorize: input.colorize,
    glyphMode: input.glyphMode,
    contractHash: input.liveContractHash,
    isAppSpace: appSpace,
    edgeAnnotationsByHash,
    refsByHash: input.refsByHash ?? buildRefsByHashFromListEntries(input.migrations),
    ...(input.dbHash !== undefined ? { dbHash: input.dbHash } : {}),
    ...(input.styler !== undefined ? { styler: input.styler } : {}),
    ...(input.palette !== undefined ? { palette: input.palette } : {}),
    ...(input.globalMaxEdgeTreePrefixWidth !== undefined
      ? { globalLabelColumn: input.globalMaxEdgeTreePrefixWidth }
      : {}),
    ...(input.globalMaxDirNameWidth !== undefined
      ? { globalMaxDirNameWidth: input.globalMaxDirNameWidth }
      : {}),
  });
}

export function renderMigrationGraphSpaceTree(input: RenderMigrationGraphSpaceTreeInput): string {
  return renderMigrationGraphSpaceTreeInternal(input);
}

export function renderMigrationGraphSpaceTrees(
  inputs: readonly RenderMigrationGraphSpaceTreeInput[],
): readonly string[] {
  const globalInputs: ComputeGlobalMaxEdgeTreePrefixWidthInput[] = inputs.map((input) => ({
    graph: input.graph,
    liveContractHash: input.liveContractHash,
  }));
  const glyphMode = inputs[0]?.glyphMode ?? 'unicode';
  const globalLabelColumn =
    inputs.length > 1 ? computeGlobalMaxEdgeTreePrefixWidth(globalInputs, glyphMode) : undefined;
  const globalMaxDirName =
    inputs.length > 1 ? computeGlobalMaxDirNameWidth(globalInputs) : undefined;
  return inputs.map((input) =>
    renderMigrationGraphSpaceTreeInternal({
      ...input,
      ...(globalLabelColumn !== undefined
        ? { globalMaxEdgeTreePrefixWidth: globalLabelColumn }
        : {}),
      ...(globalMaxDirName !== undefined ? { globalMaxDirNameWidth: globalMaxDirName } : {}),
    }),
  );
}

export function indentMigrationGraphTreeBlock(treeOutput: string, indent: string): string {
  if (treeOutput.length === 0) {
    return treeOutput;
  }
  return treeOutput
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${indent}${line}`))
    .join('\n');
}
