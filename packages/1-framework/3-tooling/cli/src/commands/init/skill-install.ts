import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { version as cliVersion } from '../../../package.json' with { type: 'json' };
import type { PackageManager } from './detect-package-manager';
import { errorInitSkillInstallFailed } from './errors';

const exec = promisify(execFile);

/**
 * Default base for the GitHub-URL form `<owner>/<repo>` consumed by
 * upstream `skills add`. Each `SkillSource` joins this base with its
 * own subpath (and optional `#ref` for version-pinned clusters).
 */
export const DEFAULT_SKILL_BASE = 'prisma/prisma';

/**
 * One skill install inside the Prisma Next monorepo. The CLI emits
 * one `skills add <base>/<subpath>[#ref] --agent ... --skill <name> -y`
 * invocation per source during `init`. Every skill lives directly
 * under the `skills/` subpath; the explicit `--skill` name keeps a
 * pinned install from capturing sibling skills with a different ref
 * policy.
 *
 * `ref` semantics:
 * - `cli`: pin to the CLI's own package version (lockstep with the
 *   skills' SPI). Used for the consolidated usage skill
 *   (`skills/prisma-8`), which describes the public package API
 *   and is pinned to the version of `@internal/*` currently
 *   installed in the consumer's project.
 * - `null`: no ref. The skill is "always-latest" — the cumulative
 *   instruction set is the source of truth, and the latest revision
 *   on `main` includes bug fixes for every prior transition. Used
 *   for the upgrade and extension-author-upgrade skills.
 */
export interface SkillSource {
  readonly subpath: string;
  readonly skill: string;
  readonly ref: 'cli' | null;
  readonly description: string;
}

export const DEFAULT_SKILL_SOURCES: readonly SkillSource[] = [
  {
    subpath: 'skills',
    skill: 'prisma-8',
    ref: 'cli',
    description: 'usage skill (version-locked to installed Prisma Next)',
  },
  {
    subpath: 'skills',
    skill: 'prisma-next-upgrade',
    ref: null,
    description: 'upgrade skill (always tracks `main`)',
  },
  {
    subpath: 'skills',
    skill: 'prisma-8-extension-upgrade',
    ref: null,
    description: 'extension-author upgrade skill (always tracks `main`)',
  },
];

/**
 * Test-only escape hatch for pinning the install base to a local
 * checkout. Production runs leave this unset, so installs always use
 * `DEFAULT_SKILL_BASE`.
 *
 * When set to an absolute filesystem path (typical for tests), the
 * `#ref` fragment is dropped — local-path mode in upstream's CLI does
 * not accept refs, and the local clone has whatever content the test
 * checked into it anyway. When set to anything else (e.g. a fork name
 * `myuser/prisma-next`), the ref policy is preserved.
 */
function resolveAgentSkillBase(): string {
  const override = process.env['PRISMA_NEXT_SKILLS_BASE']?.trim();
  return override && override.length > 0 ? override : DEFAULT_SKILL_BASE;
}

function isLocalPath(base: string): boolean {
  return base.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(base);
}

/** Agent slugs accepted by the upstream `skills add --agent` flag. */
export type SkillAgent = 'cursor' | 'claude-code' | 'codex' | 'windsurf';

/**
 * Agents passed to every project-level init install. Upstream `skills add`
 * is the source of truth for per-agent install behaviour; the CLI lists
 * every supported runtime on one invocation and delegates the rest.
 */
export const DEFAULT_SKILL_AGENTS: readonly SkillAgent[] = [
  'cursor',
  'claude-code',
  'codex',
  'windsurf',
];

/**
 * Build the `<base>/<subpath>[#ref]` URL the `skills` CLI will
 * resolve. Exported for unit tests so the per-source format can be
 * asserted without going through the full install loop.
 */
export function formatSkillSourceUrl(source: SkillSource): string {
  const base = resolveAgentSkillBase();
  const url = `${base}/${source.subpath}`;
  if (source.ref === null) return url;
  if (isLocalPath(base)) return url;
  if (source.ref === 'cli') return `${url}#v${cliVersion}`;
  return url;
}

/**
 * The skill-install command for one source, formatted for the
 * project's detected package manager. `npx`/`pnpm dlx`/`bunx` are
 * interchangeable to the user; we pick the variant that matches the
 * rest of the install step so a single project consistently uses one
 * runner.
 *
 * `--agent` takes space-separated slugs on one flag; the explicit
 * `--skill <name>` and `-y` skip the multi-select prompts a
 * non-interactive scaffold step cannot show.
 *
 * Exported for unit tests so the per-PM dispatch can be asserted
 * without a live subprocess.
 */
export function formatSkillInstallCommand(args: {
  readonly pm: PackageManager;
  readonly source: SkillSource;
  readonly agents?: readonly SkillAgent[];
}): string {
  const agents = args.agents ?? DEFAULT_SKILL_AGENTS;
  const cliArgs = [
    'skills@latest',
    'add',
    formatSkillSourceUrl(args.source),
    '--agent',
    ...agents,
    '--skill',
    args.source.skill,
    '-y',
  ];
  return formatPackageManagerCommand(args.pm, cliArgs);
}

/**
 * Ordered skill-install commands for one init run. Exported for unit tests.
 */
