import Debug from '@prisma/debug'
import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import hasYarn from 'has-yarn'
import path from 'path'

import { logger } from '.'
import { getCommandWithExecutor } from './utils/getCommandWithExecutor'
import { resolvePkg } from './utils/resolve'

const debug = Debug('prisma:generator')

const realPath = fs.promises.realpath

export type GeneratorPaths = {
  outputPath: string
  generatorPath: string
  isNode?: boolean
}

export type GeneratorResolver = (baseDir: string, version?: string) => Promise<GeneratorPaths>

export type PredefinedGeneratorResolvers = {
  [generatorName: string]: GeneratorResolver
}

/**
 * Tries to find a `@prisma/client` that is next to the `prisma` CLI
 * @param baseDir from where to start looking from
 * @returns `@prisma/client` location
 */
async function findPrismaClientDir(baseDir: string) {
  const resolveOpts = { basedir: baseDir, preserveSymlinks: true }
  const CLIDir = await resolvePkg('prisma', resolveOpts)
  const clientDir = await resolvePkg('@prisma/client', resolveOpts)
  const resolvedClientDir = clientDir && (await realPath(clientDir))

  debug('prismaCLIDir', CLIDir)
  debug('prismaClientDir', clientDir)

  // If CLI not found, we can only continue forward, likely a test
  if (CLIDir === undefined) return resolvedClientDir
  if (clientDir === undefined) return resolvedClientDir

  // for everything to work well we expect `../<client-dir>`
  const relDir = path.relative(CLIDir, clientDir).split(path.sep)

  // if the client is not near `prisma`, in parent folder => fail
  if (relDir[0] !== '..' || relDir[1] === '..') return undefined

  // we return the resolved location as pnpm users will want that
  return resolvedClientDir
}

export const predefinedGeneratorResolvers: PredefinedGeneratorResolvers = {
  photonjs: () => {
    throw new Error(`Oops! Photon has been renamed to Prisma Client. Please make the following adjustments:
  1. Rename ${chalk.red('provider = "photonjs"')} to ${chalk.green(
      'provider = "prisma-client-js"',
    )} in your ${chalk.bold('schema.prisma')} file.
  2. Replace your ${chalk.bold('package.json')}'s ${chalk.red('@prisma/photon')} dependency to ${chalk.green(
      '@prisma/client',
    )}
  3. Replace ${chalk.red("import { Photon } from '@prisma/photon'")} with ${chalk.green(
      "import { PrismaClient } from '@prisma/client'",
    )} in your code.
  4. Run ${chalk.green(getCommandWithExecutor('prisma generate'))} again.
      `)
  },
  'prisma-client-js': async (baseDir, version) => {
    let prismaClientDir = await findPrismaClientDir(baseDir)

    debug('baseDir', baseDir)

    checkYarnVersion()
    await checkTypeScriptVersion()

    if (!prismaClientDir && !process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL) {
      // TODO: should this be relative to `baseDir` rather than `process.cwd()`?
      if (
        !fs.existsSync(path.join(process.cwd(), 'package.json')) &&
        !fs.existsSync(path.join(process.cwd(), '../package.json'))
      ) {
        // Create default package.json
        const defaultPackageJson = `{
  "name": "my-prisma-project",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
`
        fs.writeFileSync(path.join(process.cwd(), 'package.json'), defaultPackageJson)
        console.info(`✔ Created ${chalk.bold.green('./package.json')}`)
      }

      const prismaCliDir = await resolvePkg('prisma', { basedir: baseDir })

      // Automatically installing the packages with Yarn on Windows won't work because
      // Yarn will try to unlink the Query Engine DLL, which is currently being used.
      // See https://github.com/prisma/prisma/issues/9184
      if (process.platform === 'win32' && isYarnUsed(baseDir)) {
        const hasCli = (s: string) => (prismaCliDir !== undefined ? s : '')
        const missingCli = (s: string) => (prismaCliDir === undefined ? s : '')

        throw new Error(
          `Could not resolve ${missingCli(`${chalk.bold('prisma')} and `)}${chalk.bold(
            '@prisma/client',
          )} in the current project. Please install ${hasCli('it')}${missingCli('them')} with ${missingCli(
            `${chalk.bold.greenBright(`${getAddPackageCommandName(baseDir, 'dev')} prisma`)} and `,
          )}${chalk.bold.greenBright(`${getAddPackageCommandName(baseDir)} @prisma/client`)}, and rerun ${chalk.bold(
            getCommandWithExecutor('prisma generate'),
          )} 🙏.`,
        )
      }

      if (!prismaCliDir) {
        await installPackage(baseDir, `prisma@${version ?? 'latest'}`, 'dev')
      }

      await installPackage(baseDir, `@prisma/client@${version ?? 'latest'}`)

      // resolvePkg has caching, so we trick it not to do it 👇
      prismaClientDir = await findPrismaClientDir(path.join('.', baseDir))

      if (!prismaClientDir) {
        throw new Error(
          `Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with ${chalk.bold.greenBright(
            `${getAddPackageCommandName(baseDir)} @prisma/client`,
          )} and rerun ${chalk.bold(getCommandWithExecutor('prisma generate'))} 🙏.`,
        )
      }

      console.info(
        `\n✔ Installed the ${chalk.bold.green('@prisma/client')} and ${chalk.bold.green(
          'prisma',
        )} packages in your project`,
      )
    }

    if (!prismaClientDir) {
      throw new Error(
        `Could not resolve @prisma/client.
Please try to install it with ${chalk.bold.greenBright('npm install @prisma/client')} and rerun ${chalk.bold(
          getCommandWithExecutor('prisma generate'),
        )} 🙏.`,
      )
    }

    return {
      outputPath: prismaClientDir,
      generatorPath: path.resolve(prismaClientDir, 'generator-build/index.js'),
      isNode: true,
    }
  },
}

