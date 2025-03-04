import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'node:path'
import stripAnsi from 'strip-ansi'

import { DebugInfo } from '../../DebugInfo'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const originalEnv = { ...process.env }

function cleanSnapshot(str: string): string {
  const redactedStr = str.replace(/(Path: ).*/g, '$1REDACTED_PATH')
  return redactedStr
}

const envVars = {
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  DEBUG: 'something',
  NODE_ENV: 'test',
  RUST_LOG: 'trace',
  RUST_BACKTRACE: 'full',
  NO_COLOR: 'true',
  TERM: 'dumb',
  NODE_TLS_REJECT_UNAUTHORIZED: 'true',
  NO_PROXY: '*',
  http_proxy: 'http://http_proxy.localhost',
  HTTP_PROXY: 'http://HTTP_PROXY.localhost',
  https_proxy: 'https://https_proxy.localhost',
  HTTPS_PROXY: 'https://HTTPS_PROXY.localhost',
  PRISMA_DISABLE_WARNINGS: 'true',
  PRISMA_HIDE_PREVIEW_FLAG_WARNINGS: 'true',
  PRISMA_HIDE_UPDATE_MESSAGE: 'true',
  PRISMA_ENGINES_MIRROR: 'http://localhost',
  PRISMA_BINARIES_MIRROR: 'http://localhost',
  PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: 'true',
  BINARY_DOWNLOAD_VERSION: 'true',
  PRISMA_CLI_QUERY_ENGINE_TYPE: 'library',
  PRISMA_CLIENT_ENGINE_TYPE: 'library',
  PRISMA_QUERY_ENGINE_BINARY: 'some/path',
  PRISMA_QUERY_ENGINE_LIBRARY: 'some/path',
  PRISMA_SCHEMA_ENGINE_BINARY: 'some/path',
  PRISMA_MIGRATION_ENGINE_BINARY: 'true',
  PRISMA_GENERATE_SKIP_AUTOINSTALL: 'true',
  PRISMA_SKIP_POSTINSTALL_GENERATE: 'true',
  PRISMA_GENERATE_IN_POSTINSTALL: 'true',
  PRISMA_GENERATE_DATAPROXY: 'true',
  PRISMA_GENERATE_NO_ENGINE: 'true',
  PRISMA_SHOW_ALL_TRACES: 'true',
  PRISMA_CLIENT_NO_RETRY: 'true',
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: 'true',
  PRISMA_MIGRATE_SKIP_GENERATE: 'true',
  PRISMA_MIGRATE_SKIP_SEED: 'true',
  BROWSER: 'something',
}

