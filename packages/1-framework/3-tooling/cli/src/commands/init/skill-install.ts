import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PackageManager } from './detect-package-manager';
import { errorInitSkillInstallFailed } from './errors';
import { resolveProjectSkillInstallCommands } from './skill-sources';

const exec = promisify(execFile);

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
