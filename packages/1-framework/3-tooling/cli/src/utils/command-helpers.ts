import { readFile } from 'node:fs/promises';
import type { ControlTargetDescriptor } from '@internal/framework-components/control';
import { hasMigrations } from '@internal/framework-components/control';
import type { NoInvariantPathStructuralEdge } from '@internal/migration-tools/errors';
import type { MigrationEdge, MigrationGraph } from '@internal/migration-tools/graph';
import type { PathDecision } from '@internal/migration-tools/migration-graph';
import { APP_SPACE_ID, spaceMigrationDirectory } from '@internal/migration-tools/spaces';
import { ifDefined } from '@internal/utils/defined';
import type { Command } from 'commander';
import { relative, resolve } from 'pathe';
import { CliStructuredError, errorRuntime } from './cli-errors';
import { formatCommandHelp } from './formatters/help';
import type { CommonCommandOptions } from './global-flags';
import { parseGlobalFlags } from './global-flags';

const longDescriptions = new WeakMap<Command, string>();
const commandExamples = new WeakMap<Command, readonly string[]>();
const commandSeeAlso = new WeakMap<
  Command,
  readonly { readonly verb: string; readonly oneLiner: string }[]
>();

/**
 * Sets both short and long descriptions for a command.
 * The short description is used in command trees and headers.
 * The long description is shown at the bottom of help output.
 */
export function setCommandDescriptions(
  command: Command,
  shortDescription: string,
  longDescription?: string,
): Command {
  command.description(shortDescription);
  if (longDescription) {
    longDescriptions.set(command, longDescription);
  }
  return command;
}

/**
 * Sets copy-pastable examples for a command, shown in help text.
 */
export function setCommandExamples(command: Command, examples: readonly string[]): Command {
  commandExamples.set(command, examples);
  return command;
}

/**
 * Gets the long description from a command if it was set via setCommandDescriptions.
 */
export function getLongDescription(command: Command): string | undefined {
  return longDescriptions.get(command);
}

/**
 * Gets examples from a command if set via setCommandExamples.
 */
export function getCommandExamples(command: Command): readonly string[] | undefined {
  return commandExamples.get(command);
}

/**
 * Sets cross-references to related commands, rendered in a "See also"
 * section below the Examples block in help output.
 */
export function setCommandSeeAlso(
  command: Command,
  refs: readonly { readonly verb: string; readonly oneLiner: string }[],
): Command {
  commandSeeAlso.set(command, refs);
  return command;
}

/**
 * Gets the see-also cross-references from a command.
 */
export function getCommandSeeAlso(
  command: Command,
): readonly { readonly verb: string; readonly oneLiner: string }[] | undefined {
  return commandSeeAlso.get(command);
}

/**
 * Shared CLI options interface for migration commands (db init, db update).
 * These are the Commander.js parsed options common to both commands.
 */
export interface MigrationCommandOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly dryRun?: boolean;
}

/**
 * Resolves the absolute path to contract.json from the config.
 */
export function resolveContractPath(config: { contract?: { output?: string } }): string {
  if (config.contract?.output === undefined) {
    throw errorRuntime(
      'CONFIG.VALIDATION_FAILED',
      'config.contract.output is required to resolve the contract path',
      {
        why: 'CLI commands read the emitted contract from config.contract.output; the config has no value to read.',
        fix: 'Ensure your prisma-next.config.ts goes through `defineConfig()`, which normalises a default output when the provider supplies an input path, or set `contract.output` explicitly.',
      },
    );
  }
  return resolve(config.contract.output);
}

/**
 * Resolves the migrations directory and config path from CLI options.
 * Shared by migrate, migration-plan, and migration-status.
 *
 * - `migrationsDir` is the project's top-level `migrations/` directory
 *   (the root that the aggregate loader walks for every contract space).
 * - `appMigrationsDir` is the app subspace directory under it
 *   (`<migrationsDir>/<APP_SPACE_ID>/`). Every per-app reader / writer
 *   (`migration new`, `migration plan`, `migrate`,
 *   `migration status`, `migration show`, `migration ref`) operates on
 *   this directory. Extensions own their own `migrations/<spaceId>/`.
 * - `refsDir` is the app's refs directory (`<appMigrationsDir>/refs/`).
 *   The framework does not maintain refs at the migrations root.
 *
 * `cwd` is the directory the command was invoked from; every relative path in
 * the result is computed against it.
 */
