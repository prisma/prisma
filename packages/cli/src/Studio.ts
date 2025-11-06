import { readFile } from 'node:fs/promises'

import { serve } from '@hono/node-server'
import type { PrismaConfigInternal } from '@prisma/config'
import type { ConnectorType } from '@prisma/generator'
import { arg, type Command, format, HelpError, isError } from '@prisma/internals'
import type { Executor, Query } from '@prisma/studio-core-licensed/data'
import { serializeError } from '@prisma/studio-core-licensed/data/bff'
import { createPostgresJSExecutor } from '@prisma/studio-core-licensed/data/postgresjs'
import { getPort } from 'get-port-please'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { bold, dim, red } from 'kleur/colors'
import open from 'open'
import { extname, join } from 'pathe'

/**
 * `prisma dev`'s `51_213 - 1`
 */
const DEFAULT_PORT = 51_212

const MIN_PORT = 49_152

const STATIC_ASSETS_DIR = join(require.resolve('@prisma/studio-core-licensed/data'), '../..')

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

interface StudioStuff {
  createExecutor(connectionString: string): Promise<Executor>
  reExportAdapterScript: string
}

const POSTGRES_STUDIO_STUFF: StudioStuff = {
  async createExecutor(connectionString: string) {
    const postgres = await import('postgres').then((mod) => mod.default(connectionString))

    process.once('SIGINT', () => postgres.end())
    process.once('SIGTERM', () => postgres.end())

    return createPostgresJSExecutor(postgres)
  },
  reExportAdapterScript: `export { createPostgresAdapter as ${ADAPTER_FACTORY_FUNCTION_NAME} } from '/data/postgres-core/index.js';`,
}

const PRISMA_PROVIDER_TO_STUDIO_STUFF: Record<ConnectorType, StudioStuff | null> = {
  cockroachdb: POSTGRES_STUDIO_STUFF,
  postgres: POSTGRES_STUDIO_STUFF,
  postgresql: POSTGRES_STUDIO_STUFF,
  'prisma+postgres': POSTGRES_STUDIO_STUFF,
  mongodb: null,
  mysql: null,
  sqlite: null,
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

    const connectionString = args['--url'] || (config as { datasource?: { url?: string } }).datasource?.url

    if (!connectionString) {
      return new Error('No URL found.')
    }

    const provider = new URL(connectionString).protocol.replace(':', '')

    const studioStuff = PRISMA_PROVIDER_TO_STUDIO_STUFF[provider]

    if (!studioStuff) {
      return new Error(`Prisma Studio is not supported for the "${provider}" provider.`)
    }

    const executor = await studioStuff.createExecutor(connectionString)

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
      const { query } = (await ctx.req.json()) as { query: Query }

      const [error, results] = await executor.execute(query)

      if (error) {
        return ctx.json([serializeError(error)])
      }

      return ctx.json([null, results])
    })

    app.post('/telemetry', (ctx) => {
      // TODO: ...
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
        // noParameters: true,
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
