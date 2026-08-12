/**
 * golden-pipeline — asserts that the real pipeline reproduces each hand-authored
 * golden's graph structure and colour (labels stripped from both sides).
 */

import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import { describe, expect, it } from 'vitest';
import { buildGrid } from '../../../src/utils/formatters/migration-graph-grid-layout';
import type { Highlight } from '../../../src/utils/formatters/migration-graph-model';
import { renderGrid } from '../../../src/utils/formatters/migration-graph-occlusion-render';
import { buildMigrationGraphRows } from '../../../src/utils/formatters/migration-graph-rows';
import { renderCells } from './gallery-cells';
import type { ScenarioGolden } from './gallery-goldens';
import { GOLDENS, goldenId } from './gallery-goldens';
import { BACKLINK_GOLDENS } from './gallery-goldens-backlink';
import { KNOWN_BROKEN_GOLDENS } from './gallery-goldens-known-broken';

// ---------------------------------------------------------------------------
// ANSI constants (biome rejects regex literals with control chars, so use strings)
// ---------------------------------------------------------------------------
const GREEN_BRIGHT = '\x1b[92m';
const ESC = '\x1b';

// ---------------------------------------------------------------------------
// The special sentinel used in golden inputs for the baseline/empty contract.
// The golden files use '∅' as the contract identifier; the real pipeline uses
// EMPTY_CONTRACT_HASH ('empty'). We translate when building graphs.
// ---------------------------------------------------------------------------
const GOLDEN_EMPTY_MARKER = '∅';

// ---------------------------------------------------------------------------
// goldenInputToGraph — translate a ScenarioInput into a real MigrationGraph.
//
// Contract identifiers from the golden (e.g. '∅', 'root', 'trunk') become
// node hashes directly. '∅' is translated to EMPTY_CONTRACT_HASH so the
// real pipeline's empty-contract handling kicks in correctly.
//
// Migration names (e.g. '000_init') become migrationHash values. The real
// topology classifier (classifyMigrationGraphTopology) determines forward vs
// rollback by examining the graph structure — a migration whose `to` is an
// ancestor in the forward DAG will be classified as rollback. We do not need
// to tell the graph type anything about forward/rollback; it infers it.
//
// The MigrationGraph type requires:
//   nodes:           Set of all contract hashes
//   forwardChain:    Map from `from` → MigrationEdge[]  (all edges, both forward and rollback)
//   reverseChain:    Map from `to` → MigrationEdge[]
//   migrationByHash: Map from migrationHash → MigrationEdge
// ---------------------------------------------------------------------------
function goldenInputToGraph(golden: ScenarioGolden): MigrationGraph {
  const { input } = golden;

  function translateHash(id: string): string {
    return id === GOLDEN_EMPTY_MARKER ? EMPTY_CONTRACT_HASH : id;
  }

  const nodes = new Set<string>();
  const forwardChain = new Map<string, MigrationEdge[]>();
  const reverseChain = new Map<string, MigrationEdge[]>();
  const migrationByHash = new Map<string, MigrationEdge>();

  for (const contractId of input.contracts) {
    nodes.add(translateHash(contractId));
  }

  for (const migration of input.migrations) {
    const from = translateHash(migration.from);
    const to = translateHash(migration.to);
    const migrationHash = migration.name;

    nodes.add(from);
    nodes.add(to);

    const edge: MigrationEdge = {
      from,
      to,
      migrationHash,
      dirName: migration.name,
      createdAt: '2026-06-07T00:00:00.000Z',
      invariants: [],
    };

    migrationByHash.set(migrationHash, edge);

    const fwdBucket = forwardChain.get(from);
    if (fwdBucket) fwdBucket.push(edge);
    else forwardChain.set(from, [edge]);

    const revBucket = reverseChain.get(to);
    if (revBucket) revBucket.push(edge);
    else reverseChain.set(to, [edge]);
  }

  return { nodes, forwardChain, reverseChain, migrationByHash };
}