export function resolveMigrationPaths(
  configOption: string | undefined,
  config: { migrations?: { dir?: string } },
  cwd: string,
): {
  configPath: string;
  migrationsDir: string;
  migrationsRelative: string;
  appMigrationsDir: string;
  appMigrationsRelative: string;
  refsDir: string;
} {
  const resolvedConfigPath = configOption ? resolve(cwd, configOption) : undefined;
  const configPath = resolvedConfigPath
    ? relative(cwd, resolvedConfigPath)
    : 'prisma-next.config.ts';
  const migrationsDir = resolve(
    resolvedConfigPath ? resolve(resolvedConfigPath, '..') : cwd,
    config.migrations?.dir ?? 'migrations',
  );
  const migrationsRelative = relative(cwd, migrationsDir);
  const appMigrationsDir = spaceMigrationDirectory(migrationsDir, APP_SPACE_ID);
  const appMigrationsRelative = relative(cwd, appMigrationsDir);
  const refsDir = resolve(appMigrationsDir, 'refs');
  return {
    configPath,
    migrationsDir,
    migrationsRelative,
    appMigrationsDir,
    appMigrationsRelative,
    refsDir,
  };
}

/**
 * Slim representation of a PathDecision for CLI JSON output.
 * Strips internal fields (createdAt) from path entries.
 */
export interface PathDecisionResult {
  readonly fromHash: string;
  readonly toHash: string;
  readonly alternativeCount: number;
  readonly tieBreakReasons: readonly string[];
  readonly refName?: string;
  readonly requiredInvariants: readonly string[];
  readonly satisfiedInvariants: readonly string[];
  readonly selectedPath: readonly {
    readonly dirName: string;
    readonly migrationHash: string;
    readonly from: string;
    readonly to: string;
    readonly invariants: readonly string[];
  }[];
}

export function collectDeclaredInvariants(graph: MigrationGraph): ReadonlySet<string> {
  const declared = new Set<string>();
  for (const edges of graph.forwardChain.values()) {
    for (const edge of edges) {
      for (const inv of edge.invariants) {
        declared.add(inv);
      }
    }
  }
  return declared;
}

/**
 * Maps a `MigrationEdge` to the structural-edge shape used in the
 * `MIGRATION.NO_INVARIANT_PATH` error envelope. Shared between
 * `migrate` and `migration status` so both commands surface
 * the same JSON wire shape when an invariant-aware route is unsatisfiable.
 */
export function toStructuralEdge(edge: MigrationEdge): NoInvariantPathStructuralEdge {
  return {
    dirName: edge.dirName,
    migrationHash: edge.migrationHash,
    from: edge.from,
    to: edge.to,
    invariants: edge.invariants,
  };
}

/**
 * Maps a PathDecision to the slim CLI output representation.
 */
export function toPathDecisionResult(decision: PathDecision): PathDecisionResult {
  return {
    fromHash: decision.fromHash,
    toHash: decision.toHash,
    alternativeCount: decision.alternativeCount,
    tieBreakReasons: decision.tieBreakReasons,
    requiredInvariants: decision.requiredInvariants ?? [],
    satisfiedInvariants: decision.satisfiedInvariants ?? [],
    ...ifDefined('refName', decision.refName),
    selectedPath: decision.selectedPath.map((entry) => ({
      dirName: entry.dirName,
      migrationHash: entry.migrationHash,
      from: entry.from,
      to: entry.to,
      invariants: entry.invariants,
    })),
  };
}

export function targetSupportsMigrations(target: ControlTargetDescriptor<string, string>): boolean {
  return hasMigrations(target);
}

export function getTargetMigrations(target: ControlTargetDescriptor<string, string>) {
  return hasMigrations(target) ? target.migrations : undefined;
}

/**
 * The subset of the emitted contract.json that the framework layer can
 * safely type. The emitter adds these fields on top of the family-specific
 * storage/models/relations. Other fields exist in the JSON but are opaque
 * at this layer — the index signature preserves them for downstream
 * consumers that operate at the family level (e.g., the control client).
 */
export interface ContractEnvelope {
  readonly storageHash: string;
  readonly schemaVersion: string;
  readonly target: string;
  readonly targetFamily: string;
  readonly profileHash?: string;
  readonly [key: string]: unknown;
}

/**
 * Reads and parses contract.json, validating the framework-level envelope
 * fields (storageHash, schemaVersion, target, targetFamily).
 *
 * Family-specific validation (storage structure, codec mappings, etc.)
 * happens downstream in the control client via the family instance.
 */
