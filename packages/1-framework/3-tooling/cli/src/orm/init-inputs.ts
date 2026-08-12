import { existsSync, readFileSync } from 'node:fs';
import type { PromptSurface } from '@prisma/cli-engine';
import { basename, join } from 'pathe';
import { errorInitMissingFlags, errorInitStrictProbeWithoutProbe } from '../commands/init/errors';
import { resolveAuthoring, resolveTarget, validateSchemaPath } from '../commands/init/input-values';
import {
  type AuthoringId,
  defaultSchemaPath,
  scaffoldSpecifierResolverFor,
  type TargetId,
  targetLabel,
  targetPackageName,
} from '../commands/init/templates/code-templates';

/** The flag values `init` reads, after the engine has parsed them. */
export interface InitFlagValues {
  readonly target: string | undefined;
  readonly authoring: string | undefined;
  readonly schemaPath: string | undefined;
  readonly writeEnv: boolean;
  readonly probeDb: boolean;
  readonly strictProbe: boolean;
  readonly skipInstall: boolean;
  readonly skipSkills: boolean;
  readonly keepPreviousFacade: boolean;
}

/** Every decision the scaffold phase operates on. */
export interface ResolvedInitInputs {
  readonly target: TargetId;
  readonly authoring: AuthoringId;
  readonly schemaPath: string;
  readonly install: boolean;
  readonly writeEnv: boolean;
  readonly probeDb: boolean;
  readonly strictProbe: boolean;
  readonly reinit: boolean;
  /**
   * The facade package a previous run installed for the other target, when the
   * user consented to dropping it; `null` when there is nothing to drop or the
   * user kept it.
   */
  readonly removePreviousFacade: string | null;
  readonly installProjectSkill: boolean;
}

const CONSENT_QUESTION =
  'This project is already initialized. Re-initializing overwrites every generated file.';

const REQUIRED_FLAG_PROMPTS = new Set(['target', 'authoring']);

/**
 * The engine raises this when a prompt has no default and the session cannot
 * show it. For the two prompts that stand in for a required flag, that is the
 * same condition `init` has always reported as a missing flag.
 */
function isPromptRequired(error: unknown): boolean {
  return error instanceof Error && Reflect.get(error, 'code') === 'CLI.PROMPT_REQUIRED';
}

/**
 * `--confirm` matches a token, so the token has to be something the user can
 * see and type. The working directory's name is it; a directory with no name
 * of its own (the filesystem root) falls back to its path.
 */
export function consentToken(cwd: string): string {
  const name = basename(cwd);
  return name.length > 0 ? name : cwd;
}

async function askTarget(prompt: PromptSurface): Promise<TargetId> {
  return prompt.select<TargetId>('What database are you using?', [
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mongo', label: 'MongoDB' },
  ]);
}

async function askAuthoring(prompt: PromptSurface): Promise<AuthoringId> {
  return prompt.select<AuthoringId>('How do you want to write your schema?', [
    { value: 'psl', label: 'Prisma Schema Language (.prisma)' },
    { value: 'typescript', label: 'TypeScript (.ts)' },
  ]);
}

/**
 * The schema path the user typed goes through the same validator the flag
 * does, so an answer the engine accepted still has to agree with the authoring
 * style.
 */
async function askSchemaPath(prompt: PromptSurface, authoring: AuthoringId): Promise<string> {
  const answer = await prompt.text('Where should the schema file go?', {
    default: defaultSchemaPath(authoring),
  });
  return validateSchemaPath(answer, authoring);
}

/**
 * The facade a previous `init` installed for the other target, when this run
 * switches targets and one is still declared. Reads every name a previous run
 * could have written, because older versions scaffolded the workspace name.
 */
function previousFacade(cwd: string, target: TargetId): string | undefined {
  const manifestPath = join(cwd, 'package.json');
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  const otherTarget: TargetId = target === 'postgres' ? 'mongo' : 'postgres';
  const candidates = [
    targetPackageName(otherTarget, scaffoldSpecifierResolverFor(otherTarget)),
    targetPackageName(otherTarget),
  ];
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    return undefined;
  }
  const deps = parsed['dependencies'];
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
    return undefined;
  }
  const declared = deps;
  return candidates.find((name) => Object.hasOwn(declared, name));
}

async function resolveRemovePreviousFacade(ctx: {
  readonly cwd: string;
  readonly target: TargetId;
  readonly reinit: boolean;
  readonly keepPreviousFacade: boolean;
  readonly prompt: PromptSurface;
}): Promise<string | null> {
  if (!ctx.reinit || ctx.keepPreviousFacade) {
    return null;
  }
  const facade = previousFacade(ctx.cwd, ctx.target);
  if (facade === undefined) {
    return null;
  }
  const otherTarget: TargetId = ctx.target === 'postgres' ? 'mongo' : 'postgres';
  const remove = await ctx.prompt.confirm(
    `Switching from ${targetLabel(otherTarget)} to ${targetLabel(ctx.target)} — remove ${facade} from package.json dependencies?`,
    { default: true },
  );
  return remove ? facade : null;
}

/**
 * Resolves every input from the flags and, where a flag is absent, from the
 * engine's prompt surface. Consent for a re-scaffold comes first: nothing else
 * is worth asking about a project the user may not want overwritten.
 */
export async function resolveInitInputs(ctx: {
  readonly cwd: string;
  readonly flags: InitFlagValues;
  readonly prompt: PromptSurface;
}): Promise<ResolvedInitInputs> {
  const { cwd, flags, prompt } = ctx;

  if (flags.strictProbe && !flags.probeDb) {
    throw errorInitStrictProbeWithoutProbe();
  }

  const reinit = existsSync(join(cwd, 'prisma-next.config.ts'));
  if (reinit) {
    await prompt.consent(CONSENT_QUESTION, { token: consentToken(cwd) });
  }

  const flagTarget = resolveTarget(flags.target);
  const flagAuthoring = resolveAuthoring(flags.authoring);

  let target: TargetId;
  let authoring: AuthoringId;
  try {
    target = flagTarget ?? (await askTarget(prompt));
    authoring = flagAuthoring ?? (await askAuthoring(prompt));
  } catch (error) {
    if (!isPromptRequired(error)) {
      throw error;
    }
    const missing = [
      ...(flagTarget === undefined ? ['target'] : []),
      ...(flagAuthoring === undefined ? ['authoring'] : []),
    ].filter((flag) => REQUIRED_FLAG_PROMPTS.has(flag));
    throw errorInitMissingFlags({
      missing,
      why: 'This session cannot prompt, so the answers have to arrive as flags.',
    });
  }

  const schemaPath =
    flags.schemaPath !== undefined
      ? validateSchemaPath(flags.schemaPath, authoring)
      : await askSchemaPath(prompt, authoring);

  const writeEnv =
    flags.writeEnv ||
    (await prompt.confirm('Also write a .env file from .env.example? (gitignored)', {
      default: false,
    }));

  const removePreviousFacade = await resolveRemovePreviousFacade({
    cwd,
    target,
    reinit,
    keepPreviousFacade: flags.keepPreviousFacade,
    prompt,
  });

  return {
    target,
    authoring,
    schemaPath,
    install: !flags.skipInstall,
    writeEnv,
    probeDb: flags.probeDb,
    strictProbe: flags.strictProbe,
    reinit,
    removePreviousFacade,
    installProjectSkill: !flags.skipSkills,
  };
}
