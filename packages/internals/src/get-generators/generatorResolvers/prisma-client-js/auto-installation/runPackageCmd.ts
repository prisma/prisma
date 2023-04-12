import { Command } from '@prisma/ni'
import execa from 'execa'

import { getPackageCmd } from './getPackageCmd'

/**
 * Run the command for the given package manager in the given directory.
 * @param cwd
 * @param cmd
 * @param args
 */
export async function runPackageCmd(cwd: string, cmd: Command, ...args: string[]): Promise<void> {
  await execa.command(await getPackageCmd(cwd, cmd, ...args), {
    // we skip this because we are already in the generator
    env: { PRISMA_SKIP_POSTINSTALL_GENERATE: 'true' },
    stdio: 'inherit',
    cwd,
  })
}
