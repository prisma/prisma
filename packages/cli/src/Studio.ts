import { access, constants, readFile } from 'node:fs/promises'

import { serve } from '@hono/node-server'
import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, format, HelpError, isError } from '@prisma/internals'
import type { Executor, SequenceExecutor } from '@prisma/studio-core/data'
import { type SerializedError, serializeError, type StudioBFFRequest } from '@prisma/studio-core/data/bff'
import { createMySQL2Executor } from '@prisma/studio-core/data/mysql2'
import { createNodeSQLiteExecutor } from '@prisma/studio-core/data/node-sqlite'
import { createPostgresJSExecutor } from '@prisma/studio-core/data/postgresjs'
import type { StudioProps } from '@prisma/studio-core/ui'
import { type Check, check as sendEvent } from 'checkpoint-client'
import { getPort } from 'get-port-please'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bold, dim, red, yellow } from 'kleur/colors'
import { digest } from 'ohash'
import open from 'open'
import { dirname, extname, join, resolve } from 'pathe'
import { runtime } from 'std-env'

import packageJson from '../package.json' assert { type: 'json' }
import { STUDIO_CSS_FILE_NAME, STUDIO_JS_FILE_NAME, type StudioAdapterType } from './studio-frontend-shared'
import { UserFacingError } from './utils/errors'
import { getPpgInfo } from './utils/ppgInfo'

/**
 * `prisma dev`'s `51_213 - 1`
 */
const DEFAULT_PORT = 51_212

const MIN_PORT = 49_152

const FILE_EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
}

const PRISMA_LOGO_SVG = `<svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M0.396923 8.8719C0.25789 9.09869 0.260041 9.38484 0.402469 9.60951L2.98037 13.6761C3.14768 13.94 3.47018 14.0603 3.76949 13.9705L11.2087 11.7388C11.6147 11.617 11.8189 11.1641 11.6415 10.7792L6.8592 0.405309C6.62598 -0.100601 5.92291 -0.142128 5.63176 0.332808L0.396923 8.8719ZM6.73214 2.77688C6.6305 2.54169 6.2863 2.57792 6.23585 2.82912L4.3947 11.9965C4.35588 12.1898 4.53686 12.3549 4.72578 12.2985L9.86568 10.7642C10.0157 10.7194 10.093 10.5537 10.0309 10.41L6.73214 2.77688Z"
    fill="currentColor"
  />
</svg>`
const PRISMA_LOGO_SVG_DATA_URL = `data:image/svg+xml,${encodeURIComponent(PRISMA_LOGO_SVG)}`

const ACCELERATE_UNSUPPORTED_MESSAGE =
  'Prisma Studio no longer supports Accelerate URLs (`prisma://` or `prisma+postgres://`). Use a direct database connection string instead.'

interface StudioStuff {
  adapter: StudioAdapterType
  createExecutor(connectionString: string, relativeTo: string): Promise<Executor>
}

/**
 * A list of query parameters that are specific to Prisma ORM and should be removed
 * from the connection string before passing it to the Postgres client to avoid errors.
 *
 * @See https://www.prisma.io/docs/orm/overview/databases/postgresql#arguments
 * @See https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS
 */
const PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'sslidentity',
  'sslaccept',
  'pool', // Using connection pooling with `postgres` package is unable to connect to PPG. Disabling it for now by removing the param. See https://linear.app/prisma-company/issue/TML-1670.
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
] as const

const PRISMA_ORM_SPECIFIC_MYSQL_QUERY_PARAMETERS = [
  'connection_limit',
  'pool_timeout',
  'socket_timeout',
  'sslaccept',
  'sslidentity',
] as const

const POSTGRES_STUDIO_STUFF: StudioStuff = {
  adapter: 'postgres',
  async createExecutor(connectionString) {
    const postgresModule = await import('postgres')

    const connectionURL = new URL(connectionString)

    for (const queryParameter of PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS) {
      connectionURL.searchParams.delete(queryParameter)
    }

    const postgres = postgresModule.default(connectionURL.toString())

    process.once('SIGINT', () => postgres.end())
    process.once('SIGTERM', () => postgres.end())

    return createPostgresJSExecutor(postgres)
  },
}

type Database = { new (path: string): import('better-sqlite3').Database }

