/**
 * gallery-cells — the oracle primitive for the scenario gallery.
 *
 * `Row{glyphs, name?, colours}` + `renderCells(rows, ctx) → string` is the
 * ONLY rendering logic the gallery runs for hand-authored golden pictures.
 * It never calls the real layout or occlusion renderer.
 *
 * Row format:
 *   - Node/migration row: [glyphs, name, colours]
 *   - Pure connector row: [glyphs, colours]
 *
 * Where:
 *   glyphs   = structural characters only (│ ╭ ╮ ╰ ╯ ─ ↑ ↓ ⟲ ○ ∅ + spaces)
 *   name     = a contract hash or migration name that exists in the scenario input
 *   colours  = one code per glyph character (colours.length === glyphs.length)
 *
 */

import { createColors } from 'colorette';

// Force-colour seam — always emits ANSI regardless of NO_COLOR.
const colours = createColors({ useColor: true });

// ---------------------------------------------------------------------------
// Colour enum — the set of roles a cell can carry.
// ---------------------------------------------------------------------------
export const Colour = {
  /** Neutral: no SGR applied (plain text). Used for label text and spaces. */
  neutral: 'neutral',
  /** Dim grey: off-path gutter or column-0 neutral lane. */
  dim: 'dim',
  /** Bright green: on-path cell (greenBright, SGR 92). */
  green: 'green',
  /** Rotating lane colours for lanes ≥ 1 (by lane index). */
  lane1: 'lane1',
  lane2: 'lane2',
  lane3: 'lane3',
  lane4: 'lane4',
  lane5: 'lane5',
  lane6: 'lane6',
} as const;

export type Colour = (typeof Colour)[keyof typeof Colour];

// ---------------------------------------------------------------------------
// Row — structural glyphs + optional identity + per-glyph colours.
// ---------------------------------------------------------------------------
export interface Row {
  /** Structural characters only (no label text). */
  readonly glyphs: string;
  /** Contract hash or migration name; undefined for pure connector rows. */
  readonly name: string | undefined;
  /** One colour code per glyph character; length must equal glyphs.length. */
  readonly colours: string;
}

// ---------------------------------------------------------------------------
// ScenarioInput — the explicit graph input each golden is anchored to.
// ---------------------------------------------------------------------------

/**
 * How a migration edge relates its `from` and `to` in the forward DAG.
 *
 * - `forward`  — `to` is a new/deeper node than `from` (the default).
 * - `rollback` — `to` is a forward-ancestor of `from` (the edge undoes work).
 * - `self-loop` — `from === to` (a no-op re-apply, e.g. `reapply_noop`).
 *
 * The real renderer infers this from topology; we record it on the input only
 * for real-world scenarios (e.g. `showcase`) so the golden documents the shape
 * it was extracted from. Synthetic scenarios omit it.
 */
export type ScenarioMigrationKind = 'forward' | 'rollback' | 'self-loop';

export interface ScenarioMigration {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  /**
   * Number of operations the migration performs (from the fixture's `ops.json`).
   * Display-only metadata; synthetic scenarios omit it.
   */
  readonly ops?: number;
  /**
   * Forward / rollback / self-loop classification carried from the source
   * fixture. Display-only metadata; synthetic scenarios omit it (the renderer
   * infers the kind from topology).
   */
  readonly kind?: ScenarioMigrationKind;
}

/**
 * Per-contract overlay metadata mirroring what `migration graph` draws on a
 * node: user refs in parens (`(prod)`) and reserved sigil markers
 * (`@contract`, `@db`).
 *
 * Keyed by the contract identifier (a hash string from `contracts`). Only the
 * contracts that actually carry an overlay appear; the rest are omitted.
 */
export interface ScenarioContractAnnotation {
  /** User refs pointing at this contract, e.g. `['prod']` → drawn `(prod)`. */
  readonly refs?: readonly string[];
  /** True when this contract is the app's working contract (`@contract`). */
  readonly contractMarker?: boolean;
  /** True when this contract is the live DB marker (`@db`). */
  readonly dbMarker?: boolean;
}

export interface ScenarioInput {
  /** All contract hashes/identifiers in the scenario, including '∅'. */
  readonly contracts: readonly string[];
  /** All migration edges (name carries 3-digit prefix, oldest = '000_'). */
  readonly migrations: readonly ScenarioMigration[];
  /**
   * Optional per-contract overlay metadata (refs + reserved markers), keyed by
   * contract identifier. Present for real-world scenarios (e.g. `showcase`);
   * omitted for synthetic scenarios that carry no refs/markers.
   */
  readonly annotations?: Readonly<Record<string, ScenarioContractAnnotation>>;
}

// ---------------------------------------------------------------------------
// RenderContext — passed to renderCells so it can look up names.
// ---------------------------------------------------------------------------
export interface RenderContext {
  readonly input: ScenarioInput;
  /** Migration names on the highlighted route; empty for flat strategy. */
  readonly onPath: readonly string[];
}

