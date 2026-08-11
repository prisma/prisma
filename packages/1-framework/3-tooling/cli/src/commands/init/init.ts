import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import * as clack from '@clack/prompts';
import type { ImportSpecifierResolver } from '@internal/framework-components/emission';
import { docsUrlFor } from '@internal/utils/structured-error';
import { basename, dirname, isAbsolute, join } from 'pathe';
import { CliStructuredError } from '../../utils/cli-errors';
import { formatErrorJson, formatErrorOutput } from '../../utils/formatters/errors';
import type { GlobalFlags } from '../../utils/global-flags';
import { createTerminalUI, type TerminalUI } from '../../utils/terminal-ui';
import {
  detectPackageManager,
  formatAddArgs,
  formatAddDevArgs,
  formatRunCommand,
  hasProjectManifest,
  type PackageManager,
} from './detect-package-manager';
import { detectPnpmCatalogOverrides, type PnpmCatalogOverride } from './detect-pnpm-catalog';
import {
  errorInitEmitFailed,
  errorInitInstallFailed,
  errorInitInvalidManifest,
  errorInitInvalidTsconfig,
  errorInitProbeFailed,
} from './errors';
import {
  INIT_EXIT_EMIT_FAILED,
  INIT_EXIT_INSTALL_FAILED,
  INIT_EXIT_INTERNAL_ERROR,
  INIT_EXIT_OK,
  INIT_EXIT_PRECONDITION,
  INIT_EXIT_SKILL_INSTALL_FAILED,
  INIT_EXIT_USER_ABORTED,
} from './exit-codes';
import { mergeGitattributes, requiredGitattributesLines } from './hygiene-gitattributes';
import { mergeGitignore } from './hygiene-gitignore';
import {
  ensureEsmModuleType,
  mergePackageScripts,
  REQUIRED_SCRIPTS,
} from './hygiene-package-scripts';
import { type InitFlagOptions, type ResolvedInitInputs, resolveInitInputs } from './inputs';
import {
  buildNextSteps,
  formatInitJson,
  type InitOutput,
  InitOutputSchema,
  renderInitOutro,
} from './output';
import { type ProbeOutcome, type ProbeOverrides, probeServerVersion } from './probe-db';
import { findStaleArtifacts, removeDependency } from './reinit-cleanup';
import {
  DEFAULT_SKILL_SOURCES,
  formatSkillInstallCommand,
  legacySkillDirs,
  runProjectLevelSkillInstall,
} from './skill-install';
import {
  configFile,
  dbFile,
  scaffoldSpecifierResolverFor,
  starterSchema,
  targetPackageName,
} from './templates/code-templates';
import { envExampleContent, envFileContent, MIN_SERVER_VERSION } from './templates/env';
import { quickReferenceMd } from './templates/quick-reference';
import { minimalProjectReadmeMd } from './templates/readme';
import { defaultTsConfig, mergeTsConfig, TsConfigParseError } from './templates/tsconfig';

interface FileEntry {
  readonly path: string;
  readonly content: string;
  /**
   * Optional human-mode message printed *after* the file is written —
   * matches the legacy `Updated tsconfig.json with required compiler
   * options.` line emitted when an existing tsconfig is merged. Kept
   * with the entry so the precondition phase decides what to say and
   * the write phase remains a dumb loop (FR6.2 atomicity).
   */
  readonly logMessage?: string;
}

interface InstallReport {
  readonly skipped: boolean;
  readonly deps: readonly string[];
  readonly devDeps: readonly string[];
  readonly warnings: readonly string[];
  /**
   * The package manager that actually ran. Equal to the detected `pm`
   * on the common path; differs when the pnpm → npm fallback fired, in
   * which case it's `'npm'`. Threaded into the skills install so the
   * runner stays consistent with the install we just ran — re-trying
   * through `pnpm dlx` when `pnpm install` just failed for
   * workspace/catalog reasons would fail again for the same reason.
   */
  readonly effectivePm: PackageManager;
}

/**
 * Runs the `init` command end-to-end and returns the exit code. Catches
 * structured CLI errors raised at every phase (input resolution, install,
 * emit) and renders them via the same UI surface as success output
 * (`--json` to stdout, human to stderr). Exit codes follow the documented
 * stable set in `./exit-codes.ts` and the
 * [Style Guide § Exit Codes](../../../../../../../docs/CLI%20Style%20Guide.md#exit-codes).
 *
 * Layered for testability: the action handler in `./index.ts` is
 * responsible for parsing flags and constructing `runOptions`; this
 * function does no flag parsing of its own.
 */
