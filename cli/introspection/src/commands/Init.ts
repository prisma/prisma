import { Command, Env, arg, format } from '@prisma/cli'
import { isError } from 'util'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { mkdirpSync } from 'fs-extra'
import { InitPromptResult } from '../types'
import { initPrompt } from '../prompt/initPrompt'

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
    await initPrompt(outputDir)
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
