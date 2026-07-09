import Debug from '@prisma/debug'
import { isCi, isInContainer, isInNpmLifecycleHook, isInteractive, maybeInGitHook } from '@prisma/internals'
import * as checkpoint from 'checkpoint-client'
import paths from 'env-paths'
import fs from 'fs'
import { yellow } from 'kleur/colors'
import path from 'path'
import readline from 'readline'

import { getCliVersion } from '../../get-cli-version'
import type { InstallSkillsOptions, InstallSkillsResult } from '../../init/skill-install'
import { installSkills } from '../../init/skill-install'
import { CommandState, daysSinceFirstCommand, loadOrInitializeCommandState } from '../commandState'
import { EventCapture, PosthogEventCapture, PUBLIC_POSTHOG_NPS_PROJECT_KEY } from '../nps/capture'
import { createSafeReadlineProxy } from '../nps/survey'
import { timeout } from '../prompt-timeout'

const debug = Debug('prisma:cli:skills-offer')

const promptTimeoutSecs = 30

export type SkillsOfferOutcome = 'accepted' | 'declined' | 'timeout' | 'already-installed'

type SkillsOfferAcknowledgement = {
  offeredAt: string
  outcome: SkillsOfferOutcome
}

export type PromptIO = {
  question: (query: string) => Promise<string>
  write: (message: string) => void
  close: () => void
}

export type SkillsOfferContext = {
  /** Project directory scanned for existing skills and targeted by the install. */
  cwd: string
  /** Directory the acknowledgement file is stored in. */
  configDir: string
  /** Whether the CLI runs on Deno, where creating a readline interface blocks generate. */
  isDeno: boolean
  isInteractive: () => boolean
  isCi: () => boolean
  maybeInGitHook: () => boolean
  isInNpmLifecycleHook: () => boolean
  isInContainer: () => boolean
  loadCommandState: () => Promise<CommandState>
  createPrompt: () => PromptIO
  installSkills: (options: InstallSkillsOptions) => Promise<InstallSkillsResult>
  capture: EventCapture
  getSignature: () => Promise<string>
  cliVersion: string
}

function defaultContext(): SkillsOfferContext {
  return {
    cwd: process.cwd(),
    configDir: paths('prisma').config,
    isDeno: 'Deno' in globalThis,
    isInteractive,
    isCi,
    maybeInGitHook,
    isInNpmLifecycleHook,
    isInContainer,
    loadCommandState: loadOrInitializeCommandState,
    createPrompt: createReadlinePrompt,
    installSkills,
    capture: new PosthogEventCapture(PUBLIC_POSTHOG_NPS_PROJECT_KEY),
    getSignature: () => checkpoint.getSignature(),
    cliVersion: getCliVersion(),
  }
}

/**
 * Offers to install the Prisma agent skills, once ever per machine, after a
 * successful generate run.
 *
 * Returns whether the user was actually shown a prompt, so the caller can
 * keep the number of prompts per run down to one. Never throws: any failure
 * is logged and reported as not prompted.
 */
export async function handleSkillsOffer(overrides: Partial<SkillsOfferContext> = {}): Promise<{
  prompted: boolean
}> {
  try {
    return await handleSkillsOfferImpl({ ...defaultContext(), ...overrides })
  } catch (err) {
    debug(`An error occurred while handling the skills offer: ${err}`)
    return { prompted: false }
  }
}