export async function runInit(
  baseDir: string,
  runOptions: {
    readonly options: InitFlagOptions;
    readonly flags: GlobalFlags;
    /**
     * Whether `init` may render an interactive prompt. Decoupled from
     * `flags.interactive` (which gates `TerminalUI` decoration / stdout
     * mode) — see [Style Guide § Interactivity](../../../../../../../docs/CLI%20Style%20Guide.md#interactivity).
     */
    readonly canPrompt: boolean;
    /**
     * FR8.3 — test-only seam for the optional database version probe.
     * Production callers omit this; tests inject stub `probePostgres` /
     * `probeMongo` functions so the probe contract (env handling,
     * comparator, message formatting, `--strict-probe` escalation) can
     * be exercised without a live database. Never read at runtime by a
     * user invocation of the CLI.
     */
    readonly probeOverrides?: ProbeOverrides;
  },
): Promise<number> {
  const { options, flags, canPrompt, probeOverrides } = runOptions;
  const ui = createTerminalUI(flags);
  const warnings: string[] = [];
  const filesWritten: string[] = [];
  const filesDeleted: string[] = [];

  if (!flags.json && !flags.quiet) {
    clack.intro('prisma-next init', { output: process.stderr });
  }

  let inputs: ResolvedInitInputs;
  try {
    inputs = await resolveInitInputs({ baseDir, options, flags, canPrompt });
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return emitError(ui, flags, error);
    }
    throw error;
  }

  const pm = await detectPackageManager(baseDir);
  const pkgRun = formatRunCommand(pm, 'prisma-next', '').trimEnd();

  const schemaDir = dirname(inputs.schemaPath);
  const configContractPath = isAbsolute(inputs.schemaPath)
    ? inputs.schemaPath
    : `./${inputs.schemaPath}`;

  // -----------------------------------------------------------------
  // Precondition phase (FR6.2 / NFR3 atomicity)
  //
  // Read every file we may need to merge with, parse it, compute the
  // merged content, and accumulate the full set of writes — *before*
  // touching the filesystem. A failure here (malformed package.json,
  // unparseable tsconfig.json, …) returns a structured error and the
  // user's project on disk stays byte-identical to its pre-init state.
  // -----------------------------------------------------------------
  // The one place `init` decides which package names the scaffold carries.
  // Everything downstream — the files below and the dependency `runInstall`
  // adds — resolves through this, so the imports written and the package
  // installed cannot disagree.
  const resolveImportSpecifier = scaffoldSpecifierResolverFor(inputs.target);

  const filesToWrite: FileEntry[] = [
    {
      path: inputs.schemaPath,
      content: starterSchema(inputs.target, inputs.authoring, resolveImportSpecifier),
    },
    {
      path: 'prisma-next.config.ts',
      content: configFile(inputs.target, configContractPath, resolveImportSpecifier),
    },
    { path: join(schemaDir, 'db.ts'), content: dbFile(inputs.target, resolveImportSpecifier) },
    {
      path: 'prisma-next.md',
      content: quickReferenceMd(
        inputs.target,
        inputs.authoring,
        inputs.schemaPath,
        pkgRun,
        resolveImportSpecifier,
      ),
    },
    { path: '.env.example', content: envExampleContent(inputs.target) },
  ];

  // FR9.1 — on re-init, queue the previously-emitted contract artifacts
  // for deletion so a target switch (or schema-shape change) does not
  // leave a stale `contract.json` / `contract.d.ts` next to the new
  // schema source. Detection is filesystem-only (no parsing of the
  // previous config) so the cleanup is safe to run before the write
  // phase: each path is checked for existence in the precondition,
  // and missing-on-disk-at-write-time is tolerated.
  const filesToDelete: string[] = inputs.reinit ? [...findStaleArtifacts(baseDir, schemaDir)] : [];

  // Retired per-workflow skill directories from pre-consolidation
  // installs compete with the consolidated `prisma-8` skill for
  // activation. Queue every existing one for recursive deletion on
  // every run (not gated on `--reinit`).
  const legacyDirsToDelete = legacySkillDirs().filter((rel) => existsSync(join(baseDir, rel)));

  // FR3.2: a real `.env` is only written when the user opted in. Never
  // overwrite an existing `.env` — secrets live there and clobbering
  // them is the most damaging possible side-effect of `init`.
  if (inputs.writeEnv) {
    if (!existsSync(join(baseDir, '.env'))) {
      filesToWrite.push({ path: '.env', content: envFileContent(inputs.target) });
    } else {
      warnings.push(
        '.env already exists; leaving it untouched. Compare with .env.example for any new keys.',
      );
    }
  }

  // FR2.2 / FR6.1: tsconfig.json gets the minimum compiler options the
  // scaffolded files need. JSONC (TS's actual configured dialect) is
  // accepted; an unparseable file is mapped to a structured
  // precondition error (5011) rather than crashing mid-write.
  const tsconfigPath = join(baseDir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    const existing = readFileSync(tsconfigPath, 'utf-8');
    let merged: string;
    try {
      merged = mergeTsConfig(existing);
    } catch (err) {
      if (err instanceof TsConfigParseError) {
        return emitError(
          ui,
          flags,
          errorInitInvalidTsconfig({ path: 'tsconfig.json', cause: err.message }),
        );
      }
      throw err;
    }
    filesToWrite.push({
      path: 'tsconfig.json',
      content: merged,
      logMessage: 'Updated tsconfig.json with required compiler options.',
    });
  } else {
    filesToWrite.push({ path: 'tsconfig.json', content: defaultTsConfig() });
  }

  // FR3.3: idempotent .gitignore — append only what's missing.
  const gitignorePath = join(baseDir, '.gitignore');
  const existingGitignore = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, 'utf-8')
    : undefined;
  const newGitignore = mergeGitignore(existingGitignore);
  if (newGitignore !== null) {
    filesToWrite.push({ path: '.gitignore', content: newGitignore });
  }

  // FR3.4: idempotent .gitattributes — linguist-generated entries for
  // the emitted artifacts so GitHub diff stats / code review collapse
  // them by default.
  const gitattributesPath = join(baseDir, '.gitattributes');
  const existingGitattributes = existsSync(gitattributesPath)
    ? readFileSync(gitattributesPath, 'utf-8')
    : undefined;
  const newGitattributes = mergeGitattributes(
    existingGitattributes,
    requiredGitattributesLines(schemaDir, inputs.target),
  );
  if (newGitattributes !== null) {
    filesToWrite.push({ path: '.gitattributes', content: newGitattributes });
  }

  // Read + parse package.json once for both the FR3.5 scripts merge and
  // the FR2.1 `@types/node`-presence check. A malformed manifest is
  // mapped to a structured precondition error (5010) rather than the
  // generic INTERNAL_ERROR fallback so CI/agents can branch on it.
  //
  // When neither `package.json` nor a `deno.json[c]` is present, init
  // synthesises a minimal `package.json` (TML-2496) — running
  // `npm init -y` first was friction with no upside, since we always
  // edit the file anyway. A `deno.json[c]` project is left alone:
  // creating a `package.json` next to it would fork the project's
  // dependency graph.
  const packageJsonPath = join(baseDir, 'package.json');
  const packageJsonExisted = existsSync(packageJsonPath);
  const synthesisePackageJson = !packageJsonExisted && !hasProjectManifest(baseDir);
  let parsedPackageJson: Record<string, unknown> | null = null;
  if (packageJsonExisted || synthesisePackageJson) {
    const pkgRaw = packageJsonExisted
      ? readFileSync(packageJsonPath, 'utf-8')
      : defaultPackageJsonContent(basename(baseDir));
    try {
      parsedPackageJson = JSON.parse(pkgRaw) as Record<string, unknown>;
    } catch (err) {
      if (err instanceof SyntaxError) {
        return emitError(
          ui,
          flags,
          errorInitInvalidManifest({ path: 'package.json', cause: err.message }),
        );
      }
      throw err;
    }

    // package.json edits are chained: FR9.2 facade-dep removal first
    // (so the later passes see the cleaned `dependencies` and we round
    // out a single re-stringification), then FR3.5 / FR9.3 idempotent
    // scripts merge with collision detection, then `"type": "module"`
    // alignment so the ESM-only `with { type: 'json' }` import attribute
    // in the scaffolded `prisma/db.ts` loads cleanly under Node's
    // loader (TML-2494).
    let workingPkg = pkgRaw;
    // A synthesised manifest is always a write — the file does not
    // exist on disk yet.
    let pkgChanged = synthesisePackageJson;
    if (inputs.removePreviousFacade !== null) {
      const next = removeDependency(workingPkg, inputs.removePreviousFacade);
      if (next !== null) {
        workingPkg = next;
        pkgChanged = true;
      }
    }
    const { content: nextPkg, warnings: scriptWarnings } = mergePackageScripts(
      workingPkg,
      REQUIRED_SCRIPTS,
    );
    if (nextPkg !== null) {
      workingPkg = nextPkg;
      pkgChanged = true;
    }
    const { content: typedPkg, warning: typeWarning } = ensureEsmModuleType(workingPkg);
    if (typedPkg !== null) {
      workingPkg = typedPkg;
      pkgChanged = true;
    }
    if (pkgChanged) {
      filesToWrite.push({ path: 'package.json', content: workingPkg });
    }
    warnings.push(...scriptWarnings);
    if (typeWarning !== null) {
      warnings.push(typeWarning);
    }
    if (synthesisePackageJson) {
      warnings.push(
        'No package.json found in the target directory; created a minimal one. Edit `name` / `version` to taste.',
      );
    }
  }

  if (existsSync(join(baseDir, 'src/index.ts'))) {
    if (!existsSync(join(baseDir, 'README.md'))) {
      const rawName =
        parsedPackageJson !== null && typeof parsedPackageJson['name'] === 'string'
          ? parsedPackageJson['name']
          : basename(baseDir);
      filesToWrite.push({
        path: 'README.md',
        content: minimalProjectReadmeMd(
          inputs.target,
          inputs.schemaPath,
          sanitisePackageName(rawName),
          pm,
        ),
      });
    } else {
      warnings.push('README.md already exists; leaving it untouched.');
    }
  }

  // -----------------------------------------------------------------
  // Write phase — every input has been parsed and every merged file is
  // staged. From here on, failures are only possible at the
  // install/emit stages, which the spec treats as discrete subsequent
  // phases (FR6.3): scaffold files remain on disk so the user can fix
  // and retry.
  // -----------------------------------------------------------------
  for (const file of filesToWrite) {
    const fullPath = join(baseDir, file.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content, 'utf-8');
    filesWritten.push(file.path);
    if (file.logMessage !== undefined && !flags.json && !flags.quiet) {
      ui.log(file.logMessage);
    }
  }

  // FR9.1 — delete stale artifacts after the new templates are written.
  // Order is intentional: the names do not collide with `filesToWrite`
  // (we never write `contract.json` from this command — that's `contract
  // emit`'s job), so deletion *after* the writes guarantees we never
  // remove a file we just produced. `existsSync` was checked in the
  // precondition phase, but a concurrent `git checkout` could have
  // already removed the file — `unlinkSync` would then throw ENOENT,
  // which we tolerate as the user-visible end state we wanted anyway.
  for (const rel of filesToDelete) {
    const fullPath = join(baseDir, rel);
    if (!existsSync(fullPath)) {
      continue;
    }
    try {
      unlinkSync(fullPath);
      filesDeleted.push(rel);
    } catch (err) {
      if (!(err instanceof Error && 'code' in err && (err as { code: string }).code === 'ENOENT')) {
        throw err;
      }
    }
  }

  // Retired skill directories are removed whole — `rmSync` with
  // `force` tolerates a concurrent removal the same way the ENOENT
  // branch above does for single files.
  for (const rel of legacyDirsToDelete) {
    rmSync(join(baseDir, rel), { recursive: true, force: true });
    filesDeleted.push(rel);
  }

  const emitCommand = formatRunCommand(pm, 'prisma-next', 'contract emit');

  let install: InstallReport;
  try {
    install = await runInstall({
      baseDir,
      pm,
      target: inputs.target,
      install: inputs.install,
      flags,
      ui,
      filesWritten,
      resolveImportSpecifier,
      hasTypesNode:
        parsedPackageJson !== null ? hasDirectDep(parsedPackageJson, '@types/node') : false,
    });
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return emitError(ui, flags, error);
    }
    throw error;
  }
  warnings.push(...install.warnings);

  let contractEmitted = false;
  if (!install.skipped) {
    try {
      await runEmit({ baseDir, ui, filesWritten, emitCommand });
      contractEmitted = true;
    } catch (error) {
      if (CliStructuredError.is(error)) {
        return emitError(ui, flags, error);
      }
      throw error;
    }
  }

  // FR8.3 — optional database version probe. Strictly opt-in: we never
  // open a network connection to the user's database without
  // `--probe-db`. The probe runs after install + emit so the target
  // driver (`pg` / `mongodb`) is guaranteed present in node_modules
  // for the CJS `createRequire` resolution.
  if (inputs.probeDb) {
    const outcome = await probeServerVersion(
      {
        baseDir,
        target: inputs.target,
        databaseUrl: process.env['DATABASE_URL'],
        minVersion: MIN_SERVER_VERSION[inputs.target],
      },
      probeOverrides ?? {},
    );
    const escalated = applyProbeOutcome(outcome, {
      strictProbe: inputs.strictProbe,
      warnings,
    });
    if (escalated !== null) {
      return emitError(ui, flags, errorInitProbeFailed({ cause: escalated, filesWritten }));
    }
  }

  // Agent-skill install. Project-level is unconditional modulo
  // `--no-skill`. We deliberately do **not** offer a user-level
  // (global) install path: the skill's behaviour and surface track
  // the project's Prisma Next version, and a host-wide install would
  // have to pick a single version for every project on the machine,
  // which breaks the version-locking invariant the rest of the
  // framework relies on. A project-level failure is fatal
  // (`INIT_EXIT_SKILL_INSTALL_FAILED`).
  //
  // Runs after the install + emit phase when those steps are enabled,
  // but is not coupled to them: the skills are pulled directly from
  // the Prisma Next GitHub repo and do not require `node_modules`.
  // `--no-install` therefore skips only dependency installation and
  // contract emission; `--no-skill` is the explicit escape hatch for
  // skipping skills.
  const manualProjectSkillCommands = DEFAULT_SKILL_SOURCES.map((source) =>
    formatSkillInstallCommand({ pm: install.effectivePm, source }),
  );
  const manualProjectSkillSummary = manualProjectSkillCommands.map((c) => `\`${c}\``).join(' && ');
  let skillRegistered = false;
  if (!inputs.installProjectSkill) {
    warnings.push(
      `Skipped Prisma Next skills install (--no-skill). To install the skills later, run: ${manualProjectSkillSummary}`,
    );
  } else {
    const spinner = ui.spinner();
    spinner.start('Registering Prisma Next skills with the agent runtime...');
    try {
      const project = await runProjectLevelSkillInstall({
        baseDir,
        pm: install.effectivePm,
        filesWritten,
      });
      spinner.stop(
        `Registered Prisma Next skills (project level) — ran ${project.commands.map((c) => `\`${c}\``).join(', ')}`,
      );
      skillRegistered = true;
    } catch (error) {
      spinner.stop('Agent-skill install failed');
      if (CliStructuredError.is(error)) {
        return emitError(ui, flags, error);
      }
      throw error;
    }
  }

  const output: InitOutput = {
    ok: true,
    target: inputs.target === 'mongo' ? 'mongodb' : 'postgres',
    authoring: inputs.authoring,
    schemaPath: inputs.schemaPath,
    filesWritten,
    filesDeleted,
    packagesInstalled: {
      skipped: install.skipped,
      deps: [...install.deps],
      devDeps: [...install.devDeps],
    },
    contractEmitted,
    nextSteps: buildNextSteps({
      target: inputs.target === 'mongo' ? 'mongodb' : 'postgres',
      contractEmitted,
      emitCommand,
      schemaPath: inputs.schemaPath,
      skillRegistered,
    }),
    warnings,
  };

  // Validate the success document at the boundary so a regression in any
  // upstream branch (templates, schema, install report) shows up as a
  // typed runtime failure here instead of an opaque consumer-side parse
  // error. The schema is also exported on the package surface for
  // downstream consumers.
  const validated = InitOutputSchema(output);
  if (validated instanceof Error || (validated as { problems?: unknown }).problems !== undefined) {
    // Route through `emitError` rather than throwing: the bare throw
    // bypassed `--json` envelope formatting and `exitCodeForError`, so a
    // CLI.INIT_INVALID_OUTPUT_DOCUMENT regression would surface as an
    // uncaught exception in commander instead of the documented
    // `INTERNAL_ERROR` envelope on the right channel.
    return emitError(
      ui,
      flags,
      new CliStructuredError(
        'CLI.INIT_INVALID_OUTPUT_DOCUMENT',
        'Init produced an invalid output document',
        {
          why: `The success document failed schema validation: ${String(validated)}`,
          fix: 'This is a bug in prisma-next. Please report it with the full `-v` output.',
          docsUrl: docsUrlFor('CLI.INIT_INVALID_OUTPUT_DOCUMENT'),
        },
      ),
    );
  }

  if (flags.json) {
    ui.output(formatInitJson(output));
  } else {
    renderInitOutro(ui, output, flags);
    if (!flags.quiet) {
      clack.outro('Done. Open prisma-next.md to get started.', { output: process.stderr });
    }
  }

  return INIT_EXIT_OK;
}

/**
 * Renders a structured CLI error to the right channel and returns the exit
 * code derived from the error's PN code. JSON-mode errors go to stdout
 * (so consumers always parse from one place); human-mode errors go to
 * stderr. Mirrors `handleResult` but returns init-specific exit codes
 * rather than the CLI/RUN binary.
 */
function emitError(ui: TerminalUI, flags: GlobalFlags, error: CliStructuredError): number {
  const envelope = error.toEnvelope();
  if (flags.json) {
    ui.output(formatErrorJson(envelope));
  } else {
    ui.error(formatErrorOutput(envelope, flags));
  }
  return exitCodeForError(error);
}

/**
 * Maps a structured init error to its documented exit code. Centralised so
 * the error → exit-code contract lives next to the codes themselves.
 *
 * `CLI.INIT_INVALID_OUTPUT_DOCUMENT` (and the unknown-code default branch)
 * routes to `INIT_EXIT_INTERNAL_ERROR` because those represent prisma-next
 * bugs the user did not cause — surfacing them as `PRECONDITION` would
 * mislead automation into thinking the caller mis-invoked the CLI.
 *
 * See [exit-codes.ts](./exit-codes.ts) for the canonical list and
 * [Style Guide § Exit Codes](../../../../../../../docs/CLI%20Style%20Guide.md#exit-codes)
 * for the reservation policy.
 *
 * Exported for unit tests so the mapping can be asserted without
 * round-tripping a full `runInit` invocation.
 */
export function exitCodeForError(error: { readonly code: string }): number {
  switch (error.code) {
    case 'CLI.INIT_REINIT_NEEDS_FORCE': // re-init needs --force — precondition
    case 'CLI.INIT_MISSING_FLAGS': // missing flags — precondition
    case 'CLI.INIT_INVALID_FLAG_VALUE': // invalid flag value — precondition
    case 'CLI.INIT_STRICT_PROBE_WITHOUT_PROBE': // --strict-probe without --probe-db — precondition
    case 'CLI.INIT_INVALID_MANIFEST': // invalid manifest (malformed package.json) — precondition
    case 'CLI.INIT_INVALID_TSCONFIG': // invalid tsconfig (unparseable JSONC) — precondition
    case 'CLI.INIT_PROBE_FAILED': // probe failed under --strict-probe — precondition
    case 'CLI.INIT_AUTHORING_SCHEMA_PATH_MISMATCH': // --authoring / --schema-path extension mismatch — precondition
      return INIT_EXIT_PRECONDITION;
    case 'CLI.INIT_USER_ABORTED': // user aborted interactive prompt
      return INIT_EXIT_USER_ABORTED;
    case 'CLI.INIT_INSTALL_FAILED': // install failed
      return INIT_EXIT_INSTALL_FAILED;
    case 'CLI.INIT_EMIT_FAILED': // emit failed
      return INIT_EXIT_EMIT_FAILED;
    case 'CLI.INIT_INVALID_OUTPUT_DOCUMENT': // invalid output document — internal bug in prisma-next
      return INIT_EXIT_INTERNAL_ERROR;
    case 'CLI.INIT_SKILL_INSTALL_FAILED': // skill install failed
      return INIT_EXIT_SKILL_INSTALL_FAILED;
    default:
      // Any unexpected code is treated as an internal bug rather than
      // mis-routed to PRECONDITION. Adding a new code requires an
      // explicit case above.
      return INIT_EXIT_INTERNAL_ERROR;
  }
}

/**
 * Folds a `ProbeOutcome` into init's warning channel and returns the
 * fatal cause string when `--strict-probe` should escalate. Mirrors
 * the FR8.3 contract:
 *
 * - `ok` — informational; nothing surfaced unless verbose. (We could
 *   plumb a `note` here, but the spec only requires the warning side
 *   of the contract; an "all good" line would just be noise on the
 *   common path.)
 * - `below-minimum` — warning regardless of `--strict-probe`. The
 *   probe ran successfully and found an old server; that is not a
 *   probe *failure* (which is what `--strict-probe` escalates), it
 *   is the probe doing its job.
 * - `no-database-url` / `connection-failed` / `driver-missing` —
 *   warning by default, fatal under `--strict-probe`.
 *
 * Exported for unit tests so the branching contract can be asserted
 * without spinning up a full `runInit` round trip.
 */
export function applyProbeOutcome(
  outcome: ProbeOutcome,
  ctx: { readonly strictProbe: boolean; readonly warnings: string[] },
): string | null {
  switch (outcome.kind) {
    case 'ok':
      return null;
    case 'below-minimum':
      ctx.warnings.push(outcome.message);
      return null;
    case 'no-database-url':
    case 'connection-failed':
    case 'driver-missing':
      if (ctx.strictProbe) {
        return outcome.message;
      }
      ctx.warnings.push(outcome.message);
      return null;
  }
}

/**
 * Drives the `pnpm add` / `npm install` step. Failures are escalated to
 * a structured `errorInitInstallFailed` (exit code 4) — the spec treats
 * an unrecoverable install as a hard outcome rather than a warning so
 * CI/agents can branch on the exit code (FR1.6).
 *
 * For pnpm specifically, we additionally implement the FR7.2 fallback:
 * if pnpm fails with a recognised workspace/catalog resolution error
 * class (typically caused by a registry version that leaked
 * `workspace:*` or `catalog:` specifiers), we retry the install using
 * `npm` and surface a non-fatal warning explaining the swap.
 */
async function runInstall(ctx: {
  readonly baseDir: string;
  readonly pm: Awaited<ReturnType<typeof detectPackageManager>>;
  readonly target: ResolvedInitInputs['target'];
  readonly install: boolean;
  readonly flags: GlobalFlags;
  readonly ui: TerminalUI;
  readonly filesWritten: readonly string[];
  /**
   * Resolves the dependency name to install, from the same root the
   * scaffolded files were written against.
   */
  readonly resolveImportSpecifier: ImportSpecifierResolver;
  /**
   * FR2.1 — set when the user already declares `@types/node` directly in
   * `dependencies` or `devDependencies`. We then skip adding it so a
   * locked major (e.g. `^18` for a Node 18 runtime) survives `init`
   * unchanged. Transitive presence is intentionally ignored: detecting
   * it requires lockfile introspection and the realistic clobber risk
   * is the direct-pin case.
   */
  readonly hasTypesNode: boolean;
}): Promise<InstallReport> {
  const { baseDir, pm, target, install, flags, ui, filesWritten, hasTypesNode } = ctx;
  const pkg = targetPackageName(target, ctx.resolveImportSpecifier);
  const deps = [pkg, 'dotenv'];
  // FR2.1: under `moduleResolution: 'bundler'` (FR2.2) the scaffolded
  // `db.ts` / `prisma-next.config.ts` reference `process.env`, which
  // only typechecks with Node's ambient types in the resolution graph.
  // Pin it as a devDep rather than relying on a transitive resolution
  // through `dotenv` (whose types bundle is internal and not guaranteed
  // across versions). Skip when the user already declares `@types/node`
  // directly so a locked major (e.g. `^18` for a Node 18 runtime) is
  // preserved. Listed last so the install log still leads with the
  // user-relevant `prisma-next` line.
  const devDeps = hasTypesNode ? ['prisma-next'] : ['prisma-next', '@types/node'];

  const addCommand = `${pm} ${formatAddArgs(pm, deps).join(' ')}`;
  const addDevCommand = `${pm} ${formatAddDevArgs(pm, devDeps).join(' ')}`;
  const emitCommand = formatRunCommand(pm, 'prisma-next', 'contract emit');

  // FR7.3 / Spec Decision 8 — honour-and-warn: if the surrounding pnpm
  // workspace pins one of our packages via the catalog, surface a
  // structured warning so the user knows the catalog version (not the
  // published `latest`) is what ends up installed. We collect the
  // warning whether or not we actually run install — the override
  // applies to a manual install too — but only when pnpm is the chosen
  // PM (catalog: specifiers are pnpm-specific).
  const catalogWarnings = pm === 'pnpm' ? buildCatalogWarnings(baseDir, [...deps, ...devDeps]) : [];

  if (!install) {
    if (!flags.json && !flags.quiet) {
      ui.note(
        [
          'Run the following commands to complete setup:',
          '',
          '  1. Install dependencies:',
          `     ${addCommand}`,
          `     ${addDevCommand}`,
          '',
          '  2. Emit the contract:',
          `     ${emitCommand}`,
        ].join('\n'),
        'Manual steps',
      );
    }
    return { skipped: true, deps: [], devDeps: [], warnings: catalogWarnings, effectivePm: pm };
  }

  const exec = promisify(execFile);
  const runPair = async (manager: PackageManager): Promise<void> => {
    await exec(manager, formatAddArgs(manager, deps), { cwd: baseDir });
    await exec(manager, formatAddDevArgs(manager, devDeps), { cwd: baseDir });
  };

  const allPackages = [...deps, ...devDeps].join(', ');
  const spinner = ui.spinner();
  spinner.start(`Installing ${allPackages}...`);
  try {
    await runPair(pm);
    spinner.stop(`Installed ${allPackages}`);
    return { skipped: false, deps, devDeps, warnings: catalogWarnings, effectivePm: pm };
  } catch (err) {
    const stderrText = redactSecrets(readChildStderr(err));

    // FR7.2: detect a recognised pnpm workspace/catalog resolution error
    // and fall back to npm. Limited to pnpm specifically; npm/yarn/bun/deno
    // failures escalate straight to a structured install error.
    if (pm === 'pnpm' && isRecognisedPnpmResolutionError(stderrText)) {
      spinner.message(
        'pnpm could not resolve a workspace/catalog dependency, retrying with npm...',
      );
      try {
        await runPair('npm');
        spinner.stop(`Installed ${allPackages} via npm (pnpm fallback)`);
        const fallbackWarning = [
          'pnpm could not install: a published Prisma Next dependency leaked a `workspace:*` or `catalog:` specifier.',
          'Falling back to `npm install` so init can complete.',
          stderrText ? `  pnpm error: ${stderrText.trim().split('\n')[0]}` : '',
          'Once the offending package republishes a clean version, re-run `pnpm install` to switch back.',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          skipped: false,
          deps,
          devDeps,
          // The pnpm fallback fired, so the workspace catalog is not the
          // version that was actually installed (npm bypassed pnpm's
          // resolver). Surface the fallback warning but suppress the
          // catalog-honour warning to avoid a contradictory message
          // pair.
          warnings: [fallbackWarning],
          effectivePm: 'npm',
        };
      } catch (npmErr) {
        spinner.stop('Installation failed');
        const npmStderr = redactSecrets(readChildStderr(npmErr));
        throw errorInitInstallFailed({
          addCommand,
          addDevCommand,
          emitCommand,
          filesWritten,
          stderrLines: [stderrText, npmStderr],
        });
      }
    }

    spinner.stop('Installation failed');
    throw errorInitInstallFailed({
      addCommand,
      addDevCommand,
      emitCommand,
      filesWritten,
      stderrLines: [stderrText],
    });
  }
}

/**
 * Builds the FR7.3 catalog-honoured warning(s) for the surrounding pnpm
 * workspace, if any. Returns an empty array when no `pnpm-workspace.yaml`
 * exists in any ancestor or when the workspace's catalog has no entry
 * for any of the packages `init` is about to install.
 *
 * Exported for unit tests.
 */
export function buildCatalogWarnings(
  baseDir: string,
  packages: readonly string[],
): readonly string[] {
  const result = detectPnpmCatalogOverrides(baseDir, packages);
  if (result === null || result.entries.length === 0) {
    return [];
  }
  return [formatCatalogWarning(result.workspaceFile, result.entries)];
}

function formatCatalogWarning(
  workspaceFile: string,
  entries: readonly PnpmCatalogOverride[],
): string {
  const list = entries.map((entry) => `  • ${entry.name}: ${entry.version}`).join('\n');
  return [
    'pnpm workspace catalog overrides detected — pnpm will install these versions instead of `latest`:',
    list,
    `Catalog source: ${workspaceFile}`,
    'To use the published `latest` instead, remove or update the catalog entry, then re-run `pnpm install`.',
  ].join('\n');
}

/**
 * Recognised pnpm error signatures that justify a fallback to npm.
 *
 * These patterns indicate the published artifact itself is at fault
 * (a leaked `workspace:*` or `catalog:` specifier), not the user's
 * environment — pnpm is faithfully reporting "I cannot resolve this
 * registry version", and npm is willing to install it because npm
 * doesn't care about the protocol prefix when there's a fallback range.
 *
 * Exported for unit tests; do not depend on this from outside the init
 * command.
 */
export function isRecognisedPnpmResolutionError(stderr: string): boolean {
  if (!stderr) return false;
  return (
    stderr.includes('ERR_PNPM_WORKSPACE_PKG_NOT_FOUND') ||
    stderr.includes('ERR_PNPM_NO_MATCHING_VERSION') ||
    /No matching version found for .* in the catalog/i.test(stderr) ||
    /workspace:[^\s]+ is not a valid (version|spec)/i.test(stderr) ||
    /catalog:[^\s]* is not a valid (version|spec)/i.test(stderr)
  );
}

/**
 * FR2.1 — true when the parsed `package.json` declares `name` directly
 * in either `dependencies` or `devDependencies`. We deliberately don't
 * inspect `peerDependencies` (irrelevant for a leaf project) or the
 * lockfile (transitive presence is brittle to detect and not the
 * realistic clobber-risk path).
 *
 * Exported for unit tests.
 */
export function hasDirectDep(parsed: Record<string, unknown>, name: string): boolean {
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const value = parsed[field];
    if (value !== null && typeof value === 'object' && name in value) {
      return true;
    }
  }
  return false;
}

function readChildStderr(err: unknown): string {
  if (err instanceof Error && 'stderr' in err) {
    return String((err as { stderr: string }).stderr ?? '');
  }
  return '';
}

/**
 * Redacts userinfo (`user:password@`) from any URL-shaped substring inside
 * package-manager stderr before we surface it in a warning or error
 * meta. pnpm and npm both include the offending registry URL in resolve
 * errors, and that URL can carry an auth token (e.g. corporate registry
 * mirrors that bake `_authToken` into the URL). The Style Guide
 * (Testing & Accessibility — "Security: never print secrets") requires
 * we never surface those.
 *
 * Exported for unit tests.
 */
export function redactSecrets(stderr: string): string {
  if (!stderr) return stderr;
  // Match `scheme://userinfo@host…` and replace the userinfo with `***`.
  return stderr.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/g, '$1***@');
}

