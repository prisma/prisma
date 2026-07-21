import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test, vi } from 'vitest'

import type { InstallSkillsResult } from '../init/skill-install'
import type { ConfirmPromptOptions, PromptOutcome, Prompts } from '../utils/prompts'
import type { SkillsOfferContext } from '../utils/skills/skills-offer'
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
})

const declined: PromptOutcome<boolean> = { status: 'answered', value: false }
const accepted: PromptOutcome<boolean> = { status: 'answered', value: true }

function scriptedPrompts(outcome: PromptOutcome<boolean> | (() => Promise<PromptOutcome<boolean>>) = declined) {
  const messages: string[] = []
  const confirm = vi.fn((_options: ConfirmPromptOptions) =>
    typeof outcome === 'function' ? outcome() : Promise.resolve(outcome),
  )

  const prompts: Prompts = {
    confirm,
    text: () => Promise.reject(new Error('the skills offer does not use text prompts')),
    message: (message) => {
      messages.push(message)
    },
  }

  return { prompts, confirm, messages }
}

function testContext(overrides: Partial<SkillsOfferContext> = {}) {
  const cwd = makeTmpDir()
  const configDir = path.join(makeTmpDir(), 'config')
  const capture = { capture: vi.fn(() => Promise.resolve()) }
  const installSkills = vi.fn((): Promise<InstallSkillsResult> => Promise.resolve({ ok: true }))
  const { prompts, confirm, messages } = scriptedPrompts()

  const ctx: SkillsOfferContext = {
    cwd,
    configDir,
    isInteractive: () => true,
    isCi: () => false,
    maybeInGitHook: () => false,
    isInNpmLifecycleHook: () => false,
    isInContainer: () => false,
    loadCommandState: () => Promise.resolve({ firstCommandTimestamp: '2020-01-01T00:00:00.000Z' }),
    prompts,
    installSkills,
    capture,
    getSignature: () => Promise.resolve('test-signature'),
    cliVersion: '0.0.0-test',
    ...overrides,
  }

  return { ctx, cwd, configDir, capture, installSkills, confirm, messages }
}

function readAcknowledgement(configDir: string): { offeredAt: string; outcome: string } {
  return JSON.parse(fs.readFileSync(path.join(configDir, 'skills-offer.json'), 'utf-8'))
}

function acknowledgementExists(configDir: string): boolean {
  return fs.existsSync(path.join(configDir, 'skills-offer.json'))
}

describe('gates', () => {
  test('existing acknowledgement short-circuits without prompting', async () => {
    const { ctx, configDir, capture, confirm } = testContext()
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      path.join(configDir, 'skills-offer.json'),
      JSON.stringify({ offeredAt: '2020-01-01T00:00:00.000Z', outcome: 'declined' }),
    )

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(confirm).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
  })

  test.each([
    ['skills-lock.json marker', (cwd: string) => fs.writeFileSync(path.join(cwd, 'skills-lock.json'), '{}')],
    [
      '.claude/skills/prisma-* directory',
      (cwd: string) => fs.mkdirSync(path.join(cwd, '.claude', 'skills', 'prisma-cli'), { recursive: true }),
    ],
    [
      '.windsurf/skills/prisma-* directory',
      (cwd: string) => fs.mkdirSync(path.join(cwd, '.windsurf', 'skills', 'prisma-cli'), { recursive: true }),
    ],
    [
      '.agents/skills/prisma-* directory',
      (cwd: string) => fs.mkdirSync(path.join(cwd, '.agents', 'skills', 'prisma-cli'), { recursive: true }),
    ],
  ])('already-installed detection via %s writes the acknowledgement', async (_name, setup) => {
    const { ctx, cwd, configDir, capture, confirm } = testContext()
    setup(cwd)

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(confirm).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('already-installed')
  })

  test('non-prisma skills of other projects do not count as already installed', async () => {
    const { ctx, cwd, configDir } = testContext()
    fs.mkdirSync(path.join(cwd, '.claude', 'skills', 'my-own-skill'), { recursive: true })
    fs.mkdirSync(path.join(cwd, '.windsurf', 'skills', 'another-skill'), { recursive: true })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
  })

  test.each([
    ['not interactive', { isInteractive: () => false }],
    ['CI', { isCi: () => true }],
    ['git hook', { maybeInGitHook: () => true }],
    ['npm lifecycle hook', { isInNpmLifecycleHook: () => true }],
    ['container', { isInContainer: () => true }],
    [
      'first command less than a day ago',
      { loadCommandState: () => Promise.resolve({ firstCommandTimestamp: new Date().toISOString() }) },
    ],
  ] as [string, Partial<SkillsOfferContext>][])('%s short-circuits without prompting', async (_name, overrides) => {
    const { ctx, configDir, capture, confirm } = testContext(overrides)

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: false })
    expect(confirm).not.toHaveBeenCalled()
    expect(capture.capture).not.toHaveBeenCalled()
    expect(acknowledgementExists(configDir)).toBe(false)
  })
})

