import {
  Command,
  arg,
  format,
  HelpError,
  uriToCredentials,
  getCommandWithExecutor,
} from '@prisma/sdk'
import { isError } from 'util'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { printError } from './prompt/utils/print'
import { link, canConnectToDatabase } from '@prisma/sdk'
import dotenv from 'dotenv'

export const defaultSchema = (
  provider = 'postgresql',
) => `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`

export const defaultEnv = (
  url = 'postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public',
) => `# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL and SQLite.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="${url}"`

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  private static help = format(`
    Setup a new Prisma project
    
    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma init
  `)

  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(argv: string[]): Promise<any> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
    })

    if (isError(args) || args['--help']) {
      return this.help()
    }

    /**
     * Validation
     */

    const outputDirName = args._[0]
    if (outputDirName) {
      throw Error('The init command does not take any argument.')
    }

    const outputDir = process.cwd()

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

    if (fs.existsSync(path.join(outputDir, 'schema.prisma'))) {
      console.log(
        printError(`File ${chalk.bold(
          './schema.prisma',
        )} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    let provider: undefined | string
    let url: undefined | string

    if (args['--url']) {
      const canConnect = await canConnectToDatabase(args['--url'])
      if (canConnect !== true) {
        const { code, message } = canConnect

        // P1003 means that the db doesn't exist but we can connect
        if (code !== 'P1003') {
          if (code) {
            throw new Error(`${code}: ${message}`)
          } else {
            throw new Error(message)
          }
        }
      }
      const credentials = uriToCredentials(args['--url'])
      provider = credentials.type
      url = args['--url']
    }

    /**
     * Validation successful? Let's create everything!
     */

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    fs.writeFileSync(
      path.join(outputDir, 'schema.prisma'),
      defaultSchema(provider),
    )
    const envPath = path.join(outputDir, '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, defaultEnv(url))
    }  else {
      const envFile = fs.readFileSync(envPath, { encoding: 'utf8'})
      const config = dotenv.parse(envFile) // will return an object
      if(Object.keys(config).includes("DATABASE_URL")){
        console.warn(`${chalk.yellow('warn')}: DATABASE_URL already exists in ${chalk.bold(envPath)}`)
      } else {
        fs.appendFileSync(envPath, defaultEnv(url));
      }

    }

    const steps = [
      `Run ${chalk.green(
        getCommandWithExecutor('prisma introspect'),
      )} to turn your database schema into a Prisma data model.`,
      `Run ${chalk.green(
        getCommandWithExecutor('prisma generate'),
      )} to install Prisma Client. You can then start querying your database.`,
    ]

    if (!url) {
      steps.unshift(
        `Set the ${chalk.green('provider')} of the ${chalk.green(
          'datasource',
        )} block in ${chalk.green(
          'schema.prisma',
        )} to match your database: ${chalk.green('postgresql')}, ${chalk.green(
          'mysql',
        )} or ${chalk.green('sqlite')}.`,
      )
      steps.unshift(
        `Set the ${chalk.green('DATABASE_URL')} in the ${chalk.green(
          '.env',
        )} file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started.`,
      )
    }

    return `
✔ Your Prisma schema was created at ${chalk.green('./schema.prisma')}.
  You can now open it in your favorite editor.

Next steps:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

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
