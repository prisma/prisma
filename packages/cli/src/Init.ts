import { confirm, input, select } from '@inquirer/prompts'
import { PrismaConfigInternal } from '@prisma/config'
import { unstable_startServer } from '@prisma/dev'
import { ServerState } from '@prisma/dev/internal/state'
import type { ConnectorType } from '@prisma/generator'
import {
  arg,
  canConnectToDatabase,
  checkUnsupportedDataProxy,
  Command,
  format,
  getCommandWithExecutor,
  HelpError,
  isError,
  link,
  logger,
  PRISMA_POSTGRES_PROTOCOL,
  PRISMA_POSTGRES_PROVIDER,
  protocolToConnectorType,
} from '@prisma/internals'
import dotenv from 'dotenv'
import { Schema as Shape } from 'effect'
import fs from 'fs'
import { bold, dim, green, red, yellow } from 'kleur/colors'
import ora from 'ora'
import path from 'path'
import { match, P } from 'ts-pattern'

import { poll, printPpgInitOutput } from './platform/_'
import { credentialsFile } from './platform/_lib/credentials'
import { successMessage } from './platform/_lib/messages'
import { getPrismaPostgresRegionsOrThrow } from './platform/accelerate/regions'
import { determineClientOutputPath } from './utils/client-output-path'
import { printError } from './utils/prompt/utils/print'

/**
 * Indicates if running in Bun runtime.
 */
export const isBun: boolean =
  // @ts-ignore
  !!globalThis.Bun || !!globalThis.process?.versions?.bun

export const defaultSchema = (props?: {
  datasourceProvider?: ConnectorType
  generatorProvider?: string
  previewFeatures?: string[]
  output?: string
  withModel?: boolean
}) => {
  const {
    datasourceProvider = 'postgresql',
    generatorProvider = defaultGeneratorProvider,
    previewFeatures = defaultPreviewFeatures,
    output = '../generated/prisma',
    withModel = false,
  } = props ?? {}

  const aboutAccelerate = `\n// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?
// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init\n`

  const isProviderCompatibleWithAccelerate = datasourceProvider !== 'sqlite'

  let schema = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema
${isProviderCompatibleWithAccelerate ? aboutAccelerate : ''}
generator client {
  provider = "${generatorProvider}"
${
  previewFeatures.length > 0
    ? `  previewFeatures = [${previewFeatures.map((feature) => `"${feature}"`).join(', ')}]\n`
    : ''
}  output   = "${output}"
}

datasource db {
  provider = "${datasourceProvider}"
}
`

  // We add a model to the schema file if the user passed the --with-model flag
  if (withModel) {
    const defaultAttributes = `email String  @unique
  name  String?`

    switch (datasourceProvider) {
      case 'mongodb':
        schema += `
model User {
  id    String  @id @default(auto()) @map("_id") @db.ObjectId
  ${defaultAttributes}
}
`
        break
      case 'cockroachdb':
        schema += `
model User {
  id    BigInt  @id @default(sequence())
  ${defaultAttributes}
}
`
        break
      default:
        schema += `
model User {
  id    Int     @id @default(autoincrement())
  ${defaultAttributes}
}
`
    }
  }

  return schema
}

export const defaultEnv = async (url: string | undefined, debug = false, comments = true) => {
  if (url === undefined) {
    let created = false
    const state =
      (await ServerState.fromServerDump({ debug })) ||
      ((created = true), await ServerState.createExclusively({ persistenceMode: 'stateful', debug }))

    if (created) {
      await state.close()
    }

    const server = await unstable_startServer({
      databasePort: state.databasePort,
      dryRun: true,
      port: state.port,
      shadowDatabasePort: state.shadowDatabasePort,
      debug,
    })

    url = server.ppg.url
  }

  let env = comments
    ? `# Environment variables declared in this file are NOT automatically loaded by Prisma.
# Please add \`import "dotenv/config";\` to your \`prisma.config.ts\` file, or use the Prisma CLI with Bun
# to load environment variables from .env files: https://pris.ly/prisma-config-env-vars.

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

${
  url.startsWith('prisma+postgres:') && url.includes('localhost')
    ? `# The following \`prisma+postgres\` URL is similar to the URL produced by running a local Prisma Postgres 
# server with the \`prisma dev\` CLI command, when not choosing any non-default ports or settings. The API key, unlike the 
# one found in a remote Prisma Postgres URL, does not contain any sensitive information.\n\n`
    : ''
}`
    : ''
  env += `DATABASE_URL="${url}"`
  return env
}

export const defaultPort = (datasourceProvider: ConnectorType) => {
  switch (datasourceProvider) {
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
    case PRISMA_POSTGRES_PROVIDER:
      return null
  }

  return undefined
}

export const defaultURL = (
  datasourceProvider: ConnectorType,
  port = defaultPort(datasourceProvider),
  schema = 'public',
) => {
  switch (datasourceProvider) {
    case 'postgresql':
      return `postgresql://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'cockroachdb':
      return `postgresql://johndoe:randompassword@localhost:${port}/mydb?schema=${schema}`
    case 'mysql':
      return `mysql://johndoe:randompassword@localhost:${port}/mydb`
    case 'sqlserver':
      return `sqlserver://localhost:${port};database=mydb;user=SA;password=randompassword;`
    case 'mongodb':
      return `mongodb+srv://root:randompassword@cluster0.ab1cd.mongodb.net/mydb?retryWrites=true&w=majority`
    case 'sqlite':
      return 'file:./dev.db'
    default:
      return undefined
  }
}