// ---------------------------------------------------------------------------
// renderReal — run the full production pipeline for a golden.
//
// For flat goldens: normal mode (no edge annotations).
// For focus goldens: path-highlight mode with edgeAnnotationsByHash built from
//   golden.onPath (marking those migration names as on-path, the rest as off-path).
//   This mirrors how migrate --show calls the renderer.
// ---------------------------------------------------------------------------
function renderReal(golden: ScenarioGolden): string {
  const graph = goldenInputToGraph(golden);
  const rowModel = buildMigrationGraphRows(graph, {});

  const highlight: Highlight =
    golden.strategy === 'focus'
      ? { mode: 'focus', onPath: new Set(golden.onPath) }
      : { mode: 'flat', onPath: new Set() };
  const grid = buildGrid(rowModel, {}, highlight);
  return renderGrid(grid, { colorize: true });
}

// ---------------------------------------------------------------------------
// structureOf — strip labels from a rendered string, keeping only the coloured
// graph columns (the leading run of graph glyphs + spaces + their ANSI).
//
// Each rendered line looks like:
//   <graph glyphs with ANSI>  <label text>
//                             ↑ two-space gap then the label
//
// The label is always a migration name or contract name appended after the
// graph gutter, separated by at least 2 spaces. For the real renderer the
// label includes dirName + hash data columns. For the golden renderCells
// output the label is exactly 2 spaces + the name.
//
// Strategy: strip any text after the last "printable glyph column" boundary.
// More precisely, scan each line left-to-right ignoring ANSI codes; the
// "graph columns" run ends when we see 2+ consecutive spaces (the gap) after
// at least one non-space structural glyph was seen.
//
// We then compare the stripped version from both sides.
//
// To make diffs legible, we produce a normalised per-line representation:
// for each line, emit one entry per coloured glyph run. Format:
//   <col-class>:<visible-text>
// where col-class is one of: green, dim, lane1..4, neutral
// This converts the raw ANSI string into a structured text that survives a
// line-by-line diff.
// ---------------------------------------------------------------------------

/**
 * Strip trailing label from a single rendered line, returning only the
 * leading graph-column portion.
 *
 * The graph gutter ends at the first run of 2+ consecutive visual spaces
 * that follows at least one structural glyph. ANSI codes are invisible.
 */
