import { bold, dim, gray, red } from 'kleur/colors'
import prompt from 'prompts'

import type { RustPanic } from '../panic'
import { sendPanic } from '../sendPanic'
import { canPrompt } from './canPrompt'
import { wouldYouLikeToCreateANewIssue } from './getGitHubIssueUrl'
import { link } from './link'

type HandlePanic = {
  error: RustPanic
  cliVersion: string
  enginesVersion: string
  command: string

  // retrieve the database version for the given schema or url, without throwing any error
  getDatabaseVersionSafe: (schemaOrUrl: string) => Promise<string | undefined>
}

export async function handlePanic(args: HandlePanic): Promise<void> {
  if (!canPrompt()) {
    throw args.error
  }

  await panicDialog(args)
}

type PanicDialog = HandlePanic

async function panicDialog({
  error,
  cliVersion,
  enginesVersion,
  command,
  getDatabaseVersionSafe,
}: PanicDialog): Promise<void> {
  const errorMessage = error.message.split('\n').slice(0, Math.max(20, process.stdout.rows)).join('\n')

  console.log(`${red('Oops, an unexpected error occurred!')}
${red(errorMessage)}

${bold('Please help us improve Prisma by submitting an error report.')}
${bold('Error reports never contain personal or other sensitive information.')}
${dim(`Learn more: ${link('https://pris.ly/d/telemetry')}`)}
`)

  const { value: shouldSubmitReport } = await prompt({
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
      const reportId = await sendPanic({ error, cliVersion, enginesVersion, getDatabaseVersionSafe })
      console.log(`\n${bold(`We successfully received the error report id: ${reportId}`)}`)
      console.log(`\n${bold('Thanks a lot for your help! 🙏')}`)
    } catch (error) {
      const reportFailedMessage = `${bold(red('Oops. We could not send the error report.'))}`
      console.log(reportFailedMessage)
      console.error(`${gray('Error report submission failed due to: ')}`, error)
    }
  }

  await wouldYouLikeToCreateANewIssue({
    prompt: !shouldSubmitReport,
    error,
    cliVersion,
    enginesVersion,
    command,
  })

  // Signal that there was an error
  process.exit(1)
}
