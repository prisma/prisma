import type { Command } from '@prisma/sdk'
import { arg, canConnectToDatabase, format, getCommandWithExecutor, HelpError, link, logger } from '@prisma/sdk'
import { protocolToConnectorType } from '@prisma/sdk/dist/convertCredentials'
import type { ConnectorType } from '@prisma/generator-helper'
import chalk from 'chalk'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { isError } from 'util'
import { printError } from './utils/prompt/utils/print'

export const defaultSchema = (provider: ConnectorType = 'postgresql') => {
  // add preview flag
  if (provider === 'mongodb') {
    return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["mongoDb"]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`
  } else {
    return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`
  }
}

export const defaultEnv = (
  url = 'postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public',
  comments = true,
) => {
  let env = comments
    ? `# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server and MongoDB (Preview).
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

  return undefined
}

export const defaultURL = (provider: ConnectorType, port = defaultPort(provider), schema = 'public') => {
  switch (provider) {
    case 'postgresql':
      return `postgresql://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'mysql':
      return `mysql://johndoe:randompassword@localhost:${port}/mydb`
    case 'sqlserver':
      return `sqlserver://localhost:${port};database=mydb;user=SA;password=randompassword;`
    case 'mongodb':
      return `mongodb+srv://root:randompassword@cluster0.ab1cd.mongodb.net/mydb?retryWrites=true&w=majority`
    case 'sqlite':
      return 'file:./dev.db'
  }
}

export const defaultGitIgnore = () => {
  return `node_modules
# Keep environment variables out of version control
.env
`
}

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  private static help = format(`
  Setup a new Prisma project
    
  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma init [options]
  ${chalk.bold('Options')}
    
             -h, --help   Display this help message
  --datasource-provider   Define the datasource provider to use: PostgreSQL, MySQL, SQLite, SQL Server or MongoDB (Preview)
                  --url   Define a custom datasource url

  ${chalk.bold('Examples')}

  Setup a new Prisma project with PostgreSQL (default)
    ${chalk.dim('$')} prisma init

  Setup a new Prisma project and specify MySQL as the datasource provider to use
    ${chalk.dim('$')} prisma init --datasource-provider mysql
  
  Setup a new Prisma project and specify the url that will be used
    ${chalk.dim('$')} prisma init --url mysql://user:password@localhost:3306/mydb
  `)

  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(argv: string[]): Promise<any> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--datasource-provider': String,
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
        printError(`File ${chalk.bold('schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(prismaFolder)) {
      console.log(
        printError(`A folder called ${chalk.bold('prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(path.join(prismaFolder, 'schema.prisma'))) {
      console.log(
        printError(`File ${chalk.bold('prisma/schema.prisma')} already exists in your project.
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

      provider = protocolToConnectorType(`${args['--url'].split(':')[0]}:`)
      url = args['--url']
    } else if (args['--datasource-provider']) {
      const providerLowercase = args['--datasource-provider'].toLowerCase()
      if (!['postgresql', 'mysql', 'sqlserver', 'sqlite', 'mongodb'].includes(providerLowercase)) {
        throw new Error(
          `Provider "${args['--datasource-provider']}" is invalid or not supported. Try again with "postgresql", "mysql", "sqlite", "sqlserver" or "mongodb".`,
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

    fs.writeFileSync(path.join(prismaFolder, 'schema.prisma'), defaultSchema(provider))

    const warnings: string[] = []
    const envPath = path.join(outputDir, '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, defaultEnv(url))
    } else {
      const envFile = fs.readFileSync(envPath, { encoding: 'utf8' })
      const config = dotenv.parse(envFile) // will return an object
      if (Object.keys(config).includes('DATABASE_URL')) {
        warnings.push(
          `${chalk.yellow('warn')} Prisma would have added DATABASE_URL but it already exists in ${chalk.bold(
            path.relative(outputDir, envPath),
          )}`,
        )
      } else {
        fs.appendFileSync(envPath, `\n\n` + '# This was inserted by `prisma init`:\n' + defaultEnv(url))
      }
    }

    const gitignorePath = path.join(outputDir, '.gitignore')
    try {
      fs.writeFileSync(gitignorePath, defaultGitIgnore(), { flag: 'wx' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        warnings.push(
          `${chalk.yellow(
            'warn',
          )} You already have a .gitignore. Don't forget to exclude .env to not commit any secret.`,
        )
      } else {
        console.error('Failed to write .gitignore file, reason: ', e)
      }
    }

    const steps: string[] = []

    if (provider === 'mongodb') {
      steps.push(`Define models in the prisma.schema file.`)
    } else {
      steps.push(
        `Run ${chalk.green(
          getCommandWithExecutor('prisma db pull'),
        )} to turn your database schema into a Prisma schema.`,
      )
    }

    steps.push(
      `Run ${chalk.green(
        getCommandWithExecutor('prisma generate'),
      )} to generate the Prisma Client. You can then start querying your database.`,
    )

    if (!url || args['--datasource-provider']) {
      if (!args['--datasource-provider']) {
        steps.unshift(
          `Set the ${chalk.green('provider')} of the ${chalk.green('datasource')} block in ${chalk.green(
            'schema.prisma',
          )} to match your database: ${chalk.green('postgresql')}, ${chalk.green('mysql')}, ${chalk.green(
            'sqlite',
          )}, ${chalk.green('sqlserver')} or ${chalk.green('mongodb')} (Preview).`,
        )
      }

      steps.unshift(
        `Set the ${chalk.green('DATABASE_URL')} in the ${chalk.green(
          '.env',
        )} file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started`,
      )
    }

    return `
✔ Your Prisma schema was created at ${chalk.green('prisma/schema.prisma')}
  You can now open it in your favorite editor.
${warnings.length > 0 && logger.should.warn ? `\n${warnings.join('\n')}\n` : ''}
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
