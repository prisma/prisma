import { existsSync, readFileSync } from 'node:fs';
import * as clack from '@clack/prompts';
import { extname, join } from 'pathe';
import type { GlobalFlags } from '../../utils/global-flags';
import {
  errorInitMissingFlags,
  errorInitReinitNeedsForce,
  errorInitStrictProbeWithoutProbe,
  errorInitUserAborted,
} from './errors';
import { resolveAuthoring, resolveTarget, validateSchemaPath } from './input-values';
import {
  type AuthoringId,
  defaultSchemaPath,
  scaffoldSpecifierResolverFor,
  type TargetId,
  targetLabel,
  targetPackageName,
} from './templates/code-templates';

/**
 * Raw command-line input as Commander.js parses it. `target` here uses the
 * user-facing `mongodb` spelling (matching the flag); the internal
 * `TargetId` uses `mongo`. The mapping happens in `resolveInitInputs`.
 */
export interface InitFlagOptions {
  readonly target?: string;
  readonly authoring?: string;
  readonly schemaPath?: string;
  readonly force?: boolean;
  readonly writeEnv?: boolean;
  readonly probeDb?: boolean;
  readonly strictProbe?: boolean;
  readonly install?: boolean;
  /**
   * `--no-skill` — skip the project-level skill install entirely.
   * Documented escape hatch for air-gapped CI, restricted registries,
   * and any environment where `npx skills` is
   * not reachable.
   */
  readonly skill?: boolean;
}

/**
 * The fully-resolved set of decisions `runInit` operates on. After this
 * value object is constructed, `runInit` should not need to consult the
 * environment again for any user-visible decision.
 */
export interface ResolvedInitInputs {
  readonly target: TargetId;
  readonly authoring: AuthoringId;
  readonly schemaPath: string;
  readonly install: boolean;
  readonly writeEnv: boolean;
  readonly probeDb: boolean;
  readonly strictProbe: boolean;
  /**
   * True if the project already has `prisma-next.config.ts` and the user
   * has agreed (or `--force` has been supplied) to overwrite it.
   */
  readonly reinit: boolean;
  /**
   * FR9.2 — set to the **previous** facade package name (e.g.
   * `@internal/postgres`) when re-init is switching targets and the
   * user has consented to remove it from `package.json#dependencies`.
   * `null` when no removal is needed: not a re-init, no previous facade
   * present, the previous facade matches the chosen target, or the user
   * declined the interactive confirm. The chosen-target facade itself
   * is added separately via the install step.
   */
  readonly removePreviousFacade: string | null;
  /**
   * Whether to run `npx skills add prisma/prisma#v<version>` at the
   * project level after install + emit. True by default; `--no-skill`
   * sets it to `false`. The skill is always project-level (never
   * user-level / global) so its version stays locked to the project's
   * Prisma Next version — see `skill-install.ts`.
   */
  readonly installProjectSkill: boolean;
}

/**
 * Resolves every required input for `runInit`. In interactive mode, missing
 * inputs are prompted via clack; in non-interactive mode, missing required
 * inputs throw a structured error listing exactly which flags are missing
 * (FR1.4). Throws `CliStructuredError` on any unrecoverable input issue.
 *
 * `canPrompt` is decoupled from `flags.interactive` so the action handler
 * (`./index.ts`) owns the merge of stdout-TTY (decoration) and stdin-TTY
 * (prompts). `flags.interactive` continues to gate `TerminalUI` decoration
 * — see [Style Guide § Interactivity](../../../../../../../docs/CLI%20Style%20Guide.md#interactivity).
 */
