import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  getSchemaPath,
  link,
} from '@prisma/sdk'
import path from 'path'
import chalk from 'chalk'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists, getDbInfo } from '../utils/ensureDatabaseExists'
import { formatms } from '../utils/formatms'
import { PreviewFlagError } from '../utils/flagErrors'
import {
  DbPushIgnoreWarningsWithForceError,
  NoSchemaFoundError,
} from '../utils/errors'

export class DbPush implements Command {
  public static new(): DbPush {
    return new DbPush()
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : chalk.bold('🙌  ')
}Push the state from your Prisma schema to your database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db push is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim(
  'When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db push [options] --preview-feature

${chalk.bold('Options')}

           -h, --help   Display this help message
             --schema   Custom path to your Prisma schema
          -f, --force   Ignore data loss warnings
      --skip-generate   Skip generating artifacts (e.g. Prisma Client)

${chalk.bold('Examples')}

  Push the Prisma schema state to the database
  ${chalk.dim('$')} prisma db push --preview-feature

  Specify a schema
  ${chalk.dim('$')} prisma db push --preview-feature --schema=./schema.prisma

  Use --force to ignore data loss warnings
  ${chalk.dim('$')} prisma db push --preview-feature --force
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--preview-feature': Boolean,
        '--force': Boolean,
        '-f': '--force',
        '--skip-generate': Boolean,
        '--schema': String,
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
      throw new PreviewFlagError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const dbInfo = await getDbInfo(schemaPath)
    console.info(
      chalk.dim(
        `Datasource "${dbInfo.name}": ${dbInfo.dbType} ${dbInfo.schemaWord} "${dbInfo.dbName}" at "${dbInfo.dbLocation}"`,
      ),
    )

    const migrate = new Migrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('push', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    const before = Date.now()
    const migration = await migrate.push({
      force: args['--force'],
    })
    migrate.stop()

    if (migration.unexecutable && migration.unexecutable.length > 0) {
      const messages: string[] = []
      messages.push(
        `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
      )
      for (const item of migration.unexecutable) {
        messages.push(`${chalk(`  • ${item}`)}`)
      }
      console.log() // empty line
      throw new Error(`${messages.join('\n')}\n`)
    }

    if (migration.warnings && migration.warnings.length > 0) {
      console.log(
        chalk.bold.yellow(
          `\n⚠️  There might be data loss when applying the changes:\n`,
        ),
      )

      for (const warning of migration.warnings) {
        console.log(chalk(`  • ${warning}`))
      }
      console.log() // empty line

      if (!args['--force']) {
        throw new DbPushIgnoreWarningsWithForceError()
      }
    }

    if (migration.warnings.length === 0 && migration.executedSteps === 0) {
      console.info(`\nThe database is already in sync with the Prisma schema.`)
    } else {
      console.info(
        `\n${
          process.platform === 'win32' ? '' : '🚀  '
        }Your database is now in sync with your schema. Done in ${formatms(
          Date.now() - before,
        )}`,
      )

      // Run if not skipped
      if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
        await migrate.tryToRunGenerate()
      }
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbPush.help}`)
    }
    return DbPush.help
  }
}