describe('prompt outcomes', () => {
  test('answering No declines', async () => {
    const { prompts } = scriptedPrompts(declined)
    const { ctx, configDir, capture, installSkills } = testContext({ prompts })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'declined',
      cliVersion: '0.0.0-test',
    })
  })

  test('answering Yes accepts and installs', async () => {
    const { prompts } = scriptedPrompts(accepted)
    const { ctx, cwd, configDir, capture, installSkills } = testContext({ prompts })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).toHaveBeenCalledExactlyOnceWith({ cwd })
    expect(readAcknowledgement(configDir).outcome).toBe('accepted')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'accepted',
      cliVersion: '0.0.0-test',
    })
  })

  test('the prompt explains itself and carries the dismissal deadline', async () => {
    const { prompts, confirm } = scriptedPrompts(declined)
    const { ctx } = testContext({ prompts })

    await handleSkillsOffer(ctx)

    expect(confirm).toHaveBeenCalledTimes(1)
    const options = confirm.mock.calls[0][0]
    expect(options.message).toContain("Install Prisma's agent skills")
    expect(options.message).toContain('--no-hints')
    expect(options.timeoutMs).toBe(30_000)
  })

  test('a timed out prompt says so and persists the timeout outcome', async () => {
    const { prompts, messages } = scriptedPrompts({ status: 'timeout' })
    const { ctx, configDir, capture, installSkills } = testContext({ prompts })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('timeout')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'timeout',
      cliVersion: '0.0.0-test',
    })
    expect(messages.join('')).toContain('No response received')
  })

  test('a dismissed prompt counts as declining and is not repeated', async () => {
    const { prompts, messages } = scriptedPrompts({ status: 'cancelled' })
    const { ctx, configDir, capture, installSkills } = testContext({ prompts })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'declined',
      cliVersion: '0.0.0-test',
    })
    // dismissing is deliberate, so it does not deserve a "no response" notice
    expect(messages).toEqual([])
  })

  test('a throwing prompt resolves to the timeout outcome', async () => {
    const { prompts } = scriptedPrompts(() => Promise.reject(new Error('stdin closed')))
    const { ctx, configDir, capture, installSkills } = testContext({ prompts })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).not.toHaveBeenCalled()
    expect(readAcknowledgement(configDir).outcome).toBe('timeout')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'timeout',
      cliVersion: '0.0.0-test',
    })
  })

  test('failed install after accepting prints the manual command and stays non-fatal', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { prompts } = scriptedPrompts(accepted)
      const { ctx, configDir } = testContext({
        prompts,
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
    const { prompts } = scriptedPrompts(declined)
    const { ctx, configDir } = testContext({
      prompts,
      capture: { capture: () => Promise.reject(new Error('offline')) },
    })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(readAcknowledgement(configDir).outcome).toBe('declined')
  })

  test('a throwing skill install still reports the prompt as shown', async () => {
    const { prompts } = scriptedPrompts(accepted)
    const installSkills = vi.fn((): Promise<InstallSkillsResult> => Promise.reject(new Error('offline')))
    const { ctx, configDir, capture } = testContext({ prompts, installSkills })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(installSkills).toHaveBeenCalledExactlyOnceWith({ cwd: ctx.cwd })
    expect(readAcknowledgement(configDir).outcome).toBe('accepted')
    expect(capture.capture).toHaveBeenCalledExactlyOnceWith('test-signature', 'skills_offer_resolved', {
      outcome: 'accepted',
      cliVersion: '0.0.0-test',
    })
  })

  test('an unwritable config dir still reports the prompt as shown', async () => {
    const filePath = path.join(makeTmpDir(), 'occupied')
    fs.writeFileSync(filePath, '')
    const { prompts } = scriptedPrompts(declined)
    // configDir points inside a regular file, so the acknowledgement write fails
    const { ctx, capture } = testContext({
      prompts,
      configDir: path.join(filePath, 'config'),
    })

    const result = await handleSkillsOffer(ctx)

    expect(result).toEqual({ prompted: true })
    expect(capture.capture).toHaveBeenCalledTimes(1)
  })
})