const defaultGitIgnore = () => {
  return `node_modules
# Keep environment variables out of version control
.env
`
}

export const defaultGeneratorProvider = 'prisma-client'

export const defaultPreviewFeatures = []

function normalizePath(configPath: string) {
  return JSON.stringify(configPath.replaceAll(path.sep, '/'))
}

export const defaultConfig = (props: { prismaFolder: string }) => {
  const { prismaFolder } = props

  const schemaPath = path.relative(process.cwd(), path.join(prismaFolder, 'schema.prisma'))
  const migrationsPath = path.relative(process.cwd(), path.join(prismaFolder, 'migrations'))

  return `import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: ${normalizePath(schemaPath)},
  migrations: {
    path: ${normalizePath(migrationsPath)},
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
`
}

export class Init implements Command {
  static new(): Init {
    return new Init()
  }

  private static help = format(`
  Set up a new Prisma project

  ${bold('Usage')}

    ${dim('$')} prisma init [options]

  ${bold('Options')}

             -h, --help   Display this help message
                   --db   Provisions a fully managed Prisma Postgres database on the Prisma Data Platform.
  --datasource-provider   Define the datasource provider to use: postgresql, mysql, sqlite, sqlserver, mongodb or cockroachdb
   --generator-provider   Define the generator provider to use. Default: \`prisma-client-js\`
      --preview-feature   Define a preview feature to use.
               --output   Define Prisma Client generator output path to use.
                  --url   Define a custom datasource url

  ${bold('Flags')}

           --with-model   Add example model to created schema file

  ${bold('Examples')}

  Set up a new \`prisma dev\`-ready (local Prisma Postgres) Prisma project
    ${dim('$')} prisma init

  Set up a new Prisma project and specify MySQL as the datasource provider to use
    ${dim('$')} prisma init --datasource-provider mysql

  Set up a new \`prisma dev\`-ready (local Prisma Postgres) Prisma project and specify \`prisma-client-go\` as the generator provider to use
    ${dim('$')} prisma init --generator-provider prisma-client-go

  Set up a new \`prisma dev\`-ready (local Prisma Postgres) Prisma project and specify \`x\` and \`y\` as the preview features to use
    ${dim('$')} prisma init --preview-feature x --preview-feature y

  Set up a new \`prisma dev\`-ready (local Prisma Postgres) Prisma project and specify \`./generated-client\` as the output path to use
    ${dim('$')} prisma init --output ./generated-client

  Set up a new Prisma project and specify the url that will be used
    ${dim('$')} prisma init --url mysql://user:password@localhost:3306/mydb

  Set up a new \`prisma dev\`-ready (local Prisma Postgres) Prisma project with an example model
    ${dim('$')} prisma init --with-model
  `)

