import fs from 'node:fs'
import path from 'node:path'

import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

import { formatCompletionOutput } from './completionOutput'
import { writeLocalFiles } from './localSetup'
import { createDevConnection, LinkApiError, sanitizeErrorMessage } from './managementApi'

export class Link implements Command {
  public static new(): Link {
    return new Link()
  }

  private static help = format(`
Link a local project to a Prisma Postgres database.

${bold('Usage')}

  ${dim('$')} prisma postgres link [options]

${bold('Options')}

  --api-key      Workspace API key (from console.prisma.io)
  --database     Database ID to link to (e.g. db_abc123)
  -h, --help     Display this help message

${bold('Examples')}

  Link to a database
  ${dim('$')} prisma postgres link --api-key "<your-api-key>" --database "db_..."

  Use environment variables
  ${dim('$')} PRISMA_API_KEY="<your-api-key>" prisma postgres link --database "db_..."
`)

  public async parse(argv: string[], _config: PrismaConfigInternal, baseDir: string): Promise<string | Error> {
    const args = arg(argv, {
      '--api-key': String,
      '--database': String,
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const apiKey = args['--api-key'] ?? process.env.PRISMA_API_KEY
    const databaseId = args['--database']

    if (!apiKey) {
      return new HelpError(
        `\n${bold(red('!'))} Missing ${bold('--api-key')} flag or ${bold('PRISMA_API_KEY')} environment variable.\n\nGet your API key at ${dim('https://console.prisma.io')}\n${Link.help}`,
      )
    }

    if (!databaseId) {
      return new HelpError(
        `\n${bold(red('!'))} Missing ${bold('--database')} flag.\n\nFind your database ID in the Prisma Console URL or dashboard.\n${Link.help}`,
      )
    }

    if (!databaseId.startsWith('db_')) {
      return new HelpError(
        `\n${bold(red('!'))} Invalid database ID "${databaseId}" — expected format: ${bold('db_<id>')}\n${Link.help}`,
      )
    }

    try {
      const connection = await createDevConnection({ apiKey, databaseId })

      const localFilesResult = writeLocalFiles(baseDir, connection)

      const hasModels = schemaHasModels(baseDir)

      return formatCompletionOutput({
        databaseId,
        localFilesResult,
        hasModels,
      })
    } catch (err) {
      if (err instanceof LinkApiError) {
        return new HelpError(`\n${bold(red('!'))} ${err.message}`)
      }
      const message = err instanceof Error ? err.message : String(err)
      return new HelpError(`\n${bold(red('!'))} ${sanitizeErrorMessage(message)}`)
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Link.help}`)
    }
    return Link.help
  }
}

function schemaHasModels(baseDir: string): boolean {
  const candidates = [path.join(baseDir, 'prisma', 'schema.prisma'), path.join(baseDir, 'schema.prisma')]

  for (const schemaPath of candidates) {
    if (fs.existsSync(schemaPath)) {
      const content = fs.readFileSync(schemaPath, 'utf-8')
      return /^\s*model\s+\w+/m.test(content)
    }
  }

  return false
}