function stripLineLabel(line: string): string {
  // Split line into [ansiCode, visibleChar] tokens.
  // Accumulate visual text; when we see 2+ spaces after a glyph, cut there.
  let result = '';
  let pendingANSI = '';
  let spaceRun = 0;
  let seenGlyph = false;

  let i = 0;
  while (i < line.length) {
    if (line[i] === ESC) {
      // Collect entire escape sequence
      const end = line.indexOf('m', i);
      if (end === -1) {
        // Malformed — keep and advance
        pendingANSI += line[i];
        i++;
        continue;
      }
      pendingANSI += line.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    const ch = line[i] ?? '';
    i++;

    if (ch === ' ') {
      spaceRun++;
      if (seenGlyph && spaceRun >= 2) {
        // Label gap found — truncate here
        break;
      }
      // Accumulate spaces (part of gutter, e.g. '│ ')
      result += pendingANSI + ch;
      pendingANSI = '';
    } else {
      // Non-space structural glyph
      seenGlyph = true;
      spaceRun = 0;
      result += pendingANSI + ch;
      pendingANSI = '';
    }
  }

  return result;
}

/**
 * Classify an ANSI SGR code into a readable label.
 * Uses the same mapping as gallery-cells.ts.
 */
function classifyANSICode(code: string): string {
  // GREEN_BRIGHT = \x1b[92m
  if (code === '\x1b[92m') return 'green';
  // DIM = \x1b[2m
  if (code === '\x1b[2m') return 'dim';
  // Lane colours (white=37, cyan=36, yellow=33, blueBright=94, magenta=35, green=32)
  if (code === '\x1b[37m') return 'lane1';
  if (code === '\x1b[36m') return 'lane2';
  if (code === '\x1b[33m') return 'lane3';
  if (code === '\x1b[94m') return 'lane4';
  if (code === '\x1b[35m') return 'lane5';
  if (code === '\x1b[32m') return 'lane6';
  // Reset or unknown
  if (code === '\x1b[0m' || code === '\x1b[22m') return 'reset';
  return 'other';
}

/**
 * Convert a rendered (ANSI) line to a normalised token sequence for diffing.
 * Only the graph-column portion (after stripLineLabel) is used.
 *
 * Output: "green:│ dim:│ ↑" style string — one token per coloured run.
 */
function normaliseLine(ansiLine: string): string {
  const stripped = stripLineLabel(ansiLine);

  // Build token list: [colourClass, visibleText]
  const tokens: Array<{ colour: string; text: string }> = [];
  let currentColour = 'neutral';
  let currentText = '';

  let i = 0;
  while (i < stripped.length) {
    if (stripped[i] === ESC) {
      const end = stripped.indexOf('m', i);
      if (end === -1) {
        currentText += stripped[i];
        i++;
        continue;
      }
      const code = stripped.slice(i, end + 1);
      i = end + 1;
      const cls = classifyANSICode(code);
      if (cls === 'reset') {
        if (currentText.length > 0) {
          tokens.push({ colour: currentColour, text: currentText });
          currentText = '';
        }
        currentColour = 'neutral';
      } else if (cls !== 'other') {
        if (currentText.length > 0) {
          tokens.push({ colour: currentColour, text: currentText });
          currentText = '';
        }
        currentColour = cls;
      }
      // 'other' codes (bold etc) don't change our colour classification
    } else {
      currentText += stripped[i];
      i++;
    }
  }
  if (currentText.length > 0) {
    tokens.push({ colour: currentColour, text: currentText });
  }

  // Merge adjacent tokens with the same colour
  const merged: Array<{ colour: string; text: string }> = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last !== undefined && last.colour === token.colour) {
      last.text += token.text;
    } else {
      merged.push({ colour: token.colour, text: token.text });
    }
  }

  // Strip trailing whitespace from the last token (normalises away the
  // first-space-of-label-gap artifact that stripLineLabel includes for golden
  // lines, and any renderer padding). Tokens that become empty are dropped.
  while (merged.length > 0) {
    const last = merged[merged.length - 1]!;
    const trimmed = last.text.trimEnd();
    if (trimmed.length === 0) {
      merged.pop();
    } else {
      last.text = trimmed;
      break;
    }
  }

  return merged.map((t) => `${t.colour}:${JSON.stringify(t.text)}`).join(' ');
}

/**
 * Convert a full rendered string to a normalised per-line structure+colour
 * representation. Each entry is a normalised line token sequence.
 *
 * This is the form we compare in assertions — labels stripped, colour
 * structure preserved in a diffable format.
 */
function structureOf(rendered: string): string[] {
  return rendered.split('\n').map(normaliseLine);
}

// ---------------------------------------------------------------------------
// goldenExpected — render the hand-authored golden rows to a string, then
// apply the same structureOf transformation.
// ---------------------------------------------------------------------------
function goldenExpected(golden: ScenarioGolden): string[] {
  const ctx = {
    input: golden.input,
    onPath: golden.onPath,
  };
  const rendered = renderCells(golden.rows, ctx);
  return structureOf(rendered);
}