const CONNECTION_STRING_PROTOCOL_TO_STUDIO_STUFF: Record<string, StudioStuff | null> = {
  // TODO: figure out PGLite support later.
  file: {
    adapter: 'sqlite',
    async createExecutor(uri, relativeTo) {
      const path = uri.replace('file:', '')

      const isInMemory = path === ':memory:'

      const resolvedPath = isInMemory ? path : resolve(relativeTo, path)

      if (!isInMemory) {
        await access(resolvedPath, constants.F_OK).catch(() => {
          console.warn(
            yellow(
              `Database file at "${resolvedPath}" was not found. A new file was created. If this is an unwanted side effect, it might mean that the URL you have provided is incorrect.`,
            ),
          )
        })
      }

      let database: InstanceType<Database> | undefined = undefined

      try {
        // TODO: remove 'as' once Node.js v22 is the minimum supported version.
        const { DatabaseSync } = (await import('node:sqlite' as never)) as {
          DatabaseSync: Database
        }

        database = new DatabaseSync(resolvedPath)
      } catch (error: unknown) {
        try {
          switch (runtime) {
            case 'node': {
              const { default: Database } = await import('better-sqlite3')

              database = new Database(resolvedPath)
              break
            }
            case 'deno': {
              const { Database } = (await import('jsr:@db/sqlite@0.13.0' as never)) as {
                Database: Database
              }

              database = new Database(resolvedPath)
              break
            }
            case 'bun': {
              const { Database } = (await import('bun:sqlite' as never)) as {
                Database: Database
              }

              database = new Database(resolvedPath) as never
              break
            }
            default:
              throw new Error(`Unsupported runtime for SQLite: "${runtime}"`)
          }
        } catch (error: unknown) {
          throw new Error(
            `Failed to open SQLite database at "${resolvedPath}".\nCaused by: ${(error as Error).message}

Please use Node.js >=22.5, Deno >=2.2 or Bun >=1.0 or ensure you have the \`better-sqlite3\` package installed for Node.js <22.5 or the \`jsr:@db/sqlite\` package installed for Deno <2.2.`,
          )
        }
      }

      process.once('SIGINT', () => database!.close())
      process.once('SIGTERM', () => database!.close())

      return createNodeSQLiteExecutor(database)
    },
  },
  postgres: POSTGRES_STUDIO_STUFF,
  postgresql: POSTGRES_STUDIO_STUFF,
  mysql: {
    adapter: 'mysql',
    async createExecutor(connectionString) {
      const { createPool } = await import('mysql2/promise')

      const pool = createPool(normalizeMySQLConnectionString(connectionString))

      process.once('SIGINT', () => pool.end())
      process.once('SIGTERM', () => pool.end())

      return createMySQL2Executor(pool)
    },
  },
  sqlserver: null,
}

export class Studio implements Command {
  private static help = format(`
Browse your data with Prisma Studio

${bold('Usage')}

  ${dim('$')} prisma studio [options]

${bold('Options')}

  -h, --help        Display this help message
  -p, --port        Port to start Studio on
  -b, --browser     Browser to open Studio in
  --config          Custom path to your Prisma config file
  --url             Database connection string (overrides the one in your Prisma config)

${bold('Examples')}

  Start Studio on the default port
    ${dim('$')} prisma studio

  Start Studio on a custom port
    ${dim('$')} prisma studio --port 5555

  Start Studio in a specific browser
    ${dim('$')} prisma studio --port 5555 --browser firefox
    ${dim('$')} BROWSER=firefox prisma studio --port 5555

  Start Studio without opening in a browser
    ${dim('$')} prisma studio --port 5555 --browser none
    ${dim('$')} BROWSER=none prisma studio --port 5555

  Specify a custom prisma config file
    ${dim('$')} prisma studio --config=./prisma.config.ts

  Specify a direct database connection string
    ${dim('$')} prisma studio --url="postgresql://user:password@localhost:5432/dbname"
`)

  static new(): Studio {
    return new Studio()
  }

