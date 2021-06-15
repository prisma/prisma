import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs'
import hasYarn from 'has-yarn'
import path from 'path'
import { logger } from '.'
import { getCommandWithExecutor } from './getCommandWithExecutor'
import { findUpAsync as findUp } from './utils/find'

// hide require from bundlers
const load = require

export type GeneratorPaths = {
  outputPath: string
  generatorPath: string
  isNode?: boolean
}

export type GeneratorResolver = (
  baseDir: string,
  version?: string,
) => Promise<GeneratorPaths>

export type PredefinedGeneratorResolvers = {
  [generatorName: string]: GeneratorResolver
}

async function getPkgDir(
  baseDir: string,
  pkgName: string,
): Promise<string | undefined> {
  const handler = (base: string, item: string) => {
    const itemPath = path.join(base, item)

    // if package.json `@prisma/client`, return `base`
    if (load(itemPath).name === pkgName) {
      return base
    }

    return false
  }

  return (
    await findUp(baseDir, ['package.json'], ['f'], ['d', 'l'], 1, handler)
  )[0]
}

async function getPrismaClientDir(baseDir: string) {
  // we check that the found client is not the one of the CLI
  const clientDir = await getPkgDir(baseDir, '@prisma/client')
  const cliDir = await getPkgDir(baseDir, 'prisma')

  // if we are testing the client in the CLI folder
  if (cliDir && process.cwd().includes(cliDir)) {
    return clientDir
  }

  // if the found client dir is not the one of CLI
  if (clientDir && !clientDir?.includes(cliDir!)) {
    return clientDir
  }

  return undefined
}

export const predefinedGeneratorResolvers: PredefinedGeneratorResolvers = {
  photonjs: () => {
    throw new Error(`Oops! Photon has been renamed to Prisma Client. Please make the following adjustments:
  1. Rename ${chalk.red('provider = "photonjs"')} to ${chalk.green(
      'provider = "prisma-client-js"',
    )} in your ${chalk.bold('schema.prisma')} file.
  2. Replace your ${chalk.bold('package.json')}'s ${chalk.red(
      '@prisma/photon',
    )} dependency to ${chalk.green('@prisma/client')}
  3. Replace ${chalk.red(
    "import { Photon } from '@prisma/photon'",
  )} with ${chalk.green(
      "import { PrismaClient } from '@prisma/client'",
    )} in your code.
  4. Run ${chalk.green(getCommandWithExecutor('prisma generate'))} again.
      `)
  },
  'prisma-client-js': async (baseDir, version) => {
    const prismaClientDir = await getPrismaClientDir(baseDir)

    checkYarnVersion()
    checkTypeScriptVersion()

    if (!prismaClientDir && !process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL) {
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
        fs.writeFileSync(
          path.join(process.cwd(), 'package.json'),
          defaultPackageJson,
        )
        console.info(`✔ Created ${chalk.bold.green('./package.json')}`)
      }

      await installPackage(baseDir, `-D prisma@${version ?? 'latest'}`)
      await installPackage(baseDir, `@prisma/client@${version ?? 'latest'}`)

      const prismaClientDir = await getPrismaClientDir(baseDir)

      if (!prismaClientDir) {
        throw new Error(
          `Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with ${chalk.bold.greenBright(
            'npm install @prisma/client',
          )} and rerun ${chalk.bold(
            getCommandWithExecutor('prisma generate'),
          )} 🙏.`,
        )
      }

      console.info(
        `\n✔ Installed the ${chalk.bold.green(
          '@prisma/client',
        )} and ${chalk.bold.green('prisma')} packages in your project`,
      )
    }

    if (!prismaClientDir) {
      throw new Error(
        `Could not resolve @prisma/client.
Please try to install it with ${chalk.bold.greenBright(
          'npm install @prisma/client',
        )} and rerun ${chalk.bold(
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

async function installPackage(baseDir: string, pkg: string): Promise<void> {
  const yarnUsed = hasYarn(baseDir) || hasYarn(path.join(baseDir, '..'))

  const cmdName = yarnUsed ? 'yarn add' : 'npm install'

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
 * Warn, if typescript is below `4.1.0` or if it is not install locally or globally
 * Because Template Literal Types are required for generating Prisma Client types.
 */
function checkTypeScriptVersion() {
  const minVersion = '4.1.0'
  try {
    const output = execa.sync('tsc', ['-v'], {
      preferLocal: true,
    })
    if (output.stdout) {
      const currentVersion = output.stdout.split(' ')[1]
      if (semverLt(currentVersion, minVersion)) {
        throw new Error(
          `Your ${chalk.bold(
            'typescript',
          )} version is ${currentVersion}, which is outdated. Please update it to ${chalk.bold(
            minVersion,
          )} or ${chalk.bold('newer')} in order to use Prisma Client.`,
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
