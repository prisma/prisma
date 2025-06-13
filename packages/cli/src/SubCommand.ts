import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { getCommand } from '@antfu/ni'
import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import type { Command } from '@prisma/internals'
import { command } from 'execa'
import { bold, dim, red } from 'kleur/colors'

const debug = Debug('prisma:cli:subcommand')

/**
 * Sub-CLIs that are installed on demand need to implement this interface
 */
type Runnable = {
  run: (args: string[], config: PrismaConfigInternal) => Promise<void>
}

class BunInstallError extends Error {
  constructor(readonly reason: unknown) {
    super('Failed to install subcommand package via bun')
  }
}

class NpmInstallError extends Error {
  constructor(readonly reason: unknown) {
    super('Failed to install subcommand package via npm')
  }
}

class ImportError extends Error {
  constructor(readonly reason: unknown) {
    super('Failed to import subcommand package')
  }
}

class DenoNotSupportedError extends Error {
  constructor() {
    super('Deno is an unsupported CLI runtime for this subcommand')
  }
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
    try {
      this.checkForDeno()

      // we accept forcing a version with @, eg. prisma rules @1.0.0 --help
      const [version, ...args] = argv[0]?.startsWith('@') ? argv : ['@latest', ...argv]

      // load the module and run it via the Runnable interface
      const module = await this.importPackage(this.pkg, version)
      await module.run(args, config)
    } catch (e) {
      this.handleError(e)
    }
    return ''
  }

  public help() {}

  private checkForDeno() {
    if (typeof globalThis.Deno !== 'undefined' && typeof globalThis.Deno.version !== 'undefined')
      throw new DenoNotSupportedError()
  }

  private async importPackage(pkg: string, version: string): Promise<Runnable> {
    const pkgWithVersion = `${pkg}${version}`

    // when version defaults to @latest, we cache it for the current day only
    const dayMillis = new Date().setHours(0, 0, 0, 0)
    const cacheKey = version === '@latest' ? `-${dayMillis}` : ''
    const prefix = `${tmpdir()}/${pkgWithVersion}${cacheKey}`

    // if the package is not installed yet, we install it otherwise we skip
    if (existsSync(prefix) === false) {
      await this.installPackage(pkgWithVersion, prefix)
    }

    const modulePath = pathToFileURL(join(prefix, 'node_modules', pkg, 'dist', 'index.js')).toString()
    try {
      return await import(modulePath)
    } catch (e) {
      debug(`import failed: ${e}`)
      debug(`=> wiping cache and retrying`)
      return this.wipeCacheAndRetry(pkgWithVersion, prefix, modulePath)
    }
  }

  private async wipeCacheAndRetry(pkgWithVersion: string, prefix: string, modulePath: string): Promise<Runnable> {
    // Wipe cache and retry if import fails
    rmSync(prefix, { recursive: true })
    await this.installPackage(pkgWithVersion, prefix)
    try {
      return await import(modulePath)
    } catch (e) {
      throw new ImportError(e)
    }
  }

  private async installPackage(pkgWithVersion: string, prefix: string) {
    process.stdout.write(dim(`Fetching latest updates for this subcommand...\n`))

    const installCmd = getCommand('npm', 'install', [
      pkgWithVersion,
      '--no-save',
      '--prefix',
      prefix,
      '--userconfig',
      prefix,
      '--loglevel',
      'error',
    ])
    debug(`running install cmd: ${installCmd}`)

    try {
      await command(installCmd, { stdout: 'ignore', stderr: 'inherit', env: process.env })
    } catch (e: unknown) {
      debug(`install via npm failed: ${e}`)
      if (typeof globalThis.Bun !== 'undefined' && typeof globalThis.Bun.version !== 'undefined') {
        await this.installPackageViaBun(pkgWithVersion)
      } else {
        throw new NpmInstallError(e)
      }
    }
  }

  /**
   * We install via bun only as fallback because bun does not support a custom install directory like npm via `--prefix`.
   * This means we cannot properly cache the package in the tmp directory but have to reinstall on every run if the user only has bun installed.
   */
  private async installPackageViaBun(pkgWithVersion: string) {
    const installCmd = `bun install ${pkgWithVersion} --no-save --silent`
    debug(`detected bun runtime - running install via: ${installCmd}`)
    try {
      await command(installCmd, { stdout: 'ignore', stderr: 'inherit', env: process.env })
    } catch (e: unknown) {
      debug(`install via bun failed: ${e}`)
      throw new BunInstallError(e)
    }
  }

  private handleError(error: unknown) {
    process.exitCode = 1
    if (error instanceof ImportError) {
      process.stdout.write(bold(red(`\nFailed to import this dynamic subcommand.\n`)))
      process.stdout.write(dim(`\nUnderlying Error: ${error.reason}\n`))
    } else if (error instanceof BunInstallError) {
      process.stdout.write(bold(red(`\nFailed to install this dynamic subcommand via bun.\n`)))
      process.stdout.write(`Prisma's dynamic subcommands work best with npm.\n`)
      process.stdout.write(`If you keep having issues, please try to install npm and rerun this command.\n`)
      process.stdout.write(dim(`\nUnderlying Error: ${error.reason}\n`))
    } else if (error instanceof NpmInstallError) {
      process.stdout.write(bold(red(`\nFailed to install dynamic subcommand via npm.\n`)))
      process.stdout.write(`This subcommand is dynamically loaded and therefore requires npm to be installed.\n`)
      process.stdout.write(`Please install npm and rerun this command.\n`)
      process.stdout.write(dim(`\nUnderlying Error: ${error.reason}\n`))
    } else if (error instanceof DenoNotSupportedError) {
      process.stdout.write(bold(red(`\nThis subcommand is not supported in Deno.\n`)))
      process.stdout.write(`Please use regular node.js to run this command.\nE.g. via 'npx prisma <cmd>'.\n`)
      process.stdout.write(
        `\nNote: You can still use Prisma's generated code via the 'prisma-client' generator on deno.\n`,
      )
      process.stdout.write(
        `See https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-deno-deploy for more information.\n`,
      )
    } else {
      process.stdout.write(bold(red(`\nFailed to run subcommand.\n`)))
      process.stdout.write(dim(`\nUnderlying Error: ${error}\n`))
    }
  }
}