  help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Studio.help}`)
    }

    return Studio.help
  }

  /**
   * Parses arguments passed to this command, and starts Studio
   *
   * @param argv Array of all arguments
   * @param config The loaded Prisma config
   */
  async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--config': String,
      '--port': Number,
      '-p': '--port',
      '--browser': String,
      '-b': '--browser',
      '--url': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const connectionString = args['--url'] || config.datasource?.url

    if (!connectionString) {
      return new UserFacingError(
        'No database URL found. Provide it via the `--url <url>` argument or define it in your Prisma config file as `datasource.url`.',
      )
    }

    if (!URL.canParse(connectionString)) {
      return new UserFacingError('The provided database URL is not valid.')
    }

    const protocol = new URL(connectionString).protocol.replace(':', '')

    if (isAccelerateProtocol(protocol)) {
      return new UserFacingError(ACCELERATE_UNSUPPORTED_MESSAGE)
    }

    const studioStuff = CONNECTION_STRING_PROTOCOL_TO_STUDIO_STUFF[protocol]

    if (!studioStuff) {
      return new UserFacingError(`Prisma Studio is not supported for the "${protocol}" protocol.`)
    }

    const executor = await studioStuff.createExecutor(
      connectionString,
      getUrlBasePath(args['--url'], config.loadedFromFile),
    )

    const app = new Hono()

    app.use('*', cors())

    app.get('/', (ctx) => {
      const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[extname('index.html')]

      return ctx.text(getIndexHtml(studioStuff.adapter), 200, { 'Content-Type': contentType })
    })

    app.get('/favicon.ico', (ctx) => {
      return ctx.body(PRISMA_LOGO_SVG, 200, { 'Content-Type': 'image/svg+xml' })
    })

    app.get(`/${STUDIO_JS_FILE_NAME}`, async (ctx) => {
      return serveStudioAsset(ctx.req.path)
    })

    app.get(`/${STUDIO_CSS_FILE_NAME}`, async (ctx) => {
      return serveStudioAsset(ctx.req.path)
    })

    app.post('/bff', async (ctx) => {
      const request = (await ctx.req.json()) as StudioBFFRequest

      const { procedure } = request

      if (procedure === 'query') {
        const [error, results] = await executor.execute(request.query)

        if (error) {
          return ctx.json([serializeBffError(error)])
        }

        return ctx.json([null, results])
      }

      if (procedure === 'sequence') {
        if (!('executeSequence' in executor)) {
          return ctx.json([[serializeBffError(new Error('Executor does not support sequences'))]])
        }

        const [[error0, result0], maybeResult1] = await (executor as SequenceExecutor).executeSequence(request.sequence)

        if (error0) {
          return ctx.json([[serializeBffError(error0)]])
        }

        const [error1, result1] = maybeResult1 || []

        if (error1) {
          return ctx.json([[null, result0], [serializeBffError(error1)]])
        }

        return ctx.json([
          [null, result0],
          [null, result1],
        ])
      }

      if (procedure === 'transaction') {
        if (!executor.executeTransaction) {
          return ctx.json([serializeBffError(new Error('Executor does not support transactions'))])
        }

        const [error, results] = await executor.executeTransaction(request.queries)

        if (error) {
          return ctx.json([serializeBffError(error)])
        }

        return ctx.json([null, results])
      }

      if (procedure === 'sql-lint') {
        if (!executor.lintSql) {
          return ctx.json([serializeBffError(new Error('Executor does not support SQL lint'))])
        }

        const [error, result] = await executor.lintSql({
          schemaVersion: request.schemaVersion,
          sql: request.sql,
        })

        if (error) {
          return ctx.json([serializeBffError(error)])
        }

        return ctx.json([null, result])
      }

      procedure satisfies undefined

      return ctx.text('Unknown procedure', { status: 500 })
    })

    let projectHash: string | null = null
    const version = packageJson.dependencies['@prisma/studio-core']

    const ppgDbInfo = await getPpgInfo(connectionString)

    app.post('/telemetry', async (ctx) => {
      const { eventId, name, payload, timestamp } =
        await ctx.req.json<Parameters<NonNullable<StudioProps['onEvent']>>[0]>()

      if (name !== 'studio_launched') {
        return ctx.body(null, 200)
      }

      const input: Check.Input = {
        check_if_update_available: false,
        client_event_id: eventId,
        command: name,
        information: JSON.stringify({
          eventPayload: payload,
          protocol,
          ...ppgDbInfo,
        }),
        local_timestamp: timestamp,
        product: 'prisma-studio-cli',
        project_hash: (projectHash ??= digest(process.cwd())),
        version,
      }

      await sendEvent(input).catch(() => {
        // noop
      })

      return ctx.body(null, 200)
    })

    const port = args['--port'] || (await getPort({ port: DEFAULT_PORT, portRange: [MIN_PORT, DEFAULT_PORT - 1] }))

    const url = `http://localhost:${port}`

    const server = serve({ fetch: app.fetch, overrideGlobalObjects: false, port }, () => {
      process.once('SIGINT', () => server.close())
      process.once('SIGTERM', () => server.close())

      console.log(bold(`\nPrisma Studio is running at:`), url)

      const browser = args['--browser'] || process.env.BROWSER

      if (browser?.toLowerCase() !== 'none') {
        void open(url, { app: browser ? { name: browser } : undefined })
      }
    })

    return ''
  }
}

