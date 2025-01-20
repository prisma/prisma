import { getCommandWithExecutor, isError, link } from '@prisma/internals'
import { bold, green, underline } from 'kleur/colors'

import { getOptionalParameter } from './cli/parameters'
import { credentialsFile } from './credentials'

export const platformParameters = {
  global: {
    // TODO Remove this from global once we have a way for parents to strip out flags upon parsing.
    '--token': String,
    '--json': Boolean,
  },
  workspace: {
    '--token': String,
    '--workspace': String,
    '--json': Boolean,
    '-w': '--workspace',
  },
  project: {
    '--token': String,
    '--project': String,
    '-p': '--project',
  },
  environment: {
    '--token': String,
    '--environment': String,
    '-e': '--environment',
  },
  serviceToken: {
    '--token': String,
    '--serviceToken': String,
    '-s': '--serviceToken',
  },
  apikey: {
    '--token': String,
    '--apikey': String,
  },
} as const

export const ErrorPlatformUnauthorized = new Error(
  `No platform credentials found. Run ${green(getCommandWithExecutor('prisma platform auth login --early-access'))} first. Alternatively you can provide a token via the \`--token\` or \`-t\` parameters, or set the 'PRISMA_TOKEN' environment variable with a token.`, // prettier-ignore
)

export const getTokenOrThrow = async <$Args extends Record<string, unknown>>(args: $Args) => {
  const token = getOptionalParameter(args, ['--token', '-t'], 'PRISMA_TOKEN') as string
  if (token) return token

  const credentials = await credentialsFile.load()
  if (isError(credentials)) throw credentials
  if (!credentials) throw ErrorPlatformUnauthorized

  return credentials.token
}

const accelerateConnectionStringUrl = 'prisma://accelerate.prisma-data.net'

/**
 *
 * Output related utils
 *
 */

export const generateConnectionString = (apiKey: string) => {
  const url = new URL(accelerateConnectionStringUrl)
  url.searchParams.set('api_key', apiKey)
  return bold(url.href)
}

export const poll = async <F extends () => Promise<R>, R>(
  fn: F,
  until: (res: R) => boolean,
  waitMs: number,
  timeoutMs: number,
  message?: string,
) => {
  const endTime = new Date().getMilliseconds() + timeoutMs

  const wait = () =>
    new Promise((resolve) => {
      setTimeout(resolve, waitMs)
    })

  let result = await fn()
  while (!until(result)) {
    const waitTime = new Date().getMilliseconds() + waitMs
    if (waitTime > endTime) {
      throw new Error(`polling timed out after ${timeoutMs}ms`)
    }
    if (message) console.log(message)
    result = await wait().then(fn)
  }

  if (isError(result)) throw result

  return result
}

export const printPpgInitOutput = ({
  databaseUrl,
  workspaceId,
  projectId,
  environmentId,
}: {
  databaseUrl: string
  workspaceId: string
  projectId: string
  environmentId: string
}) => `
Database URL:
${green(databaseUrl)}

Project link:
${link(`https://console.prisma.io/${workspaceId}/${projectId}/${environmentId}/dashboard`)}

${bold('Next steps')}
${bold('1. Define your database schema')}
Open the ${green('schema.prisma')} file and define your first models. Go to ${link(
  underline('pris.ly/ppg-quickstart'),
)} if you need inspiration.

${bold('2. Apply migrations')}
Run the following command to create and apply a migration:
${green('npx prisma migrate dev --name init')}

${bold(`3. Send queries with Prisma Client`)}
As a next step, you can instantiate Prisma Client and start sending queries to your database from your application.

${bold(`4. Manage your data`)}
View your database in Studio via Console: ${link(
  `https://console.prisma.io/${workspaceId}/${projectId}/${environmentId}/studio`,
)}.
Or run Studio locally with: ${green('npx prisma studio')}

Find more information in our documentation:
${link('https://pris.ly/d/getting-started')}
`
