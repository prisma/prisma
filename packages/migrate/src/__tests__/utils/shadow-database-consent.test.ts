import prompt from 'prompts'

import { agentMatchers } from '../../utils/ai-safety'
import {
  askToResetShadowDatabase,
  isShadowDatabaseNotEmptyError,
  sanitizedShadowDatabaseUrl,
} from '../../utils/shadow-database-consent'

describe('sanitizedShadowDatabaseUrl', () => {
  it('strips the credentials that reach the database', () => {
    expect(sanitizedShadowDatabaseUrl('postgresql://alice:hunter2@db.example.com:5432/shadow')).toBe(
      'postgresql://db.example.com:5432/shadow',
    )
  })

  it('strips the query parameters that carry a secret, whatever their case', () => {
    expect(sanitizedShadowDatabaseUrl('postgresql://db.example.com/shadow?sslpassword=hunter2&schema=public')).toBe(
      'postgresql://db.example.com/shadow?schema=public',
    )
    expect(sanitizedShadowDatabaseUrl('postgresql://db.example.com/shadow?PASSWORD=hunter2')).toBe(
      'postgresql://db.example.com/shadow',
    )
    expect(sanitizedShadowDatabaseUrl('prisma+postgres://localhost:51213/?api_key=c2VjcmV0')).toBe(
      'prisma+postgres://localhost:51213/',
    )
  })

  it('keeps what tells the databases apart', () => {
    expect(sanitizedShadowDatabaseUrl('postgresql://db.example.com:5432/shadow?schema=public')).toBe(
      'postgresql://db.example.com:5432/shadow?schema=public',
    )
    // Shown as configured: the URL parser would turn this relative path into `file:///shadow.db`.
    expect(sanitizedShadowDatabaseUrl('file:./shadow.db')).toBe('file:./shadow.db')
  })

  it('shows nothing rather than something it cannot strip', () => {
    // A SQL Server connection string parses as a URL whose "host" is the whole property list.
    expect(sanitizedShadowDatabaseUrl('sqlserver://db.example.com;database=shadow;password=hunter2')).toBeUndefined()
    expect(sanitizedShadowDatabaseUrl('this is not a url')).toBeUndefined()
    expect(sanitizedShadowDatabaseUrl(undefined)).toBeUndefined()
  })
})

describe('isShadowDatabaseNotEmptyError', () => {
  it('recognizes the engine refusal the user can answer', () => {
    expect(isShadowDatabaseNotEmptyError({ code: 'P3026' })).toBe(true)
  })

  it('leaves every other failure alone', () => {
    expect(isShadowDatabaseNotEmptyError({ code: 'P3025' })).toBe(false)
    expect(isShadowDatabaseNotEmptyError(new Error('boom'))).toBe(false)
    expect(isShadowDatabaseNotEmptyError(undefined)).toBe(false)
  })
})

describe('askToResetShadowDatabase', () => {
  const agentEnvVars = [
    ...new Set(agentMatchers.flatMap((matcher) => matcher.envVars)),
    'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION',
  ]
  const inheritedAgentEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const name of agentEnvVars) {
      inheritedAgentEnv[name] = process.env[name]
      delete process.env[name]
    }
  })

  afterEach(() => {
    for (const [name, value] of Object.entries(inheritedAgentEnv)) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  })

  const datasource = {
    url: 'postgresql://localhost:5432/main',
    shadowDatabaseUrl: 'postgresql://localhost:5432/shadow',
  }

  it('never asks an AI agent, which could answer for itself', async () => {
    process.env.CLAUDECODE = '1'

    await expect(askToResetShadowDatabase(datasource)).rejects.toThrow(
      'Prisma Migrate detected that it was invoked by Claude Code',
    )
  })

  it('lets an AI agent past the checkpoint once the user has consented', async () => {
    process.env.CLAUDECODE = '1'
    process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = 'yes, reset the shadow database'
    prompt.inject(['y'])

    await expect(askToResetShadowDatabase(datasource)).resolves.toBe(true)
  })

  it('takes yes for an answer', async () => {
    prompt.inject([true])

    await expect(askToResetShadowDatabase(datasource)).resolves.toBe(true)
  })

  it('takes no for an answer', async () => {
    prompt.inject([false])

    await expect(askToResetShadowDatabase(datasource)).resolves.toBe(false)
  })

  it('does not ask where nobody can answer', async () => {
    // No injected answers and no TTY: `canPrompt()` is false, and an unanswerable question would
    // hang the command.
    await expect(askToResetShadowDatabase(datasource)).resolves.toBe(false)
  })
})
