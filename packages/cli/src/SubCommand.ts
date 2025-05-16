import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { getCommand } from '@antfu/ni'
import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { command } from 'execa'
import { dim } from 'kleur/colors'

/**
 * Sub-CLIs that are installed on demand need to implement this interface
 */
type Runnable = {
  run: (args: string[], config: PrismaConfigInternal) => Promise<void>
}

/**
 * Generic SubCommand that installs a package on demand and runs it
 */
export class SubCommand implements Command {
  pkg: string

  constructor(pkg: string) {
    this.pkg = pkg
  }

  async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    // we accept forcing a version with @, eg. prisma rules @1.0.0 --help
    const [version, ...args] = argv[0]?.startsWith('@') ? argv : ['@latest', ...argv]
    const pkg = `${this.pkg}${version}`

    // when version defaults to @latest, we cache it for the current day only
    const dayMillis = new Date().setHours(0, 0, 0, 0)
    const cacheKey = version === '@latest' ? `-${dayMillis}` : ''
    const prefix = `${tmpdir()}/${pkg}${cacheKey}`

    // if the package is not installed yet, we install it otherwise we skip
    if (existsSync(prefix) === false) {
      process.stdout.write(dim(`Fetching latest updates for this subcommand...\n`))
      const installCmd = getCommand('npm', 'install', [
        pkg,
        '--no-save',
        '--prefix',
        prefix,
        '--userconfig',
        prefix,
        '--loglevel',
        'error',
      ])
      await command(installCmd, { stdout: 'ignore', stderr: 'inherit', env: process.env })
    }

    // load the module and run it via the Runnable interface
    const modulePath = pathToFileURL(join(prefix, 'node_modules', this.pkg, 'dist', 'index.js'))
    const module: Runnable = await import(modulePath.toString())
    await module.run(args, config)

    return ''
  }

  public help() {}
}
