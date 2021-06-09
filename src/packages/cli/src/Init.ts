import {
  arg,
  canConnectToDatabase,
  Command,
  format,
  getCommandWithExecutor,
  HelpError,
  link,
  logger,
} from '@prisma/sdk'
import {
  protocolToDatabaseType,
  databaseTypeToConnectorType,
} from '@prisma/sdk/dist/convertCredentials'
import { ConnectorType } from '@prisma/generator-helper'
import chalk from 'chalk'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { isError } from 'util'
import { printError } from './prompt/utils/print'

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
  comments = true,
) => {
  let env = comments
    ? `# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQL Server and SQLite.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings\n\n`
    : ''
  env += `DATABASE_URL="${url}"`
  return env
}

export const defaultPort = (provider: ConnectorType) => {
  switch (provider) {
    case 'mysql':
      return 3306
    case 'sqlserver':
      return 1433
    case 'mongodb':
      return 27017
    case 'postgresql':
      return 5432
  }
}

export const defaultURL = (
  provider: ConnectorType,
  port = defaultPort(provider),
  schema = 'public',
) => {
  switch (provider) {
    case 'postgresql':
      return `${provider}://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'mysql':
      return `${provider}://johndoe:randompassword@localhost:${port}/mydb`
    case 'sqlserver':
      return `${provider}://localhost:${port};database=mydb;user=SA;password=randompassword;`
    case 'mongodb':
      return `mongodb://johndoe:randompassword@localhost:${port}/mydb?authSource=admin`
    case 'sqlite':
      return 'file:./dev.db'
  }
}

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
      '--provider': String,
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

    let provider: ConnectorType
    let url: string | undefined

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

      provider = databaseTypeToConnectorType(
        protocolToDatabaseType(`${args['--url'].split(':')[0]}:`),
      )
      url = args['--url']
    } else if (args['--provider']) {
      const providerLowercase = args['--provider'].toLowerCase()
      if (
        !['postgresql', 'mysql', 'sqlserver', 'sqlite', 'mongodb'].includes(
          providerLowercase,
        )
      ) {
        throw new Error(
          `Provider "${args['--provider']}" is invalid or not supported. Try again with "postgresql", "mysql", "sqlserver" or "sqlite".`,
        )
      }
      provider = providerLowercase as ConnectorType
      url = defaultURL(provider)
    } else {
      // Default to PostgreSQL
      provider = 'postgresql'
    }

    /**
     * Validation successful? Let's create everything!
     */

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }

    if (!fs.existsSync(prismaFolder)) {
      fs.mkdirSync(prismaFolder)
    }

    fs.writeFileSync(
      path.join(prismaFolder, 'schema.prisma'),
      defaultSchema(provider),
    )

    let warning
    const envPath = path.join(outputDir, '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, defaultEnv(url))
    } else {
      const envFile = fs.readFileSync(envPath, { encoding: 'utf8' })
      const config = dotenv.parse(envFile) // will return an object
      if (Object.keys(config).includes('DATABASE_URL')) {
        warning = `${chalk.yellow('warn')} Prisma would have added ${defaultEnv(
          url,
          false,
        )} but it already exists in ${chalk.bold(
          path.relative(outputDir, envPath),
        )}`
      } else {
        fs.appendFileSync(
          envPath,
          `\n\n` +
            '# This text is inserted by `prisma init`:\n' +
            defaultEnv(url),
        )
      }
    }

    const steps = [
      `Run ${chalk.green(
        getCommandWithExecutor('prisma db pull'),
      )} to turn your database schema into a Prisma data model.`,
      `Run ${chalk.green(
        getCommandWithExecutor('prisma generate'),
      )} to install Prisma Client. You can then start querying your database.`,
    ]

    if (!url || args['--provider']) {
      if (!args['--provider']) {
        steps.unshift(
          `Set the ${chalk.green('provider')} of the ${chalk.green(
            'datasource',
          )} block in ${chalk.green(
            'schema.prisma',
          )} to match your database: ${chalk.green(
            'postgresql',
          )}, ${chalk.green('mysql')}, ${chalk.green(
            'sqlserver',
          )} or ${chalk.green('sqlite')}.`,
        )
      }

      steps.unshift(
        `Set the ${chalk.green('DATABASE_URL')} in the ${chalk.green(
          '.env',
        )} file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started`,
      )
    }

    return `
✔ Your Prisma schema was created at ${chalk.green('prisma/schema.prisma')}.
  You can now open it in your favorite editor.
${warning && logger.should.warn ? '\n' + warning + '\n' : ''}
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
