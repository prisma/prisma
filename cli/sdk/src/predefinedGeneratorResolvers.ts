import resolvePkg from 'resolve-pkg'
import chalk from 'chalk'
import prompts from 'prompts'
import execa from 'execa'
import path from 'path'

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
  photonjs: async (baseDir, version) => {
    let photonDir = resolvePkg('@prisma/photon', { cwd: baseDir })

    if (!photonDir) {
      if (!process.stdout.isTTY) {
        throw new PhotonFacadeMissingError()
      } else {
        const { value } = await prompts({
          type: 'confirm',
          name: 'value',
          message:
            '@prisma/photon needs to be installed to use "photonjs". Do you want to install it now?',
          initial: true,
        })

        if (!value) {
          throw new PhotonFacadeMissingError()
        }

        await installPackage(baseDir, `@prisma/photon@${version ?? 'latest'}`)
      }
      photonDir = resolvePkg('@prisma/photon', { cwd: baseDir })

      if (!photonDir) {
        throw new Error(
          `Could not resolve @prisma/photon despite the installation that just happened. We're sorry.
Please try to install it by hand and rerun ${chalk.bold(
            'prisma2 generate',
          )} 🙏.`,
        )
      }
    }

    return {
      outputPath: photonDir,
      generatorPath: path.resolve(photonDir, 'generator-build/index.js'),
    }
  },
}

class PhotonFacadeMissingError extends Error {
  constructor() {
    super(`In order to use the ${chalk.underline(
      '"photonjs"',
    )} generator, you need to install @prisma/photon to your project:
${chalk.bold.green('npm add @prisma/photon')}`)
  }
}

async function installPackage(baseDir: string, pkg: string): Promise<void> {
  const yarnInstalled = await isYarnInstalled()

  const cmdName = yarnInstalled ? 'yarn' : 'npm'

  await execa.command(`${cmdName} add ${pkg}`, {
    cwd: baseDir,
    stdio: 'inherit',
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
