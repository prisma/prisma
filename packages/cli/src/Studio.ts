import { access, constants, readFile } from 'node:fs/promises'

import { serve } from '@hono/node-server'
import type { PrismaConfigInternal } from '@prisma/config'
import { arg, type Command, format, HelpError, isError } from '@prisma/internals'
import type { Executor, SequenceExecutor } from '@prisma/studio-core/data'
import { serializeError, type StudioBFFRequest } from '@prisma/studio-core/data/bff'
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
import { z } from 'zod'

import packageJson from '../package.json' assert { type: 'json' }
import { getPpgInfo } from './utils/ppgInfo'

/**
 * `prisma dev`'s `51_213 - 1`
 */
const DEFAULT_PORT = 51_212

const MIN_PORT = 49_152

const STATIC_ASSETS_DIR = join(require.resolve('@prisma/studio-core/data'), '../..')

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

const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

const ADAPTER_FILE_NAME = 'adapter.js'
const ADAPTER_FACTORY_FUNCTION_NAME = 'createAdapter'

const ACCELERATE_API_KEY_QUERY_PARAMETER = 'api_key'

const AccelerateAPIKeyPayloadSchema = z.object({
  secure_key: z.string(),
  tenant_id: z.string(),
})

interface StudioStuff {
  createExecutor(connectionString: string, relativeTo: string): Promise<Executor>
  reExportAdapterScript: string
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

const POSTGRES_STUDIO_STUFF: StudioStuff = {
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
  reExportAdapterScript: `export { createPostgresAdapter as ${ADAPTER_FACTORY_FUNCTION_NAME} } from '/data/postgres-core/index.js';`,
}

type Database = { new (path: string): import('better-sqlite3').Database }

const CONNECTION_STRING_PROTOCOL_TO_STUDIO_STUFF: Record<string, StudioStuff | null> = {
  // TODO: figure out PGLite support later.
  file: {
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
    reExportAdapterScript: `export { createSQLiteAdapter as ${ADAPTER_FACTORY_FUNCTION_NAME} } from '/data/sqlite-core/index.js';`,
  },
  postgres: POSTGRES_STUDIO_STUFF,
  postgresql: POSTGRES_STUDIO_STUFF,
  'prisma+postgres': {
    async createExecutor(connectionString, relativeTo) {
      const connectionURL = new URL(connectionString)

      if (['localhost', '127.0.0.1', '[::1]'].includes(connectionURL.hostname)) {
        // TODO: support `prisma dev` accelerate URLs.

        throw new Error('The "prisma+postgres" protocol with localhost is not supported in Prisma Studio yet.')
      }

      const apiKey = connectionURL.searchParams.get(ACCELERATE_API_KEY_QUERY_PARAMETER)

      if (!apiKey) {
        throw new Error(
          `\`${ACCELERATE_API_KEY_QUERY_PARAMETER}\` query parameter is missing in the provided "prisma+postgres" connection string.`,
        )
      }

      const [, payload] = apiKey.split('.')

      try {
        const decodedPayload = AccelerateAPIKeyPayloadSchema.parse(
          JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')),
        )

        connectionURL.password = decodedPayload.secure_key
        connectionURL.username = decodedPayload.tenant_id
      } catch {
        throw new Error(
          `Invalid/outdated \`${ACCELERATE_API_KEY_QUERY_PARAMETER}\` query parameter in the provided "prisma+postgres" connection string. Please create a new API key and use the new connection string OR use a direct TCP connection string instead.`,
        )
      }

      connectionURL.host = 'db.prisma.io:5432'
      connectionURL.pathname = '/postgres'
      connectionURL.protocol = 'postgres:'
      connectionURL.searchParams.delete(ACCELERATE_API_KEY_QUERY_PARAMETER)
      connectionURL.searchParams.set('sslmode', 'require')

      return await POSTGRES_STUDIO_STUFF.createExecutor(connectionURL.toString(), relativeTo)
    },
    reExportAdapterScript: POSTGRES_STUDIO_STUFF.reExportAdapterScript,
  },
  mysql: {
    async createExecutor(connectionString) {
      const { createPool } = await import('mysql2/promise')

      const pool = createPool(connectionString)

      process.once('SIGINT', () => pool.end())
      process.once('SIGTERM', () => pool.end())

      return createMySQL2Executor(pool)
    },
    reExportAdapterScript: `export { createMySQLAdapter as ${ADAPTER_FACTORY_FUNCTION_NAME} } from '/data/mysql-core/index.js';`,
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
      return new Error(
        'No database URL found. Provide it via the `--url <url>` argument or define it in your Prisma config file as `datasource.url`.',
      )
    }

    if (!URL.canParse(connectionString)) {
      return new Error('The provided database URL is not valid.')
    }

    const protocol = new URL(connectionString).protocol.replace(':', '')

    const studioStuff = CONNECTION_STRING_PROTOCOL_TO_STUDIO_STUFF[protocol]

    if (!studioStuff) {
      return new Error(`Prisma Studio is not supported for the "${protocol}" protocol.`)
    }

    const executor = await studioStuff.createExecutor(
      connectionString,
      getUrlBasePath(args['--url'], config.loadedFromFile),
    )

    const app = new Hono()

    app.use('*', cors())

    app.get('/', (ctx) => {
      const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[extname('index.html')]

      return ctx.text(INDEX_HTML, 200, { 'Content-Type': contentType })
    })

    app.get(`/${ADAPTER_FILE_NAME}`, (ctx) => {
      const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[extname(ctx.req.path)]

      return ctx.text(studioStuff.reExportAdapterScript, 200, { 'Content-Type': contentType })
    })

    app.get('/*', async (ctx) => {
      const filePath = join(STATIC_ASSETS_DIR, ctx.req.path.substring(1))

      const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[extname(filePath)] || DEFAULT_CONTENT_TYPE

      try {
        return ctx.body(await readFile(filePath), 200, { 'Content-Type': contentType })
      } catch {
        return ctx.text('Not Found', 404)
      }
    })

    app.post('/bff', async (ctx) => {
      const request = (await ctx.req.json()) as StudioBFFRequest

      const { procedure } = request

      if (procedure === 'query') {
        const [error, results] = await executor.execute(request.query)

        if (error) {
          return ctx.json([serializeError(error)])
        }

        return ctx.json([null, results])
      }

      if (procedure === 'sequence') {
        if (!('executeSequence' in executor)) {
          return ctx.json([[serializeError(new Error('Executor does not support sequences'))]])
        }

        const [[error0, result0], maybeResult1] = await (executor as SequenceExecutor).executeSequence(request.sequence)

        if (error0) {
          return ctx.json([[serializeError(error0)]])
        }

        const [error1, result1] = maybeResult1 || []

        if (error1) {
          return ctx.json([[null, result0], [serializeError(error1)]])
        }

        return ctx.json([
          [null, result0],
          [null, result1],
        ])
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

// prettier-ignore
const INDEX_HTML =
`<!doctype html>
<html lang="en" style="height: 100%">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.17"></script>
    <link rel="stylesheet" href="/ui/index.css">
    <style>
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
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.2.0",
          "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
          "react-dom": "https://esm.sh/react-dom@19.2.0",
          "react-dom/client": "https://esm.sh/react-dom@19.2.0/client"
        }
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      'use strict';
      import React from 'react';
      import ReactDOMClient from 'react-dom/client';

      import { ${ADAPTER_FACTORY_FUNCTION_NAME} } from '/${ADAPTER_FILE_NAME}';
      import { createStudioBFFClient } from '/data/bff/index.js';
      import { Studio } from '/ui/index.js';

      const adapter = ${ADAPTER_FACTORY_FUNCTION_NAME}({
        executor: createStudioBFFClient({ url: '/bff' }),
      });

      const onEvent = (event) => {
        fetch('/telemetry', {
          body: JSON.stringify(event),
          method: 'POST',
        });
      };

      window.__PVCE__ = true;

      const container = document.getElementById('root');
      const root = ReactDOMClient.createRoot(container);

      root.render(React.createElement(Studio, { adapter, onEvent }));
    </script>
  </body>
</html>`
