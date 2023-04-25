import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  HelpError,
  isError,
  link,
  loadEnvFile,
  logger,
} from '@prisma/internals'
import { bold, dim, green, italic, red } from 'kleur/colors'
import path from 'path'

import { Migrate } from '../Migrate'
import type { EngineArgs, EngineResults } from '../types'

const debug = Debug('prisma:migrate:diff')

const helpOptions = format(
  `${bold('Usage')}

  ${dim('$')} prisma migrate diff [options]

${bold('Options')}

  -h, --help               Display this help message

${italic('From and To inputs (1 `--from-...` and 1 `--to-...` must be provided):')}
  --from-url               A datasource URL
  --to-url

  --from-empty             Flag to assume from or to is an empty datamodel
  --to-empty

  --from-schema-datamodel  Path to a Prisma schema file, uses the ${italic('datamodel')} for the diff
  --to-schema-datamodel

  --from-schema-datasource Path to a Prisma schema file, uses the ${italic('datasource url')} for the diff
  --to-schema-datasource

  --from-migrations        Path to the Prisma Migrate migrations directory
  --to-migrations

${italic('Shadow database (only required if using --from-migrations or --to-migrations):')}
  --shadow-database-url    URL for the shadow database

${bold('Flags')}

  --script                 Render a SQL script to stdout instead of the default human readable summary (not supported on MongoDB)
  --exit-code              Change the exit code behavior to signal if the diff is empty or not (Empty: 0, Error: 1, Not empty: 2). Default behavior is Success: 0, Error: 1.`,
)

