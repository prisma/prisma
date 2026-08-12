/**
 * Occlusion renderer for the line/plane/occlusion migration-graph.
 *
 * Per cell: pick the topmost-plane line (lowest plane number = drawn on top),
 * look up its glyph, apply colour from the line's lane or role. Lower-plane
 * lines are occluded (not drawn).
 *
 * Colour comes from the palette the caller hands in; see migration-graph-palette.
 */

import {
  type Cell,
  type CellLine,
  DEFAULT_COLS_PER_LANE,
  type Direction,
  type Grid,
  type PathRole,
} from './migration-graph-model';
import {
  ANSI_MIGRATION_GRAPH_PALETTE,
  type MigrationGraphPalette,
  PLAIN_MIGRATION_GRAPH_PALETTE,
} from './migration-graph-palette';

type Colorizer = (text: string) => string;

// ---------------------------------------------------------------------------
// Glyph alphabet — unicode and ASCII variants.
// ---------------------------------------------------------------------------
export type GraphGlyphMode = 'unicode' | 'ascii';

interface GraphGlyphAlphabet {
  readonly vertical: string;
  readonly horizontal: string;
  readonly cornerUpRight: string;
  readonly cornerDownRight: string;
  readonly cornerUpLeft: string;
  readonly cornerDownLeft: string;
  readonly arrowUp: string;
  readonly arrowDown: string;
  readonly node: string;
  readonly selfLoop: string;
  readonly landingArrow: string;
  readonly fallback: string;
}

const UNICODE_ALPHABET: GraphGlyphAlphabet = {
  vertical: '│',
  horizontal: '─',
  cornerUpRight: '╰',
  cornerDownRight: '╭',
  cornerUpLeft: '╯',
  cornerDownLeft: '╮',
  arrowUp: '↑',
  arrowDown: '↓',
  node: '○',
  selfLoop: '⟲',
  landingArrow: '◂',
  fallback: '?',
};

const ASCII_ALPHABET: GraphGlyphAlphabet = {
  vertical: '|',
  horizontal: '-',
  cornerUpRight: '\\',
  cornerDownRight: '/',
  cornerUpLeft: '/',
  cornerDownLeft: '\\',
  arrowUp: '^',
  arrowDown: 'v',
  node: '*',
  selfLoop: '@',
  landingArrow: '<',
  fallback: '?',
};

function alphabetFor(mode: GraphGlyphMode): GraphGlyphAlphabet {
  return mode === 'ascii' ? ASCII_ALPHABET : UNICODE_ALPHABET;
}

function glyphFor(dirs: ReadonlySet<Direction>, alphabet: GraphGlyphAlphabet): string {
  const has = (d: Direction) => dirs.has(d);

  if (has('up') && has('down') && !has('left') && !has('right')) return alphabet.vertical;
  if (has('left') && has('right') && !has('up') && !has('down')) return alphabet.horizontal;
  if (has('up') && has('right') && !has('down') && !has('left')) return alphabet.cornerUpRight;
  if (has('down') && has('right') && !has('up') && !has('left')) return alphabet.cornerDownRight;
  if (has('up') && has('left') && !has('down') && !has('right')) return alphabet.cornerUpLeft;
  if (has('down') && has('left') && !has('up') && !has('right')) return alphabet.cornerDownLeft;
  if (has('up') && !has('down') && !has('left') && !has('right')) return alphabet.arrowUp;
  if (has('down') && !has('up') && !has('left') && !has('right')) return alphabet.arrowDown;

  // Fallback: shouldn't happen in well-formed grids
  return alphabet.fallback;
}

// ---------------------------------------------------------------------------
// renderCell — project one cell to a coloured string fragment.
// ---------------------------------------------------------------------------

/** A line or node is painted by its path role when it has one, else by its lane. */
function paintByRoleOrLane(
  palette: MigrationGraphPalette,
  role: PathRole | undefined,
  lane: number,
): Colorizer {
  return role === undefined
    ? (text) => palette.lane(lane, text)
    : (text) => palette.role(role, text);
}

