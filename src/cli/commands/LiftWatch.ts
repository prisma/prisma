import { Command } from '../types'
import { arg, isError, format } from '../utils'
import prompt from 'prompts'
import { HelpError } from '../Help'
import chalk from 'chalk'
import { Lift } from '../../Lift'
import path from 'path'
import { serializeFileMap } from '../../utils/serializeFileMap'
import { Env } from '../Env'
import { printFiles } from '../../utils/printFiles'
import { printMigrationId } from '../../utils/printMigrationId'
import fs from 'fs'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)

/**
 * $ prisma migrate new
 */
export class LiftWatch implements Command {
  static new(env: Env): LiftWatch {
    return new LiftWatch(env)
  }
  private constructor(private readonly env: Env) {}

  // parse arguments
  async parse(argv: string[], allowWatch = true): Promise<string | Error> {
    const args = arg(argv, {
      '--preview': Boolean,
      '-p': '--preview',
    })
    const preview = args['--preview'] || false

    // needed to not have infinite rewatching
    if (allowWatch) {
      fs.watch(
        path.join(this.env.cwd, 'datamodel.prisma'),
        (eventType, filename) => {
          if (eventType === 'change') {
            console.clear()
            this.parse(argv, false)
          }
        },
      )
    }

    const lift = new Lift(this.env.cwd)

    const migration = await lift.create('', preview)

    if (!migration) {
      return `Everything up-to-date\n` //TODO: find better wording
    }

    const { files, migrationId, newLockFile } = migration

    if (preview)
      return `\nWatching for changes in ${chalk.greenBright(
        'datamodel.prisma',
      )}`

    if (preview)
      return `\nRun ${chalk.greenBright(
        'prisma lift create --name MIGRATION_NAME',
      )} to create the migration\n`

    await lift.up({
      n: 1,
      short: true,
    })
    return ''
  }

  // get the name
  async name(name?: string): Promise<string | undefined> {
    if (name === '') return undefined
    if (name) return name
    let response = await prompt({
      type: 'text',
      name: 'name',
      message: `Name of migration ${chalk.dim('(optional)')}`,
      // validate: value => value.length,
    })
    return response.name || undefined
  }

  // help message
  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${LiftWatch.help}`,
      )
    }
    return LiftWatch.help
  }

  // static help template
  private static help = format(`
    Create a new migration.

    ${chalk.bold('Usage')}

      prisma migrate new [options]

    ${chalk.bold('Options')}

      -n, --name     Name of the migration
      -p, --preview  Preview the changes

    ${chalk.bold('Examples')}

      Create a new migration
      ${chalk.dim(`$`)} prisma migrate new

      Create a new migration by name
      ${chalk.dim(`$`)} prisma migrate new --name "add unique to email"

  `)
}
