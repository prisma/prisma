import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import type { GlyphMode } from '../glyph-mode';
import type { MigrationEdgeAnnotation } from './migration-graph-labels';
import type { MigrationGraphPalette } from './migration-graph-palette';
import {
  computeGlobalMaxDirNameWidth,
  computeGlobalMaxEdgeTreePrefixWidth,
  indentMigrationGraphTreeBlock,
  renderMigrationGraphSpaceTree,
} from './migration-graph-space-render';
import type { MigrationListEntry, MigrationListResult } from './migration-list-types';

export type { GlyphMode } from '../glyph-mode';
export type { MigrationEdgeKind } from './migration-list-graph-topology';
export type {
  MigrationListEntry,
  MigrationListResult,
  MigrationSpaceListEntry,
} from './migration-list-types';

/**
 * Semantic styler for `migration list` output tokens. Token-typed so
 * the renderer composes presentation-neutral fragments and the styler
 * decides how each token kind is decorated (ANSI codes, plain text,
 * etc.). The renderer pads with raw spaces *outside* styled tokens so
 * visible column widths stay stable regardless of what the styler
 * emits — adding ANSI escape sequences never disturbs alignment.
 *
 * `invariants` and `refs` receive the underlying string arrays rather
 * than a pre-joined string so per-element styling (e.g. distinguishing
 * the live-DB `db` marker from user-named refs) is possible without
 * having to re-parse a joined block.
 */
export interface MigrationListStyler {
  kind(text: string): string;
  dirName(text: string): string;
  sourceHash(text: string): string;
  destHash(text: string): string;
  glyph(text: string): string;
  lane(text: string): string;
  invariants(ids: readonly string[]): string;
  refs(names: readonly string[]): string;
  spaceHeading(text: string): string;
  summary(text: string): string;
  emptyState(text: string): string;
}

export const IDENTITY_MIGRATION_LIST_STYLER: MigrationListStyler = {
  kind: (text) => text,
  dirName: (text) => text,
  sourceHash: (text) => text,
  destHash: (text) => text,
  glyph: (text) => text,
  lane: (text) => text,
  invariants: (ids) => `{${ids.join(', ')}}`,
  refs: (names) => `(${names.join(', ')})`,
  spaceHeading: (text) => text,
  summary: (text) => text,
  emptyState: (text) => text,
};

function canonicalFrom(from: string | null): string {
  return from ?? EMPTY_CONTRACT_HASH;
}

export function migrationGraphFromListEntries(
  entries: readonly MigrationListEntry[],
): MigrationGraph {
  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();

  for (const entry of entries) {
    const from = canonicalFrom(entry.fromContract);
    const edge: MigrationEdge = {
      from,
      to: entry.toContract,
      migrationHash: entry.hash,
      dirName: entry.name,
      createdAt: entry.createdAt,
      invariants: entry.providedInvariants,
    };
    nodes.add(from);
    nodes.add(entry.toContract);
    const forward = forwardChain.get(from);
    if (forward) forward.push(edge);
    else forwardChain.set(from, [edge]);
    const reverse = reverseChain.get(entry.toContract);
    if (reverse) reverse.push(edge);
    else reverseChain.set(entry.toContract, [edge]);
    migrationByHash.set(entry.hash, edge);
  }

  return { nodes, forwardChain, reverseChain, migrationByHash };
}

export function buildEdgeAnnotationsByHashFromListEntries(
  entries: readonly MigrationListEntry[],
): ReadonlyMap<string, MigrationEdgeAnnotation> {
  const annotations = new Map<string, MigrationEdgeAnnotation>();
  for (const entry of entries) {
    annotations.set(entry.hash, {
      operationCount: entry.operationCount,
      invariants: entry.providedInvariants,
    });
  }
  return annotations;
}

export function buildRefsByHashFromListEntries(
  entries: readonly MigrationListEntry[],
): ReadonlyMap<string, readonly string[]> {
  const refsByHash = new Map<string, readonly string[]>();
  for (const entry of entries) {
    if (entry.refs.length > 0) {
      refsByHash.set(entry.toContract, entry.refs);
    }
  }
  return refsByHash;
}

function formatEmptyStateLine(spaceId: string, style: MigrationListStyler): string {
  return style.emptyState(`There are no migrations in migrations/${spaceId}/ yet`);
}

interface SpaceTreeBlockInput {
  readonly spaceId: string;
  readonly migrations: readonly MigrationListEntry[];
  readonly multiSpace: boolean;
  readonly glyphMode: GlyphMode;
  readonly style: MigrationListStyler;
  readonly colorize: boolean;
  readonly liveContractHash: string;
  readonly graphForSpace: (spaceId: string) => MigrationGraph | undefined;
  readonly appSpaceId: string | undefined;
  readonly palette: MigrationGraphPalette | undefined;
  readonly globalMaxEdgeTreePrefixWidth: number | undefined;
  readonly globalMaxDirNameWidth: number | undefined;
}

