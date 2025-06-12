import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { detect, getCommand } from '@antfu/ni'
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
      await this.installPackage(pkg, prefix)
    }

    // load the module and run it via the Runnable interface
    const modulePath = pathToFileURL(join(prefix, 'node_modules', this.pkg, 'dist', 'index.js'))
    let module: Runnable
    try {
      module = await import(modulePath.toString())
    } catch (e) {
      // Wipe cache and retry if import fails
      rmSync(prefix, { recursive: true })
      await this.installPackage(pkg, prefix)
      module = await import(modulePath.toString())
    }
    await module.run(args, config)

    return ''
  }

  public help() {}

  private async installPackage(pkg: string, prefix: string) {
    process.stdout.write(dim(`Fetching latest updates for this subcommand...\n`))
    const agent = await detect({ cwd: process.cwd(), autoInstall: false, programmatic: true })
    const installCmd = getCommand(agent ?? 'npm', 'install', [
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
}
