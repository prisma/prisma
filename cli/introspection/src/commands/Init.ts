import { Command, Env, arg, format } from '@prisma/cli'
import { isError } from 'util'
import { mkdirpSync } from 'fs-extra'
import { initPrompt } from '../prompt/initPrompt'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { printError, printFix } from '../prompt/utils/print'

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
    const outputDir = outputDirName ? path.join(process.cwd(), outputDirName) : process.cwd()

    if (!fs.existsSync(outputDir)) {
      mkdirpSync(outputDir)
    } else {
      const schemaExists = fs.existsSync(path.join(outputDir, 'schema.prisma'))
      const prismaSchemaExists = fs.existsSync(path.join(outputDir, 'prisma/schema.prisma'))
      if (schemaExists || prismaSchemaExists) {
        const filePath = schemaExists ? 'schema.prisma' : 'prisma/schema.prisma'
        console.log(printError(`The project directory must not contain a ${chalk.bold(filePath)} file.`))
        console.log(
          printFix(`Run the command in a directory without a ${chalk.bold(filePath)} file
or provide a project name, e.g.: ${chalk.bold('prisma2 init hello-world')}`),
        )
        process.exit(1)
      }
    }

    await initPrompt(outputDir)
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
