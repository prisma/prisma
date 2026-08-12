import { type } from 'arktype';
import type { GlobalFlags } from '../../utils/global-flags';
import type { TerminalUI } from '../../utils/terminal-ui';

/**
 * arktype schema for the structured success document `init --json` writes
 * to stdout (FR1.5). The same shape backs the human-readable outro
 * renderer (FR10), so the two output modes carry identical information.
 *
 * `target` is normalised to the user-facing flag value (`mongodb` rather
 * than the internal `mongo`) so consumers can round-trip the document
 * straight into a follow-up `--target` invocation.
 *
 * The `ok: true` literal is the documented success/error discriminator —
 * see [Style Guide § JSON Semantics](../../../../../../../docs/CLI%20Style%20Guide.md#json-semantics).
 * Error envelopes (`CliErrorEnvelope`) carry `ok: false` so consumers can
 * branch with `if (doc.ok)` without inspecting the rest of the structure.
 */
export const InitOutputSchema = type({
  ok: 'true',
  target: "'postgres'|'mongodb'",
  authoring: "'psl'|'typescript'",
  schemaPath: 'string',
  filesWritten: 'string[]',
  /**
   * FR9.1 — files removed from disk during this run. Populated only on
   * re-init when previously-emitted contract artifacts (`contract.json`,
   * `contract.d.ts`, `ops.json`, `migration.json`) were left behind by an
   * earlier run. Empty on a green-field init.
   */
  filesDeleted: 'string[]',
  packagesInstalled: {
    skipped: 'boolean',
    deps: 'string[]',
    devDeps: 'string[]',
  },
  contractEmitted: 'boolean',
  nextSteps: 'string[]',
  warnings: 'string[]',
});

export type InitOutput = typeof InitOutputSchema.infer;

/**
 * Serialises the output document for `--json`. Sorted keys are not enforced
 * — `JSON.stringify` preserves insertion order, and the schema field order
 * is the documented order, which matches what users will see when they
 * `jq .` the result.
 */
export function formatInitJson(output: InitOutput): string {
  return JSON.stringify(output, null, 2);
}

/**
 * Renders the human-readable outro on stderr (FR10.1). Re-uses the same
 * data structure as the JSON output so the two stay in lock-step.
 *
 * Warnings come before "Next steps" because they describe state the user
 * needs to be aware of before acting on the next-steps list.
 */
export function renderInitOutro(ui: TerminalUI, output: InitOutput, flags: GlobalFlags): void {
  if (flags.quiet || flags.json) {
    return;
  }

  for (const warning of output.warnings) {
    ui.warn(warning);
  }

  const lines: string[] = [];
  lines.push(`Target:    ${output.target}`);
  lines.push(`Authoring: ${output.authoring}`);
  lines.push(`Schema:    ${output.schemaPath}`);
  lines.push('');
  lines.push('Files written:');
  for (const file of output.filesWritten) {
    lines.push(`  • ${file}`);
  }

  if (output.filesDeleted.length > 0) {
    lines.push('');
    lines.push('Files deleted (stale contract artifacts):');
    for (const file of output.filesDeleted) {
      lines.push(`  • ${file}`);
    }
  }

  if (!output.packagesInstalled.skipped) {
    lines.push('');
    lines.push('Packages installed:');
    for (const dep of output.packagesInstalled.deps) {
      lines.push(`  • ${dep}`);
    }
    for (const dep of output.packagesInstalled.devDeps) {
      lines.push(`  • ${dep} (dev)`);
    }
  }

  lines.push('');
  lines.push('Next steps:');
  for (const step of output.nextSteps) {
    lines.push(`  ${step}`);
  }

  ui.note(lines.join('\n'), 'Done');
}

/**
 * Builds the `nextSteps` array from the resolved scaffold state. Steps are
 * ordered by the workflow a user needs to follow: configure connection →
 * (emit if not yet done) → run a starter query → docs / agent skill.
 *
 * The strings are stable and human-readable; agents wanting to act on them
 * should match on substrings (e.g. "DATABASE_URL") rather than exact text,
 * since copy may evolve.
 */
export function buildNextSteps(options: {
  readonly target: 'postgres' | 'mongodb';
  readonly contractEmitted: boolean;
  readonly emitCommand: string;
  readonly schemaPath: string;
  /**
   * Whether the project-level Prisma Next skills install actually ran
   * and succeeded during this `init`. When false (the user passed
   * `--no-skill`, so the install was skipped), the
   * "registered with your agent runtime" step is omitted — the skip is
   * already surfaced in the warnings array with a manual-install hint.
   */
  readonly skillRegistered: boolean;
}): string[] {
  const steps: string[] = [];
  let stepNumber = 1;
  const push = (text: string): void => {
    steps.push(`${stepNumber}. ${text}`);
    stepNumber += 1;
  };
  push('Set DATABASE_URL in your environment (export it or add it to .env).');
  if (!options.contractEmitted) {
    push(`Emit the contract: \`${options.emitCommand}\``);
    push(`Edit your schema at ${options.schemaPath}, then re-run the emit command.`);
  } else {
    push(`Edit your schema at ${options.schemaPath}, then re-run \`${options.emitCommand}\`.`);
  }
  push('Open prisma-next.md for a quick reference on how to write your first typed query.');
  if (options.skillRegistered) {
    push(
      'Prisma Next skills are registered with your agent runtime — open the project in your IDE and ask the agent to add a model, run a query, or plan a migration.',
    );
  }
  return steps;
}
