import { MigrateDev } from '../commands/MigrateDev'
import { MigrateDiff } from '../commands/MigrateDiff'
import { agentMatchers } from '../utils/ai-safety'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

const agentEnvVars = [
  ...new Set(agentMatchers.flatMap((matcher) => matcher.envVars)),
  'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION',
]

describe('--reset-shadow-database', () => {
  const inheritedAgentEnv: Record<string, string | undefined> = {}

  // The suite itself may be running under an AI agent, whose markers would make every command in
  // it hit the checkpoint.
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

  it('stops an AI agent before migrate diff reaches the engine', async () => {
    ctx.fixture('schema-only-sqlite')
    process.env.CLAUDECODE = '1'

    const result = MigrateDiff.new().parse(
      ['--from-empty', '--to-config-datasource', '--reset-shadow-database'],
      await ctx.config(),
      ctx.configDir(),
    )

    await expect(result).rejects.toThrow('Prisma Migrate detected that it was invoked by Claude Code')
  })

  it('stops an AI agent before migrate dev reaches the engine', async () => {
    ctx.fixture('schema-only-sqlite')
    process.env.CLAUDECODE = '1'

    const result = MigrateDev.new().parse(['--reset-shadow-database'], await ctx.config(), ctx.configDir())

    await expect(result).rejects.toThrow('Prisma Migrate detected that it was invoked by Claude Code')
  })

  it('lets an AI agent through when the user consented', async () => {
    ctx.fixture('schema-only-sqlite')
    process.env.CLAUDECODE = '1'
    process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = 'yes, reset the shadow database'

    const result = await MigrateDiff.new().parse(
      ['--from-empty', '--to-config-datasource', '--reset-shadow-database'],
      await ctx.config(),
      ctx.configDir(),
    )

    expect(result).toBe('')
  })

  it('does not run the checkpoint when the flag is absent', async () => {
    ctx.fixture('schema-only-sqlite')
    process.env.CLAUDECODE = '1'

    const result = await MigrateDiff.new().parse(
      ['--from-empty', '--to-config-datasource'],
      await ctx.config(),
      ctx.configDir(),
    )

    expect(result).toBe('')
  })
})
