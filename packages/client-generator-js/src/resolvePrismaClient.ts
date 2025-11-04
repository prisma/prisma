import fs from 'node:fs/promises'
import path from 'node:path'

import { Command, detect, getCommand } from '@antfu/ni'
import { Debug } from '@prisma/debug'
import { longestCommonPathPrefix, resolvePkg } from '@prisma/internals'
import { execaCommand } from 'execa'
import { bold, dim, green, yellow } from 'kleur/colors'

export const debug = Debug('prisma:generator')

/**
 * Resolves the path to the Prisma Client to determine the default output directory.
 */
export async function resolvePrismaClient(baseDir: string): Promise<string> {
  const prismaClientDir = await findPrismaClientDir(baseDir)

  debug('baseDir', baseDir)

  if (!prismaClientDir) {
    throw new Error(
      `Could not resolve @prisma/client.
Please try to install it with ${bold(
        green(await getPackageCmd(baseDir, 'install', '@prisma/client')),
      )} and rerun ${bold(await getPackageCmd(baseDir, 'execute', 'prisma generate'))} 🙏.`,
    )
  }

  return prismaClientDir
}

/**
 * Resolves the path to the Prisma Client to determine the default output directory.
 * Installs the Prisma Client if it is not found.
 */
export async function resolveOrInstallPrismaClient(baseDir: string, version: string): Promise<string> {
  let prismaClientDir = await findPrismaClientDir(baseDir)

  debug('baseDir', baseDir)

  if (prismaClientDir) {
    return prismaClientDir
  }

  let projectRoot = longestCommonPathPrefix(baseDir, process.cwd())
  debug('projectRoot', projectRoot)

  const warningTag = `${bold('Warning:')} ${dim('[Prisma auto-install on generate]')}`

  if (projectRoot === undefined) {
    console.warn(
      yellow(
        `${warningTag} The Prisma schema directory ${bold(baseDir)} and the current working directory ${bold(
          process.cwd(),
        )} have no common ancestor. The Prisma schema directory will be used as the project root.`,
      ),
    )
    projectRoot = baseDir
  }

  try {
    await fs.stat(path.join(projectRoot, 'package.json'))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(
        yellow(
          `${warningTag} Prisma could not find a ${bold('package.json')} file in the inferred project root ${bold(
            projectRoot,
          )}. During the next step, when an auto-install of Prisma package(s) will be attempted, it will then be created by your package manager on the appropriate level if necessary.`,
        ),
      )
    } else {
      throw err
    }
  }

  const prismaCliDir = await resolvePkg('prisma', { basedir: baseDir })

  // Automatically installing the packages with Yarn on Windows won't work because
  // Yarn will try to unlink the Query Engine DLL, which is currently being used.
  // See https://github.com/prisma/prisma/issues/9184
  if (process.platform === 'win32' && (await isYarnUsed(baseDir))) {
    const hasCli = (s: string) => (prismaCliDir !== undefined ? s : '')
    const missingCli = (s: string) => (prismaCliDir === undefined ? s : '')

    throw new Error(
      `Could not resolve ${missingCli(`${bold('prisma')} and `)}${bold(
        '@prisma/client',
      )} in the current project. Please install ${hasCli('it')}${missingCli('them')} with ${missingCli(
        `${bold(green(`${await getPackageCmd(baseDir, 'add', 'prisma', '-D')}`))} and `,
      )}${bold(green(`${await getPackageCmd(baseDir, 'add', '@prisma/client')}`))}, and rerun ${bold(
        await getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`,
    )
  }

  if (!prismaCliDir) {
    await runPackageCmd(projectRoot, 'add', `prisma@${version}`, '-D', '--silent')
  }

  await runPackageCmd(projectRoot, 'add', `@prisma/client@${version}`, '--silent')

  // resolvePkg has caching, so we trick it not to do it 👇
  prismaClientDir = await findPrismaClientDir(path.join('.', baseDir))

  if (!prismaClientDir) {
    throw new Error(
      `Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with ${bold(
        green(`${await getPackageCmd(baseDir, 'add', '@prisma/client')}`),
      )} and rerun ${bold(await getPackageCmd(baseDir, 'execute', 'prisma generate'))} 🙏.`,
    )
  }

  console.info(
    `\n✔ Installed the ${bold(green('@prisma/client'))} and ${bold(green('prisma'))} packages in your project`,
  )

  return prismaClientDir
}

/**
 * Tries to find a `@prisma/client` that is next to the `prisma` CLI
 * @param baseDir from where to start looking from
 * @returns `@prisma/client` location
 */
async function findPrismaClientDir(baseDir: string) {
  const resolveOpts = { basedir: baseDir, preserveSymlinks: true }
  const cliDir = await resolvePkg('prisma', resolveOpts)
  const clientDir = await resolvePkg('@prisma/client', resolveOpts)
  const resolvedClientDir = clientDir && (await fs.realpath(clientDir))

  debug('prismaCliDir', cliDir)
  debug('prismaClientDir', clientDir)

  // If CLI not found, we can only continue forward, likely a test
  if (cliDir === undefined) return resolvedClientDir
  if (clientDir === undefined) return resolvedClientDir

  // for everything to work well we expect `../<client-dir>`
  const relDir = path.relative(cliDir, clientDir).split(path.sep)

  // if the client is not near `prisma`, in parent folder => fail
  if (relDir[0] !== '..' || relDir[1] === '..') return undefined

  // we return the resolved location as pnpm users will want that
  return resolvedClientDir
}

/**
 * Get the command to run for the given package manager in the given directory.
 */
async function getPackageCmd(cwd: string, cmd: Command, ...args: string[]): Promise<string> {
  const agent = await detect({ cwd, autoInstall: false, programmatic: true })
  return getCommand(agent ?? 'npm', cmd, args)
}

async function isYarnUsed(baseDir: string): Promise<boolean> {
  const agent = await detect({ cwd: baseDir, autoInstall: false, programmatic: true })
  return agent === 'yarn' || agent === 'yarn@berry'
}

async function runPackageCmd(cwd: string, cmd: Command, ...args: string[]): Promise<void> {
  await execaCommand(await getPackageCmd(cwd, cmd, ...args), {
    stdio: 'inherit',
    cwd,
  })
}
