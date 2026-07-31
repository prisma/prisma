/**
 * Per-row label formatting for the command graph renderer.
 *
 * The command graph renderer ({@link renderMigrationGraphCommand}) derives the
 * graph structure — rows, gutter, lane colours — from the grid pipeline. The
 * per-row LABEL (contract hash + markers + refs for node rows;
 * migration name + `from → to` + ops/status/will-run for migration rows) is
 * formatted here. This module owns ONLY label text + styling; it knows nothing
 * about lanes, gutters, or grid geometry.
 *
 * The label format (hash abbreviation, `from → to` arrow column, `@contract`/
 * `@db` markers, `(refs)`, ops/status/will-run suffix, the legend) is the same
 * as the previous renderer — that part was never the bug.
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { bold, createColors, green, yellow } from 'colorette';
import type { GlyphMode } from '../glyph-mode';
import { laneColorizer } from './migration-graph-occlusion-render';
import type { ClassifiedEdge } from './migration-graph-rows';
import {
  MIGRATION_LIST_HASH_WIDTH,
  migrationListEmptySource,
  migrationListForwardArrow,
  padFromHashColumn,
} from './migration-list-data-column';
import type { MigrationEdgeKind } from './migration-list-graph-topology';
import type { MigrationListStyler } from './migration-list-render';
import {
  CONTRACT_MARKER_NAME,
  createAnsiMigrationListStyler,
  formatContractNodeOverlays,
} from './migration-list-styler';

/**
 * The live-database overlay marker. Just another ref as far as styling goes —
 * the only emphasized markers are the active ref and the `contract`
 * desired-state marker (see {@link CONTRACT_MARKER_NAME}).
 */
const DB_MARKER_NAME = 'db';

export interface MigrationEdgeAnnotation {
  readonly status?: 'applied' | 'pending';
  readonly operationCount?: number;
  readonly invariants?: readonly string[];
  /**
   * Path-highlight annotation for `migrate --show` preview.
   * - `'on-path'`: migration is on the chosen path; rendered in bright green.
   * - `'off-path'`: migration is off the chosen path; fully drawn but dim grey.
   */
  readonly pathHighlight?: 'on-path' | 'off-path';
}

/**
 * Inputs that drive label formatting. A subset of the command renderer's
 * options — everything the label functions read.
 */
export interface MigrationGraphLabelOptions {
  readonly refsByHash?: ReadonlyMap<string, readonly string[]>;
  readonly edgeAnnotationsByHash?: ReadonlyMap<string, MigrationEdgeAnnotation>;
  readonly dbHash?: string;
  readonly contractHash?: string;
  readonly isAppSpace?: boolean;
  readonly activeRefName?: string;
  readonly hashLength?: number;
  readonly colorize: boolean;
  readonly glyphMode?: GlyphMode;
  readonly styler?: MigrationListStyler;
}

/**
 * Forced-color functions that always emit ANSI regardless of the ambient TTY
 * environment (NO_COLOR, piped output). Used so on-path green / off-path dim are
 * deterministically emitted in tests that request colour while NO_COLOR is set.
 */
const { dim: forcedDim } = createColors({ useColor: true });
const { greenBright: forcedGreen } = createColors({ useColor: true });

/**
 * The two label styles used in `migrate --show` path-highlight mode.
 *
 * - `onPath`: bold name, neutral hashes (the on-path lane glyphs are coloured
 *   green by the grid renderer, not here).
 * - `offPath`: uniform dim grey on the name and the whole hash column.
 *
 * To change the on-path / off-path label colour in future, edit this object.
 */
export const PATH_HIGHLIGHT_STYLES = {
  onPath: (_style: MigrationListStyler, colorize: boolean) => ({
    lane: colorize ? forcedGreen : (text: string) => text,
    arrow: (text: string) => text,
    dirName: (text: string) => bold(text),
    hashOverride: undefined,
  }),
  offPath: (colorize: boolean) => ({
    lane: colorize ? forcedDim : (text: string) => text,
    arrow: colorize ? forcedDim : (text: string) => text,
    dirName: colorize ? forcedDim : (text: string) => text,
    hashOverride: colorize ? forcedDim : undefined,
  }),
} as const;

function abbreviateHash(hash: string, hashLength: number, emptySource: string): string {
  if (hash === EMPTY_CONTRACT_HASH) {
    return emptySource;
  }
  return hash.slice(0, hashLength);
}