// ---------------------------------------------------------------------------
// Colour → SGR mapping.
// Rotating lane palette matches the lane colour palette:
//   lane1 = white, lane2 = cyan, lane3 = yellow, lane4 = blueBright,
//   lane5 = magenta, lane6 = green (normal, SGR 32)
// (lane N maps to colour N: lane1=`1`, … lane6=`6`)
// We avoid red (reads as an error). The lane6 green is the normal green (SGR 32);
// the on-path highlight (Colour.green) is the brighter greenBright (SGR 92).
// ---------------------------------------------------------------------------
function applyColour(colour: Colour, glyph: string): string {
  switch (colour) {
    case Colour.neutral:
      return glyph;
    case Colour.dim:
      return colours.dim(glyph);
    case Colour.green:
      return colours.greenBright(glyph);
    case Colour.lane1:
      return colours.white(glyph);
    case Colour.lane2:
      return colours.cyan(glyph);
    case Colour.lane3:
      return colours.yellow(glyph);
    case Colour.lane4:
      return colours.blueBright(glyph);
    case Colour.lane5:
      return colours.magenta(glyph);
    case Colour.lane6:
      return colours.green(glyph);
  }
}

// ---------------------------------------------------------------------------
// renderCells — trivial serialiser: colour each glyph, look up name if
// present, join cells, join rows.
//
// For each row:
//   - Each glyph character is coloured individually by its code.
//   - If the row has a name, it must exist in ctx.input.contracts or
//     ctx.input.migrations. If not found, an error is thrown (golden/input
//     mismatch). The looked-up name is appended after a two-space gap,
//     in neutral colour (labels are display-only, not asserted).
//   - Connector rows (no name) render just their coloured glyphs.
//
// This is the ONLY rendering logic the gallery runs for goldens.
// ---------------------------------------------------------------------------
export function renderCells(rows: readonly Row[], ctx: RenderContext): string {
  return rows
    .map((row) => {
      const { glyphs, colours: codes, name } = row;
      let line = '';
      for (let i = 0; i < glyphs.length; i++) {
        const ch = glyphs[i] ?? '';
        const code = codes[i] ?? '.';
        line += applyColour(colourOf(code), ch);
      }
      if (name !== undefined) {
        const inContracts = ctx.input.contracts.includes(name);
        const inMigrations = ctx.input.migrations.some((m) => m.name === name);
        if (!inContracts && !inMigrations) {
          throw new Error(
            `Golden name "${name}" not found in scenario input. ` +
              `Contracts: [${ctx.input.contracts.join(', ')}]. ` +
              `Migrations: [${ctx.input.migrations.map((m) => m.name).join(', ')}].`,
          );
        }
        line += '  ' + name;
      }
      return line;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// parseGrid — ergonomic authoring → Row[]
//
// Accepts an array of tuples, one per row:
//   [glyphs, colours]         → pure connector row (no identity)
//   [glyphs, name, colours]   → node or migration row
//
// Discrimination: a 2-element tuple is always [glyphs, colours]; a 3-element
// tuple is always [glyphs, name, colours].
//
// Colour code map (one character per glyph character):
//   '.' = neutral (no SGR)
//   '1' = lane1 (white)     ← flat graphs: lane N = colour N
//   '2' = lane2 (cyan)
//   '3' = lane3 (yellow)
//   '4' = lane4 (blueBright)
//   '5' = lane5 (magenta)
//   '6' = lane6 (green, normal SGR 32)
//   'g' = green (on-path, greenBright SGR 92)   ← focus graphs only
//   'd' = dim (off-path)    ← focus graphs only
//   'b' = back-arc lane colour (dim — same rendering as 'd')
//
// Validates: colours.length === glyphs.length (throws on mismatch).
// ---------------------------------------------------------------------------
function colourOf(code: string): Colour {
  switch (code) {
    case '.':
      return Colour.neutral;
    case 'd':
      return Colour.dim;
    case 'g':
      return Colour.green;
    case '1':
      return Colour.lane1;
    case '2':
      return Colour.lane2;
    case '3':
      return Colour.lane3;
    case '4':
      return Colour.lane4;
    case '5':
      return Colour.lane5;
    case '6':
      return Colour.lane6;
    case 'b':
      return Colour.dim;
    default:
      return Colour.neutral;
  }
}

type GridTuple =
  | readonly [glyphs: string, colours: string]
  | readonly [glyphs: string, name: string, colours: string];

function parseRowTuple(tuple: GridTuple): Row {
  if (tuple.length === 2) {
    const [glyphs, colourStr] = tuple;
    if (colourStr.length !== glyphs.length) {
      throw new Error(
        `parseGrid: colours.length (${colourStr.length}) !== glyphs.length (${glyphs.length}) for connector row "${glyphs}"`,
      );
    }
    return { glyphs, name: undefined, colours: colourStr };
  }
  const [glyphs, name, colourStr] = tuple;
  if (colourStr.length !== glyphs.length) {
    throw new Error(
      `parseGrid: colours.length (${colourStr.length}) !== glyphs.length (${glyphs.length}) for row "${glyphs}" name="${name}"`,
    );
  }
  return { glyphs, name, colours: colourStr };
}

export function parseGrid(tuples: ReadonlyArray<GridTuple>): Row[] {
  return tuples.map(parseRowTuple);
}