export async function readContractEnvelope(config: {
  contract?: { output?: string };
}): Promise<ContractEnvelope> {
  const contractPath = resolveContractPath(config);
  const content = await readFile(contractPath, 'utf-8');
  const json = JSON.parse(content) as Record<string, unknown>;

  const { schemaVersion, target, targetFamily, profileHash } = json;
  const storage = json['storage'] as Record<string, unknown> | undefined;
  const storageHash = storage?.['storageHash'];

  if (typeof storageHash !== 'string') {
    throw new CliStructuredError(
      'CONTRACT.VALIDATION_FAILED',
      `Contract at ${relative(process.cwd(), contractPath)} is missing a valid storage.storageHash. Run \`prisma-next contract emit\` to regenerate.`,
      { where: { path: contractPath } },
    );
  }
  if (typeof schemaVersion !== 'string') {
    throw new CliStructuredError(
      'CONTRACT.VALIDATION_FAILED',
      `Contract at ${relative(process.cwd(), contractPath)} is missing schemaVersion.`,
      { where: { path: contractPath } },
    );
  }
  if (typeof target !== 'string') {
    throw new CliStructuredError(
      'CONTRACT.VALIDATION_FAILED',
      `Contract at ${relative(process.cwd(), contractPath)} is missing target.`,
      { where: { path: contractPath } },
    );
  }
  if (typeof targetFamily !== 'string') {
    throw new CliStructuredError(
      'CONTRACT.VALIDATION_FAILED',
      `Contract at ${relative(process.cwd(), contractPath)} is missing targetFamily.`,
      { where: { path: contractPath } },
    );
  }

  return {
    ...json,
    storageHash,
    schemaVersion,
    target,
    targetFamily,
    ...(typeof profileHash === 'string' ? { profileHash } : {}),
  };
}

/**
 * Masks credentials in a database connection URL.
 * Handles standard URLs (username + password + query params) and libpq-style key=value strings.
 */
export function maskConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username) {
      parsed.username = '****';
    }
    if (parsed.password) {
      parsed.password = '****';
    }
    // Also mask password in query parameters (e.g., ?password=secret, ?sslpassword=secret)
    for (const key of [...parsed.searchParams.keys()]) {
      if (/password/i.test(key)) {
        parsed.searchParams.set(key, '****');
      }
    }
    return parsed.toString();
  } catch {
    // Fallback for libpq-style key=value connection strings (e.g., "host=localhost password=secret user=admin")
    return url
      .replace(/password\s*=\s*\S+/gi, 'password=****')
      .replace(/user\s*=\s*\S+/gi, 'user=****');
  }
}

/**
 * Strips raw connection URL fragments from an error message to prevent credential leakage.
 * Call this before surfacing driver errors to the user.
 */
export function sanitizeErrorMessage(message: string, connectionUrl?: string): string {
  if (!connectionUrl) {
    return message;
  }
  try {
    const parsed = new URL(connectionUrl);
    // Replace the full URL (with and without trailing slash)
    let sanitized = message;
    sanitized = sanitized.replaceAll(connectionUrl, maskConnectionUrl(connectionUrl));
    // Also replace the password and username individually if they appear
    if (parsed.password) {
      sanitized = sanitized.replaceAll(parsed.password, '****');
    }
    if (parsed.username) {
      sanitized = sanitized.replaceAll(parsed.username, '****');
    }
    return sanitized;
  } catch {
    // For libpq-style strings, mask password and user values in the message
    return message
      .replace(/password\s*=\s*\S+/gi, 'password=****')
      .replace(/user\s*=\s*\S+/gi, 'user=****');
  }
}

/**
 * Registers the global CLI options shared by every command:
 * --format, --json, -q/--quiet, -v/--verbose, --trace, --color, --no-color,
 * --interactive, --no-interactive, -y/--yes.
 *
 * Also sets up the styled help formatter.
 */
export function addGlobalOptions(command: Command): Command {
  return command
    .configureHelp({
      formatHelp: (cmd) => {
        const flags = parseGlobalFlags({});
        return formatCommandHelp({ command: cmd, flags });
      },
    })
    .option(
      '--format <pretty|json>',
      'Output format (default: pretty, or json when stdout is not a TTY)',
    )
    .option('--json', 'Output as JSON (alias for --format json)')
    .option('-q, --quiet', 'Quiet mode: errors only')
    .option('-v, --verbose', 'Verbose output: debug info, timings')
    .option('--trace', 'Trace output: deep internals, stack traces')
    .option('--color', 'Force color output')
    .option('--no-color', 'Disable color output')
    .option('--interactive', 'Force interactive mode')
    .option('--no-interactive', 'Disable interactive prompts')
    .option('-y, --yes', 'Auto-accept prompts');
}