describe('debug', () => {
  // make sure the env is empty before each test
  beforeEach(() => {
    process.env = {}
  })
  // clean up env vars after each individual test
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should succeed when env vars are NOT set (undefined)', async () => {
    ctx.fixture('example-project/prisma')

    // Make sure all env vars are undefined
    Object.keys(envVars).map((key) => delete process.env[key])

    // To make sure the terminal is always detected
    // as non interactive, locally and in CI
    process.env.TERM = 'dumb'

    const result = await DebugInfo.new().parse([], defaultTestConfig())

    expect(cleanSnapshot(result as string)).toMatchInlineSnapshot(`
      "-- Prisma schema --
      Path: REDACTED_PATH

      -- Local cache directory for engines files --
      Path: REDACTED_PATH

      -- Environment variables --
      When not set, the line is dimmed and no value is displayed.
      When set, the line is bold and the value is inside the \`\` backticks.

      For general debugging
      - CI:
      - DEBUG:
      - NODE_ENV:
      - RUST_LOG:
      - RUST_BACKTRACE:
      - NO_COLOR:
      - TERM: \`dumb\`
      - NODE_TLS_REJECT_UNAUTHORIZED:
      - NO_PROXY:
      - http_proxy:
      - HTTP_PROXY:
      - https_proxy:
      - HTTPS_PROXY:

      For more information about Prisma environment variables:
      See https://www.prisma.io/docs/reference/api-reference/environment-variables-reference

      For hiding messages
      - PRISMA_DISABLE_WARNINGS:
      - PRISMA_HIDE_PREVIEW_FLAG_WARNINGS:
      - PRISMA_HIDE_UPDATE_MESSAGE:

      For downloading engines
      - PRISMA_ENGINES_MIRROR:
      - PRISMA_BINARIES_MIRROR (deprecated):
      - PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING:
      - BINARY_DOWNLOAD_VERSION:

      For configuring the Query Engine Type
      - PRISMA_CLI_QUERY_ENGINE_TYPE:
      - PRISMA_CLIENT_ENGINE_TYPE:

      For custom engines
      - PRISMA_QUERY_ENGINE_BINARY:
      - PRISMA_QUERY_ENGINE_LIBRARY:
      - PRISMA_SCHEMA_ENGINE_BINARY:
      - PRISMA_MIGRATION_ENGINE_BINARY:

      For the "postinstall" npm hook
      - PRISMA_GENERATE_SKIP_AUTOINSTALL:
      - PRISMA_SKIP_POSTINSTALL_GENERATE:
      - PRISMA_GENERATE_IN_POSTINSTALL:

      For "prisma generate"
      - PRISMA_GENERATE_DATAPROXY:
      - PRISMA_GENERATE_NO_ENGINE:

      For Prisma Client
      - PRISMA_SHOW_ALL_TRACES:
      - PRISMA_CLIENT_NO_RETRY (Binary engine only):

      For Prisma Migrate
      - PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK:
      - PRISMA_MIGRATE_SKIP_GENERATE:
      - PRISMA_MIGRATE_SKIP_SEED:

      For Prisma Studio
      - BROWSER:

      -- Terminal is interactive? --
      false

      -- CI detected? --
      false
      "
    `)
  })

  it('should succeed when env vars are set to empty', async () => {
    ctx.fixture('example-project/prisma')

    // Make sure all env vars are set to ''
    const envVarsSetToEmptyString = Object.fromEntries(Object.keys(envVars).map((key) => [key, '']))
    Object.assign(process.env, envVarsSetToEmptyString)
    // To make sure the terminal is always detected
    // as non interactive, locally and in CI
    process.env.TERM = 'dumb'

    const result = await DebugInfo.new().parse([], defaultTestConfig())

    expect(cleanSnapshot(result as string)).toMatchInlineSnapshot(`
      "-- Prisma schema --
      Path: REDACTED_PATH

      -- Local cache directory for engines files --
      Path: REDACTED_PATH

      -- Environment variables --
      When not set, the line is dimmed and no value is displayed.
      When set, the line is bold and the value is inside the \`\` backticks.

      For general debugging
      - CI: \`\`
      - DEBUG: \`\`
      - NODE_ENV: \`\`
      - RUST_LOG: \`\`
      - RUST_BACKTRACE: \`\`
      - NO_COLOR: \`\`
      - TERM: \`dumb\`
      - NODE_TLS_REJECT_UNAUTHORIZED: \`\`
      - NO_PROXY: \`\`
      - http_proxy: \`\`
      - HTTP_PROXY: \`\`
      - https_proxy: \`\`
      - HTTPS_PROXY: \`\`

      For more information about Prisma environment variables:
      See https://www.prisma.io/docs/reference/api-reference/environment-variables-reference

      For hiding messages
      - PRISMA_DISABLE_WARNINGS: \`\`
      - PRISMA_HIDE_PREVIEW_FLAG_WARNINGS: \`\`
      - PRISMA_HIDE_UPDATE_MESSAGE: \`\`

      For downloading engines
      - PRISMA_ENGINES_MIRROR: \`\`
      - PRISMA_BINARIES_MIRROR (deprecated): \`\`
      - PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: \`\`
      - BINARY_DOWNLOAD_VERSION: \`\`

      For configuring the Query Engine Type
      - PRISMA_CLI_QUERY_ENGINE_TYPE: \`\`
      - PRISMA_CLIENT_ENGINE_TYPE: \`\`

      For custom engines
      - PRISMA_QUERY_ENGINE_BINARY: \`\`
      - PRISMA_QUERY_ENGINE_LIBRARY: \`\`
      - PRISMA_SCHEMA_ENGINE_BINARY: \`\`
      - PRISMA_MIGRATION_ENGINE_BINARY: \`\`

      For the "postinstall" npm hook
      - PRISMA_GENERATE_SKIP_AUTOINSTALL: \`\`
      - PRISMA_SKIP_POSTINSTALL_GENERATE: \`\`
      - PRISMA_GENERATE_IN_POSTINSTALL: \`\`

      For "prisma generate"
      - PRISMA_GENERATE_DATAPROXY: \`\`
      - PRISMA_GENERATE_NO_ENGINE: \`\`

      For Prisma Client
      - PRISMA_SHOW_ALL_TRACES: \`\`
      - PRISMA_CLIENT_NO_RETRY (Binary engine only): \`\`

      For Prisma Migrate
      - PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: \`\`
      - PRISMA_MIGRATE_SKIP_GENERATE: \`\`
      - PRISMA_MIGRATE_SKIP_SEED: \`\`

      For Prisma Studio
      - BROWSER: \`\`

      -- Terminal is interactive? --
      false

      -- CI detected? --
      false
      "
    `)
  })

  it('should succeed when env vars are set', async () => {
    ctx.fixture('example-project/prisma')

    Object.assign(process.env, envVars)

    const result = await DebugInfo.new().parse([], defaultTestConfig())

    expect(cleanSnapshot(result as string)).toMatchInlineSnapshot(`
      "-- Prisma schema --
      Path: REDACTED_PATH

      -- Local cache directory for engines files --
      Path: REDACTED_PATH

      -- Environment variables --
      When not set, the line is dimmed and no value is displayed.
      When set, the line is bold and the value is inside the \`\` backticks.

      For general debugging
      - CI: \`true\`
      - DEBUG: \`something\`
      - NODE_ENV: \`test\`
      - RUST_LOG: \`trace\`
      - RUST_BACKTRACE: \`full\`
      - NO_COLOR: \`true\`
      - TERM: \`dumb\`
      - NODE_TLS_REJECT_UNAUTHORIZED: \`true\`
      - NO_PROXY: \`*\`
      - http_proxy: \`http://http_proxy.localhost\`
      - HTTP_PROXY: \`http://HTTP_PROXY.localhost\`
      - https_proxy: \`https://https_proxy.localhost\`
      - HTTPS_PROXY: \`https://HTTPS_PROXY.localhost\`

      For more information about Prisma environment variables:
      See https://www.prisma.io/docs/reference/api-reference/environment-variables-reference

      For hiding messages
      - PRISMA_DISABLE_WARNINGS: \`true\`
      - PRISMA_HIDE_PREVIEW_FLAG_WARNINGS: \`true\`
      - PRISMA_HIDE_UPDATE_MESSAGE: \`true\`

      For downloading engines
      - PRISMA_ENGINES_MIRROR: \`http://localhost\`
      - PRISMA_BINARIES_MIRROR (deprecated): \`http://localhost\`
      - PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: \`true\`
      - BINARY_DOWNLOAD_VERSION: \`true\`

      For configuring the Query Engine Type
      - PRISMA_CLI_QUERY_ENGINE_TYPE: \`library\`
      - PRISMA_CLIENT_ENGINE_TYPE: \`library\`

      For custom engines
      - PRISMA_QUERY_ENGINE_BINARY: \`some/path\`
      - PRISMA_QUERY_ENGINE_LIBRARY: \`some/path\`
      - PRISMA_SCHEMA_ENGINE_BINARY: \`some/path\`
      - PRISMA_MIGRATION_ENGINE_BINARY: \`true\`

      For the "postinstall" npm hook
      - PRISMA_GENERATE_SKIP_AUTOINSTALL: \`true\`
      - PRISMA_SKIP_POSTINSTALL_GENERATE: \`true\`
      - PRISMA_GENERATE_IN_POSTINSTALL: \`true\`

      For "prisma generate"
      - PRISMA_GENERATE_DATAPROXY: \`true\`
      - PRISMA_GENERATE_NO_ENGINE: \`true\`

      For Prisma Client
      - PRISMA_SHOW_ALL_TRACES: \`true\`
      - PRISMA_CLIENT_NO_RETRY (Binary engine only): \`true\`

      For Prisma Migrate
      - PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: \`true\`
      - PRISMA_MIGRATE_SKIP_GENERATE: \`true\`
      - PRISMA_MIGRATE_SKIP_SEED: \`true\`

      For Prisma Studio
      - BROWSER: \`something\`

      -- Terminal is interactive? --
      false

      -- CI detected? --
      true
      "
    `)
  })

  it('should read the .env file if it exists', async () => {
    ctx.fixture('dotenv-debug-cmd')

    // To make sure the terminal is always detected
    // as non interactive, locally and in CI
    process.env.TERM = 'dumb'

    const result = await DebugInfo.new().parse([], defaultTestConfig())

    expect(result).not.toContain('this_is_private')
    expect(result).toContain('from_env_file')

    expect(cleanSnapshot(result as string)).toMatchInlineSnapshot(`
      "-- Prisma schema --
      Path: REDACTED_PATH

      -- Local cache directory for engines files --
      Path: REDACTED_PATH

      -- Environment variables --
      When not set, the line is dimmed and no value is displayed.
      When set, the line is bold and the value is inside the \`\` backticks.

      For general debugging
      - CI: \`from_env_file\`
      - DEBUG: \`from_env_file\`
      - NODE_ENV: \`from_env_file\`
      - RUST_LOG: \`from_env_file\`
      - RUST_BACKTRACE: \`from_env_file\`
      - NO_COLOR: \`from_env_file\`
      - TERM: \`dumb\`
      - NODE_TLS_REJECT_UNAUTHORIZED: \`from_env_file\`
      - NO_PROXY: \`from_env_file\`
      - http_proxy: \`from_env_file\`
      - HTTP_PROXY: \`from_env_file\`
      - https_proxy: \`from_env_file\`
      - HTTPS_PROXY: \`from_env_file\`

      For more information about Prisma environment variables:
      See https://www.prisma.io/docs/reference/api-reference/environment-variables-reference

      For hiding messages
      - PRISMA_DISABLE_WARNINGS: \`from_env_file\`
      - PRISMA_HIDE_PREVIEW_FLAG_WARNINGS: \`from_env_file\`
      - PRISMA_HIDE_UPDATE_MESSAGE: \`from_env_file\`

      For downloading engines
      - PRISMA_ENGINES_MIRROR: \`from_env_file\`
      - PRISMA_BINARIES_MIRROR (deprecated): \`from_env_file\`
      - PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: \`from_env_file\`
      - BINARY_DOWNLOAD_VERSION: \`from_env_file\`

      For configuring the Query Engine Type
      - PRISMA_CLI_QUERY_ENGINE_TYPE: \`from_env_file\`
      - PRISMA_CLIENT_ENGINE_TYPE: \`from_env_file\`

      For custom engines
      - PRISMA_QUERY_ENGINE_BINARY: \`from_env_file\`
      - PRISMA_QUERY_ENGINE_LIBRARY: \`from_env_file\`
      - PRISMA_SCHEMA_ENGINE_BINARY: \`from_env_file\`
      - PRISMA_MIGRATION_ENGINE_BINARY: \`from_env_file\`

      For the "postinstall" npm hook
      - PRISMA_GENERATE_SKIP_AUTOINSTALL: \`from_env_file\`
      - PRISMA_SKIP_POSTINSTALL_GENERATE: \`from_env_file\`
      - PRISMA_GENERATE_IN_POSTINSTALL: \`from_env_file\`

      For "prisma generate"
      - PRISMA_GENERATE_DATAPROXY: \`from_env_file\`
      - PRISMA_GENERATE_NO_ENGINE: \`from_env_file\`

      For Prisma Client
      - PRISMA_SHOW_ALL_TRACES: \`from_env_file\`
      - PRISMA_CLIENT_NO_RETRY (Binary engine only): \`from_env_file\`

      For Prisma Migrate
      - PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: \`from_env_file\`
      - PRISMA_MIGRATE_SKIP_GENERATE: \`from_env_file\`
      - PRISMA_MIGRATE_SKIP_SEED: \`from_env_file\`

      For Prisma Studio
      - BROWSER: \`from_env_file\`

      -- Terminal is interactive? --
      false

      -- CI detected? --
      true
      "
    `)
  })

  it('should succeed with --schema', async () => {
    ctx.fixture('example-project/prisma')
    const result = stripAnsi((await DebugInfo.new().parse(['--schema=schema.prisma'], defaultTestConfig())) as string)

    expect(result).toContain(`Path: ${path.join(process.cwd(), 'schema.prisma')}`)
  })

  it('should succeed with incorrect --schema path', async () => {
    await expect(DebugInfo.new().parse(['--schema=does-not-exists.prisma'], defaultTestConfig())).resolves.toContain(
      'Could not load `--schema` from provided path `does-not-exists.prisma`: file or directory not found',
    )
  })
})
