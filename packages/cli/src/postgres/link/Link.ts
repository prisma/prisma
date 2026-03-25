import fs from 'node:fs'
import path from 'node:path'

import { select } from '@inquirer/prompts'
import type { PrismaConfigInternal } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import type { ManagementApiClient } from '@prisma/management-api-sdk'
import { AuthError, createManagementApiClient } from '@prisma/management-api-sdk'
import { bold, dim, green, red } from 'kleur/colors'

import { login } from '../../management-api/auth'
import { createAuthenticatedManagementAPI } from '../../management-api/auth-client'
import { FileTokenStorage } from '../../management-api/token-storage'
import { formatCompletionOutput } from './completion-output'
import { isAlreadyLinked, writeLocalFiles } from './local-setup'
import { createDevConnection, LinkApiError, listDatabases, listProjects, sanitizeErrorMessage } from './management-api'

const DEFAULT_MANAGEMENT_API_URL = 'https://api.prisma.io'

function getManagementApiUrl(): string {
  return process.env.PRISMA_MANAGEMENT_API_URL ?? DEFAULT_MANAGEMENT_API_URL
}

async function resolveApiClient(apiKey: string | undefined): Promise<ManagementApiClient> {
  if (apiKey) {
    return createManagementApiClient({ baseUrl: getManagementApiUrl(), token: apiKey })
  }

  const tokenStorage = new FileTokenStorage()
  const tokens = await tokenStorage.getTokens()

  if (!tokens) {
    console.log(`Opening browser to authenticate on ${dim('console.prisma.io')}...`)
    await login({ utmMedium: 'command-postgres-link' })
  }

  return createAuthenticatedManagementAPI().client
}

function isExpiredSessionError(err: unknown): boolean {
  return err instanceof AuthError && err.refreshTokenInvalid
}

async function resolveDatabase(client: ManagementApiClient): Promise<string> {
  const projects = await listProjects(client)

  if (projects.length === 0) {
    throw new LinkApiError('No projects found in your workspace. Create one at console.prisma.io first.')
  }

  const projectId = await select({
    message: 'Select a project:',
    choices: projects.map((p) => ({
      name: `${p.name}  ${dim(p.workspace.name)}`,
      value: p.id,
    })),
    loop: true,
  })

  const databases = (await listDatabases(client, projectId)).filter((db) => db.status === 'ready')

  if (databases.length === 0) {
    throw new LinkApiError('No ready databases found in this project. Create one at console.prisma.io first.')
  }

  if (databases.length === 1) {
    const db = databases[0]
    console.log(`${green('✔')} Using database ${bold(db.name)}${db.region ? ` (${db.region.name})` : ''}`)
    return db.id
  }

  return select({
    message: 'Select a database:',
    choices: databases.map((db) => ({
      name: `${db.name}  ${dim(db.region?.name ?? 'unknown region')}`,
      value: db.id,
    })),
    loop: true,
  })
}

export class Link implements Command {
  public static new(): Link {
    return new Link()
  }

  private static help = format(`
Link a local project to a Prisma Postgres database.

${bold('Usage')}

  ${dim('$')} prisma postgres link [options]

${bold('Options')}

  --api-key      Workspace API key (CI / non-interactive)
  --database     Database ID to link to (e.g. db_abc123)
  --force        Re-link even if already linked to Prisma Postgres
  -h, --help     Display this help message

${bold('Examples')}

  Interactive (opens browser, lets you pick project & database)
  ${dim('$')} prisma postgres link

  Non-interactive with explicit credentials
  ${dim('$')} prisma postgres link --api-key "<your-api-key>" --database "db_..."
`)

  public async parse(argv: string[], _config: PrismaConfigInternal, baseDir: string): Promise<string | Error> {
    const args = arg(argv, {
      '--api-key': String,
      '--database': String,
      '--force': Boolean,
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

    if (!args['--force'] && isAlreadyLinked(baseDir)) {
      return `\nThis project is already linked to Prisma Postgres.\nRun with ${bold('--force')} to re-link.\n`
    }

    const explicitApiKey = args['--api-key']
    const databaseId = args['--database']
    const apiKey = explicitApiKey ?? (databaseId ? process.env.PRISMA_API_KEY : undefined)

    if (explicitApiKey && !databaseId) {
      return new HelpError(
        `\n${bold(red('!'))} Missing ${bold('--database')} flag.\n\nWhen using ${bold('--api-key')}, you must also provide ${bold('--database')}.\n${Link.help}`,
      )
    }

    if (databaseId && !databaseId.startsWith('db_')) {
      return new HelpError(
        `\n${bold(red('!'))} Invalid database ID "${databaseId}" — expected format: ${bold('db_<id>')}\n${Link.help}`,
      )
    }

    try {
      return await this.linkDatabase(apiKey, databaseId, baseDir)
    } catch (err) {
      if (!apiKey && isExpiredSessionError(err)) {
        console.log(`Session expired. Re-authenticating via browser...`)
        await login({ utmMedium: 'command-postgres-link' })
        try {
          return await this.linkDatabase(apiKey, databaseId, baseDir)
        } catch (retryErr) {
          return Link.formatError(retryErr)
        }
      }
      return Link.formatError(err)
    }
  }

  private async linkDatabase(
    apiKey: string | undefined,
    databaseId: string | undefined,
    baseDir: string,
  ): Promise<string> {
    const client = await resolveApiClient(apiKey)

    if (!databaseId) {
      databaseId = await resolveDatabase(client)
    }

    const connection = await createDevConnection(client, databaseId)
    const localFilesResult = writeLocalFiles(baseDir, connection)
    const hasModels = schemaHasModels(baseDir)

    return formatCompletionOutput({ databaseId, localFilesResult, hasModels })
  }

  private static formatError(err: unknown): HelpError {
    if (err instanceof LinkApiError) {
      return new HelpError(`\n${bold(red('!'))} ${sanitizeErrorMessage(err.message)}`)
    }
    const message = err instanceof Error ? err.message : String(err)
    return new HelpError(`\n${bold(red('!'))} ${sanitizeErrorMessage(message)}`)
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