  async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--datasource-provider': String,
      '--generator-provider': String,
      '--preview-feature': [String],
      '--output': String,
      '--with-model': Boolean,
      '--db': Boolean,
      '--region': String,
      '--name': String,
      '--non-interactive': Boolean,
      '--prompt': String,
      '--vibe': String,
      '--debug': Boolean,
    })

    if (isError(args) || args['--help']) {
      return this.help()
    }

    const urlArg = args['--url']

    if (urlArg) {
      checkUnsupportedDataProxy({
        cmd: 'init',
        validatedConfig: { datasource: { url: urlArg } },
      })
    }

    /**
     * Validation
     */

    const outputDirName = args._[0]
    if (outputDirName) {
      throw Error('The init command does not take any argument.')
    }

    const { datasourceProvider, url } = await match(args)
      .with(
        {
          '--datasource-provider': P.when((datasourceProvider): datasourceProvider is string =>
            Boolean(datasourceProvider),
          ),
        },
        (input) => {
          const datasourceProvider = input['--datasource-provider'].toLowerCase()

          assertDatasourceProvider(datasourceProvider)

          const url = defaultURL(datasourceProvider)

          return { datasourceProvider, url }
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

          const datasourceProvider = protocolToConnectorType(`${url.split(':')[0]}:`)
          return { datasourceProvider, url }
        },
      )
      .otherwise(() => {
        return {
          datasourceProvider: 'postgresql' as const,
          url: undefined,
        }
      })
    const generatorProvider = args['--generator-provider']
    const previewFeatures = args['--preview-feature']
    const output = args['--output']
    const isPpgCommand =
      args['--db'] || datasourceProvider === PRISMA_POSTGRES_PROVIDER || args['--prompt'] || args['--vibe']

    if (args['--debug']) {
      console.log(`[isBun]`, isBun)
    }

    let prismaPostgresDatabaseUrl: string | undefined
    let workspaceId = ``
    let projectId = ``
    let environmentId = ``

    const outputDir = process.cwd()
    const prismaFolder = path.join(outputDir, 'prisma')

    let generatedSchema: string | undefined
    let generatedName: string | undefined

    if (isPpgCommand) {
      const PlatformCommands = await import(`./platform/_`)

      const credentials = await credentialsFile.load()
      if (isError(credentials)) throw credentials

      if (!credentials) {
        if (args['--non-interactive']) {
          return 'Please authenticate before creating a Prisma Postgres project.'
        }
        console.log('This will create a project for you on console.prisma.io and requires you to be authenticated.')
        const authAnswer = await confirm({
          message: 'Would you like to authenticate?',
        })
        if (!authAnswer) {
          return 'Project creation aborted. You need to authenticate to use Prisma Postgres'
        }
        const authenticationResult = await PlatformCommands.loginOrSignup()
        console.log(`Successfully authenticated as ${bold(authenticationResult.email)}.`)
      }

      if (args['--prompt'] || args['--vibe']) {
        const prompt = args['--prompt'] || args['--vibe'] || ''
        const spinner = ora(`Generating a Prisma Schema based on your description ${bold(prompt)} ...`).start()

        try {
          const serverResponseShape = Shape.Struct({
            generatedSchema: Shape.String,
            generatedName: Shape.String,
          })

          ;({ generatedSchema, generatedName } = Shape.decodeUnknownSync(serverResponseShape)(
            await (
              await fetch(`https://prisma-generate-server.prisma.workers.dev/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  description: prompt,
                }),
              })
            ).json(),
          ))
        } catch (e) {
          spinner.fail()
          throw e
        }

        spinner.succeed('Schema is ready')
      }

      console.log("Let's set up your Prisma Postgres database!")
      const platformToken = await PlatformCommands.getTokenOrThrow(args)
      const defaultWorkspace = await PlatformCommands.Workspace.getDefaultWorkspaceOrThrow({ token: platformToken })
      const regions = await getPrismaPostgresRegionsOrThrow({ token: platformToken })

      const ppgRegionSelection =
        args['--region'] ||
        (await select({
          message: 'Select your region:',
          default: 'us-east-1',
          choices: regions.map((region) => ({
            name: `${region.id} - ${region.displayName}`,
            value: region.id,
            disabled: region.ppgStatus === 'unavailable',
          })),
          loop: true,
        }))

      const projectDisplayNameAnswer =
        args['--name'] ||
        (await input({
          message: 'Enter a project name:',
          default: generatedName || 'My Prisma Project',
        }))

      const spinner = ora(`Creating project ${bold(projectDisplayNameAnswer)} (this may take a few seconds)...`).start()

      try {
        const project = await PlatformCommands.Project.createProjectOrThrow({
          token: platformToken,
          displayName: projectDisplayNameAnswer,
          workspaceId: defaultWorkspace.id,
          allowRemoteDatabases: false,
          ppgRegion: ppgRegionSelection,
        })

        spinner.text = `Waiting for your Prisma Postgres database to be ready...`

        workspaceId = defaultWorkspace.id
        projectId = project.id
        environmentId = project.defaultEnvironment.id

        await poll(
          () =>
            PlatformCommands.Environment.getEnvironmentOrThrow({
              environmentId: project.defaultEnvironment.id,
              token: platformToken,
            }),
          (environment: Awaited<ReturnType<typeof PlatformCommands.Environment.getEnvironmentOrThrow>>) =>
            environment.ppg.status === 'healthy' && environment.accelerate.status.enabled,
          5000, // Poll every 5 seconds
          120000, // if it takes more than two minutes, bail with an error
        )

        const serviceToken = await PlatformCommands.ServiceToken.createOrThrow({
          token: platformToken,
          environmentId: project.defaultEnvironment.id,
          displayName: `database-setup-prismaPostgres-api-key`,
        })

        prismaPostgresDatabaseUrl = `${PRISMA_POSTGRES_PROTOCOL}//accelerate.prisma-data.net/?api_key=${serviceToken.value}`

        spinner.succeed(successMessage('Your Prisma Postgres database is ready ✅'))
      } catch (error) {
        spinner.fail(error instanceof Error ? error.message : 'Something went wrong')
        throw error
      }
    }

    if (
      fs.existsSync(path.join(outputDir, 'schema.prisma')) ||
      fs.existsSync(prismaFolder) ||
      fs.existsSync(path.join(prismaFolder, 'schema.prisma'))
    ) {
      if (isPpgCommand) {
        return printPpgInitOutput({
          databaseUrl: prismaPostgresDatabaseUrl!,
          workspaceId,
          projectId,
          environmentId,
          isExistingPrismaProject: true,
        })
      }
    }

    if (fs.existsSync(path.join(outputDir, 'schema.prisma'))) {
      console.log(
        printError(`File ${bold('schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(prismaFolder)) {
      console.log(
        printError(`A folder called ${bold('prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
    }

    if (fs.existsSync(path.join(prismaFolder, 'schema.prisma'))) {
      console.log(
        printError(`File ${bold('prisma/schema.prisma')} already exists in your project.
        Please try again in a project that is not yet using Prisma.
      `),
      )
      process.exit(1)
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

    const clientOutput = output ?? determineClientOutputPath(prismaFolder)

    fs.writeFileSync(
      path.join(prismaFolder, 'schema.prisma'),
      generatedSchema ||
        defaultSchema({
          datasourceProvider,
          generatorProvider,
          previewFeatures,
          output: clientOutput,
          withModel: args['--with-model'],
        }),
    )

    const databaseUrl = prismaPostgresDatabaseUrl || url
    const warnings: string[] = []

    // Write prisma.config.ts
    fs.writeFileSync(
      path.join(outputDir, 'prisma.config.ts'),
      defaultConfig({
        prismaFolder,
      }),
    )

    const envPath = path.join(outputDir, '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, await defaultEnv(databaseUrl, args['--debug']))
    } else {
      const envFile = fs.readFileSync(envPath, { encoding: 'utf8' })
      const config = dotenv.parse(envFile) // will return an object
      if (Object.keys(config).includes('DATABASE_URL')) {
        warnings.push(
          `${yellow('warn')} Prisma would have added DATABASE_URL but it already exists in ${bold(
            path.relative(outputDir, envPath),
          )}`,
        )
      } else {
        fs.appendFileSync(
          envPath,
          `\n\n` + '# This was inserted by `prisma init`:\n' + (await defaultEnv(databaseUrl, args['--debug'])),
        )
      }
    }

    const gitignorePath = path.join(outputDir, '.gitignore')
    try {
      fs.writeFileSync(gitignorePath, defaultGitIgnore(), { flag: 'wx' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
        warnings.push(
          `${yellow(
            'warn',
          )} You already have a .gitignore file. Don't forget to add \`.env\` in it to not commit any private information.`,
        )
      } else {
        console.error('Failed to write .gitignore file, reason: ', e)
      }
    }

    // Append the generated client to the .gitignore file regardless of whether we created it
    // in the previous step.
    const clientPathRelativeToOutputDir = path.relative(outputDir, path.resolve(prismaFolder, clientOutput))
    try {
      fs.appendFileSync(gitignorePath, `\n/${clientPathRelativeToOutputDir.replaceAll(path.sep, '/')}\n`)
    } catch (e) {
      console.error('Failed to append client path to .gitignore file, reason: ', e)
    }

    const steps: string[] = []

    if (!isBun) {
      steps.push(
        `Install \`dotenv\`, and add \`import "dotenv/config";\` to your \`prisma.config.ts\` file to load environment variables from \`.env\`.`,
      )
    }

    const isPrismaDev = !args['--url'] && (datasourceProvider === 'postgres' || datasourceProvider === 'postgresql')

    if (isPrismaDev) {
      steps.push(`Run ${green(getCommandWithExecutor('prisma dev'))} to start a local Prisma Postgres server.`)
    } else if (!args['--url']) {
      steps.push(
        `Set the ${green('DATABASE_URL')} in the ${green(
          '.env',
        )} file to point to your existing database. If your database has no ${datasourceProvider === 'mongodb' ? 'collections' : 'tables'} yet, read https://pris.ly/d/getting-started`,
      )
    }

    if (isPrismaDev || datasourceProvider === 'mongodb') {
      steps.push(`Define models in the ${green('schema.prisma')} file.`)
    } else {
      steps.push(
        `Run ${green(getCommandWithExecutor('prisma db pull'))} to turn your database schema into a Prisma schema.`,
      )
    }

    if (isPrismaDev) {
      steps.push(
        `Run ${green(getCommandWithExecutor('prisma migrate dev'))} to migrate your local Prisma Postgres database.`,
      )
    } else {
      steps.push(
        `Run ${green(
          getCommandWithExecutor('prisma generate'),
        )} to generate the Prisma Client. You can then start querying your database.`,
      )
    }

    steps.push(
      `Tip: Explore how you can extend the ${green(
        'ORM',
      )} with scalable connection pooling, global caching, and a managed serverless Postgres database. Read: https://pris.ly/cli/beyond-orm`,
    )

    if (!isBun) {
      warnings.push(`Environment variables declared in the \`.env\` file are NOT automatically loaded by Prisma.
See: https://pris.ly/prisma-config-env-vars.`)
    }

    const defaultOutput = `
✔ Your Prisma schema was created at ${green('prisma/schema.prisma')}
✔ Your Prisma config was created at ${green('prisma.config.ts')}
  You can now open them in your favorite editor.
${warnings.length > 0 && logger.should.warn() ? `\n${warnings.join('\n')}\n` : ''}
Next steps:
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

More information in our documentation:
${link('https://pris.ly/d/getting-started')}
    `

    return isPpgCommand
      ? printPpgInitOutput({ databaseUrl: prismaPostgresDatabaseUrl!, workspaceId, projectId, environmentId })
      : defaultOutput
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Init.help}`)
    }
    return Init.help
  }
}

// order matters for the error message.
const DATASOURCE_PROVIDERS = [
  'postgresql',
  'mysql',
  'sqlite',
  'sqlserver',
  'mongodb',
  'cockroachdb',
  'prismapostgres',
  'prisma+postgres',
] as const

function assertDatasourceProvider(thing: unknown): asserts thing is ConnectorType {
  if (typeof thing !== 'string' || !DATASOURCE_PROVIDERS.includes(thing as never)) {
    throw new Error(
      `Provider "${thing}" is invalid or not supported. Try again with ${DATASOURCE_PROVIDERS.slice(0, -1)
        .map((p) => `"${p}"`)
        .join(', ')} or "${DATASOURCE_PROVIDERS.at(-1)}".`,
    )
  }
}