/**
 * Drives `prisma-next contract emit` against the freshly scaffolded
 * project. On failure, throws `errorInitEmitFailed` with the underlying
 * cause embedded in `meta.cause` so the user can re-run with `-v` to see
 * the full envelope and follow the fix steps. Maps to exit code
 * `5 = EMIT_FAILED` (FR1.6).
 */
async function runEmit(ctx: {
  readonly baseDir: string;
  readonly ui: TerminalUI;
  readonly filesWritten: readonly string[];
  readonly emitCommand: string;
}): Promise<void> {
  const spinner = ctx.ui.spinner();
  spinner.start('Emitting contract...');
  try {
    const { executeContractEmit } = await import('../../control-api/operations/contract-emit');
    const { loadConfigForSections } = await import('@internal/config-loader');
    const configFilePath = join(ctx.baseDir, 'prisma-next.config.ts');
    const configResult = await loadConfigForSections(configFilePath, [
      'contract',
      'family',
      'target',
      'adapter',
      'extensions',
    ]);
    if (!configResult.ok) {
      throw configResult.failure;
    }
    await executeContractEmit({
      config: configResult.value,
      cwd: process.cwd(),
      configPath: configFilePath,
    });
    spinner.stop('Contract emitted');
  } catch (err) {
    spinner.stop('Contract emission failed');
    throw errorInitEmitFailed({
      emitCommand: ctx.emitCommand,
      filesWritten: ctx.filesWritten,
      cause: causeMessage(err),
    });
  }
}

function causeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Minimal `package.json` content used when init runs in a directory
 * that has no project manifest (TML-2496). Mirrors the npm 11 `init -y`
 * defaults, with two deliberate deviations:
 *
 * - `"private": true` so a stray `npm publish` cannot leak the
 *   placeholder. Users who want to publish have to opt in by removing
 *   the field.
 * - `"type": "module"` so the scaffolded ESM imports in
 *   `prisma-next.config.ts` and `db.ts` typecheck and run without
 *   additional tsconfig coercion.
 *
 * Exported for unit tests so the canonical shape is asserted in one
 * place rather than re-derived at every call site.
 */
export function defaultPackageJsonContent(rawName: string): string {
  return `${JSON.stringify(
    {
      name: sanitisePackageName(rawName),
      version: '0.0.0',
      private: true,
      type: 'module',
    },
    null,
    2,
  )}\n`;
}

/**
 * npm package names are restricted to lowercase, no leading dot/underscore,
 * and a small URL-safe character set. `basename(cwd)` happily returns
 * "My Project" or ".hidden" — both rejected by `npm install` validation.
 * Coerce to a safe fallback rather than emit a manifest npm refuses to
 * read.
 */
function sanitisePackageName(raw: string): string {
  const lowered = raw.toLowerCase().replace(/[^a-z0-9._~-]/g, '-');
  const trimmed = lowered.replace(/^[._-]+/, '').replace(/-+/g, '-');
  return trimmed.length > 0 ? trimmed : 'my-app';
}
