import Debug from '@prisma/debug'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

import { findPrismaClientDir } from './auto-installation/findPrismaClientDir'
import { getPackageCmd } from './auto-installation/getPackageCmd'
import { runPackageCmd } from './auto-installation/runPackageCmd'
import { checkTypeScriptVersion } from './check-dependencies/checkTypeScriptVersion'
import { checkYarnVersion } from './check-dependencies/checkYarnVersion'
import { isYarnUsed } from './check-dependencies/isYarnUsed'
import { resolvePkg } from './check-dependencies/resolve'

export const debug = Debug('prisma:generator')

/**
 * Client generator resolver. The generator is shipped with the Client, so f the
 * client is not installed, it will be installed unless generation is skipped.
 * @param baseDir
 * @param version
 * @returns
 */
export async function prismaClientResolver(baseDir: string, version?: string) {
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
          `${chalk.bold.greenBright(`${getPackageCmd(baseDir, 'install', 'prisma', '-D')}`)} and `,
        )}${chalk.bold.greenBright(`${getPackageCmd(baseDir, 'install', '@prisma/client')}`)}, and rerun ${chalk.bold(
          getPackageCmd(baseDir, 'execute', 'prisma generate'),
        )} 🙏.`,
      )
    }

    if (!prismaCliDir) {
      await runPackageCmd(baseDir, 'add', `prisma@${version ?? 'latest'}`, '-D')
    }

    await runPackageCmd(baseDir, 'add', `@prisma/client@${version ?? 'latest'}`)

    // resolvePkg has caching, so we trick it not to do it 👇
    prismaClientDir = await findPrismaClientDir(path.join('.', baseDir))

    if (!prismaClientDir) {
      throw new Error(
        `Could not resolve @prisma/client despite the installation that we just tried.
Please try to install it by hand with ${chalk.bold.greenBright(
          `${getPackageCmd(baseDir, 'install', '@prisma/client')}`,
        )} and rerun ${chalk.bold(getPackageCmd(baseDir, 'execute', 'prisma generate'))} 🙏.`,
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
        getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`,
    )
  }

  return {
    outputPath: prismaClientDir,
    generatorPath: path.resolve(prismaClientDir, 'generator-build/index.js'),
    isNode: true,
  }
}
