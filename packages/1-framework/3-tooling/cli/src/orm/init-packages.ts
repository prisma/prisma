import { ifDefined } from '@internal/utils/defined';
import type { PackageManagerId, PackageOperations } from '@prisma/cli-engine';
import type { CliStructuredError } from '@prisma/cli-engine/protocol';
import { isRecognisedPnpmResolutionError } from '../commands/init/pnpm-fallback';
import {
  DEFAULT_SKILL_AGENTS,
  DEFAULT_SKILL_SOURCES,
  formatSkillSourceUrl,
  type SkillInstallEnv,
} from '../commands/init/skill-sources';

/** What one install pair produced, and which manager finished it. */
export interface InstallOutcome {
  /** Absent on success; the capability's own failure otherwise. */
  readonly failure: CliStructuredError | undefined;
  /**
   * The manager override that succeeded, when the pnpm fallback fired. The
   * agent-skill install reuses it: driving `pnpm dlx` right after `pnpm add`
   * failed to resolve a workspace specifier would fail the same way.
   */
  readonly manager: PackageManagerId | undefined;
  readonly warnings: readonly string[];
}

function metaString(failure: CliStructuredError, key: string): string {
  const value = failure.meta?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * pnpm reported a specifier the published artifact leaked, which npm installs
 * happily. The engine redacts credentials out of the stderr it returns but
 * leaves error codes alone, which is what this reads.
 */
function pnpmLeakedASpecifier(failure: CliStructuredError): boolean {
  return (
    metaString(failure, 'manager') === 'pnpm' &&
    isRecognisedPnpmResolutionError(metaString(failure, 'stderrTail'))
  );
}

function fallbackWarning(failure: CliStructuredError): string {
  const firstLine = metaString(failure, 'stderrTail').trim().split('\n')[0] ?? '';
  return [
    'pnpm could not install: a published Prisma Next dependency leaked a `workspace:*` or `catalog:` specifier.',
    'Falling back to npm so init can complete.',
    firstLine === '' ? '' : `  pnpm error: ${firstLine}`,
    'Once the offending package republishes a clean version, re-run `pnpm install` to switch back.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Adds the runtime and development dependencies through the engine's package
 * manager. The retry is `init`'s alone: the engine spells and runs the
 * command, and this decides — from the stderr it returned — that another
 * manager is worth a try.
 */
export async function installProjectDependencies(ctx: {
  readonly packages: PackageOperations;
  readonly cwd: string;
  readonly deps: readonly string[];
  readonly devDeps: readonly string[];
  readonly catalogWarnings: readonly string[];
}): Promise<InstallOutcome> {
  const pair = async (manager?: PackageManagerId): Promise<CliStructuredError | undefined> => {
    const runtimeDeps = await ctx.packages.install({
      packages: ctx.deps,
      cwd: ctx.cwd,
      ...ifDefined('manager', manager),
    });
    if (!runtimeDeps.ok) {
      return runtimeDeps.failure;
    }
    const developmentDeps = await ctx.packages.install({
      packages: ctx.devDeps,
      dev: true,
      cwd: ctx.cwd,
      ...ifDefined('manager', manager),
    });
    return developmentDeps.ok ? undefined : developmentDeps.failure;
  };

  const failure = await pair();
  if (failure === undefined) {
    return { failure: undefined, manager: undefined, warnings: ctx.catalogWarnings };
  }
  if (!pnpmLeakedASpecifier(failure)) {
    return { failure, manager: undefined, warnings: [] };
  }

  const retryFailure = await pair('npm');
  if (retryFailure !== undefined) {
    return { failure: retryFailure, manager: undefined, warnings: [] };
  }
  // npm bypassed pnpm's resolver, so the workspace catalog is not what ended
  // up installed — saying otherwise alongside the fallback would contradict it.
  return { failure: undefined, manager: 'npm', warnings: [fallbackWarning(failure)] };
}

function skillArgs(url: string, skill: string): readonly string[] {
  return ['add', url, '--agent', ...DEFAULT_SKILL_AGENTS, '--skill', skill, '-y'];
}

/**
 * Registers every Prisma Next skill with the agent runtimes, in order. The
 * first failure stops the loop: the user opted into Prisma Next by running
 * `init`, and a half-installed skill set leaves the project ambiguous.
 */
export async function installAgentSkills(ctx: {
  readonly packages: PackageOperations;
  readonly cwd: string;
  readonly env: SkillInstallEnv;
  readonly manager: PackageManagerId | undefined;
}): Promise<CliStructuredError | undefined> {
  for (const source of DEFAULT_SKILL_SOURCES) {
    const result = await ctx.packages.run({
      package: 'skills@latest',
      args: skillArgs(formatSkillSourceUrl(source, ctx.env), source.skill),
      cwd: ctx.cwd,
      ...ifDefined('manager', ctx.manager),
    });
    if (!result.ok) {
      return result.failure;
    }
  }
  return undefined;
}
