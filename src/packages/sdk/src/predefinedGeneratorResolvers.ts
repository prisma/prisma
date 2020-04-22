import resolvePkg from 'resolve-pkg'
import chalk from 'chalk'
import hasYarn from 'has-yarn'
import execa from 'execa'
import path from 'path'
import fs from 'fs'
import Debug from 'debug'
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
