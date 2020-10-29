import chalk from 'chalk'
import prompt from 'prompts'
import { getCommandWithExecutor, isCi } from '@prisma/sdk'

import { MigrationFeedback } from '../types'

export function handleUnexecutableSteps(
  unexecutableSteps: MigrationFeedback[],
) {
  if (unexecutableSteps && unexecutableSteps.length > 0) {
    const messages: string[] = []
    messages.push(
      `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
    )
    for (const item of unexecutableSteps) {
      messages.push(`${chalk(`  • ${item}`)}`)
    }
    console.info() // empty line
    // Exit
    throw new Error(`${messages.join('\n')}\n`)
  }
}

export async function handleWarnings(
  warnings: MigrationFeedback[],
  force = false,
): Promise<boolean | void> {
  if (warnings && warnings.length > 0) {
    console.log(
      chalk.bold(
        `\n\n⚠️  There will be data loss when applying the migration:\n`,
      ),
    )
    for (const warning of warnings) {
      console.log(chalk(`  • ${warning.message}`))
    }
    console.info() // empty line

    if (!force) {
      if (isCi()) {
        throw Error(
          `Use the --force flag to use the migrate command in an unnattended environment like ${chalk.bold.greenBright(
            getCommandWithExecutor(
              'prisma migrate --force --early-access-feature',
            ),
          )}`,
        )
      } else {
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message: `Are you sure you want create and apply this migration? ${chalk.red(
            'Some data will be lost',
          )}.`,
        })

        if (!confirmation.value) {
          return true
        }
      }
    }

    return false
  }
}
