import type { ConnectorType } from '@prisma/generator-helper'
import {
  arg,
  canConnectToDatabase,
  checkUnsupportedDataProxy,
  Command,
  format,
  getCommandWithExecutor,
  HelpError,
  link,
  logger,
  protocolToConnectorType,
} from '@prisma/internals'
import chalk from 'chalk'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { match, P } from 'ts-pattern'
import { isError } from 'util'

import { printError } from './utils/prompt/utils/print'

export const defaultSchema = (
  provider: ConnectorType = 'postgresql',
  generatorProvider: string = defaultGeneratorProvider,
  previewFeatures: string[] = defaultPreviewFeatures,
  output: string = defaultOutput,
) => {
  return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "${generatorProvider}"
${
  previewFeatures.length > 0
    ? `  previewFeatures = [${previewFeatures.map((feature) => `"${feature}"`).join(', ')}]\n`
    : ''
}${output != defaultOutput ? `  output = "${output}"\n` : ''}}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`
}

export const defaultEnv = (
  url = 'postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public',
  comments = true,
) => {
  let env = comments
    ? `# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
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
    case 'cockroachdb':
      return 26257
  }

  return undefined
}

export const defaultURL = (provider: ConnectorType, port = defaultPort(provider), schema = 'public') => {
  switch (provider) {
    case 'postgresql':
    case 'postgres':
      return `postgresql://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'cockroachdb':
      return `postgresql://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'mysql':
      return `mysql://johndoe:randompassword@localhost:${port}/mydb`
    case 'sqlserver':
      return `sqlserver://localhost:${port};database=mydb;user=SA;password=randompassword;`
    case 'jdbc:sqlserver':
      return `jdbc:sqlserver://localhost:${port};database=mydb;user=SA;password=randompassword;`
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

export const defaultGeneratorProvider = 'prisma-client-js'

export const defaultPreviewFeatures = []

export const defaultOutput = 'node_modules/.prisma/client'

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  private static help = format(`
  Set up a new Prisma project
    
  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma init [options]
  ${chalk.bold('Options')}
    
             -h, --help   Display this help message
  --datasource-provider   Define the datasource provider to use: postgresql, mysql, sqlite, sqlserver, mongodb or cockroachdb
   --generator-provider   Define the generator provider to use: by default, it will be prisma-client-js
      --preview-feature   Define the preview features to use: by default, there will be none
               --output   Define the output path to use: by default, it will be node_modules/.prisma/client
                  --url   Define a custom datasource url

  ${chalk.bold('Examples')}

  Set up a new Prisma project with PostgreSQL (default)
    ${chalk.dim('$')} prisma init

  Set up a new Prisma project and specify MySQL as the datasource provider to use
    ${chalk.dim('$')} prisma init --datasource-provider mysql

  Set up a new Prisma project and specify prisma-client-go as the generator provider to use
    ${chalk.dim('$')} prisma init --generator-provider prisma-client-go

  Set up a new Prisma project and specify x and y as the preview features to use
    ${chalk.dim('$')} prisma init --preview-feature x --preview-feature y

  Set up a new Prisma project and specify ./generated-client as the output path to use
    ${chalk.dim('$')} prisma init --output ./generated-client
  
  Set up a new Prisma project and specify the url that will be used
    ${chalk.dim('$')} prisma init --url mysql://user:password@localhost:3306/mydb
  `)

  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(argv: string[]): Promise<any> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--datasource-provider': String,
      '--generator-provider': String,
      '--preview-feature': [String],
      '--output': String,
    })

    if (isError(args) || args['--help']) {
      return this.help()
    }

    await checkUnsupportedDataProxy('init', args, false)

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

    const { provider, url } = await match(args)
      .with(
        {
          '--datasource-provider': P.when((provider): provider is string => Boolean(provider)),
        },
        (input) => {
          const providerLowercase = input['--datasource-provider'].toLowerCase()
          if (!['postgresql', 'mysql', 'sqlserver', 'sqlite', 'mongodb', 'cockroachdb'].includes(providerLowercase)) {
            throw new Error(
              `Provider "${args['--datasource-provider']}" is invalid or not supported. Try again with "postgresql", "mysql", "sqlite", "sqlserver", "mongodb" or "cockroachdb".`,
            )
          }
          const provider = providerLowercase as ConnectorType
          const url = defaultURL(provider)
          return Promise.resolve({
            provider,
            url,
          })
        },
      )
      .with(
        {
          '--url': P.when((url): url is string => Boolean(url)),
        },
        async (input) => {
          const url = input['--url']
          const canConnect = await canConnectToDatabase(url)
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

          const provider = protocolToConnectorType(`${url.split(':')[0]}:`)
          return { provider, url }
        },
      )
      .otherwise(() => {
        // Default to PostgreSQL
        return Promise.resolve({
          provider: 'postgresql' as ConnectorType,
          url: undefined,
        })
      })
    const generatorProvider = args['--generator-provider']
    const previewFeatures = args['--preview-feature']
    const output = args['--output']

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
      defaultSchema(provider, generatorProvider, previewFeatures, output),
    )

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
          )} You already have a .gitignore file. Don't forget to add \`.env\` in it to not commit any private information.`,
        )
      } else {
        console.error('Failed to write .gitignore file, reason: ', e)
      }
    }

    const steps: string[] = []

    if (provider === 'mongodb') {
      steps.push(`Define models in the schema.prisma file.`)
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
          )}, ${chalk.green('sqlserver')}, ${chalk.green('mongodb')} or ${chalk.green('cockroachdb')}.`,
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
${warnings.length > 0 && logger.should.warn() ? `\n${warnings.join('\n')}\n` : ''}
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
