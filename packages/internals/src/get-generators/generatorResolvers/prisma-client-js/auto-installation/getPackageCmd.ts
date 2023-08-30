import { Command, detect, getCommand } from '@antfu/ni'

/**
 * Get the command to run for the given package manager in the given directory.
 * @param cwd
 * @param cmd
 * @param args
 * @returns
 */
export async function getPackageCmd(cwd: string, cmd: Command, ...args: string[]) {
  const agent = await detect({ autoInstall: false, cwd, programmatic: true })

  return getCommand(agent ?? 'npm', cmd, args)
}
