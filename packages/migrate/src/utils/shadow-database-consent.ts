import type { Datasource } from '@prisma/config'
import { canPrompt } from '@prisma/internals'
import prompt from 'prompts'

import { aiAgentConfirmationCheckpoint } from './ai-safety'

/** The engine refuses to reset a shadow database that is not empty with this code. */
const SHADOW_DATABASE_NOT_EMPTY = 'P3026'

/** Query string parameters that carry a secret rather than a connection setting. */
const SECRET_QUERY_PARAMS = ['api_key', 'password', 'sslpassword']

/**
 * Whether the engine refused to reset a shadow database because it is not empty, which is a
 * refusal the user can answer.
 */
export function isShadowDatabaseNotEmptyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === SHADOW_DATABASE_NOT_EMPTY
}

/**
 * Renders a shadow database URL for the prompt that asks whether it may be reset, without the
 * credentials that reach it. Returns `undefined` when there is nothing that can be shown safely,
 * in which case the prompt describes the database instead of naming it.
 *
 * This is for display only. The engine sanitizes the URL it names in its own error, and nothing
 * here guards anything: reading it as a guard would make a parsing quirk a security boundary.
 */
export function sanitizedShadowDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  // SQL Server connection strings hold their properties in a `;`-separated list that the URL
  // parser takes for a host, password and all, so they are not shown rather than shown wrongly.
  if (parsed.protocol === 'sqlserver:' || parsed.protocol === 'jdbc:') {
    return undefined
  }

  // A SQLite path holds no credentials, and rewriting it through the URL parser would name a
  // different file than the one that was configured: `file:./shadow.db` comes back as
  // `file:///shadow.db`.
  if (parsed.protocol === 'file:') {
    return url
  }

  parsed.username = ''
  parsed.password = ''

  for (const name of [...parsed.searchParams.keys()]) {
    if (SECRET_QUERY_PARAMS.some((secret) => name.toLowerCase() === secret)) {
      parsed.searchParams.delete(name)
    }
  }

  return parsed.toString()
}

/**
 * Asks whether the shadow database may be reset, after the engine refused to reset one that holds
 * data. Returns whether the command may run again with that consent.
 *
 * An AI agent never reaches the question: the checkpoint either recognizes the user's own consent
 * in the environment, or stops the command here. Answering a prompt is something an agent can do
 * for itself, which is exactly what the checkpoint exists to prevent.
 */
export async function askToResetShadowDatabase(datasource: Datasource | undefined): Promise<boolean> {
  aiAgentConfirmationCheckpoint()

  if (!canPrompt()) {
    return false
  }

  const shadowDatabase = sanitizedShadowDatabaseUrl(datasource?.shadowDatabaseUrl)
  const name = shadowDatabase ? `\`${shadowDatabase}\`` : 'configured for this project'

  const confirmation = await prompt({
    type: 'confirm',
    name: 'value',
    message: `The shadow database ${name} will be reset and all data in it will be lost. Do you want to continue?`,
  })

  return Boolean(confirmation.value)
}
