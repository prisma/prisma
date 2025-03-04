import Debug from '@prisma/debug'
import fs from 'node:fs'
import { bold, dim, green, yellow } from 'kleur/colors'
import path from 'node:path'

import { longestCommonPathPrefix } from '../../../utils/path'
import { findPrismaClientDir } from './auto-installation/findPrismaClientDir'
import { getPackageCmd } from './auto-installation/getPackageCmd'
import { runPackageCmd } from './auto-installation/runPackageCmd'
import { checkTypeScriptVersion } from './check-dependencies/checkTypeScriptVersion'
import { isYarnUsed } from './check-dependencies/isYarnUsed'
import { resolvePkg } from './check-dependencies/resolve'

export const debug = Debug('prisma:generator')

/**
 * Client generator resolver. The generator is shipped with the Client, so if
 * the client is not installed, it will be installed unless generation is
 * skipped.
 * @param baseDir
 * @param version
 * @returns
 */
export async function prismaClientResolver(baseDir: string, version?: string) {
  let prismaClientDir = await findPrismaClientDir(baseDir)

  debug('baseDir', baseDir)

  await checkTypeScriptVersion()

  if (!prismaClientDir && !process.env.PRISMA_GENERATE_SKIP_AUTOINSTALL) {
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

    if (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
      console.warn(
        yellow(
          `${warningTag} Prisma could not find a ${bold('package.json')} file in the inferred project root ${bold(
            projectRoot,
          )}. During the next step, when an auto-install of Prisma package(s) will be attempted, it will then be created by your package manager on the appropriate level if necessary.`,
        ),
      )
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
      await runPackageCmd(projectRoot, 'add', `prisma@${version ?? 'latest'}`, '-D', '--silent')
    }

    await runPackageCmd(projectRoot, 'add', `@prisma/client@${version ?? 'latest'}`, '--silent')

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
  }

  if (!prismaClientDir) {
    throw new Error(
      `Could not resolve @prisma/client.
Please try to install it with ${bold(green('npm install @prisma/client'))} and rerun ${bold(
        await getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`,
    )
  }

  return {
    outputPath: prismaClientDir,
    generatorPath: path.resolve(prismaClientDir, 'generator-build/index.js'),
    isNode: true,
  }
}
