import prompt from 'prompts'

import { DbExecute } from '../commands/DbExecute'
import { MigrateDiff } from '../commands/MigrateDiff'
import { agentMatchers } from '../utils/ai-safety'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

const agentEnvVars = [
  ...new Set(agentMatchers.flatMap((matcher) => matcher.envVars)),
  'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION',
]

const diffFromMigrations = ['--from-migrations', './migrations', '--to-empty']

/**
 * Answers waiting to be given. `prompts` keeps them in a queue that it consumes as questions are
 * asked, so what is left of it says whether a question was asked at all.
 */
const unaskedQuestions = () => ((prompt as unknown as { _injected?: unknown[] })._injected ?? []).length

/**
 * Puts a table in the shadow database, which is what a shadow database somebody else's data lives
 * in looks like to the engine.
 */
async function makeShadowDatabaseDirty() {
  ctx.setConfigFile('shadow-database.config.ts')
  await DbExecute.new().parse(['--file', './marker.sql'], await ctx.config(), ctx.configDir())
  ctx.setConfigFile('prisma.config.ts')
  ctx.clearCapturedStdout()
}

/** What the shadow database holds, as the diff of it against an empty datamodel describes it. */
async function shadowDatabaseContents() {
  ctx.setConfigFile('shadow-database.config.ts')
  ctx.clearCapturedStdout()
  await MigrateDiff.new().parse(['--from-config-datasource', '--to-empty'], await ctx.config(), ctx.configDir())
  ctx.setConfigFile('prisma.config.ts')
  return ctx.normalizedCapturedStdout()
}

describe('shadow database consent', () => {
  const inheritedAgentEnv: Record<string, string | undefined> = {}

  // The suite may itself be running under an AI agent, whose markers would send every case down
  // the checkpoint path.
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

  it('resets a shadow database that holds data when the flag says it may', async () => {
    ctx.fixture('shadow-database-consent')
    await makeShadowDatabaseDirty()

    const result = await MigrateDiff.new().parse(
      [...diffFromMigrations, '--reset-shadow-database'],
      await ctx.config(),
      ctx.configDir(),
    )

    expect(result).toBe('')
    // The consent reached the engine: what was in the shadow database is gone, and the migration
    // history the engine replayed into it was cleaned up after itself.
    expect(await shadowDatabaseContents()).toContain('No difference detected')
  }, 60_000)

  it('resets a shadow database that holds data when the user says it may', async () => {
    ctx.fixture('shadow-database-consent')
    await makeShadowDatabaseDirty()
    prompt.inject([true])

    const result = await MigrateDiff.new().parse(diffFromMigrations, await ctx.config(), ctx.configDir())

    expect(result).toBe('')
    expect(unaskedQuestions()).toBe(0) // the answer was given to a question that was asked
    expect(await shadowDatabaseContents()).toContain('No difference detected')
  }, 60_000)

  it('leaves the shadow database alone when the user says no', async () => {
    ctx.fixture('shadow-database-consent')
    await makeShadowDatabaseDirty()
    prompt.inject([false])

    const result = MigrateDiff.new().parse(diffFromMigrations, await ctx.config(), ctx.configDir())

    await expect(result).rejects.toThrow('P3026')
    expect(unaskedQuestions()).toBe(0)
    expect(await shadowDatabaseContents()).toContain('dirty_marker')
  }, 60_000)

  it('leaves the shadow database alone where nobody can be asked', async () => {
    ctx.fixture('shadow-database-consent')
    await makeShadowDatabaseDirty()

    // No injected answer and no TTY: the engine's refusal is all the command has to say.
    const result = MigrateDiff.new().parse(diffFromMigrations, await ctx.config(), ctx.configDir())

    await expect(result).rejects.toThrow('P3026')
    expect(await shadowDatabaseContents()).toContain('dirty_marker')
  }, 60_000)

  it('never asks an AI agent, which could answer for itself', async () => {
    ctx.fixture('shadow-database-consent')
    await makeShadowDatabaseDirty()
    process.env.CLAUDECODE = '1'
    // An answer is waiting, and the agent still must not get to use it.
    prompt.inject([true])

    const result = MigrateDiff.new().parse(diffFromMigrations, await ctx.config(), ctx.configDir())

    await expect(result).rejects.toThrow('Prisma Migrate detected that it was invoked by Claude Code')
    // The answer is still waiting: the checkpoint came before the question.
    expect(unaskedQuestions()).toBe(1)
    expect(await shadowDatabaseContents()).toContain('dirty_marker')
  }, 60_000)
})