async function handleSkillsOfferImpl(ctx: SkillsOfferContext): Promise<{ prompted: boolean }> {
  const ackPath = path.join(ctx.configDir, 'skills-offer.json')

  if (await fileExists(ackPath)) {
    return { prompted: false }
  }

  if (await skillsAlreadyInstalled(ctx.cwd)) {
    await writeAcknowledgement(ackPath, 'already-installed')
    return { prompted: false }
  }

  if (
    !ctx.isInteractive() ||
    ctx.isDeno ||
    ctx.isCi() ||
    ctx.maybeInGitHook() ||
    ctx.isInNpmLifecycleHook() ||
    ctx.isInContainer()
  ) {
    return { prompted: false }
  }

  if (daysSinceFirstCommand(await ctx.loadCommandState()) < 1) {
    return { prompted: false }
  }

  const outcome = await promptForInstall(ctx)
  await writeAcknowledgement(ackPath, outcome)

  if (outcome === 'accepted') {
    try {
      const result = await ctx.installSkills({ cwd: ctx.cwd })
      if (!result.ok) {
        console.warn(
          `${yellow('warn')} Failed to install Prisma agent skills. You can install them manually by running:\n  ${
            result.manualCommand
          }`,
        )
      }
    } catch (err) {
      debug(`Failed to install Prisma agent skills: ${err}`)
    }
  }

  try {
    await submitOfferEvent(outcome, ctx)
  } catch (err) {
    // A telemetry failure after the prompt was shown must not report the run
    // as not prompted, or the caller would show a second prompt via the NPS
    // survey.
    debug(`Failed to submit the skills offer telemetry event: ${err}`)
  }

  return { prompted: true }
}

async function promptForInstall(ctx: SkillsOfferContext): Promise<'accepted' | 'declined' | 'timeout'> {
  const prompt = ctx.createPrompt()
  try {
    const answer = await timeout(
      prompt.question(
        "Install Prisma's agent skills so AI coding tools work better with this project? (y/N)\n" +
          `This prompt closes in ${promptTimeoutSecs}s and can be suppressed with --no-hints.\n` +
          '> ',
      ),
      promptTimeoutSecs * 1000,
    )

    if (answer === undefined) {
      prompt.write(`No response received within ${promptTimeoutSecs} seconds.\n`)
      return 'timeout'
    }

    return /^y(es)?$/i.test(answer.trim()) ? 'accepted' : 'declined'
  } finally {
    prompt.close()
  }
}

async function skillsAlreadyInstalled(cwd: string): Promise<boolean> {
  if (await fileExists(path.join(cwd, 'skills-lock.json'))) {
    return true
  }

  for (const skillsDir of ['.claude/skills', '.windsurf/skills', '.agents/skills']) {
    const entries: string[] = await fs.promises.readdir(path.join(cwd, skillsDir)).catch(() => [])
    if (entries.some((entry) => entry.startsWith('prisma-'))) {
      return true
    }
  }

  return false
}

async function writeAcknowledgement(ackPath: string, outcome: SkillsOfferOutcome): Promise<void> {
  const ack: SkillsOfferAcknowledgement = { offeredAt: new Date().toISOString(), outcome }
  try {
    await fs.promises.mkdir(path.dirname(ackPath), { recursive: true })
    await fs.promises.writeFile(ackPath, JSON.stringify(ack))
  } catch (err) {
    // A failed write (e.g. read-only config dir) may repeat the offer on the
    // next run, which is preferable to failing generate.
    debug(`Failed to write the skills offer acknowledgement: ${err}`)
  }
}

async function submitOfferEvent(outcome: SkillsOfferOutcome, ctx: SkillsOfferContext): Promise<void> {
  const signature = await ctx.getSignature()
  await ctx.capture.capture(signature, 'skills_offer_resolved', { outcome, cliVersion: ctx.cliVersion })
}

function createReadlinePrompt(): PromptIO {
  const rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.on('error', (err) => {
    debug(`A readline error occurred while handling the skills offer: ${err}`)
  })
  rl.on('SIGINT', () => rl.close())

  const proxy = createSafeReadlineProxy(rl)

  return {
    question: (query) => proxy.question(query),
    write: (message) => proxy.write(message),
    // Closes the underlying interface directly: the proxy throws once the
    // stream is closed, and close must stay callable from the finally block.
    close: () => rl.close(),
  }
}

function fileExists(filePath: string): Promise<boolean> {
  return fs.promises.access(filePath).then(
    () => true,
    () => false,
  )
}
