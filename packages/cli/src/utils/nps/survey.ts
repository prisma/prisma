import Debug from '@prisma/debug'
import { isCi, isInContainer, isInNpmLifecycleHook, isInteractive, maybeInGitHook } from '@prisma/internals'
import * as checkpoint from 'checkpoint-client'
import paths from 'env-paths'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

import { CommandState, daysSinceFirstCommand, loadOrInitializeCommandState } from '../commandState'
import { EventCapture, PosthogEventCapture } from './capture'
import { NpsStatusLookup, ProdNpsStatusLookup, Timeframe } from './status'

type NpsConfig = {
  acknowledgedTimeframe: Timeframe
}

type NpsSurveyResult = {
  rating?: number
  feedback?: string
}

type NpsSurveyEvent = {
  rating: number
  feedback?: string
}

type ReadlineInterface = {
  question: (query: string) => Promise<string>
  write: (message: string) => void
}

const promptTimeoutSecs = 30

const debug = Debug('prisma:cli:nps')

export async function handleNpsSurvey() {
  if (!isInteractive()) {
    // no point in running the NPS survey if there's no TTY
    return
  }

  if ('Deno' in globalThis) {
    // For some reason merely creating the readline interface on Deno
    // doesn't allow `prisma generate` to finish until Enter is pressed.
    return
  }

  const now = new Date()

  const rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.on('error', (err) => {
    debug(`A readline error occurred while handling NPS survey: ${err}`)
  })
  rl.on('SIGINT', () => {
    rl.write('Received SIGINT, closing the survey.\n')
    rl.close()
  })

  const status = new ProdNpsStatusLookup()
  const eventCapture = new PosthogEventCapture()

  await loadOrInitializeCommandState()
    .then((state) => handleNpsSurveyImpl(now, status, createSafeReadlineProxy(rl), eventCapture, state))
    .catch((err) => {
      // we don't want to propagate NPS survey errors, so we catch them here and log them
      debug(`An error occurred while handling NPS survey: ${err}`)
    })
    .finally(() => rl.close())
}

/**
 * Creates a proxy that aborts the readline interface when the underlying stream closes.
 */
export function createSafeReadlineProxy(rl: readline.promises.Interface): ReadlineInterface {
  const controller = new AbortController()
  rl.on('close', () => controller.abort())

  const rlProxy = new Proxy(rl, {
    get(target, prop, receiver) {
      controller.signal.throwIfAborted()
      return Reflect.get(target, prop, receiver)
    },
  })

  return rlProxy
}

export async function handleNpsSurveyImpl(
  now: Date,
  statusLookup: NpsStatusLookup,
  rl: ReadlineInterface,
  eventCapture: EventCapture,
  commandState: CommandState,
) {
  if (
    isCi() ||
    maybeInGitHook() ||
    isInNpmLifecycleHook() ||
    isInContainer() ||
    daysSinceFirstCommand(commandState) < 1
  ) {
    return
  }

  const config = await readConfig()
  if (config && isWithinTimeframe(now, config.acknowledgedTimeframe)) {
    // the user has already acknowledged an NPS survey covering the current date
    return
  }

  const status = await statusLookup.status()
  if (!status.currentTimeframe || !isWithinTimeframe(now, status.currentTimeframe)) {
    // no NPS survey is currently active
    return
  }

  const result = await collectFeedback(rl)

  if (result.rating) {
    await submitSurveyEvent({ rating: result.rating, ...result }, eventCapture)
    rl.write('Thanks for your feedback!\n')
  }

  await writeConfig({ acknowledgedTimeframe: status.currentTimeframe })
}

async function collectFeedback(rl: ReadlineInterface): Promise<NpsSurveyResult> {
  const question = rl.question(
    'How likely are you to recommend Prisma?\n\n' +
      'Enter a number from 0 to 10 (0 = not at all, 10 = extremely likely) and press Enter — ' +
      'or leave blank to skip and not be asked again.\n\n' +
      `This prompt closes in ${promptTimeoutSecs}s and can be suppressed with --no-hints. ` +
      'Learn more: https://pris.ly/why-nps\n\n' +
      'Rating: ',
  )
  const ratingAnswer = await timeout(question, promptTimeoutSecs * 1000)
  if (ratingAnswer === undefined) {
    rl.write(`No response received within ${promptTimeoutSecs} seconds. Exiting the survey.\n`)
    return {}
  }

  const rating = parseInt(ratingAnswer.trim(), 10)
  if (isNaN(rating) || rating < 0 || rating > 10) {
    rl.write('Not received a valid rating. Exiting the survey.\n')
    return {}
  }

  const feedbackAnswer = await rl.question(
    'Optional: Provide additional feedback or press Enter to skip.\n' + 'Additional feedback: ',
  )
  const feedback = feedbackAnswer.trim() === '' ? undefined : feedbackAnswer

  return { rating, feedback }
}

function getConfigPath(): string {
  return path.join(paths('prisma').config, 'nps.json')
}

async function readConfig(): Promise<NpsConfig | undefined> {
  const data = await fs.promises
    .readFile(getConfigPath(), 'utf-8')
    .catch((err) => (err.code === 'ENOENT' ? Promise.resolve(undefined) : Promise.reject(err)))
  if (data === undefined) {
    return undefined
  }

  const obj = JSON.parse(data)
  if (
    obj.acknowledgedTimeframe &&
    typeof obj.acknowledgedTimeframe.start === 'string' &&
    typeof obj.acknowledgedTimeframe.end === 'string'
  ) {
    return obj
  } else {
    throw new Error('Invalid NPS config schema')
  }
}

async function writeConfig(config: NpsConfig) {
  const configPath = getConfigPath()
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
  await fs.promises.writeFile(configPath, JSON.stringify(config))
}

async function submitSurveyEvent(event: NpsSurveyEvent, eventCapture: EventCapture) {
  const signature = await checkpoint.getSignature()
  await eventCapture.capture(signature, 'NPS feedback', event)
}

/**
 * Wraps a promise with a timeout. If the provided promise does not resolve within the given
 * time, the returned promise resolves to `undefined`.
 */
function timeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(undefined)
    }, ms)

    return promise.then((result) => {
      clearTimeout(timeoutId)
      resolve(result)
    })
  })
}

function isWithinTimeframe(date: Date, timeframe: Timeframe): boolean {
  return new Date(timeframe.start) <= date && new Date(timeframe.end) >= date
}