interface ContractOverlayNames {
  readonly markers: readonly string[];
  readonly refs: readonly string[];
}

function overlayNamesForContract(
  contractHash: string,
  opts: MigrationGraphLabelOptions,
): ContractOverlayNames {
  const markers: string[] = [];
  const refs: string[] = [];
  const userRefs = opts.refsByHash?.get(contractHash);
  if (userRefs) {
    refs.push(...[...userRefs].sort((a, b) => a.localeCompare(b)));
  }
  if (
    opts.isAppSpace !== false &&
    opts.contractHash === contractHash &&
    contractHash !== EMPTY_CONTRACT_HASH
  ) {
    markers.push(CONTRACT_MARKER_NAME);
  }
  if (opts.dbHash === contractHash) {
    markers.push(DB_MARKER_NAME);
  }
  markers.sort((a, b) => {
    if (a === CONTRACT_MARKER_NAME) return -1;
    if (b === CONTRACT_MARKER_NAME) return 1;
    return a.localeCompare(b);
  });
  return { markers, refs };
}

export function createLabelStyler(opts: MigrationGraphLabelOptions): MigrationListStyler {
  const base = opts.styler ?? createAnsiMigrationListStyler({ useColor: opts.colorize });
  const activeRefName = opts.activeRefName;
  if (!opts.colorize || activeRefName === undefined) {
    return base;
  }
  return {
    ...base,
    refs: (names) => {
      const styledNames = names.map((name) => (name === activeRefName ? bold(name) : name));
      return base.refs(styledNames);
    },
  };
}

function overlayStatusGlyphs(mode: GlyphMode): {
  readonly applied: string;
  readonly pending: string;
} {
  return mode === 'ascii' ? { applied: '+', pending: '>' } : { applied: '✓', pending: '⧗' };
}

function formatEdgeAnnotationSuffix(
  migrationHash: string,
  opts: MigrationGraphLabelOptions,
  style: MigrationListStyler,
): string {
  const annotation = opts.edgeAnnotationsByHash?.get(migrationHash);
  if (annotation === undefined) {
    return '';
  }
  const isOffPath = annotation.pathHighlight === 'off-path';
  const segments: string[] = [];
  if (annotation.operationCount !== undefined) {
    segments.push(`${annotation.operationCount} ops`);
  }
  if (annotation.invariants !== undefined && annotation.invariants.length > 0) {
    segments.push(style.invariants(annotation.invariants));
  }
  const status = annotation.status;
  if (status !== undefined) {
    const glyphs = overlayStatusGlyphs(opts.glyphMode ?? 'unicode');
    const glyph = status === 'applied' ? glyphs.applied : glyphs.pending;
    const label = status === 'applied' ? 'applied' : 'pending';
    if (!opts.colorize) {
      segments.push(`${glyph} ${label}`);
    } else {
      const styler = status === 'applied' ? green : yellow;
      segments.push(styler(`${glyph} ${label}`));
    }
  }
  if (annotation.pathHighlight === 'on-path') {
    const glyph = opts.glyphMode === 'ascii' ? '>' : '↑';
    segments.push(`${glyph} will run`);
  }
  if (segments.length === 0) {
    return '';
  }
  const suffix = `  ${segments.join('  ')}`;
  return opts.colorize && isOffPath ? forcedDim(suffix) : suffix;
}

/**
 * Format the `from → to` hash data column for an edge row.
 *
 * When `hashOverride` is provided (off-path → `dim`), it replaces ALL sub-stylers
 * so dim reaches every character without inner ANSI codes overriding it.
 */
function formatEdgeHashColumn(
  edge: ClassifiedEdge,
  style: MigrationListStyler,
  hashLength: number,
  glyphMode: GlyphMode,
  hashOverride?: (text: string) => string,
): string {
  const emptySource = migrationListEmptySource(glyphMode);
  const forwardArrow = migrationListForwardArrow(glyphMode);
  const src = hashOverride ?? style.sourceHash;
  const dst = hashOverride ?? style.destHash;
  const glyph = hashOverride ?? style.glyph;
  if (edge.kind === 'self') {
    const hash = abbreviateHash(edge.from, hashLength, emptySource);
    const source = padFromHashColumn(src(hash), hashLength);
    return `${source} ${glyph(forwardArrow)} ${dst(hash)}`;
  }
  const source =
    edge.from === EMPTY_CONTRACT_HASH
      ? padFromHashColumn(glyph(emptySource), hashLength)
      : padFromHashColumn(src(abbreviateHash(edge.from, hashLength, emptySource)), hashLength);
  const arrow = glyph(forwardArrow);
  const dest = dst(abbreviateHash(edge.to, hashLength, emptySource));
  return `${source} ${arrow} ${dest}`;
}

