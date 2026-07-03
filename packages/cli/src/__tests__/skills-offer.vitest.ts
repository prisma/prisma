import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import type { InstallSkillsResult } from '../init/skill-install'
import type { PromptIO, SkillsOfferContext } from '../utils/skills/skills-offer'
import { handleSkillsOffer } from '../utils/skills/skills-offer'

const tmpDirs: string[] = []

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-offer-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  vi.useRealTimers()
})

function scriptedPrompt(answer?: string) {
  const questions: string[] = []
  const writes: string[] = []
  let closed = false

  const prompt: PromptIO = {
    question: (query: string) => {
      questions.push(query)
      return answer === undefined ? new Promise<string>(() => {}) : Promise.resolve(answer)
    },
    write: (message: string) => {
      writes.push(message)
    },
    close: () => {
      closed = true
    },
  }

  return { prompt, questions, writes, isClosed: () => closed }
}

function testContext(overrides: Partial<SkillsOfferContext> = {}) {
  const cwd = makeTmpDir()
  const configDir = path.join(makeTmpDir(), 'config')
  const capture = { capture: vi.fn(() => Promise.resolve()) }
  const installSkills = vi.fn((): Promise<InstallSkillsResult> => Promise.resolve({ ok: true }))
  const createPrompt = vi.fn(() => scriptedPrompt('n').prompt)

  const ctx: SkillsOfferContext = {
    cwd,
    configDir,
    isDeno: false,
    isInteractive: () => true,
    isCi: () => false,
    maybeInGitHook: () => false,
    isInNpmLifecycleHook: () => false,
    isInContainer: () => false,
    loadCommandState: () => Promise.resolve({ firstCommandTimestamp: '2020-01-01T00:00:00.000Z' }),
    createPrompt,
    installSkills,
    capture,
    getSignature: () => Promise.resolve('test-signature'),
    cliVersion: '0.0.0-test',
    ...overrides,
  }

  return { ctx, cwd, configDir, capture, installSkills, createPrompt }
}

function readAcknowledgement(configDir: string): { offeredAt: string; outcome: string } {
  return JSON.parse(fs.readFileSync(path.join(configDir, 'skills-offer.json'), 'utf-8'))
}

function acknowledgementExists(configDir: string): boolean {
  return fs.existsSync(path.join(configDir, 'skills-offer.json'))
}

describe('gates', () => {
  test('existing acknowledgement short-circuits without prompting', async () => {
    const { ctx, configDir, capture, createPrompt } = testContext()
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'skills-offer.json'),
      JSON.stringify({ offeredAt: '2020-01-01T00:00:00.000Z', outcome: 'declined' }),
    )

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(createPrompt).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
  })

  test.each([
    ['skills-lock.json marker', (cwd: string) => fs.writeFileSync(path.join(cwd, 'skills-lock.json'), '{}')],
    [
      '.claude/skills/prisma-* directory',
      (cwd: string) => fs.mkdirSync(path.join(cwd, '.claude', 'skills', 'prisma-cli'), { recursive: true }),
    ],
    [
      '.agents/skills/prisma-* directory',
      (cwd: string) => fs.mkdirSync(path.join(cwd, '.agents', 'skills', 'prisma-cli'), { recursive: true }),
    ],
  ])('already-installed detection via %s writes the acknowledgement', async (_name, setup) => {
    const { ctx, cwd, configDir, capture, createPrompt } = testContext()
    setup(cwd)

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(createPrompt).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('already-installed')
  })

  test('non-prisma skills of other projects do not count as already installed', async () => {
    const { ctx, cwd, configDir } = testContext()
    fs.mkdirSync(path.join(cwd, '.claude', 'skills', 'my-own-skill'), { recursive: true })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
  })

  test.each([
    ['not interactive', { isInteractive: () => false }],
    ['Deno runtime', { isDeno: true }],
    ['CI', { isCi: () => true }],
    ['git hook', { maybeInGitHook: () => true }],
    ['npm lifecycle hook', { isInNpmLifecycleHook: () => true }],
    ['container', { isInContainer: () => true }],
    [
      'first command less than a day ago',
      { loadCommandState: () => Promise.resolve({ firstCommandTimestamp: new Date().toISOString() }) },
    ],
  ] as [string, Partial<SkillsOfferContext>][])('%s short-circuits without prompting', async (_name, overrides) => {
    const { ctx, configDir, capture, createPrompt } = testContext(overrides)

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(createPrompt).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
    expect(acknowledgementExists(configDir)).toBe(false)
  })
})

