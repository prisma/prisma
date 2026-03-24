import { getCommandWithExecutor } from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'

type StepResult = 'completed' | 'skipped' | 'not-applicable' | 'failed'

export interface BootstrapStepStatus {
  init: 'completed' | 'skipped'
  template: StepResult
  link: 'completed' | 'failed'
  generate: StepResult
  migrate: StepResult
  seed: StepResult
}

function statusIcon(status: StepResult): string {
  switch (status) {
    case 'completed':
      return green('✔')
    case 'failed':
      return red('✗')
    case 'skipped':
    case 'not-applicable':
      return dim('–')
  }
}

function statusLabel(status: StepResult): string {
  switch (status) {
    case 'completed':
      return 'done'
    case 'failed':
      return red('failed')
    case 'skipped':
      return 'skipped'
    case 'not-applicable':
      return 'n/a'
  }
}

export function formatBootstrapOutput(opts: {
  databaseId: string
  isNewProject: boolean
  steps: BootstrapStepStatus
  hasModels: boolean
}): string {
  const lines: string[] = []

  lines.push('')
  lines.push(green('✔') + bold(' Bootstrap completed!'))
  lines.push('')
  lines.push(`  ${statusIcon(opts.steps.init)}  Init         ${statusLabel(opts.steps.init)}`)
  lines.push(`  ${statusIcon(opts.steps.template)}  Template     ${statusLabel(opts.steps.template)}`)
  lines.push(`  ${statusIcon(opts.steps.link)}  Link         ${statusLabel(opts.steps.link)}`)
  lines.push(`  ${statusIcon(opts.steps.generate)}  Generate     ${statusLabel(opts.steps.generate)}`)
  lines.push(`  ${statusIcon(opts.steps.migrate)}  Migration    ${statusLabel(opts.steps.migrate)}`)
  lines.push(`  ${statusIcon(opts.steps.seed)}  Seed         ${statusLabel(opts.steps.seed)}`)
  lines.push('')

  lines.push(bold('Next steps:'))

  const clientReady = opts.steps.generate === 'completed' || opts.steps.migrate === 'completed'

  if (opts.hasModels && clientReady) {
    lines.push(
      `  1. Start querying: ${dim('https://www.prisma.io/docs/getting-started/quickstart#4-explore-how-to-send-queries-to-your-database-with-prisma-client')}`,
    )
  } else if (opts.hasModels) {
    lines.push(`  1. Run ${green(getCommandWithExecutor('prisma generate'))} to generate the Prisma Client`)
    lines.push(
      `  2. Start querying: ${dim('https://www.prisma.io/docs/getting-started/quickstart#4-explore-how-to-send-queries-to-your-database-with-prisma-client')}`,
    )
  } else {
    lines.push(`  1. Define your data model in ${green('prisma/schema.prisma')}`)
    lines.push(`  2. Run ${green(getCommandWithExecutor('prisma migrate dev'))} to create the database tables`)
    lines.push(`  3. Start querying`)
  }

  lines.push('')

  return lines.join('\n')
}
