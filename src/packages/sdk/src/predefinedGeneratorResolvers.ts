import resolvePkg from 'resolve-pkg'
import chalk from 'chalk'
import hasYarn from 'has-yarn'
import execa from 'execa'
import path from 'path'
import fs from 'fs'
import Debug from '@prisma/debug'
const debugEnabled = Debug.enabled('generator')

export type GeneratorPaths = {
  outputPath: string
  generatorPath: string
}

export type GeneratorResolver = (
  baseDir: string,
  version?: string,
) => Promise<GeneratorPaths>

export type PredefinedGeneratorResolvers = {
  [generatorName: string]: GeneratorResolver
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
  4. Run ${chalk.green('prisma generate')} again.
      `)
  },
  'prisma-client-js': async (baseDir, version) => {
    let prismaClientDir = resolvePkg('@prisma/client', { cwd: baseDir })
    checkYarnVersion()

    if (debugEnabled) {
      console.log({ prismaClientDir })
    }

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

      await installPackage(baseDir, `-D @prisma/cli@${version ?? 'latest'}`)
      await installPackage(baseDir, `@prisma/client@${version ?? 'latest'}`)

      prismaClientDir = resolvePkg('@prisma/client', { cwd: baseDir })

      if (!prismaClientDir) {
        throw new Error(
          `Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with ${chalk.bold.greenBright(
            'npm install @prisma/client',
          )} and rerun ${chalk.bold('prisma generate')} 🙏.`,
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
        )} and rerun ${chalk.bold('prisma generate')} 🙏.`,
      )
    }

    return {
      outputPath: prismaClientDir,
      generatorPath: path.resolve(prismaClientDir, 'generator-build/index.js'),
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
      ...process.env,
      SKIP_GENERATE: 'true',
    },
  })
}

/**
 * Warn, if yarn is older than 1.19.2
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
          console.error(
            `${chalk.yellow('warning')} Your ${chalk.bold(
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