describe('prompt outcomes', () => {
  test.each([['n'], ['no'], [''], ['whatever']])('answer %j declines', async (answer) => {
    const { prompt, isClosed } = scriptedPrompt(answer)
    const { ctx, configDir, capture, installSkills } = testContext({ createPrompt: () => prompt })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'declined',
      cliVersion: '0.0.0-test',
    })
    expect(isClosed()).toBe(true)
  })

  test.each([['y'], ['Y'], ['yes'], [' YES ']])('answer %j accepts and installs', async (answer) => {
    const { prompt } = scriptedPrompt(answer)
    const { ctx, cwd, configDir, capture, installSkills } = testContext({ createPrompt: () => prompt })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).toHaveBeenCalledExactlyOnceWith({ cwd })
    expect(readAcknowledgement(configDir).outcome).toBe('accepted')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'accepted',
      cliVersion: '0.0.0-test',
    })
  })

  test('prompt question offers a default of No', async () => {
    const { prompt, questions } = scriptedPrompt('n')
    const { ctx } = testContext({ createPrompt: () => prompt })

    await handleSkillsOffer(ctx)

    expect(questions).toHaveLength(1)
    expect(questions[0]).toContain("Install Prisma's agent skills")
    expect(questions[0]).toContain('(y/N)')
  })

  test('timeout resolves to No and persists the timeout outcome', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { prompt, writes, isClosed } = scriptedPrompt()
    const { ctx, configDir, capture, installSkills } = testContext({ createPrompt: () => prompt })

    const resultPromise = handleSkillsOffer(ctx)
    while (vi.getTimerCount() === 0) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    await vi.advanceTimersByTimeAsync(30_000)
    const result = await resultPromise

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('timeout')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'timeout',
      cliVersion: '0.0.0-test',
    })
    expect(writes.join('')).toContain('No response received')
    expect(isClosed()).toBe(true)
  })

  test('failed install after accepting prints the manual command and stays non-fatal', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { prompt } = scriptedPrompt('y')
      const { ctx, configDir } = testContext({
        createPrompt: () => prompt,
        installSkills: () => Promise.resolve({ ok: false, manualCommand: 'npx --yes skills add prisma/skills' }),
      })

      const result = await handleSkillsOffer(ctx)

      expect(result).toEqual({ prompted: true })
      expect(readAcknowledgement(configDir).outcome).toBe('accepted')
      const warnings = consoleWarn.mock.calls.join('\n')
      expect(warnings).toContain('Failed to install Prisma agent skills')
      expect(warnings).toContain('npx --yes skills add prisma/skills')
    } finally {
      consoleWarn.mockRestore()
    }
  })
})

describe('failure isolation', () => {
  test('a throwing gate dependency resolves to not prompted', async () => {
    const { ctx, capture } = testContext({
      isCi: () => {
        throw new Error('detection exploded')
      },
    })

    await expect(handleSkillsOffer(ctx)).resolves.toEqual({ prompted: false })
    expect(capture.capture).not.toHaveBeenCalled()
  })

  test('a rejecting command state loader resolves to not prompted', async () => {
    const { ctx } = testContext({ loadCommandState: () => Promise.reject(new Error('no state')) })

    await expect(handleSkillsOffer(ctx)).resolves.toEqual({ prompted: false })
  })

  test('a failing telemetry capture still reports the prompt as shown', async () => {
    const { prompt } = scriptedPrompt('n')
    const { ctx, configDir } = testContext({
      createPrompt: () => prompt,
      capture: { capture: () => Promise.reject(new Error('offline')) },
    })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
  })

  test('an unwritable config dir still reports the prompt as shown', async () => {
    const filePath = path.join(makeTmpDir(), 'occupied')
    fs.writeFileSync(filePath, '')
    const { prompt } = scriptedPrompt('n')
    // configDir points inside a regular file, so the acknowledgement write fails
    const { ctx, capture } = testContext({
      createPrompt: () => prompt,
      configDir: path.join(filePath, 'config'),
    })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(capture.capture).toHaveBeenCalledTimes(1)
  })
})