function getUrlBasePath(url: string | undefined, configPath: string | null): string {
  return url ? process.cwd() : configPath ? dirname(configPath) : process.cwd()
}

function serializeBffError(error: unknown): SerializedError {
  return getSerializedBffError(error) ?? serializeError(error)
}

function getSerializedBffError(error: unknown): SerializedError | null {
  if (isSerializedError(error)) {
    return error
  }

  if (!isRecord(error)) {
    return null
  }

  const nestedError = error.error

  if (isSerializedError(nestedError)) {
    return nestedError
  }

  const rpcSerializedError = error['@@error']

  if (isSerializedError(rpcSerializedError)) {
    return rpcSerializedError
  }

  return null
}

function isSerializedError(error: unknown): error is SerializedError {
  if (!isRecord(error)) {
    return false
  }

  if (typeof error.name !== 'string' || typeof error.message !== 'string') {
    return false
  }

  if (error.errors === undefined) {
    return true
  }

  return Array.isArray(error.errors) && error.errors.every(isSerializedError)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAccelerateProtocol(protocol: string): boolean {
  return protocol === 'prisma' || protocol === 'prisma+postgres'
}

function normalizeMySQLConnectionString(connectionString: string): string {
  const connectionURL = new URL(connectionString)

  const connectionLimit = connectionURL.searchParams.get('connection_limit')

  if (connectionLimit && !connectionURL.searchParams.has('connectionLimit')) {
    connectionURL.searchParams.set('connectionLimit', connectionLimit)
  }

  const sslAccept = connectionURL.searchParams.get('sslaccept')

  if (sslAccept && !connectionURL.searchParams.has('ssl')) {
    connectionURL.searchParams.set('ssl', JSON.stringify(prismaSslAcceptToMySQL2Ssl(sslAccept)))
  }

  for (const queryParameter of PRISMA_ORM_SPECIFIC_MYSQL_QUERY_PARAMETERS) {
    connectionURL.searchParams.delete(queryParameter)
  }

  return connectionURL.toString()
}

function prismaSslAcceptToMySQL2Ssl(sslAccept: string): { rejectUnauthorized: boolean } {
  switch (sslAccept) {
    case 'strict':
      return { rejectUnauthorized: true }
    case 'accept_invalid_certs':
      return { rejectUnauthorized: false }
    default:
      throw new Error(
        `Unknown Prisma MySQL sslaccept value "${sslAccept}". Supported values are "strict" and "accept_invalid_certs".`,
      )
  }
}

// prettier-ignore
function getIndexHtml(adapter: StudioAdapterType): string {
  return `<!doctype html>
<html lang="en" style="height: 100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="${PRISMA_LOGO_SVG_DATA_URL}" type="image/svg+xml">
    <link rel="stylesheet" href="/${STUDIO_CSS_FILE_NAME}">
    <style>
      html {
        height: 100%;
      }

      body {
        color: black;
        height: 100%;
        margin: 0;
        padding: 0;
      }

      #root {
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>window.__STUDIO_CONFIG__ = ${JSON.stringify({ adapter })};</script>
    <script type="module" src="/${STUDIO_JS_FILE_NAME}"></script>
  </body>
</html>`
}

async function serveStudioAsset(requestPath: string): Promise<Response> {
  const fileName = requestPath.substring(1)
  const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[extname(fileName)]

  try {
    return new Response(await readStudioAsset(fileName), {
      headers: { 'Content-Type': contentType },
      status: 200,
    })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return new Response('Not Found', { status: 404 })
    }

    return new Response('Internal Server Error', { status: 500 })
  }
}

async function readStudioAsset(fileName: string): Promise<Buffer | string> {
  const triedPaths: string[] = []

  for (const directory of getStudioAssetDirectories()) {
    const filePath = join(directory, fileName)
    triedPaths.push(filePath)

    try {
      return await readFile(filePath)
    } catch (error: unknown) {
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  const error = new Error(`Prisma Studio asset "${fileName}" was not found.`) as Error & { code?: string }
  error.code = 'ENOENT'
  error.message = `${error.message}\nSearched in:\n${triedPaths.map((filePath) => `- ${filePath}`).join('\n')}`
  throw error
}

function getStudioAssetDirectories(): string[] {
  return [...new Set([__dirname, join(__dirname, '..', 'build')])]
}

function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