export async function resolveInitInputs(ctx: {
  readonly baseDir: string;
  readonly options: InitFlagOptions;
  readonly flags: GlobalFlags;
  readonly canPrompt: boolean;
}): Promise<ResolvedInitInputs> {
  const { baseDir, options, flags, canPrompt } = ctx;
  // `--force` and `--yes` are deliberately separate: `--force` is the
  // contract for "overwrite an existing scaffold" (works in both modes);
  // `--yes` only auto-accepts interactive prompts and never substitutes
  // for the explicit destructive opt-in. In non-interactive mode, `--yes`
  // alone does nothing useful; the user must supply `--target`,
  // `--authoring`, and (for re-init) `--force`.
  const force = Boolean(options.force);
  const autoAcceptPrompts = Boolean(flags.yes);

  // --strict-probe is a no-op without --probe-db; surface the mistake
  // rather than silently swallowing it (FR8.3 / NFR9).
  if (options.strictProbe && !options.probeDb) {
    throw errorInitStrictProbeWithoutProbe();
  }

  const reinit = await resolveReinit({ baseDir, force, canPrompt, autoAcceptPrompts });
  const target = resolveTarget(options.target);
  const authoring = resolveAuthoring(options.authoring);

  // Now collect what's still missing under non-interactive rules.
  const missing: string[] = [];
  if (target === undefined) missing.push('target');
  if (authoring === undefined) missing.push('authoring');

  if (!canPrompt && missing.length > 0) {
    const reason = process.stdin.isTTY
      ? 'Non-interactive mode is active (`--no-interactive` or stdout is piped).'
      : 'stdin is not a TTY, so `init` cannot prompt interactively.';
    throw errorInitMissingFlags({ missing, why: reason });
  }

  // Interactive path — fall back to clack for anything still missing.
  const finalTarget = target ?? (await promptTarget());
  const finalAuthoring = authoring ?? (await promptAuthoring());
  const finalSchemaPath =
    options.schemaPath !== undefined
      ? validateSchemaPath(options.schemaPath, finalAuthoring)
      : canPrompt
        ? await promptSchemaPath(finalAuthoring)
        : defaultSchemaPath(finalAuthoring);

  // FR3.2: `--write-env` is the explicit opt-in for non-interactive
  // mode. Interactive runs additionally get a single confirm — but only
  // when the flag was not already supplied (an explicit `--write-env`
  // suppresses the prompt) and `--yes` did not auto-accept everything
  // (in which case interactive mode is effectively non-interactive and
  // the flag-only contract applies). See Style Guide § Interactivity.
  const writeEnv = await resolveWriteEnv({
    flag: options.writeEnv,
    canPrompt,
    autoAcceptPrompts,
  });

  // FR9.2 — when re-init switches targets, ask whether to drop the
  // previous facade from `dependencies`. Detection happens here (not in
  // `runInit`) so the prompt sequence stays in one place; the actual
  // edit is applied during `runInit`'s precondition phase alongside the
  // other `package.json` merges.
  const removePreviousFacade = await resolveRemovePreviousFacade({
    baseDir,
    target: finalTarget,
    reinit,
    force,
    canPrompt,
    autoAcceptPrompts,
  });

  // Skill-install gating. `--no-skill` (commander parses
  // `options.skill === false`) is the only escape hatch; otherwise
  // project-level install is unconditional. The skill is always
  // installed at the project level so its version tracks the
  // project's Prisma Next release.
  const installProjectSkill = options.skill !== false;

  return {
    target: finalTarget,
    authoring: finalAuthoring,
    schemaPath: finalSchemaPath,
    install: options.install !== false,
    writeEnv,
    probeDb: Boolean(options.probeDb),
    strictProbe: Boolean(options.strictProbe),
    reinit,
    removePreviousFacade,
    installProjectSkill,
  };
}

async function resolveWriteEnv(opts: {
  readonly flag: boolean | undefined;
  readonly canPrompt: boolean;
  readonly autoAcceptPrompts: boolean;
}): Promise<boolean> {
  if (opts.flag !== undefined) {
    return Boolean(opts.flag);
  }
  if (!opts.canPrompt || opts.autoAcceptPrompts) {
    return false;
  }
  const result = await clack.confirm({
    message: 'Also write a .env file from .env.example? (gitignored)',
    initialValue: false,
    output: process.stderr,
  });
  if (clack.isCancel(result)) {
    throw errorInitUserAborted();
  }
  return Boolean(result);
}

/**
 * FR9.2 — detects whether re-init is switching targets (the previous
 * facade differs from the chosen target's facade) and resolves the
 * remove-or-keep question.
 *
 * The non-interactive contract is the same as the `--force` re-init
 * gate above: a non-interactive run that reaches this helper always
 * has `--force` (otherwise `resolveReinit` would have thrown 5002), so
 * the removal proceeds without further prompting. Interactive runs see
 * a `clack.confirm` with `initialValue: true` — the destructive default
 * is correct because keeping both facades produces a project that
 * imports from one but pays for both in the lockfile, which is a
 * silent foot-gun the user almost never wants.
 *
 * Returns the previous facade package name when the user consented (or
 * was force-ed) to remove it, otherwise `null`. Parse failures on
 * `package.json` resolve to `null` here — `runInit`'s precondition
 * gate surfaces a structured 5010 error for the same file shortly
 * after, so we avoid double-reporting and keep this helper side-effect
 * free under hostile inputs.
 */
