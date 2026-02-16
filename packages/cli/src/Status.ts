import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { bold, dim, green, red, yellow } from 'kleur/colors'

const STATUS_PAGE_URL = 'https://www.prisma-status.com'
const SUMMARY_API_URL = `${STATUS_PAGE_URL}/api/v2/summary.json`

type StatusPageStatus = {
  indicator: 'none' | 'minor' | 'major' | 'critical'
  description: string
}

type StatusPageComponent = {
  id: string
  name: string
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage'
  description: string | null
  position: number
  group_id: string | null
  group: boolean
}

type StatusPageIncidentUpdate = {
  status: string
  body: string
  created_at: string
}

type StatusPageIncident = {
  id: string
  name: string
  status: string
  impact: 'none' | 'minor' | 'major' | 'critical'
  created_at: string
  incident_updates: StatusPageIncidentUpdate[]
}

type StatusPageMaintenance = {
  id: string
  name: string
  status: 'scheduled' | 'in_progress' | 'verifying' | 'completed'
  scheduled_for: string
  incident_updates: StatusPageIncidentUpdate[]
}

type StatusPageSummary = {
  status: StatusPageStatus
  components: StatusPageComponent[]
  incidents: StatusPageIncident[]
  scheduled_maintenances: StatusPageMaintenance[]
}

function formatComponentStatus(status: StatusPageComponent['status']): string {
  switch (status) {
    case 'operational':
      return green('Operational')
    case 'degraded_performance':
      return yellow('Degraded')
    case 'partial_outage':
      return yellow('Partial Outage')
    case 'major_outage':
      return red('Major Outage')
    default:
      return status
  }
}

function formatOverallStatus(indicator: StatusPageStatus['indicator'], description: string): string {
  switch (indicator) {
    case 'none':
      return green(description)
    case 'minor':
      return yellow(description)
    case 'major':
    case 'critical':
      return red(description)
    default:
      return description
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return '<1m ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function stripPrismaPrefix(name: string): string {
  return name.replace(/^Prisma\s+/, '')
}

export class Status implements Command {
  static new(): Status {
    return new Status()
  }

  private static help = format(`
  Show Prisma Data Platform service status

  ${bold('Usage')}

    ${dim('$')} prisma status [options]

  ${bold('Options')}

    -h, --help     Display this help message
        --json     Output raw JSON from the status API
`)

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Status.help}`)
    }

    return Status.help
  }

  async parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--json': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const isJson = args['--json'] ?? false

    let summary: StatusPageSummary
    try {
      const response = await fetch(SUMMARY_API_URL, {
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        const message = `Status API returned HTTP ${response.status}`
        if (isJson) {
          return JSON.stringify({ error: message })
        }
        return `${red(message)}\nCheck ${STATUS_PAGE_URL} directly.`
      }

      const data = await response.json()

      if (isJson) {
        return JSON.stringify(data, null, 2)
      }

      summary = data as StatusPageSummary
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (isJson) {
        return JSON.stringify({ error: message })
      }
      return `${red('Could not reach status API')}: ${message}\nCheck ${STATUS_PAGE_URL} directly.`
    }

    const lines: string[] = []

    lines.push(bold(formatOverallStatus(summary.status.indicator, summary.status.description)))
    lines.push('')

    // services table
    const components = summary.components
      .filter((c) => !c.group)
      .sort((a, b) => a.position - b.position)

    if (components.length > 0) {
      lines.push(bold('Services'))
      const maxNameLen = Math.max(...components.map((c) => stripPrismaPrefix(c.name).length))
      for (const component of components) {
        const name = stripPrismaPrefix(component.name).padEnd(maxNameLen)
        lines.push(`  ${name}   ${formatComponentStatus(component.status)}`)
      }
    }

    // active incidents
    if (summary.incidents.length > 0) {
      lines.push('')
      lines.push(bold('Active Incidents'))
      for (const incident of summary.incidents) {
        const impact = incident.impact === 'critical' || incident.impact === 'major' ? red(incident.impact) : yellow(incident.impact)
        lines.push(`  ${impact} ${incident.name} (${timeAgo(incident.created_at)})`)
        const latestUpdate = incident.incident_updates[0]
        if (latestUpdate) {
          lines.push(`    ${dim(latestUpdate.status + ':')} ${latestUpdate.body}`)
        }
      }
    }

    // scheduled maintenances (exclude completed)
    const activeMaint = summary.scheduled_maintenances.filter((m) => m.status !== 'completed')
    if (activeMaint.length > 0) {
      lines.push('')
      lines.push(bold('Scheduled Maintenances'))
      for (const maint of activeMaint) {
        lines.push(`  ${maint.name} (${maint.status}, ${timeAgo(maint.scheduled_for)})`)
        const latestUpdate = maint.incident_updates[0]
        if (latestUpdate) {
          lines.push(`    ${dim(latestUpdate.status + ':')} ${latestUpdate.body}`)
        }
      }
    }

    lines.push('')
    lines.push(`Status page: ${dim(STATUS_PAGE_URL)}`)

    return lines.join('\n')
  }
}