function isYarnUsed(baseDir: string): boolean {
  // TODO: this may give false results for Yarn workspaces or when the schema is
  // in a non-standard location, implement proper detection.
  // Possibly related: https://github.com/prisma/prisma/discussions/10488
  return hasYarn(baseDir) || hasYarn(path.join(baseDir, '..'))
}

function getAddPackageCommandName(baseDir: string, dependencyType?: 'dev'): string {
  let command = isYarnUsed(baseDir) ? 'yarn add' : 'npm install'

  if (dependencyType === 'dev') {
    command += ' -D'
  }

  return command
}

async function installPackage(baseDir: string, pkg: string, dependencyType?: 'dev'): Promise<void> {
  const cmdName = getAddPackageCommandName(baseDir, dependencyType)

  await execa.command(`${cmdName} ${pkg}`, {
    cwd: baseDir,
    stdio: 'inherit',
    env: {
      PRISMA_SKIP_POSTINSTALL_GENERATE: 'true',
    },
  })
}

/**
 * Warn, if yarn is older than 1.19.2
 * Because Yarn used to remove all dot folders inside node_modules before.
 * We use node_modules/.prisma/client directory as default location for generated Prisma Client.
 * Changelog https://github.com/yarnpkg/yarn/blob/HEAD/CHANGELOG.md#1192
 */
function checkYarnVersion() {
  if (process.env.npm_config_user_agent) {
    const match = parseUserAgentString(process.env.npm_config_user_agent)
    if (match) {
      const { agent, major, minor, patch } = match
      if (agent === 'yarn' && major === 1) {
        const currentYarnVersion = `${major}.${minor}.${patch}`
        const minYarnVersion = '1.19.2'
        if (semverLt(currentYarnVersion, minYarnVersion)) {
          logger.warn(
            `Your ${chalk.bold(
              'yarn',
            )} has version ${currentYarnVersion}, which is outdated. Please update it to ${chalk.bold(
              minYarnVersion,
            )} or ${chalk.bold('newer')} in order to use Prisma.`,
          )
        }
      }
    }
  }
}

/**
 * Warn, if typescript is below `4.1.0` and is install locally
 * Because Template Literal Types are required for generating Prisma Client types.
 */
async function checkTypeScriptVersion() {
  const minVersion = '4.1.0'
  try {
    const typescriptPath = await resolvePkg('typescript', {
      basedir: process.cwd(),
    })
    debug('typescriptPath', typescriptPath)
    const typescriptPkg = typescriptPath && path.join(typescriptPath, 'package.json')
    if (typescriptPkg && fs.existsSync(typescriptPkg)) {
      const pjson = require(typescriptPkg)
      const currentVersion = pjson.version
      if (semverLt(currentVersion, minVersion)) {
        logger.warn(
          `Prisma detected that your ${chalk.bold(
            'TypeScript',
          )} version ${currentVersion} is outdated. If you want to use Prisma Client with TypeScript please update it to version ${chalk.bold(
            minVersion,
          )} or ${chalk.bold('newer')}. ${chalk.dim(`TypeScript found in: ${chalk.bold(typescriptPath)}`)}`,
        )
      }
    }
  } catch (e) {
    // They do not have TS installed, we ignore (example: JS project)
  }
}

/**
 * Returns true, if semver version `a` is lower than `b`
 * Note: This obviously doesn't support the full semver spec.
 * @param {string} a
 * @param {string} b
 */
function semverLt(a, b) {
  const [major1, minor1, patch1] = a.split('.')
  const [major2, minor2, patch2] = b.split('.')

  if (major1 < major2) {
    return true
  }

  if (major1 > major2) {
    return false
  }

  if (minor1 < minor2) {
    return true
  }

  if (minor1 > minor2) {
    return false
  }

  if (patch1 < patch2) {
    return true
  }

  if (patch1 > patch2) {
    return false
  }

  return false
}

function parseUserAgentString(str) {
  const userAgentRegex = /(\w+)\/(\d+)\.(\d+)\.(\d+)/
  const match = userAgentRegex.exec(str)
  if (match) {
    const agent = match[1]
    const major = parseInt(match[2])
    const minor = parseInt(match[3])
    const patch = parseInt(match[4])
    return { agent, major, minor, patch }
  }
  return null
}
