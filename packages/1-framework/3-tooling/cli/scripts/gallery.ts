#!/usr/bin/env tsx

/**
 * Render hand-authored golden fixtures in colour to the terminal.
 *
 * Usage:
 *   pnpm --filter @internal/cli gallery                        # all goldens
 *   pnpm --filter @internal/cli gallery merge-2                # all of one scenario
 *   pnpm --filter @internal/cli gallery merge-2:flat           # one strategy
 *   pnpm --filter @internal/cli gallery merge-2:focus          # all focus variants
 *   pnpm --filter @internal/cli gallery merge-2:focus:alt      # one specific golden
 *
 * Filter syntax: scenario · scenario:strategy · scenario:strategy:variant
 *
 * Serialises hand-authored {glyph,colour} goldens via renderCells — the oracle
 * foundation. No real renderer is invoked.
 */

import { type RenderContext, renderCells } from '../test/utils/formatters/gallery-cells';
import { GOLDENS, goldenId, type ScenarioGolden } from '../test/utils/formatters/gallery-goldens';
import { BACKLINK_GOLDENS } from '../test/utils/formatters/gallery-goldens-backlink';
import { KNOWN_BROKEN_GOLDENS } from '../test/utils/formatters/gallery-goldens-known-broken';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const UNDERLINE = '\x1b[4m';
const DIM_ANSI = '\x1b[2m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';

function header(golden: ScenarioGolden): string {
  const id = goldenId(golden);
  const strategyColour = golden.strategy === 'focus' ? YELLOW : MAGENTA;
  const title = `${BOLD}${UNDERLINE}${CYAN}${id}${RESET}  ${DIM_ANSI}${golden.description}${RESET}`;
  const strategyLabel = `${strategyColour}${golden.strategy}${RESET}`;
  const variantLabel =
    golden.variant !== undefined ? `  variant: ${BOLD}${golden.variant}${RESET}` : '';
  return `\n${title}\n${DIM_ANSI}strategy:${RESET} ${strategyLabel}${variantLabel}\n`;
}

function separator(): string {
  return `${DIM_ANSI}${'─'.repeat(72)}${RESET}`;
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const rawArgs = process.argv.slice(2);
const filterArg = rawArgs.find((a) => !a.startsWith('--'))?.trim();

// Three-level filter: scenario · scenario:strategy · scenario:strategy:variant
let filterScenario: string | undefined;
let filterStrategy: string | undefined;
let filterVariant: string | undefined;

if (filterArg !== undefined && filterArg !== '') {
  const parts = filterArg.split(':');
  filterScenario = parts[0];
  filterStrategy = parts[1];
  filterVariant = parts[2];
}

function matchesFilter(golden: ScenarioGolden): boolean {
  if (filterScenario !== undefined && golden.scenario !== filterScenario) return false;
  if (filterStrategy !== undefined && golden.strategy !== filterStrategy) return false;
  if (filterVariant !== undefined && golden.variant !== filterVariant) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Goldens mode — renderCells only, no real renderer
// ---------------------------------------------------------------------------
function runGoldensMode(): void {
  let count = 0;

  const allGoldens = [...GOLDENS, ...BACKLINK_GOLDENS, ...KNOWN_BROKEN_GOLDENS];

  for (const golden of allGoldens) {
    if (!matchesFilter(golden)) continue;

    process.stdout.write(`\n${separator()}\n`);
    process.stdout.write(header(golden));

    const ctx: RenderContext = { input: golden.input, onPath: golden.onPath };
    const rendered = renderCells(golden.rows, ctx);
    process.stdout.write(rendered);
    process.stdout.write('\n');
    count++;
  }

  process.stdout.write(`\n${separator()}\n`);

  if (count === 0) {
    process.stdout.write(
      `${DIM_ANSI}No goldens matched filter: ${JSON.stringify(filterArg)}${RESET}\n\n`,
    );
    process.exit(1);
  }

  const summary =
    filterArg !== undefined
      ? `[goldens] Rendered ${count} golden(s) for filter: ${JSON.stringify(filterArg)}`
      : `[goldens] Rendered ${count} hand-authored golden(s)`;

  process.stdout.write(`\n${DIM_ANSI}${summary}${RESET}\n`);
  process.stdout.write(
    `${DIM_ANSI}Gallery runs renderCells only — no real renderer invoked.${RESET}\n\n`,
  );
}

runGoldensMode();