// ---------------------------------------------------------------------------
// Public label builders used by the command renderer.
// ---------------------------------------------------------------------------

/**
 * The label text for a contract node row: the abbreviated hash (or the `∅`
 * empty-source token for the baseline) followed by its `@contract`/`@db` markers
 * and `(refs)`, with two spaces between the hash and the overlay block.
 */
export function formatNodeLabel(
  contractHash: string,
  opts: MigrationGraphLabelOptions,
  nodeHighlight?: 'on-path' | 'off-path' | undefined,
): string {
  const style = createLabelStyler(opts);
  const hashLength = opts.hashLength ?? MIGRATION_LIST_HASH_WIDTH;
  const emptySource = migrationListEmptySource(opts.glyphMode ?? 'unicode');
  const overlays = overlayNamesForContract(contractHash, opts);
  const hasOverlays = overlays.markers.length > 0 || overlays.refs.length > 0;
  const offPath = nodeHighlight === 'off-path' && opts.colorize;
  // The baseline's label is the ∅ empty-source token (the gutter draws ○ for
  // every node, including the baseline); a real contract's label is its hash.
  const hashText =
    contractHash === EMPTY_CONTRACT_HASH
      ? (offPath ? forcedDim : style.glyph)(emptySource)
      : (offPath ? forcedDim : style.sourceHash)(
          abbreviateHash(contractHash, hashLength, emptySource),
        );
  if (!hasOverlays) return hashText;
  const overlay = formatContractNodeOverlays(style, overlays.markers, overlays.refs);
  return `${hashText}  ${overlay}`;
}

/**
 * The label text for a migration row: the migration name (padded to
 * `dirNameWidth`) followed by the `from → to` hash column and the annotation
 * suffix (ops / status / will-run).
 *
 * In flat mode the name is tinted with its lane's hue (`lane` ≥ 0), so the node
 * `○`, the edges/arrows in the gutter, and the name all read in one colour. In
 * focus mode the on-path/off-path role overrides the lane hue (bold / dim).
 */
export function formatMigrationLabel(
  edge: ClassifiedEdge,
  dirNameWidth: number,
  opts: MigrationGraphLabelOptions,
  lane?: number,
): string {
  const style = createLabelStyler(opts);
  const hashLength = opts.hashLength ?? MIGRATION_LIST_HASH_WIDTH;
  const glyphMode = opts.glyphMode ?? 'unicode';
  const highlight = opts.edgeAnnotationsByHash?.get(edge.migrationHash)?.pathHighlight;

  let dirNameStyler: (text: string) => string;
  let hashOverride: ((text: string) => string) | undefined;
  if (highlight === 'on-path') {
    // On-path: tint the name with the on-path green (matching the route's green
    // glyphs in the gutter), not bolded.
    dirNameStyler = opts.colorize ? forcedGreen : (text) => text;
    hashOverride = undefined;
  } else if (highlight === 'off-path') {
    dirNameStyler = opts.colorize ? forcedDim : style.dirName;
    hashOverride = opts.colorize ? forcedDim : undefined;
  } else if (opts.colorize && lane !== undefined) {
    // Flat mode: tint the name with the lane hue (matching the lane's
    // node/edge/arrow colour in the gutter), not bolded.
    dirNameStyler = (text) => laneColorizer(lane)(text);
    hashOverride = undefined;
  } else {
    dirNameStyler = style.dirName;
    hashOverride = undefined;
  }

  const dirNamePadding = ' '.repeat(Math.max(0, dirNameWidth - edge.dirName.length));
  const dirName = `${dirNameStyler(edge.dirName)}${dirNamePadding}`;
  const hashColumn = formatEdgeHashColumn(edge, style, hashLength, glyphMode, hashOverride);
  const annotationSuffix = formatEdgeAnnotationSuffix(edge.migrationHash, opts, style);
  return `${dirName}${hashColumn}${annotationSuffix}`;
}

/**
 * Format a single on-path migration row for the `migrate --show` run-list.
 * Shares PATH_HIGHLIGHT_STYLES.onPath with the graph tree so the run-list and
 * the graph are byte-for-byte identical in their name/hash columns.
 */
