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
  status: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'under_maintenance'
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
  scheduled_until: string
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
    case 'under_maintenance':
      return yellow('Maintenance')
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

function formatMaintenanceStatus(status: StatusPageMaintenance['status']): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled'
    case 'in_progress':
      return 'In Progress'
    case 'verifying':
      return 'Verifying'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

function formatTimeWindow(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
  const date = startDate.toLocaleDateString('en-US', opts)
  const startTime = startDate.toLocaleTimeString('en-US', timeOpts)
  const endTime = endDate.toLocaleTimeString('en-US', timeOpts)
  return `${date} ${startTime}-${endTime} UTC`
}

function latestUpdate(updates: StatusPageIncidentUpdate[]): StatusPageIncidentUpdate | undefined {
  return updates.toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]
}

function stripPrismaPrefix(name: string): string {
  return name.replace(/^Prisma\s+/, '')
}

/** $ prisma status */
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
          process.exitCode = 1
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
        process.exitCode = 1
        return JSON.stringify({ error: message })
      }
      return `${red('Could not reach status API')}: ${message}\nCheck ${STATUS_PAGE_URL} directly.`
    }

    const lines: string[] = []

    lines.push(bold(formatOverallStatus(summary.status.indicator, summary.status.description)))
    lines.push('')

    const components = summary.components.filter((c) => !c.group).sort((a, b) => a.position - b.position)

    if (components.length > 0) {
      lines.push(bold('Services'))
      const maxNameLen = Math.max(...components.map((c) => stripPrismaPrefix(c.name).length))
      for (const component of components) {
        const name = stripPrismaPrefix(component.name).padEnd(maxNameLen)
        lines.push(`  ${name}   ${formatComponentStatus(component.status)}`)
      }
    }

    if (summary.incidents.length > 0) {
      lines.push('')
      lines.push(bold('Active Incidents'))
      for (const incident of summary.incidents) {
        const impact =
          incident.impact === 'critical' || incident.impact === 'major' ? red(incident.impact) : yellow(incident.impact)
        lines.push(`  ${impact} ${incident.name} (${timeAgo(incident.created_at)})`)
        const update = latestUpdate(incident.incident_updates)
        if (update) {
          lines.push(`    ${dim(update.status + ':')} ${update.body}`)
        }
      }
    }

    const activeMaint = summary.scheduled_maintenances.filter((m) => m.status !== 'completed')
    if (activeMaint.length > 0) {
      lines.push('')
      lines.push(bold('Scheduled Maintenances'))
      for (const maint of activeMaint) {
        const statusLabel = formatMaintenanceStatus(maint.status)
        lines.push(`  ${maint.name} ${dim(`(${statusLabel})`)}`)

        // prefer scheduled update (has details) over latest status update
        const scheduledUpdate = maint.incident_updates.find((u) => u.status === 'scheduled')
        const updateToShow = scheduledUpdate ?? latestUpdate(maint.incident_updates)
        if (updateToShow?.body) {
          for (const line of updateToShow.body.split('\n')) {
            lines.push(`    ${line}`)
          }
        }

        if (maint.scheduled_for && maint.scheduled_until) {
          lines.push(`    ${formatTimeWindow(maint.scheduled_for, maint.scheduled_until)}`)
        }
      }
    }

    lines.push('')
    lines.push(`Status page: ${dim(STATUS_PAGE_URL)}`)

    return lines.join('\n')
  }
}
