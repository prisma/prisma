import { Command, arg, format } from '@prisma/cli'
import { isError } from 'util'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { printError, printFix } from '../prompt/utils/print'

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  private constructor() {}

  async parse(argv: string[]): Promise<any> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
    })

    if (isError(args)) {
      return null
    }

    if (args['--help']) {
      return this.help()
    }

    const outputDirName = args._[0]
    const outputDir = outputDirName ? path.join(process.cwd(), outputDirName) : process.cwd()
    const prismaFolder = path.join(outputDir, 'prisma')

    if (fs.existsSync(path.join(outputDir, 'schema.prisma'))) {
      console.log(printError(`File ${chalk.bold('schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `))
      process.exit(1)
    }

    if (fs.existsSync(prismaFolder)) {
      console.log(printError(`Folder ${chalk.bold('prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `))
      process.exit(1)
    }

    if (fs.existsSync(path.join(prismaFolder, 'schema.prisma'))) {
      console.log(printError(`File ${chalk.bold('prisma/schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `))
      process.exit(1)
    }

    if (fs.existsSync(path.join(prismaFolder, 'schema.prisma'))) {
      console.log(printError(`File ${chalk.bold('prisma/schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `))
      process.exit(1)
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    if (!fs.existsSync(prismaFolder)) {
      fs.mkdirSync(prismaFolder)
    }

    const defaultSchema = fs.readFileSync(path.join(__dirname, 'default.prisma'), 'utf-8')

    fs.writeFileSync(path.join(prismaFolder, 'schema.prisma'), defaultSchema)

    return format(`
      We created ${chalk.green('prisma/schema.prisma')} for you.
      Edit it with your favorite editor to update your database connection so Prisma can connect to it.

      When done, run ${chalk.green('prisma2 introspect')} to test the connection and introspect the data model from your existing database.
      Then run ${chalk.green('prisma2 generate')} to generate a Prisma Client based on this data model that can be used in your application.

      More information in our documentation:
      http://tbd
    `)
  }

  help() {
    return console.log(
      format(`
        Usage: prisma2 init

        Setup Prisma for your existing database
      `),
    )
  }
}