export function formatOnPathMigrationRow(
  dirName: string,
  from: string,
  to: string,
  dirNameWidth: number,
  colorize: boolean,
  glyphMode: GlyphMode,
): string {
  const style = createAnsiMigrationListStyler({ useColor: colorize });
  const s = PATH_HIGHLIGHT_STYLES.onPath(style, colorize);
  const styledDirName = `${s.dirName(dirName)}${' '.repeat(Math.max(0, dirNameWidth - dirName.length))}`;
  const hashLength = MIGRATION_LIST_HASH_WIDTH;
  const emptySource = migrationListEmptySource(glyphMode);
  const forwardArrow = migrationListForwardArrow(glyphMode);
  const fromAbbr =
    from === EMPTY_CONTRACT_HASH
      ? padFromHashColumn(style.glyph(emptySource), hashLength)
      : padFromHashColumn(
          style.sourceHash(abbreviateHash(from, hashLength, emptySource)),
          hashLength,
        );
  const toAbbr =
    to === EMPTY_CONTRACT_HASH
      ? style.glyph(emptySource)
      : style.destHash(abbreviateHash(to, hashLength, emptySource));
  const arrow = style.glyph(forwardArrow);
  return `${styledDirName}  ${fromAbbr} ${arrow} ${toAbbr}`;
}

export interface RenderMigrationGraphLegendOptions {
  readonly colorize: boolean;
  readonly glyphMode?: GlyphMode;
}

function legendGlyphs(mode: GlyphMode): {
  readonly node: string;
  readonly forward: string;
  readonly rollback: string;
  readonly self: string;
} {
  return mode === 'ascii'
    ? { node: '*', forward: '^', rollback: 'v', self: '@' }
    : { node: '○', forward: '↑', rollback: '↓', self: '⟲' };
}

function formatLegendExampleMarkers(colorize: boolean): string {
  if (!colorize) {
    return '@contract @db';
  }
  const sigil = green('@');
  return `${sigil + bold(green('contract'))} ${sigil}${green('db')}`;
}

/**
 * A compact key for the tree visual language: the contract node glyph, the
 * in-lane direction arrows, the empty baseline, the system-marker `@…` and
 * user-ref `(…)` conventions, and a worked sample of the data-column hash arrow.
 */
export function renderMigrationGraphLegend(opts: RenderMigrationGraphLegendOptions): string {
  const glyphMode = opts.glyphMode ?? 'unicode';
  const style = createAnsiMigrationListStyler({ useColor: opts.colorize });
  const glyphs = legendGlyphs(glyphMode);
  const emptySource = migrationListEmptySource(glyphMode);
  const forwardArrow = migrationListForwardArrow(glyphMode);
  const sampleArrow = `${style.sourceHash('aaaaaa')} ${style.glyph(forwardArrow)} ${style.destHash('bbbbbb')}`;
  const statusGlyphs = overlayStatusGlyphs(glyphMode);
  const appliedPending = opts.colorize
    ? `  ${green(statusGlyphs.applied)} ${style.summary('applied')}   ${yellow(statusGlyphs.pending)} ${style.summary('pending')}`
    : `  ${statusGlyphs.applied} ${style.summary('applied')}   ${statusGlyphs.pending} ${style.summary('pending')}`;
  const exampleMarkers = formatLegendExampleMarkers(opts.colorize);
  const exampleRefs = opts.colorize ? style.refs(['prod', 'staging']) : '(prod, staging)';
  const lines = [
    'Legend:',
    `  ${style.kind(glyphs.node)} ${style.summary('contract')}   ${style.kind(glyphs.forward)} ${style.summary('forward')}   ${style.kind(glyphs.rollback)} ${style.summary('rollback')}`,
    `  ${style.kind(glyphs.self)} ${style.summary('migration without schema change')}`,
    appliedPending,
    `  ${style.kind(emptySource)} ${style.summary('empty database (baseline)')}`,
    `  ${exampleMarkers} ${style.summary('reserved markers — also typeable as --from/--to tokens')}`,
    `  ${exampleRefs} ${style.summary('user-defined refs')}`,
    `  ${sampleArrow}   ${style.summary('migration from contract aaaaaa to bbbbbb')}`,
  ];
  return lines.join('\n');
}

// Re-export the edge kind type alias for downstream label callers.
export type { MigrationEdgeKind };
