import fs from 'fs'
import type { Command } from '@prisma/sdk'
import { arg, format, HelpError, isError, getSchemaPath, link, getCommandWithExecutor } from '@prisma/sdk'
import path from 'path'
import chalk from 'chalk'
import { Migrate } from '../Migrate'
import { NoSchemaFoundError, DbExecuteNeedsPreviewFeatureFlagError } from '../utils/errors'
import type { EngineArgs } from '../types'
import getStdin from 'get-stdin'

export class DbExecute implements Command {
  public static new(): DbExecute {
    return new DbExecute()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('🙌  ')}Execute native commands to your database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db push is currently in Preview (${link('https://pris.ly/d/preview')}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}

Run a native database command on the specified database.
You need to specify the datasource and the command input. 
The output of the command is connector-specific, and is not meant for returning data, but only to report success or failure.
On SQL databases, this command takes as input a SQL script. The whole script will be sent as a single command to the database.

This command is currently not supported on MongoDB.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db execute --preview-feature [options]

${chalk.bold('Options')}

      -h, --help   Display this help message
           --url   URL of the datasource to run the command on
        --schema   Path to your Prisma schema file to take the datasource URL from
         --stdin   Use the terminal standard input as input
          --file   Custom path to your file to execute


${chalk.bold('Examples')}

  Standard input as source and explicit database url.
  ${chalk.dim(
    '$',
  )} echo 'SELECT \`hello world\`;' | prisma db execute --preview-feature --stdin --url="mysql://localhost/testdb"

  SQL file as input and database URL from schema file.
  ${chalk.dim('$')} prisma db execute --preview-feature --file ./script.sql --schema schema.prisma
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--stdin': Boolean,
        '--file': String,
        '--schema': String,
        '--url': String,
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
      throw new DbExecuteNeedsPreviewFeatureFlagError()
    }

    // One of --stdin or --file is required
    if (args['--stdin'] && args['--file']) {
      throw new Error(
        `--stdin and --file cannot be used at the same time. Only 1 must be provided. 
See \`${chalk.green(getCommandWithExecutor('prisma db execute -h'))}\``,
      )
    } else if (!args['--stdin'] && !args['--file']) {
      throw new Error(
        `Either --stdin or --file must be provided.
See \`${chalk.green(getCommandWithExecutor('prisma db execute -h'))}\``,
      )
    }

    // One of --url or --schema is required
    if (args['--url'] && args['--schema']) {
      throw new Error(
        `--url and --schema cannot be used at the same time. Only 1 must be provided.
See \`${chalk.green(getCommandWithExecutor('prisma db execute -h'))}\``,
      )
    } else if (!args['--stdin'] && !args['--file']) {
      throw new Error(
        `Either --url or --schema must be provided.
See \`${chalk.green(getCommandWithExecutor('prisma db execute -h'))}\``,
      )
    }

    let script = ''
    // Read file
    if (args['--file']) {
      script = fs.readFileSync(path.resolve(args['--file']), 'utf-8')
    }
    // Read stdin
    if (args['--stdin']) {
      script = await getStdin()
      // If input is empty, stop here
      if (!script) {
        throw new Error(
          `--stdin was passed but the input was empty. See \`${chalk.green(
            getCommandWithExecutor('prisma db execute -h'),
          )}\``,
        )
      }
    }

    let datasourceType: EngineArgs.DbExecuteDatasourceType

    const schemaPath = await getSchemaPath(args['--schema'])
    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    // Execute command(s) to url passed
    if (args['--url']) {
      datasourceType = {
        tag: 'url',
        url: args['--url'],
      }
    } else {
      // Execute command(s) to url from schema
      datasourceType = {
        tag: 'schema',
        schema: schemaPath,
      }
    }

    // console.info(chalk.dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`))
    // await printDatasource(schemaPath)
    const migrate = new Migrate()

    try {
      await migrate.engine.dbExecute({
        script,
        datasourceType,
      })
    } finally {
      migrate.stop()
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbExecute.help}`)
    }
    return DbExecute.help
  }
}
