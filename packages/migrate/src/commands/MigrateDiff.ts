import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  type Command,
  format,
  getConfig,
  HelpError,
  isError,
  link,
  loadEnvFile,
  locateLocalCloudflareD1,
  toSchemasContainer,
  toSchemasWithConfigDir,
} from '@prisma/internals'
import fs from 'fs-jetpack'
import { bold, dim, green, italic } from 'kleur/colors'
import path from 'node:path'

import { getSchemaWithPath } from '../../../internals/src/cli/getSchema'
import { Migrate } from '../Migrate'
import type { EngineArgs, EngineResults } from '../types'
import { CaptureStdout } from '../utils/captureStdout'

const debug = Debug('prisma:migrate:diff')

const helpOptions = format(
  `${bold('Usage')}

  ${dim('$')} prisma migrate diff [options]

${bold('Options')}

  -h, --help               Display this help message
  --config                 Custom path to your Prisma config file
  -o, --output             Writes to a file instead of stdout

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

  --from-local-d1          Automatically locate the local Cloudflare D1 database
  --to-local-d1

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
  process.platform === 'win32' ? '' : '🔍 '
}Compares the database schema from two arbitrary sources, and outputs the differences either as a human-readable summary (by default) or an executable script.

${green('prisma migrate diff')} is a read-only command that does not write to your datasource(s).
${green('prisma db execute')} can be used to execute its ${green('--script')} output.

The command takes a source ${green('--from-...')} and a destination ${green('--to-...')}.
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

  From a local D1 database to a datamodel
  ${dim('$')} prisma migrate diff \\
    --from-local-d1 \\
    --to-schema-datamodel=./prisma/schema.prisma \\
    --script

  From a Prisma datamodel to a local D1 database
  ${dim('$')} prisma migrate diff \\
    --from-schema-datamodel=./prisma/schema.prisma \\
    --to-local-d1 \\
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

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--output': String,
        '-o': '--output',
        // From
        '--from-empty': Boolean,
        '--from-schema-datasource': String,
        '--from-schema-datamodel': String,
        '--from-url': String,
        '--from-migrations': String,
        '--from-local-d1': Boolean,
        // To
        '--to-empty': Boolean,
        '--to-schema-datasource': String,
        '--to-schema-datamodel': String,
        '--to-url': String,
        '--to-migrations': String,
        '--to-local-d1': Boolean,
        // Others
        '--shadow-database-url': String,
        '--script': Boolean,
        '--exit-code': Boolean,
        '--telemetry-information': String,
        '--config': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('migrate diff', args, config.schema, false)

    if (args['--help']) {
      return this.help()
    }

    const numberOfFromParameterProvided =
      Number(Boolean(args['--from-empty'])) +
      Number(Boolean(args['--from-schema-datasource'])) +
      Number(Boolean(args['--from-schema-datamodel'])) +
      Number(Boolean(args['--from-url'])) +
      Number(Boolean(args['--from-migrations'])) +
      Number(Boolean(args['--from-local-d1']))

    const numberOfToParameterProvided =
      Number(Boolean(args['--to-empty'])) +
      Number(Boolean(args['--to-schema-datasource'])) +
      Number(Boolean(args['--to-schema-datamodel'])) +
      Number(Boolean(args['--to-url'])) +
      Number(Boolean(args['--to-migrations'])) +
      Number(Boolean(args['--to-local-d1']))

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

    // Validate Cloudflare D1-related flags
    if (args['--shadow-database-url'] && (args['--from-local-d1'] || args['--to-local-d1'])) {
      return this.help('The flag `--shadow-database-url` is not compatible with `--from-local-d1` or `--to-local-d1`.')
    }

    let from: EngineArgs.MigrateDiffTarget
    if (args['--from-empty']) {
      from = {
        tag: 'empty',
      }
    } else if (args['--from-schema-datasource']) {
      // Load .env file that might be needed
      await loadEnvFile({ schemaPath: args['--from-schema-datasource'], printMessage: false, config })
      const schema = await getSchemaWithPath(path.resolve(args['--from-schema-datasource']), config.schema, {
        argumentName: '--from-schema-datasource',
      })
      const engineConfig = await getConfig({ datamodel: schema.schemas })
      from = {
        tag: 'schemaDatasource',
        ...toSchemasWithConfigDir(schema, engineConfig),
      }
    } else if (args['--from-schema-datamodel']) {
      const schema = await getSchemaWithPath(path.resolve(args['--from-schema-datamodel']), config.schema, {
        argumentName: '--from-schema-datamodel',
      })
      from = {
        tag: 'schemaDatamodel',
        ...toSchemasContainer(schema.schemas),
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
    } else if (args['--from-local-d1']) {
      const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
      from = {
        tag: 'url',
        url: `file:${d1Database}`,
      }
    }

    let to: EngineArgs.MigrateDiffTarget
    if (args['--to-empty']) {
      to = {
        tag: 'empty',
      }
    } else if (args['--to-schema-datasource']) {
      // Load .env file that might be needed
      await loadEnvFile({ schemaPath: args['--to-schema-datasource'], printMessage: false, config })
      const schema = await getSchemaWithPath(path.resolve(args['--to-schema-datasource']), config.schema, {
        argumentName: '--to-schema-datasource',
      })
      const engineConfig = await getConfig({ datamodel: schema.schemas })
      to = {
        tag: 'schemaDatasource',
        ...toSchemasWithConfigDir(schema, engineConfig),
      }
    } else if (args['--to-schema-datamodel']) {
      const schema = await getSchemaWithPath(path.resolve(args['--to-schema-datamodel']), config.schema, {
        argumentName: '--to-schema-datamodel',
      })
      to = {
        tag: 'schemaDatamodel',
        ...toSchemasContainer(schema.schemas),
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
    } else if (args['--to-local-d1']) {
      const d1Database = await locateLocalCloudflareD1({ arg: '--to-local-d1' })
      to = {
        tag: 'url',
        url: `file:${d1Database}`,
      }
    }

    const migrate = new Migrate()

    // Capture stdout if --output is defined
    const captureStdout = new CaptureStdout()
    const outputPath = args['--output']
    const isOutputDefined = Boolean(outputPath)
    if (isOutputDefined) {
      captureStdout.startCapture()
    }

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

    // Write output to file if --output is defined
    if (isOutputDefined) {
      captureStdout.stopCapture()
      const diffOutput = captureStdout.getCapturedText()
      captureStdout.clearCaptureText()
      await fs.writeAsync(outputPath!, diffOutput.join('\n'))
    }

    // Note: only contains the exitCode
    debug({ migrateDiffOutput: result })

    if (args['--exit-code'] && result.exitCode) {
      process.exit(result.exitCode)
    }

    // Return nothing
    // See below for where the printing to stdout happens
    // [console.info(result.params.content)](https://github.com/prisma/prisma/blob/e6d2bc01af44cec35cb2bda35a5c93e13dc4ba4e/packages/migrate/src/SchemaEngine.ts#L303)
    return ''
  }

  public help(error?: string): string | HelpError {
    if (error) {
      throw new HelpError(`\n${error}\n\n${helpOptions}`)
    }
    return MigrateDiff.help
  }
}
