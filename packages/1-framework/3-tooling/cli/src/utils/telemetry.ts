import { fileURLToPath } from 'node:url';
import {
  type CommanderOptionShape,
  type CommanderResultShape,
  ensureInstallationId,
  readUserConfig,
  resolveGating,
  runTelemetry,
  type TelemetryRunOutcome,
  type UserConfig,
  userConfigPath,
} from '@internal/cli-telemetry';
import type { Command } from 'commander';
import { version as CLI_VERSION } from '../../package.json' with { type: 'json' };
import { isCI } from './is-ci';

type TelemetryGate =
  | { readonly enabled: true; readonly userConfig: UserConfig }
  | { readonly enabled: false; readonly outcome: TelemetryRunOutcome };

/**
 * Resolve the commander command path from a leaf `Command`, walking up
 * the parent chain. Result is rooted at the program name and ends at
 * the leaf — `['prisma-next', 'migration', 'new']` for
 * `prisma-next migration new …`.
 */
function commandPathFor(actionCommand: Command): string[] {
  const path: string[] = [];
  let cursor: Command | null = actionCommand;
  while (cursor !== null) {
    path.unshift(cursor.name());
    cursor = cursor.parent;
  }
  return path;
}

function commanderOptionSnapshots(actionCommand: Command): CommanderOptionShape[] {
  return actionCommand.options.map((option) => {
    const attributeName = option.attributeName();
    return {
      attributeName,
      longName: option.long ?? null,
      source: actionCommand.getOptionValueSource(attributeName) ?? null,
    };
  });
}

/**
 * Project commander's leaf `Command` into the wire-shape snapshot the
 * telemetry sanitiser consumes. Pure projection — no env, no I/O.
 */
export function commanderSnapshotForTelemetry(actionCommand: Command): CommanderResultShape {
  return {
    commandPath: commandPathFor(actionCommand),
    positionalArgs: actionCommand.args,
    options: commanderOptionSnapshots(actionCommand),
  };
}

function resolveTelemetryGate(): TelemetryGate {
  if (isCI()) {
    return { enabled: false, outcome: { spawned: false, reason: 'ci' } };
  }
  const userConfig = readUserConfig();
  const gating = resolveGating({ env: process.env, config: userConfig });
  if (!gating.enabled) {
    return { enabled: false, outcome: { spawned: false, reason: 'gated-off' } };
  }
  return { enabled: true, userConfig };
}

/**
 * Path to the compiled sender script inside `@internal/cli-telemetry`'s
 * `dist/`. Resolved off this module's `import.meta.url` via the package
 * specifier `@internal/cli-telemetry/sender`, so the consumer pays
 * no attention to internal package layout.
 */
function senderPath(): string {
  return fileURLToPath(new URL(import.meta.resolve('@internal/cli-telemetry/sender')));
}

function fireTelemetry(actionCommand: Command, userConfig: UserConfig): TelemetryRunOutcome {
  return runTelemetry({
    command: commanderSnapshotForTelemetry(actionCommand),
    version: CLI_VERSION,
    projectRoot: process.cwd(),
    senderPath: senderPath(),
    isCI: isCI(),
    env: process.env,
    userConfig,
  });
}

/**
 * preAction-stage entry point. Synchronous by construction: resolve
 * env/CI/user-consent gates (cheap, all in-memory and a single tiny
 * user-config read), then — only when enabled — `fork()` the detached
 * sender script. The forked child loads `prisma-next.config.*` via
 * c12 on its own (see `loadProjectConfig` in cli-telemetry); the
 * parent does no project-config I/O on the command's hot path.
 *
 * Privacy invariant: gate resolution always happens before any project
 * config touches disk. The child loading user TS code is acceptable
 * only because it's gated behind the same resolved-enabled signal.
 */
/**
 * Builds the one-time first-run disclosure. The resolved absolute path to
 * the user-level config file is substituted in so the user can see exactly
 * which file to edit (it must not be confused with `prisma-next.config.ts`).
 * `prisma-next telemetry disable` is named as the primary, friendliest
 * opt-out, alongside the env vars and the config edit.
 */
function firstRunNotice(configPath: string): string {
  return [
    'Prisma Next collects anonymous CLI usage data, enabled by default.',
    "What's collected and why: https://prisma-next.dev/docs/cli/telemetry.",
    'Opt out: run "prisma-next telemetry disable", set DO_NOT_TRACK=1 or',
    `PRISMA_NEXT_DISABLE_TELEMETRY=1, or set "enableTelemetry": false in ${configPath}.`,
  ].join(' ');
}

/**
 * Best-effort first-run disclosure + installationId mint. Runs only on the
 * gating-enabled path. Prints the notice to stderr (never stdout) and mints
 * a persistent id without touching `enableTelemetry`, so the opt-out default
 * stays intact and no unasked-for consent is recorded.
 *
 * Every step is wrapped so an un-writable config dir (or any other failure)
 * never throws and never blocks the command. Returns the minted (or
 * pre-existing) id so the caller can forward it to `runTelemetry` without a
 * redundant disk read. On mint failure it returns `undefined`: the notice may
 * reprint next run, and `runTelemetry` no-ops on the missing id.
 */
function discloseAndMintOnFirstRun(): string | undefined {
  try {
    process.stderr.write(`${firstRunNotice(userConfigPath())}\n`);
  } catch {}
  try {
    return ensureInstallationId();
  } catch {}
  return undefined;
}

/**
 * True when the run is the `telemetry` command (or one of its
 * subcommands). The usage-telemetry preAction fire is exempted for it:
 * it would be absurd for `telemetry disable` to send a usage event before
 * disabling, or for `telemetry status` to mint an id + send while merely
 * reporting state. This is the only command-specific exemption.
 *
 * The check is rooted at the program: the path must be
 * `['prisma-next', 'telemetry', …]`, so it matches the top-level
 * `telemetry` command and its subcommands without matching a hypothetical
 * nested `… telemetry` elsewhere.
 */
function isTelemetryCommand(actionCommand: Command): boolean {
  return commandPathFor(actionCommand)[1] === 'telemetry';
}

export function fireTelemetryFromPreAction(actionCommand: Command): TelemetryRunOutcome {
  if (isTelemetryCommand(actionCommand)) {
    return { spawned: false, reason: 'gated-off' };
  }
  const gate = resolveTelemetryGate();
  if (!gate.enabled) {
    return gate.outcome;
  }
  const storedId = gate.userConfig.installationId;
  if (typeof storedId !== 'string' || storedId.length === 0) {
    const installationId = discloseAndMintOnFirstRun();
    return fireTelemetry(
      actionCommand,
      installationId === undefined ? gate.userConfig : { ...gate.userConfig, installationId },
    );
  }
  return fireTelemetry(actionCommand, gate.userConfig);
}
