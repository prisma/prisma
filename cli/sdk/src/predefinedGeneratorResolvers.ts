import resolvePkg from 'resolve-pkg'
import chalk from 'chalk'
import prompts from 'prompts'
import execa from 'execa'
import path from 'path'
import fs from 'fs'
import Debug from 'debug'
import isCi from 'is-ci'
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
    throw new Error(`The generator provider "photonjs" with the corresponding package "@prisma/photon" has been deprecated.
The provider has been renamed to "prisma-client-js" and the package to "@prisma/client".
"@prisma/client" now exposes "PrismaClient" instead of "Photon". Please update your code accordingly 🙏`)
  },
  'prisma-client-js': async (baseDir, version) => {
    let prismaClientDir = resolvePkg('@prisma/client', { cwd: baseDir })

    if (debugEnabled) {
      console.log({ prismaClientDir })
    }

    if (!prismaClientDir) {
      if (
        !fs.existsSync(path.join(process.cwd(), 'package.json')) &&
        !fs.existsSync(path.join(process.cwd(), '../package.json'))
      ) {
        throw new PrismaClientFacadeMissingError()
      }
      if (!process.stdout.isTTY || isCi || process.env.GITHUB_ACTIONS) {
        throw new PrismaClientFacadeMissingError()
      } else {
        console.log(
          `In order to use the ${chalk.underline(
            '"prisma-client-js"',
          )} generator, you need to install ${chalk.bold(
            '@prisma/client',
          )} to your project.`,
        )
        const { value } = await prompts({
          type: 'confirm',
          name: 'value',
          message: 'Do you want to install it now?',
          initial: true,
        })

        if (!value) {
          throw new PrismaClientFacadeMissingError()
        }

        await installPackage(baseDir, `@prisma/client@${version ?? 'latest'}`)
      }
      prismaClientDir = resolvePkg('@prisma/client', { cwd: baseDir })

      if (!prismaClientDir) {
        throw new Error(
          `Could not resolve @prisma/client despite the installation that just happened. We're sorry.
Please try to install it by hand and rerun ${chalk.bold(
            'prisma2 generate',
          )} 🙏.`,
        )
      }
    }

    return {
      outputPath: prismaClientDir,
      generatorPath: path.resolve(prismaClientDir, 'generator-build/index.js'),
    }
  },
}

class PrismaClientFacadeMissingError extends Error {
  constructor() {
    super(`In order to use the ${chalk.underline(
      '"prisma-client-js"',
    )} generator, you need to install ${chalk.bold(
      '@prisma/client',
    )} to your project:
${chalk.bold.greenBright('npm install @prisma/client')}`)
  }
}

async function installPackage(baseDir: string, pkg: string): Promise<void> {
  const yarnInstalled = await isYarnInstalled()

  const cmdName = yarnInstalled ? 'yarn add' : 'npm install'

  await execa.command(`${cmdName} ${pkg}`, {
    cwd: baseDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      SKIP_GENERATE: 'true',
    },
  })
}

async function isYarnInstalled(): Promise<boolean> {
  try {
    await execa.command(`yarn --version`, { stdio: `ignore` })
    return true
  } catch (err) {
    return false
  }
}
