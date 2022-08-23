import chalk from 'chalk'
import prompt from 'prompts'

import type { RustPanic } from '../panic'
import { sendPanic } from '../sendPanic'
import { wouldYouLikeToCreateANewIssue } from './getGithubIssueUrl'
import { isCi } from './isCi'
import { link } from './link'

export async function handlePanic(
  error: RustPanic,
  cliVersion: string,
  engineVersion: string,
  command: string,
): Promise<void> {
  if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
    throw error
  }

  await panicDialog(error, cliVersion, engineVersion, command)
}

async function panicDialog(
  error: RustPanic,
  cliVersion: string,
  engineVersion: string,
  command: string,
): Promise<void> {
  const errorMessage = error.message.split('\n').slice(0, Math.max(20, process.stdout.rows)).join('\n')

  console.log(`${chalk.red('Oops, an unexpected error occured!')}
${chalk.red(errorMessage)}

${chalk.bold('Please help us improve Prisma by submitting an error report.')}
${chalk.bold('Error reports never contain personal or other sensitive information.')}
${chalk.dim(`Learn more: ${link('https://pris.ly/d/telemetry')}`)}
`)

  const { value: shouldSubmitReport }: { value: boolean } = await prompt({
    type: 'select',
    name: 'value',
    message: 'Submit error report',
    initial: 0,
    choices: [
      {
        title: 'Yes',
        value: true,
        description: `Send error report once`,
      },
      {
        title: 'No',
        value: false,
        description: `Don't send error report`,
      },
    ],
  })

  if (shouldSubmitReport) {
    try {
      console.log('Submitting...')
      const reportId = await sendPanic(error, cliVersion, engineVersion)
      console.log(`\n${chalk.bold(`We successfully received the error report id: ${reportId}`)}`)
      console.log(`\n${chalk.bold('Thanks a lot for your help! 🙏')}`)
    } catch (error) {
      const reportFailedMessage = `${chalk.bold.red('Oops. We could not send the error report.')}`
      console.log(reportFailedMessage)
      console.error(`${chalk.gray('Error report submission failed due to: ')}`, error)
    }
  }

  /*
  Example flow:

  1) Prompt: Would you like to submit an error report? (no)
     Prompt: Would you like to create a Github issue? (yes | no)

  2) Prompt: Would you like to submit an error report? (yes)
     Would you like to create a Github issue? (automatically yes)
  */

  // Automatically create a Github issue if we already submitted an error report.
  //
  // TODO: does this still make sense? (If we already have an error report, it's better to manually create an issue
  // from the error reporting dashboard, as it includes the schema file and other details, and it's monitored weekly)
  await wouldYouLikeToCreateANewIssue({
    prompt: !shouldSubmitReport,
    error,
    cliVersion,
    engineVersion,
    command,
  })
}
