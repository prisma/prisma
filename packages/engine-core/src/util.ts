import fs from 'fs'
import { Platform } from '@prisma/get-platform'
import { BinaryTargetsEnvValue } from '@prisma/generator-helper'
import terminalLink from 'terminal-link'
import newGithubIssueUrl from 'new-github-issue-url'
import chalk from 'chalk'
import Debug from '@prisma/debug'
import crypto from 'crypto'

const debug = Debug('plusX')

export function plusX(file): void {
  const s = fs.statSync(file)
  const newMode = s.mode | 64 | 8 | 1
  if (s.mode === newMode) {
    debug(`Execution permissions of ${file} are fine`)
    return
  }
  const base8 = newMode.toString(8).slice(-3)
  debug(`Have to call plusX on ${file}`)
  fs.chmodSync(file, base8)
}

function transformPlatformToEnvValue(
  platform: Platform | string,
): BinaryTargetsEnvValue {
  return { fromEnvVar: null, value: platform }
}

export function fixBinaryTargets(
  binaryTargets: BinaryTargetsEnvValue[],
  platform: Platform | string,
): BinaryTargetsEnvValue[] {
  binaryTargets = binaryTargets || []

  if (!binaryTargets.find((object) => object.value === 'native')) {
    return [transformPlatformToEnvValue('native'), ...binaryTargets]
  }

  return [...binaryTargets, transformPlatformToEnvValue(platform)]
}

export function link(url: string): string {
  return terminalLink(url, url, {
    fallback: (url) => chalk.underline(url),
  })
}

export function getGithubIssueUrl({
  title,
  user = 'prisma',
  repo = 'prisma',
  template = 'bug_report.md',
  body,
}: {
  title: string
  user?: string
  repo?: string
  template?: string
  body?: string
}): string {
  return newGithubIssueUrl({
    user,
    repo,
    template,
    title,
    body,
  })
}

export function getRandomString() {
  return crypto.randomBytes(12).toString('hex')
}