function renderSpaceTreeBlock(input: SpaceTreeBlockInput): readonly string[] {
  const {
    spaceId,
    migrations,
    multiSpace,
    glyphMode,
    style,
    colorize,
    liveContractHash,
    graphForSpace,
    appSpaceId,
    palette,
    globalMaxEdgeTreePrefixWidth,
    globalMaxDirNameWidth,
  } = input;
  if (migrations.length === 0) {
    const emptyLine = formatEmptyStateLine(spaceId, style);
    if (!multiSpace) {
      return [emptyLine];
    }
    return [style.spaceHeading(`${spaceId}:`), `  ${emptyLine}`];
  }

  const graph = graphForSpace(spaceId) ?? migrationGraphFromListEntries(migrations);
  const isAppSpace = appSpaceId === undefined ? undefined : spaceId === appSpaceId;
  const treeOutput = renderMigrationGraphSpaceTree({
    graph,
    migrations,
    liveContractHash,
    glyphMode,
    colorize,
    refsByHash: buildRefsByHashFromListEntries(migrations),
    styler: style,
    ...(palette !== undefined ? { palette } : {}),
    ...(isAppSpace !== undefined ? { isAppSpace } : {}),
    ...(globalMaxEdgeTreePrefixWidth !== undefined ? { globalMaxEdgeTreePrefixWidth } : {}),
    ...(globalMaxDirNameWidth !== undefined ? { globalMaxDirNameWidth } : {}),
  });

  if (!multiSpace) {
    return treeOutput.length === 0 ? [] : [treeOutput];
  }

  const indented = indentMigrationGraphTreeBlock(treeOutput, '  ');
  return [style.spaceHeading(`${spaceId}:`), indented];
}

export interface RenderMigrationListWithStyleOptions {
  readonly colorize?: boolean;
  readonly liveContractHash?: string;
  readonly graphForSpace?: (spaceId: string) => MigrationGraph | undefined;
  /**
   * The space ID that is the app contract space. When provided, `@contract`
   * and the floating working-contract node are shown only for this space.
   * When absent, the renderer falls back to the default (`isAppSpace: true`
   * for every space), which is safe for single-space callers.
   */
  readonly appSpaceId?: string;
  /** Where the tree gets its colour. Defaults to the ANSI palette. */
  readonly palette?: MigrationGraphPalette;
}

/**
 * Compose the styled `migration list` human output via the shared tree
 * renderer. Each on-disk migration is one edge row with package-fact
 * annotations; refs decorate destination contract nodes.
 *
 * `options.colorize` must match whether `style` emits ANSI (e.g. both true for
 * `createAnsiMigrationListStyler({ useColor: true })`).
 */
export function renderMigrationListWithStyle(
  result: MigrationListResult,
  style: MigrationListStyler,
  glyphMode: GlyphMode = 'unicode',
  options: RenderMigrationListWithStyleOptions = {},
): string {
  const multiSpace = result.spaces.length > 1;
  const colorize = options.colorize ?? false;
  const liveContractHash = options.liveContractHash ?? EMPTY_CONTRACT_HASH;
  const graphForSpace = options.graphForSpace ?? (() => undefined);
  const appSpaceId = options.appSpaceId;
  const globalLayoutInputs = multiSpace
    ? result.spaces
        .filter((space) => space.migrations.length > 0)
        .map((space) => ({
          graph: graphForSpace(space.space) ?? migrationGraphFromListEntries(space.migrations),
          liveContractHash,
        }))
    : [];
  const globalMaxEdgeTreePrefixWidth =
    globalLayoutInputs.length > 0
      ? computeGlobalMaxEdgeTreePrefixWidth(globalLayoutInputs)
      : undefined;
  const globalMaxDirNameWidth =
    globalLayoutInputs.length > 0 ? computeGlobalMaxDirNameWidth(globalLayoutInputs) : undefined;
  const lines: string[] = [];

  for (let index = 0; index < result.spaces.length; index++) {
    const space = result.spaces[index]!;
    if (index > 0) {
      lines.push('');
    }
    lines.push(
      ...renderSpaceTreeBlock({
        spaceId: space.space,
        migrations: space.migrations,
        multiSpace,
        glyphMode,
        style,
        colorize,
        liveContractHash,
        graphForSpace,
        appSpaceId,
        palette: options.palette,
        globalMaxEdgeTreePrefixWidth,
        globalMaxDirNameWidth,
      }),
    );
  }

  const totalMigrations = result.spaces.reduce(
    (count, space) => count + space.migrations.length,
    0,
  );
  if (totalMigrations > 0) {
    lines.push('');
    lines.push(style.summary(result.summary));
  }

  return lines.join('\n');
}

export function renderMigrationList(result: MigrationListResult): string {
  return renderMigrationListWithStyle(result, IDENTITY_MIGRATION_LIST_STYLER);
}