async function resolveRemovePreviousFacade(opts: {
  readonly baseDir: string;
  readonly target: TargetId;
  readonly reinit: boolean;
  readonly force: boolean;
  readonly canPrompt: boolean;
  readonly autoAcceptPrompts: boolean;
}): Promise<string | null> {
  if (!opts.reinit) {
    return null;
  }
  const packageJsonPath = join(opts.baseDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const otherTarget: TargetId = opts.target === 'postgres' ? 'mongo' : 'postgres';
  // This reads a `package.json` an *earlier* `init` wrote, which may have been
  // an older version that scaffolded the workspace name rather than the
  // published one. So it looks for every name a previous run could have
  // installed, not only the one this run would write.
  const otherFacadeNames = [
    targetPackageName(otherTarget, scaffoldSpecifierResolverFor(otherTarget)),
    targetPackageName(otherTarget),
  ];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  const deps = parsed['dependencies'];
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
    return null;
  }
  const otherFacade = otherFacadeNames.find((name) =>
    Object.hasOwn(deps as Record<string, unknown>, name),
  );
  if (otherFacade === undefined) {
    return null;
  }

  // `--force` (and `--yes` in interactive mode) auto-confirms the
  // removal. The `!canPrompt` branch is unreachable in practice because
  // the FR9.0 reinit gate already required `--force` for non-interactive
  // re-init, but we keep the guard for defence-in-depth.
  if (opts.force || (opts.canPrompt && opts.autoAcceptPrompts)) {
    return otherFacade;
  }
  if (!opts.canPrompt) {
    return otherFacade;
  }
  const result = await clack.confirm({
    message: `Switching from ${targetLabel(otherTarget)} to ${targetLabel(opts.target)} — remove ${otherFacade} from package.json dependencies?`,
    initialValue: true,
    output: process.stderr,
  });
  if (clack.isCancel(result)) {
    throw errorInitUserAborted();
  }
  return result === true ? otherFacade : null;
}

async function resolveReinit(opts: {
  readonly baseDir: string;
  readonly force: boolean;
  readonly canPrompt: boolean;
  readonly autoAcceptPrompts: boolean;
}): Promise<boolean> {
  const configPath = join(opts.baseDir, 'prisma-next.config.ts');
  if (!existsSync(configPath)) {
    return false;
  }
  if (opts.force) {
    return true;
  }
  if (!opts.canPrompt) {
    throw errorInitReinitNeedsForce();
  }
  // In interactive mode, `--yes` auto-accepts the re-init confirm.
  if (opts.autoAcceptPrompts) {
    return true;
  }
  const result = await clack.confirm({
    message:
      'This project is already initialized. Re-initialize? This will overwrite all generated files.',
    initialValue: false,
    output: process.stderr,
  });
  if (clack.isCancel(result) || result !== true) {
    throw errorInitUserAborted();
  }
  return true;
}

async function promptTarget(): Promise<TargetId> {
  const result = await clack.select({
    message: 'What database are you using?',
    options: [
      { value: 'postgres' as TargetId, label: 'PostgreSQL' },
      { value: 'mongo' as TargetId, label: 'MongoDB' },
    ],
    output: process.stderr,
  });
  if (clack.isCancel(result)) {
    throw errorInitUserAborted();
  }
  return result as TargetId;
}

async function promptAuthoring(): Promise<AuthoringId> {
  const result = await clack.select({
    message: 'How do you want to write your schema?',
    options: [
      { value: 'psl' as AuthoringId, label: 'Prisma Schema Language (.prisma)' },
      { value: 'typescript' as AuthoringId, label: 'TypeScript (.ts)' },
    ],
    output: process.stderr,
  });
  if (clack.isCancel(result)) {
    throw errorInitUserAborted();
  }
  return result as AuthoringId;
}

async function promptSchemaPath(authoring: AuthoringId): Promise<string> {
  const expectedExt = authoring === 'typescript' ? '.ts' : '.prisma';
  const result = await clack.text({
    message: 'Where should the schema file go?',
    initialValue: defaultSchemaPath(authoring),
    validate(value = '') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return 'Path cannot be empty';
      if (trimmed.endsWith('/') || trimmed.endsWith('\\'))
        return 'Path must be a file, not a directory';
      const ext = extname(trimmed).toLowerCase();
      if (ext === '') return 'Path must include a file extension (e.g. .prisma or .ts)';
      if (ext !== expectedExt) {
        return `Schema path must end in ${expectedExt} for --authoring ${authoring} (got ${ext}).`;
      }
      return undefined;
    },
    output: process.stderr,
  });
  if (clack.isCancel(result)) {
    throw errorInitUserAborted();
  }
  // Pipe through `validateSchemaPath` so the final value goes through the
  // same canonicalisation as the flag path — defence-in-depth in case
  // the inline `validate` ever drifts from the flag-mode rules.
  return validateSchemaPath(result as string, authoring);
}