function renderCell(
  cell: Cell,
  palette: MigrationGraphPalette,
  alphabet: GraphGlyphAlphabet,
): string {
  const node = cell.node;
  if (node !== undefined) {
    // Every node uses ○ — the ∅ identifier is only used as the label, not as a
    // glyph, per the golden colour model. Colour by role (focus) or lane (flat).
    return paintByRoleOrLane(palette, node.role, node.lane)(alphabet.node);
  }

  if (cell.lines.length === 0) {
    return ' ';
  }

  // Pick the drawn line by occlusion: lowest plane number wins (drawn on top).
  // At an equal plane, on-path beats off-path explicitly — never rely on array
  // order to break the tie (the single-owner invariant should already prevent
  // a same-plane on/off-path collision, but the priority is made explicit here).
  const topLine = cell.lines.reduce<CellLine>((best, current) => {
    if (current.plane < best.plane) return current;
    if (current.plane > best.plane) return best;
    if (current.line.role === 'on-path' && best.line.role !== 'on-path') return current;
    return best;
  }, cell.lines[0]!);

  const glyph =
    topLine.selfLoop === true
      ? alphabet.selfLoop
      : topLine.landingArrow === true
        ? alphabet.landingArrow
        : glyphFor(topLine.directions, alphabet);
  return paintByRoleOrLane(palette, topLine.line.role, topLine.line.lane)(glyph);
}

// ---------------------------------------------------------------------------
// RenderGridOptions
// ---------------------------------------------------------------------------

export interface RenderGridOptions {
  readonly colorize?: boolean;
  readonly colsPerLane?: number;
  readonly glyphMode?: GraphGlyphMode;
  /** Where the gutter's colour comes from. Defaults to the ANSI palette. */
  readonly palette?: MigrationGraphPalette;
}

// ---------------------------------------------------------------------------
// renderGrid — the main render function.
//
// Produces the final string: one line per grid row, each cell rendered to
// a coloured character. Trailing empty cells are trimmed, but we always
// include up to the last non-empty cell's connector column
// (the full 2-col-per-lane width for the active lane count).
// ---------------------------------------------------------------------------

/**
 * Render a single grid row to a coloured string. A completely empty row returns
 * the empty string (the row is NOT dropped) so callers that pair grid rows with
 * an external per-row label list keep a 1:1 index correspondence. `renderGrid`
 * itself drops empty rows for its standalone output (but preserves separator rows).
 */
export function renderGridRow(
  row: readonly (Cell | undefined)[],
  opts: RenderGridOptions = {},
): string {
  // Inter-component separator row — always renders as an empty line.
  if (row[0]?.separator === true) {
    return '';
  }

  // Find the last non-empty cell index
  let lastNonEmpty = -1;
  for (let i = row.length - 1; i >= 0; i--) {
    const cell = row[i];
    if (cell !== undefined && (cell.lines.length > 0 || cell.node !== undefined)) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty < 0) {
    return '';
  }

  // Extend to the next even column boundary (connector col of the current lane)
  // so that connector columns are always present for active lane ranges.
  const colsPerLane = opts.colsPerLane ?? DEFAULT_COLS_PER_LANE;
  const palette =
    (opts.colorize ?? true)
      ? (opts.palette ?? ANSI_MIGRATION_GRAPH_PALETTE)
      : PLAIN_MIGRATION_GRAPH_PALETTE;
  const alphabet = alphabetFor(opts.glyphMode ?? 'unicode');
  const lastLane = Math.floor(lastNonEmpty / colsPerLane);
  const lastConnectorCol = lastLane * colsPerLane + (colsPerLane - 1);
  const renderThrough = Math.max(lastNonEmpty, lastConnectorCol);

  let line = '';
  for (let col = 0; col <= Math.min(renderThrough, row.length - 1); col++) {
    const cell = row[col];
    line += cell === undefined ? ' ' : renderCell(cell, palette, alphabet);
  }
  return line;
}

export function renderGrid(grid: Grid, opts: RenderGridOptions = {}): string {
  const lines: string[] = [];
  for (const row of grid) {
    const isSeparator = row[0]?.separator === true;
    const rendered = renderGridRow(row, opts);
    if (rendered === '' && !isSeparator) {
      // Completely empty non-separator row — skip in standalone output.
      continue;
    }
    lines.push(rendered);
  }
  return lines.join('\n');
}
