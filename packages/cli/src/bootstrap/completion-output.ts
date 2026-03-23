import { getCommandWithExecutor } from '@prisma/internals'
import { bold, dim, green } from 'kleur/colors'

export interface BootstrapStepStatus {
  init: 'completed' | 'skipped'
  link: 'completed' | 'failed'
  migrate: 'completed' | 'skipped' | 'not-applicable'
  seed: 'completed' | 'skipped' | 'not-applicable'
}

function statusIcon(status: 'completed' | 'skipped' | 'not-applicable' | 'failed'): string {
  switch (status) {
    case 'completed':
      return green('✔')
    case 'skipped':
      return dim('–')
    case 'not-applicable':
      return dim('–')
    case 'failed':
      return '✗'
  }
}

function statusLabel(status: 'completed' | 'skipped' | 'not-applicable' | 'failed'): string {
  switch (status) {
    case 'completed':
      return 'done'
    case 'skipped':
      return 'skipped'
    case 'not-applicable':
      return 'n/a'
    case 'failed':
      return 'failed'
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
  lines.push(`  ${statusIcon(opts.steps.link)}  Link         ${statusLabel(opts.steps.link)}`)
  lines.push(`  ${statusIcon(opts.steps.migrate)}  Migration    ${statusLabel(opts.steps.migrate)}`)
  lines.push(`  ${statusIcon(opts.steps.seed)}  Seed         ${statusLabel(opts.steps.seed)}`)
  lines.push('')

  lines.push(bold('Next steps:'))

  if (opts.hasModels) {
    lines.push(`  1. Run ${green(getCommandWithExecutor('prisma generate'))} to generate the Prisma Client`)
    lines.push(
      `  2. Start querying: ${dim('https://www.prisma.io/docs/getting-started/quickstart#4-explore-how-to-send-queries-to-your-database-with-prisma-client')}`,
    )
  } else {
    lines.push(`  1. Define your data model in ${green('prisma/schema.prisma')}`)
    lines.push(`  2. Run ${green(getCommandWithExecutor('prisma migrate dev'))} to create the database tables`)
    lines.push(`  3. Run ${green(getCommandWithExecutor('prisma generate'))} and start querying`)
  }

  lines.push('')

  return lines.join('\n')
}
