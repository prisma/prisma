import { getLogs } from '@prisma/debug'
import { underline } from 'kleur/colors'
import stripAnsi from 'strip-ansi'

import type { ErrorWithLinkInput } from '../types/ErrorWithLinkInput'
import { maskQuery } from './maskQuery'
import { normalizeLogs } from './normalizeLogs'
import { getGitHubIssueUrl } from './util'

export function getErrorMessageWithLink({
  version,
  platform,
  title,
  description,
  engineVersion,
  database,
  query,
}: ErrorWithLinkInput) {
  const gotLogs = getLogs(6000 - (query?.length ?? 0))
  const logs = normalizeLogs(stripAnsi(gotLogs))
  const moreInfo = description ? `# Description\n\`\`\`\n${description}\n\`\`\`` : ''
  const body = stripAnsi(
    `Hi Prisma Team! My Prisma Client just crashed. This is the report:
## Versions

| Name            | Version            |
|-----------------|--------------------|
| Node            | ${process.version?.padEnd(19)}| 
| OS              | ${platform?.padEnd(19)}|
| Prisma Client   | ${version?.padEnd(19)}|
| Query Engine    | ${engineVersion?.padEnd(19)}|
| Database        | ${database?.padEnd(19)}|

${moreInfo}

## Logs
\`\`\`
${logs}
\`\`\`

## Client Snippet
\`\`\`ts
// PLEASE FILL YOUR CODE SNIPPET HERE
\`\`\`

## Schema
\`\`\`prisma
// PLEASE ADD YOUR SCHEMA HERE IF POSSIBLE
\`\`\`

## Prisma Engine Query
\`\`\`
${query ? maskQuery(query) : ''}
\`\`\`
`,
  )

  const url = getGitHubIssueUrl({ title, body })
  return `${title}

This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

${underline(url)}

If you want the Prisma team to look into it, please open the link above 🙏
To increase the chance of success, please post your schema and a snippet of
how you used Prisma Client in the issue. 
`
}
