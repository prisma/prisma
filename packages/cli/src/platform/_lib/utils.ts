import { getCommandWithExecutor, isError, link } from '@prisma/internals'
import { bold, green } from 'kleur/colors'

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
  isExistingPrismaProject = false,
}: {
  databaseUrl: string
  workspaceId: string
  projectId: string
  environmentId: string
  isExistingPrismaProject?: boolean
}) => {
  /**
   * Happy path: fresh Prisma project, files have been created for the user
   */
  const newPrismaProjectOutput = `
We created an initial ${green('schema.prisma')} file and a ${green('.env')} file with your ${green(
    'DATABASE_URL',
  )} environment variable already set.

${bold('--- Next steps ---')}

Go to ${link('https://pris.ly/ppg-init')} for detailed instructions.

${bold('1. Define your database schema')}
Open the ${green('schema.prisma')} file and define your first models. Check the docs if you need inspiration: ${link(
    'https://pris.ly/ppg-init',
  )}.

${bold('2. Apply migrations')}
Run the following command to create and apply a migration:
${green('npx prisma migrate dev --name init')}

${bold('3. Manage your data')}
View and edit your data locally by running this command:
${green('npx prisma studio')}

...or online in Console:
${link(`https://console.prisma.io/${workspaceId}/${projectId}/${environmentId}/studio`)}

${bold('4. Send queries from your app')}
To access your database from a JavaScript/TypeScript app, you need to use Prisma ORM. Go here for step-by-step instructions: ${link(
    'https://pris.ly/ppg-init',
  )}
  `

  /**
   * Init was ran against an existing Prisma project.
   * If ./schema.prisma, prisma folder, or ./prisma/schema.prisma, or DATABASE_URL in .env exists,
   * then show DATABASE_URL to the user and do not write to file system.
   */
  const existingPrismaProjectOutput = `
We found an existing ${green('schema.prisma')} file in your current project directory.

${bold('--- Database URL ---')}

Connect Prisma ORM to your Prisma Postgres database with this URL:

${green(databaseUrl)}

${bold('--- Next steps ---')}

Go to ${link('https://pris.ly/ppg-init')} for detailed instructions.

${bold('1. Install and use the Prisma Accelerate extension')}
Prisma Postgres requires the Prisma Accelerate extension for querying. If you haven't already installed it, install it in your project:
${green('npm install @prisma/extension-accelerate')}

...and add it to your Prisma Client instance:
${green('import { withAccelerate } from "@prisma/extension-accelerate"')}

${green('const prisma = new PrismaClient().$extends(withAccelerate())')}

${bold('2. Apply migrations')}
Run the following command to create and apply a migration:
${green('npx prisma migrate dev')}

${bold('3. Manage your data')}
View and edit your data locally by running this command:
${green('npx prisma studio')}

...or online in Console:
${link(`https://console.prisma.io/${workspaceId}/${projectId}/${environmentId}/studio`)}

${bold('4. Send queries from your app')}
If you already have an existing app with Prisma ORM, you can now run it and it will send queries against your newly created Prisma Postgres instance.

${bold('5. Learn more')}
For more info, visit the Prisma Postgres docs: ${link('https://pris.ly/ppg-docs')}
`

  return isExistingPrismaProject // prettier-ignore
    ? existingPrismaProjectOutput
    : newPrismaProjectOutput
}