// ---------------------------------------------------------------------------
// Green-only-on-path invariant checker.
//
// For a focus golden: verify that GREEN_BRIGHT appears only on rows/cells
// that belong to on-path migrations, never on off-path cells.
//
// Strategy: scan each line of the real output. If GREEN_BRIGHT appears on
// a line that is not an on-path edge row or an on-path node row, that is a
// violation. We can't perfectly identify which line is which without
// re-parsing the whole renderer output, so we use a simpler approach:
// check that the total set of lines containing GREEN_BRIGHT is bounded.
//
// For a more direct invariant: assert that no line contains BOTH green and
// a string that places it clearly off-path. Actually the simplest correct
// check is: parse the rendered string's ANSI segments and count green vs
// non-green. Instead, we assert the raw invariant:
// "greenBright appears only in lines associated with on-path items".
//
// We detect this by comparing the set of lines with GREEN_BRIGHT in
// the real output to what we'd expect from on-path-only colouring.
// If any connector/arc row that clearly belongs to an off-path edge
// contains GREEN_BRIGHT, we report it.
//
// For our RED baseline test, this invariant will often fail — that's fine.
// We report it but don't block the overall test from reaching the main
// structure comparison.
// ---------------------------------------------------------------------------
function assertGreenOnlyOnPath(golden: ScenarioGolden, rendered: string): void {
  const lines = rendered.split('\n');
  for (const line of lines) {
    if (!line.includes(GREEN_BRIGHT)) continue;
    // This line has green — it should only be on-path related.
    // (We do a best-effort check: if we can find the migration name for this
    // line and it's off-path, that's a violation.)
    // For now we just collect violations without blocking.
  }

  // Actual assertion: green must NOT appear on a line that is purely off-path.
  // We check: any line containing GREEN_BRIGHT must also NOT contain an off-path
  // migration name (a name in input.migrations but not in golden.onPath).
  const offPathNames = golden.input.migrations
    .map((m) => m.name)
    .filter((name) => !golden.onPath.includes(name));

  const violations: string[] = [];
  for (const line of lines) {
    if (!line.includes(GREEN_BRIGHT)) continue;
    for (const offPathName of offPathNames) {
      // The real renderer appends dirName (migration name) to its edge rows.
      // A line that contains the off-path migration's name AND green is a bleed.
      if (line.includes(offPathName)) {
        violations.push(
          `GREEN_BRIGHT on off-path edge "${offPathName}": ${JSON.stringify(line.slice(0, 80))}`,
        );
      }
    }
  }

  expect(
    violations,
    `[${goldenId(golden)}] Green-only-on-path invariant violated:\n${violations.join('\n')}`,
  ).toEqual([]);
}

// ---------------------------------------------------------------------------
// The test suite
// ---------------------------------------------------------------------------

const ALL_GOLDENS: readonly ScenarioGolden[] = [...GOLDENS, ...BACKLINK_GOLDENS];

describe('golden-pipeline: render(input) === golden (structure + colour, labels stripped)', () => {
  for (const golden of ALL_GOLDENS) {
    const id = goldenId(golden);
    describe(id, () => {
      it('structure + colour match (labels stripped)', () => {
        const real = renderReal(golden);
        const expected = goldenExpected(golden);
        const actual = structureOf(real);

        // Compare line by line for legible diffs
        expect(actual, `[${id}] structure+colour mismatch (each line: colour:text tokens)`).toEqual(
          expected,
        );
      });

      if (golden.strategy === 'focus') {
        it('green-only-on-path invariant', () => {
          const real = renderReal(golden);
          assertGreenOnlyOnPath(golden, real);
        });
      }
    });
  }
});

// Layout bugs the showcase fixture exposed. Each golden encodes the TARGET shape
// and `it.fails` until the renderer is fixed (then move it to GOLDENS). See
// gallery-goldens-known-broken.ts for the per-bug root-cause notes.
if (KNOWN_BROKEN_GOLDENS.length > 0) {
  describe('golden-pipeline: known-broken layout (target shape; renderer not yet fixed)', () => {
    for (const golden of KNOWN_BROKEN_GOLDENS) {
      const id = goldenId(golden);
      it.fails(`${id} — structure + colour match`, () => {
        const real = renderReal(golden);
        const expected = goldenExpected(golden);
        const actual = structureOf(real);
        expect(actual, `[${id}] structure+colour mismatch (each line: colour:text tokens)`).toEqual(
          expected,
        );
      });
    }
  });
}

// (showcase real-world golden shelved to branch `showcase-golden-shelf` — it
// needs back-arc convergence from the render-redesign-geometry slice.)
