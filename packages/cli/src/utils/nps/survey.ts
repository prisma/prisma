import Debug from '@prisma/debug'
import { isCi } from '@prisma/internals'
import * as checkpoint from 'checkpoint-client'
import paths from 'env-paths'
import fs from 'fs'
import path from 'path'
import readline from 'readline'

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
  const now = new Date()
  const rl = readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const status = new ProdNpsStatusLookup()
  const eventCapture = new PosthogEventCapture()

  const rlClose = new Promise((resolve) => {
    rl.once('close', resolve)
  })

  const survey = await handleNpsSurveyImpl(now, status, rl, eventCapture)
    .catch((err) => {
      // we don't want to propagate NPS survey errors, so we catch them here and log them
      debug(`An error occurred while handling NPS survey: ${err}`)
    })
    .finally(() => rl.close())

  // wait for either the survey or the readline interface to close
  await Promise.race([survey, rlClose])
}

export async function handleNpsSurveyImpl(
  now: Date,
  statusLookup: NpsStatusLookup,
  rl: ReadlineInterface,
  eventCapture: EventCapture,
) {
  if (isCi()) {
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
    rl.write('Thank you for your feedback!\n')
  }

  await writeConfig({ acknowledgedTimeframe: status.currentTimeframe })
}

async function collectFeedback(rl: ReadlineInterface): Promise<NpsSurveyResult> {
  const question = rl.question(
    'If you would like to rate how likely you are to recommend Prisma to a friend or colleague, ' +
      'enter a number from 0 to 10, where 0 means "not likely at all" and 10 means ' +
      '"extremely likely" and then press "Enter". This prompt will close automatically after ' +
      `${promptTimeoutSecs} seconds.\n` +
      'Rating: ',
  )
  const ratingAnswer = await timeout(question, promptTimeoutSecs * 1000)
  if (ratingAnswer === undefined) {
    rl.write(`No response received within ${promptTimeoutSecs} seconds. Exiting.\n`)
    return {}
  }

  const rating = parseInt(ratingAnswer.trim(), 10)
  if (isNaN(rating) || rating < 0 || rating > 10) {
    rl.write('Not received a valid rating. Exiting.\n')
    return {}
  }

  const feedbackAnswer = await rl.question(
    'If you would like to provide any additional feedback, enter it below or press "Enter" to ' +
      'skip.\n' +
      'Additional feedback: ',
  )
  const feedback = feedbackAnswer.trim() === '' ? undefined : feedbackAnswer

  return { rating, feedback }
}

function getConfigPath(): string {
  return path.join(paths('prisma').config, 'nps.json')
}

function readConfig(): Promise<NpsConfig | undefined> {
  return (
    fs.promises
      .readFile(getConfigPath(), 'utf-8')
      .then((data) => JSON.parse(data))
      // treat missing config file as no config
      .catch((err) => (err.code === 'ENOENT' ? Promise.resolve(undefined) : Promise.reject(err)))
  )
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
  return new Date(timeframe.start) < date && new Date(timeframe.end) > date
}
