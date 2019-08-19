import { Command, Env, arg, format } from '@prisma/cli'
import { isError } from 'util'
import { promptInteractively } from '../prompt'
import { introspect } from '../introspect/util'
import chalk from 'chalk'
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, relative } from 'path'
import { findTemplate } from '../templates'
import { loadStarter } from '../loader'
import { mkdirpSync } from 'fs-extra'
import { InitPromptResult } from '../types'
import { renderInk } from '../prompt/inkTest'

export class Init implements Command {
  static new(env: Env): Init {
    return new Init(env)
  }

  private constructor(private readonly env: Env) {}

  async parse(argv: string[]): Promise<any> {
    // parse the arguments according to the spec
    const args = arg(argv, {})

    if (isError(args)) {
      return null
    }

    if (args['--help']) {
      return this.help()
    }

    const outputDirName = args._[0]
    const outputDir = outputDirName ? join(process.cwd(), outputDirName) : process.cwd()
    await renderInk()
    return

    // TODO: Move logic to the right place
    // const existingFiles = readdirSync(outputDir)

    //     if (existingFiles.length > 0) {
    //       const relativeOutPath = './' + relative(process.cwd(), outputDir)
    //       const s = existingFiles.length === 1 ? 's' : ''
    //       const plural = existingFiles.length === 1 ? '' : 's'
    //       const files =
    //         existingFiles.length > 3
    //           ? existingFiles
    //               .slice(0, 3)
    //               .map(f => chalk.bold(f))
    //               .join(', ') + `and ${existingFiles.length - 3} more files `
    //           : existingFiles.map(f => chalk.underline(f)).join(', ')
    //       throw new Error(`Can't start ${chalk.bold(
    //         'prisma2 init',
    //       )} as the file${plural} ${files} exist${s} in ${chalk.underline(relativeOutPath)}
    // Please either run ${chalk.greenBright('prisma2 init')} in an empty directory
    // or provide a directory to initialize in: ${chalk.greenBright('prisma2 init sub-dir')}`)
    //     }

    if (outputDirName) {
      try {
        // Create the output directories if needed (mkdir -p)
        mkdirSync(outputDir, { recursive: true })
      } catch (e) {
        if (e.code !== 'EEXIST') throw e
      }
    }

    try {
      const result = await promptInteractively(introspect, 'init')

      if (result.initConfiguration && result.initConfiguration.language) {
        const template = findTemplate(result.initConfiguration.template, result.initConfiguration.language)
        await loadStarter(template, outputDir, {
          installDependencies: true,
        })
      }

      this.patchPrismaConfig(result, outputDir)
    } catch (e) {
      console.error(e)
    }

    process.exit(0)
  }

  patchPrismaConfig(result: InitPromptResult, outputDir: string) {
    if (!result.introspectionResult || !result.introspectionResult.sdl) {
      return
    }
    mkdirpSync(join(outputDir, 'prisma'))
    writeFileSync(join(outputDir, 'prisma/schema.prisma'), result.introspectionResult.sdl)
  }

  help() {
    return console.log(
      format(`
Usage: prisma2 init

Initialize files for a new Prisma project
    `),
    )
  }
}
