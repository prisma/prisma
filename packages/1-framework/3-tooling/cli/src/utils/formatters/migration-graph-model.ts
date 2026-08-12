/**
 * Data structures for the line/plane/occlusion migration-graph renderer.
 *
 * A _line_ is the primitive. Each migration edge becomes a routed line that
 * carries its identity. Cells hold an ordered (z) set of lines; the topmost
 * plane wins and is drawn; lower planes are occluded.
 */

// ---------------------------------------------------------------------------
// Directions — which arms a line occupies in a cell.
// ---------------------------------------------------------------------------
export type Direction = 'up' | 'down' | 'left' | 'right';

// ---------------------------------------------------------------------------
// PathRole — whether this line is on-path or off-path in focus mode.
// In flat mode all lines have role = undefined.
// ---------------------------------------------------------------------------
export type PathRole = 'on-path' | 'off-path';

// ---------------------------------------------------------------------------
// LineRef — identity carried into every cell the line touches.
// ---------------------------------------------------------------------------
export interface LineRef {
  readonly migrationHash: string;
  readonly dirName: string;
  readonly lane: number;
  readonly role: PathRole | undefined;
}

// ---------------------------------------------------------------------------
// NodeRef — identity of a contract node in the grid.
// ---------------------------------------------------------------------------
export interface NodeRef {
  readonly contractHash: string;
  readonly isEmpty: boolean;
  /** Lane index; used to pick the node's colour in flat mode. */
  readonly lane: number;
  /** In focus mode: 'on-path' (green) or 'off-path' (dim). undefined in flat mode. */
  readonly role: PathRole | undefined;
}

// ---------------------------------------------------------------------------
// CellLine — one line's presence in one cell.
//
// `selfLoop` marks a self-edge (a migration whose from === to). It renders as
// the ⟲ glyph and is modelled separately from `directions` because a self-loop
// is not one of the four cardinal arms — `Direction` stays honestly up|down|
// left|right.
// ---------------------------------------------------------------------------
export interface CellLine {
  readonly line: LineRef;
  readonly directions: ReadonlySet<Direction>;
  readonly plane: number;
  readonly selfLoop?: boolean;
  /**
   * Marks the arrowhead where a routed back-arc lands into its target node
   * (the connector cell immediately right of the node). Renders as `◂` instead
   * of the box-drawing glyph for its directions.
   */
  readonly landingArrow?: boolean;
}

// ---------------------------------------------------------------------------
// Cell — one position in the grid.
//
// `separator` marks an inter-component blank-line row. When the first cell in
// a row has `separator: true`, the row renders as an empty line (the renderGrid
// blank-separator pass-through).
// ---------------------------------------------------------------------------
export interface Cell {
  readonly node?: NodeRef;
  readonly lines: readonly CellLine[];
  readonly separator?: boolean;
}

// ---------------------------------------------------------------------------
// Grid — the full rendered layout (rows × columns, row 0 = top of display).
// ---------------------------------------------------------------------------
export type Grid = readonly (readonly Cell[])[];

// ---------------------------------------------------------------------------
// GridOptions — configurable geometry.
// ---------------------------------------------------------------------------

/** Default number of grid columns allocated per lane (one rail + one connector). */
export const DEFAULT_COLS_PER_LANE = 2;

export interface GridOptions {
  readonly colsPerLane?: number;
}

// ---------------------------------------------------------------------------
// Highlight — focus-mode input.
//
// `flat` (the default) → trunk-on-top z-order, lane-rotation colour.
// `focus` → on-path-on-top z-order; the migration names in `onPath` are the
// chosen route. Lines whose migration is in `onPath` get role 'on-path' (green,
// continuous, topmost plane); every other line is 'off-path' (dim, yields).
// ---------------------------------------------------------------------------
export interface Highlight {
  readonly mode: 'flat' | 'focus';
  readonly onPath: ReadonlySet<string>;
}
