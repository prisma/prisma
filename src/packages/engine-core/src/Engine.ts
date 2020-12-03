import {
  RustLog,
  //  PanicLogFields,
  RustError,
  isRustError,
} from './log'
import { getLogs } from '@prisma/debug'
import { getGithubIssueUrl, link } from './util'
import stripAnsi from 'strip-ansi'

export function getMessage(log: string | RustLog | RustError | any): string {
  if (typeof log === 'string') {
    return log
  } else if (isRustError(log)) {
    return log.message
  } else if (log.fields && log.fields.message) {
    if (log.fields.reason) {
      return `${log.fields.message}: ${log.fields.reason}`
    }
    return log.fields.message
  } else {
    return JSON.stringify(log)
  }
}

export interface RequestError {
  error: string
  user_facing_error: {
    is_panic: boolean
    message: string
    meta?: object
    error_code?: string
  }
}

export class PrismaClientKnownRequestError extends Error {
  code: string
  meta?: object
  clientVersion: string

  constructor(
    message: string,
    code: string,
    clientVersion: string,
    meta?: any,
  ) {
    super(message)

    this.code = code
    this.clientVersion = clientVersion
    this.meta = meta
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientKnownRequestError'
  }
}

export class PrismaClientUnknownRequestError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientUnknownRequestError'
  }
}

export class PrismaClientRustPanicError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientRustPanicError'
  }
}

export class PrismaClientInitializationError extends Error {
  clientVersion: string

  constructor(message: string, clientVersion: string) {
    super(message)

    this.clientVersion = clientVersion
  }
  get [Symbol.toStringTag]() {
    return 'PrismaClientInitializationError'
  }
}

export interface ErrorWithLinkInput {
  version: string
  platform?: string
  title: string
  description?: string
}

export function getErrorMessageWithLink({
  version,
  platform,
  title,
  description,
}: ErrorWithLinkInput) {
  const logs = normalizeLogs(stripAnsi(getLogs()))
  const moreInfo = description
    ? `# Description\n\`\`\`\n${description}\n\`\`\``
    : ''
  const body = stripAnsi(
    `Hi Prisma Team! My Prisma Client just crashed. This is the report:
## Versions

| Name            | Version            |
|-----------------|--------------------|
| Node            | ${process.version?.padEnd(19)}| 
| OS              | ${platform?.padEnd(19)}|
| Prisma Client   | ${version?.padEnd(19)}|

${moreInfo}

## Logs
\`\`\`
${logs}
\`\`\``,
  )

  const url = getGithubIssueUrl({ title, body })
  return `${title}

This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

${link(url)}

If you want the Prisma team to look into it, please open the link above 🙏
`
}

/**
 * Removes the leading timestamps (from docker) and trailing ms (from debug)
 * @param logs logs to normalize
 */
function normalizeLogs(logs: string): string {
  return logs
    .split('\n')
    .map((l) => {
      return l
        .replace(
          /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)\s*/,
          '',
        )
        .replace(/\+\d+\s*ms$/, '')
    })
    .join('\n')
}
