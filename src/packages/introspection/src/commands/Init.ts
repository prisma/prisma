import { Command, arg, format, HelpError } from '@prisma/sdk'
import { isError } from 'util'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { printError } from '../prompt/utils/print'
import { highlightTS, link } from '@prisma/sdk'

export const defaultSchema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`

export const defaultEnv = `# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL and SQLite.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"`

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  // static help template
  private static help = format(`
    Setup a new Prisma project
    
    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma init
  `)

  // eslint-disable-next-line @typescript-eslint/require-await
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
    if (outputDirName) {
      throw Error('The init command does not take any argument.')
    }

    const outputDir = process.cwd()
    const prismaFolder = path.join(outputDir, 'prisma')

    if (fs.existsSync(path.join(outputDir, 'schema.prisma'))) {
      console.log(
        printError(`File ${chalk.bold(
          'schema.prisma',
        )} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(prismaFolder)) {
      console.log(
        printError(`A folder called ${chalk.bold(
          'prisma',
        )} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(path.join(prismaFolder, 'schema.prisma'))) {
      console.log(
        printError(`File ${chalk.bold(
          'prisma/schema.prisma',
        )} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    if (!fs.existsSync(prismaFolder)) {
      fs.mkdirSync(prismaFolder)
    }

    fs.writeFileSync(path.join(prismaFolder, 'schema.prisma'), defaultSchema)
    fs.writeFileSync(path.join(prismaFolder, '.env'), defaultEnv)

    return `
✔ Your Prisma schema was created at ${chalk.green('prisma/schema.prisma')}.
  You can now open it in your favorite editor.

Next steps:
1. Set the ${chalk.green('provider')} of the ${chalk.green(
      'datasource',
    )} block in ${chalk.green(
      'schema.prisma',
    )} to match your database: ${chalk.green('postgresql')}, ${chalk.green(
      'mysql',
    )} or ${chalk.green('sqlite')}.
2. Set the ${chalk.green('DATABASE_URL')} in the ${chalk.green(
      '.env',
    )} file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started.
3. Run ${chalk.green(
      'prisma introspect',
    )} to turn your database schema into a Prisma data model.
4. Run ${chalk.green(
      'prisma generate',
    )} to install Prisma Client. You can then start querying your database.

More information in our documentation:
${link('https://pris.ly/d/getting-started')}
    `
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Init.help}`)
    }
    return Init.help
  }
}