export function resolveProjectSkillInstallCommands(pm: PackageManager): readonly string[] {
  return DEFAULT_SKILL_SOURCES.map((source) => formatSkillInstallCommand({ pm, source }));
}

function formatPackageManagerCommand(pm: PackageManager, args: readonly string[]): string {
  switch (pm) {
    case 'pnpm':
      return `pnpm dlx ${args.join(' ')}`;
    case 'yarn':
      return `yarn dlx ${args.join(' ')}`;
    case 'bun':
      return `bunx ${args.join(' ')}`;
    case 'deno':
      return `deno run -A npm:${args.join(' ')}`;
    case 'npm':
      return `npx ${args.join(' ')}`;
  }
}

/**
 * Parse the project-pm-formatted command into an exec call. The
 * format-then-parse split keeps the user-facing command string the same
 * as the surface the structured error advertises, so a user who copies
 * the error's `fix` line gets the same invocation that init just
 * attempted. Single-quoted tokens are preserved in the display form so
 * shell-sensitive characters stay copy-safe, then stripped before
 * `execFile`.
 */
function commandToExec(command: string): {
  readonly file: string;
  readonly args: readonly string[];
} {
  const tokens = (command.match(/'[^']*'|\S+/g) ?? []).map((token) =>
    token.startsWith("'") && token.endsWith("'") ? token.slice(1, -1) : token,
  );
  return { file: tokens[0] ?? 'npx', args: tokens.slice(1) };
}

/**
 * Runs the project-level skill install for every source in
 * `DEFAULT_SKILL_SOURCES`, in order. Returns
 * `{ ok: true, commands }` on success; throws a structured
 * `errorInitSkillInstallFailed` on the first failure (subsequent
 * sources are not attempted — the user opted into Prisma Next by
 * running `init` and a partial install would leave the project in an
 * ambiguous state). The throw is intentionally fatal — project-level
 * skill install is unconditional (modulo `--no-skill`).
 */
export async function runProjectLevelSkillInstall(ctx: {
  readonly baseDir: string;
  readonly pm: PackageManager;
  readonly filesWritten: readonly string[];
}): Promise<{ readonly ok: true; readonly commands: readonly string[] }> {
  const commands: string[] = [];
  const installCommands = resolveProjectSkillInstallCommands(ctx.pm);

  for (const command of installCommands) {
    const { file, args } = commandToExec(command);
    try {
      await exec(file, args, { cwd: ctx.baseDir });
      commands.push(command);
    } catch (err) {
      throw errorInitSkillInstallFailed({
        skillInstallCommand: command,
        filesWritten: ctx.filesWritten,
        cause:
          redactSecrets(readChildStderr(err)) || (err instanceof Error ? err.message : String(err)),
      });
    }
  }
  return { ok: true, commands };
}

function readChildStderr(err: unknown): string {
  if (err instanceof Error && 'stderr' in err) {
    return String((err as { stderr: string }).stderr ?? '');
  }
  return '';
}

/**
 * Strips credentials from a `scheme://user:pass@host/...` URL anywhere
 * in `stderr`. Package-manager stderr regularly contains credentialed
 * registry URLs (private npm registries, GitHub Packages tokens), and
 * those bubble into the structured `errorInitSkillInstallFailed`
 * envelope, which ends up in logs and CI output. Redact at the
 * boundary so we never re-emit a secret.
 *
 * Exported for unit tests.
 */
export function redactSecrets(stderr: string): string {
  if (!stderr) return stderr;
  return stderr.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s]+)@/g, '$1***@');
}

// -------------------------------------------------------------------
// Legacy file cleanup
// -------------------------------------------------------------------

/**
 * Skill directories that predate the consolidated `prisma-8` skill:
 * the per-workflow usage cluster (including the renamed
 * `prisma-8-migration-review` spelling it briefly shipped under), the
 * pre-rename spellings of the consolidated skill and the
 * extension-author upgrade skill, and any hand-rolled `prisma-next`
 * stub. Projects initialised before the consolidation carry these as
 * sibling directories in each agent's install root; left in place
 * they compete with the current skills for activation, so init
 * removes them on every run.
 */
export const RETIRED_SKILL_NAMES = [
  'prisma-next',
  'prisma-next-quickstart',
  'prisma-next-contract',
  'prisma-next-migrations',
  'prisma-next-migration-review',
  'prisma-8-migration-review',
  'prisma-next-queries',
  'prisma-next-runtime',
  'prisma-next-build',
  'prisma-next-supabase',
  'prisma-next-debug',
  'prisma-next-feedback',
  'prisma-next-extension-upgrade',
] as const;

/**
 * Project-level install roots the upstream `skills` CLI uses for the
 * agents in `DEFAULT_SKILL_AGENTS`: cursor and codex install into
 * `.agents/skills`, claude-code into `.claude/skills`, windsurf into
 * `.windsurf/skills`.
 */
export const AGENT_SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.windsurf/skills'] as const;

/**
 * Every directory a retired per-workflow skill may occupy in a
 * consumer project. Init deletes each (recursively) before running the
 * skill install.
 */
export function legacySkillDirs(): readonly string[] {
  return AGENT_SKILL_ROOTS.flatMap((root) => RETIRED_SKILL_NAMES.map((name) => `${root}/${name}`));
}