export class MigrateDiff implements Command {
  public static new(): MigrateDiff {
    return new MigrateDiff()
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : bold('🔍 ')
}Compares the database schema from two arbitrary sources, and outputs the differences either as a human-readable summary (by default) or an executable script.

${green(`prisma migrate diff`)} is a read-only command that does not write to your datasource(s).
${green(`prisma db execute`)} can be used to execute its ${green(`--script`)} output.

The command takes a source ${green(`--from-...`)} and a destination ${green(`--to-...`)}.
The source and destination must use the same provider,
e.g. a diff using 2 different providers like PostgreSQL and SQLite is not supported.

It compares the source with the destination to generate a diff. 
The diff can be interpreted as generating a migration that brings the source schema (from) to the shape of the destination schema (to).
The default output is a human readable diff, it can be rendered as SQL using \`--script\` on SQL databases.

See the documentation for more information ${link('https://pris.ly/d/migrate-diff')}

${helpOptions}
${bold('Examples')}
 
  From database to database as summary
    e.g. compare two live databases
  ${dim('$')} prisma migrate diff \\
    --from-url "$DATABASE_URL" \\
    --to-url "postgresql://login:password@localhost:5432/db2"
  
  From a live database to a Prisma datamodel
    e.g. roll forward after a migration failed in the middle
  ${dim('$')} prisma migrate diff \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-url "$PROD_DB" \\
    --to-schema-datamodel=next_datamodel.prisma \\
    --script
  
  From a live database to a datamodel 
    e.g. roll backward after a migration failed in the middle
  ${dim('$')} prisma migrate diff \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-url "$PROD_DB" \\
    --to-schema-datamodel=previous_datamodel.prisma \\
    --script
  
  From a Prisma Migrate \`migrations\` directory to another database
    e.g. generate a migration for a hotfix already applied on production
  ${dim('$')} prisma migrate diff \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-migrations ./migrations \\
    --to-url "$PROD_DB" \\
    --script

  Execute the --script output with \`prisma db execute\` using bash pipe \`|\`
  ${dim('$')} prisma migrate diff \\
    --from-[...] \\
    --to-[...] \\
    --script | prisma db execute --stdin --url="$DATABASE_URL"

  Detect if both sources are in sync, it will exit with exit code 2 if changes are detected
  ${dim('$')} prisma migrate diff \\
    --exit-code \\
    --from-[...] \\
    --to-[...]
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        // From
        '--from-empty': Boolean,
        '--from-schema-datasource': String,
        '--from-schema-datamodel': String,
        '--from-url': String,
        '--from-migrations': String,
        // To
        '--to-empty': Boolean,
        '--to-schema-datasource': String,
        '--to-schema-datamodel': String,
        '--to-url': String,
        '--to-migrations': String,
        // Others
        '--shadow-database-url': String,
        '--script': Boolean,
        '--exit-code': Boolean,
        '--preview-feature': Boolean,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate diff', args, false)

    if (args['--help']) {
      return this.help()
    }

    if (args['--preview-feature']) {
      logger.warn(`"prisma migrate diff" was in Preview and is now Generally Available.
You can now remove the ${red('--preview-feature')} flag.`)
    }

    const numberOfFromParameterProvided =
      Number(Boolean(args['--from-empty'])) +
      Number(Boolean(args['--from-schema-datasource'])) +
      Number(Boolean(args['--from-schema-datamodel'])) +
      Number(Boolean(args['--from-url'])) +
      Number(Boolean(args['--from-migrations']))

    const numberOfToParameterProvided =
      Number(Boolean(args['--to-empty'])) +
      Number(Boolean(args['--to-schema-datasource'])) +
      Number(Boolean(args['--to-schema-datamodel'])) +
      Number(Boolean(args['--to-url'])) +
      Number(Boolean(args['--to-migrations']))

    // One of --to or --from is required
    if (numberOfFromParameterProvided !== 1 || numberOfToParameterProvided !== 1) {
      const errorMessages: string[] = []
      if (numberOfFromParameterProvided !== 1) {
        errorMessages.push(`${numberOfFromParameterProvided} \`--from-...\` parameter(s) provided. 1 must be provided.`)
      }
      if (numberOfToParameterProvided !== 1) {
        errorMessages.push(`${numberOfToParameterProvided} \`--to-...\` parameter(s) provided. 1 must be provided.`)
      }
      return this.help(`${errorMessages.join('\n')}`)
    }

    let from: EngineArgs.MigrateDiffTarget
    if (args['--from-empty']) {
      from = {
        tag: 'empty',
      }
    } else if (args['--from-schema-datasource']) {
      // Load .env file that might be needed
      loadEnvFile(args['--from-schema-datasource'], false)

      from = {
        tag: 'schemaDatasource',
        schema: path.resolve(args['--from-schema-datasource']),
      }
    } else if (args['--from-schema-datamodel']) {
      from = {
        tag: 'schemaDatamodel',
        schema: path.resolve(args['--from-schema-datamodel']),
      }
    } else if (args['--from-url']) {
      from = {
        tag: 'url',
        url: args['--from-url'],
      }
    } else if (args['--from-migrations']) {
      from = {
        tag: 'migrations',
        path: path.resolve(args['--from-migrations']),
      }
    }

    let to: EngineArgs.MigrateDiffTarget
    if (args['--to-empty']) {
      to = {
        tag: 'empty',
      }
    } else if (args['--to-schema-datasource']) {
      // Load .env file that might be needed
      loadEnvFile(args['--to-schema-datasource'], false)

      to = {
        tag: 'schemaDatasource',
        schema: path.resolve(args['--to-schema-datasource']),
      }
    } else if (args['--to-schema-datamodel']) {
      to = {
        tag: 'schemaDatamodel',
        schema: path.resolve(args['--to-schema-datamodel']),
      }
    } else if (args['--to-url']) {
      to = {
        tag: 'url',
        url: args['--to-url'],
      }
    } else if (args['--to-migrations']) {
      to = {
        tag: 'migrations',
        path: path.resolve(args['--to-migrations']),
      }
    }

    const migrate = new Migrate()

    let result: EngineResults.MigrateDiffOutput
    try {
      result = await migrate.engine.migrateDiff({
        from: from!,
        to: to!,
        script: args['--script'] || false, // default is false
        shadowDatabaseUrl: args['--shadow-database-url'],
        exitCode: args['--exit-code'],
      })
    } finally {
      // Stop engine
      migrate.stop()
    }

    debug(result)

    if (args['--exit-code'] && result.exitCode) {
      process.exit(result.exitCode)
    }

    // Return nothing
    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      throw new HelpError(`\n${error}\n\n${helpOptions}`)
    }
    return MigrateDiff.help
  }
}
