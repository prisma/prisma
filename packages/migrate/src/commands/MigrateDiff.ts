import path from 'path'
import type { Command } from '@prisma/sdk'
import { arg, format, HelpError, isError, getSchemaPath, link, getCommandWithExecutor } from '@prisma/sdk'
import chalk from 'chalk'
import { Migrate } from '../Migrate'
import { MigrateDiffNeedsPreviewFeatureFlagError } from '../utils/errors'
import type { EngineArgs, EngineResults } from '../types'
import Debug from '@prisma/debug'

const debug = Debug('prisma:migrate:diff')
export class MigrateDiff implements Command {
  public static new(): MigrateDiff {
    return new MigrateDiff()
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : chalk.bold('🔍 ')
}Compares the database schema from two arbitrary sources, and displays the differences either as a human-readable summary (by default) or an executable script.

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `${chalk.green(`prisma migrate diff`)} is currently in Preview (${link('https://pris.ly/d/preview')}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}

${chalk.green(`prisma migrate diff`)} is a read-only command that does not write to your datasource(s).
${chalk.green(`prisma db execute`)} can be used to execute its ${chalk.green(`--script`)} output.

The command takes a source ${chalk.green(`--from-...`)} and a destination ${chalk.green(`--to-...`)}.
The source and destination must use the same provider,
e.g. a diff using 2 different providers like PostgreSQL and SQLite is not supported.

It compares the source with the destination to generate a diff. 
The diff can be interpreted as generating a migration that brings the source schema (from) to the shape of the destination schema (to).
The default output is a human readable diff, it can be rendered as SQL using \`--script\` on SQL databases.

See the documentation for more information ${link('https://pris.ly/d/migrate-diff')}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma migrate diff --preview-feature [options]

${chalk.bold('Options')}

                                       -h, --help  Display this help message

${chalk.italic('From and To inputs (1 `--from-...` and 1 `--to-...` must be provided):')}
                            --from-url / --to-url  A datasource URL
                        --from-empty / --to-empty  Flag to assume from or to is an empty datamodel
  --from-schema-datamodel / --to-schema-datamodel  Path to a Prisma schema file, uses the datamodel for the diff
--from-schema-datasource / --to-schema-datasource  Path to a Prisma schema file, uses the datasource url for the diff
              --from-migrations / --to-migrations  Path to the Prisma Migrate migrations directory

${chalk.italic('Shadow database (only required if using --from-migrations or --to-migrations):')}
                            --shadow-database-url  URL for the shadow database

${chalk.italic('Output format:')}
                                         --script  Render a SQL script to stdout instead of the default human readable summary (not supported on MongoDB)

${chalk.bold('Flag')}

                                --preview-feature  Run Preview Prisma commands

${chalk.bold('Examples')}
 
  From database to database as summary
    e.g. compare two live databases
  ${chalk.dim('$')} prisma migrate diff \\
    --preview-feature \\
    --from-url "$DATABASE_URL" \\
    --to-url "postgresql://login:password@localhost:5432/db2"
  
  From a live database to a Prisma datamodel
    e.g. roll forward after a migration failed in the middle
  ${chalk.dim('$')} prisma migrate diff \\
    --preview-feature \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-url "$PROD_DB" \\
    --to-schema-datamodel=next_datamodel.prisma \\
    --script
  
  From a live database to a datamodel 
    e.g. roll backward after a migration failed in the middle
  ${chalk.dim('$')} prisma migrate diff \\
    --preview-feature \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-url "$PROD_DB" \\
    --to-schema-datamodel=previous_datamodel.prisma \\
    --script
  
  From a Prisma Migrate \`migrations\` directory to another database
    e.g. generate a migration for a hotfix already applied on production
  ${chalk.dim('$')} prisma migrate diff \\
    --preview-feature \\
    --shadow-database-url "$SHADOW_DB" \\
    --from-migrations ./migrations \\
    --to-url "$PROD_DB" \\
    --script

  Execute the --script output with \`prisma db execute\` using bash pipe \`|\`
  ${chalk.dim('$')} prisma migrate diff \\
  --preview-feature \\
  --from-[...] \\
  --to-[...]  \\
  --script | prisma db execute --preview-feature --stdin --url="$DATABASE_URL"
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
        '--preview-feature': Boolean,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--preview-feature']) {
      throw new MigrateDiffNeedsPreviewFeatureFlagError()
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
      throw new Error(`${errorMessages.join('\n')}
See ${chalk.green(getCommandWithExecutor('prisma migrate diff -h'))}`)
    }

    let from: EngineArgs.MigrateDiffTarget
    if (args['--from-empty']) {
      from = {
        tag: 'empty',
      }
    } else if (args['--from-schema-datasource']) {
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
        script: args['--script'] || false,
        shadowDatabaseUrl: args['--shadow-database-url'],
      })
    } finally {
      migrate.stop()
    }

    debug(result)

    // Return nothing
    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${MigrateDiff.help}`)
    }
    return MigrateDiff.help
  }
}
