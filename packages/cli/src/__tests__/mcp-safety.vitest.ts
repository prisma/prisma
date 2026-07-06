import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, expect, test } from 'vitest'

const cliPath = path.resolve(__dirname, '..', '..', 'build', 'index.js')
const configDistPath = path.resolve(__dirname, '..', '..', '..', 'config', 'dist', 'index.js')

if (!fs.existsSync(cliPath)) {
  throw new Error(
    `The MCP safety tests drive the built CLI over stdio, but ${cliPath} does not exist. ` +
      'Build the CLI first, e.g. `pnpm exec turbo build --filter=prisma` from the repository root.',
  )
}

if (!fs.existsSync(configDistPath)) {
  throw new Error(
    `The MCP safety tests load a scratch prisma.config.ts through a @prisma/config symlink, but ${configDistPath} ` +
      'does not exist. Build the workspace first, e.g. `pnpm exec turbo build --filter=prisma` from the repository root.',
  )
}

const testTimeout = 60_000

const tmpDirs: string[] = []

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-safety-test-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      // Retries cover Windows, where the server child's file handles can
      // still be released asynchronously after the process exits.
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    } catch (error) {
      // A leaked CI temp dir is not worth failing the safety pin over.
      console.warn(`mcp-safety: failed to remove temp dir ${dir}: ${error}`)
    }
  }
})

/**
 * Creates a minimal sqlite project that `migrate reset --force` can run
 * against without any database server. `@prisma/config` is symlinked into the
 * project so that its `prisma.config.ts` can be loaded from the scratch
 * directory.
 */
function createScratchProject(): string {
  const dir = makeTmpDir()

  fs.mkdirSync(path.join(dir, 'prisma'))
  fs.writeFileSync(
    path.join(dir, 'prisma', 'schema.prisma'),
    `datasource db {
  provider = "sqlite"
}

model User {
  id   Int    @id @default(autoincrement())
  name String
}
`,
  )

  fs.writeFileSync(
    path.join(dir, 'prisma.config.ts'),
    `import { defineConfig } from '@prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: 'file:dev.db',
  },
})
`,
  )

  fs.mkdirSync(path.join(dir, 'node_modules', '@prisma'), { recursive: true })
  // 'junction' avoids requiring elevated privileges on Windows; the type
  // argument is ignored on other platforms.
  fs.symlinkSync(
    path.resolve(__dirname, '..', '..', '..', 'config'),
    path.join(dir, 'node_modules', '@prisma', 'config'),
    'junction',
  )

  return dir
}

/**
 * Environment for the spawned MCP server (inherited by the `migrate reset`
 * child it spawns in turn). Built from an allowlist because the test process
 * itself may run under an AI agent: inheriting the full environment would
 * leak agent markers — or a user consent variable — into the server and trip
 * or bypass the safety checkpoint regardless of what a test case intends.
 */
function curatedEnv(extra: Record<string, string> = {}): Record<string, string> {
  const allowlist = ['HOME', 'PATH', 'SYSTEMROOT', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'TEMP', 'TMP']
  const env: Record<string, string> = {
    TERM: 'dumb',
    // keeps the child CLI from printing the version-update box (and from
    // calling out to the network for it) in the middle of tool output
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  }
  for (const name of allowlist) {
    const value = process.env[name]
    if (value !== undefined) {
      env[name] = value
    }
  }
  return { ...env, ...extra }
}

/** Calls the real `prisma mcp` server's migrate-reset tool over stdio and returns the tool result text. */
async function callMigrateReset(projectCWD: string, env: Record<string, string>): Promise<string> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, 'mcp'],
    env,
    cwd: makeTmpDir(),
  })
  const client = new Client({ name: 'mcp-safety-test', version: '0.0.0' })

  // connect() is inside the try so a connection failure still closes the
  // client and does not leak the spawned server process.
  let transportClosed: Promise<void> | undefined
  try {
    await client.connect(transport)
    // The transport's close() resolves before the spawned server process has
    // actually exited, which leaves temp-dir file handles locked on Windows.
    // The transport's onclose fires on the child's real exit; chain the
    // client's own handler (installed during connect) and await the event.
    transportClosed = new Promise<void>((resolve) => {
      const clientOnClose = transport.onclose
      transport.onclose = () => {
        clientOnClose?.call(transport)
        resolve()
      }
    })
    const result = await client.callTool({ name: 'migrate-reset', arguments: { projectCWD } })
    const content = result.content as { type: string; text?: string }[]
    return content.map((item) => item.text ?? '').join('\n')
  } finally {
    await client.close()
    if (transportClosed) {
      const closeGracePeriod = new Promise<void>((resolve) => setTimeout(resolve, 5_000).unref())
      await Promise.race([transportClosed, closeGracePeriod])
    }
  }
}

test(
  'migrate-reset is blocked with consent instructions when the server is launched by an AI agent',
  async () => {
    const project = createScratchProject()

    const text = await callMigrateReset(project, curatedEnv({ CLAUDECODE: '1' }))

    expect(text).toContain('PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION')
    expect(text).toContain('must stop at this point and respond to the user')
    expect(text).not.toContain('Database reset successful')
  },
  testTimeout,
)

test(
  'migrate-reset proceeds without consent instructions when no agent marker is present',
  async () => {
    const project = createScratchProject()

    const text = await callMigrateReset(project, curatedEnv())

    expect(text).not.toContain('PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION')
    expect(text).toContain('Database reset successful')
  },
  testTimeout,
)

test(
  'the user consent environment variable unblocks migrate-reset for an AI agent',
  async () => {
    const project = createScratchProject()

    const text = await callMigrateReset(
      project,
      curatedEnv({
        CLAUDECODE: '1',
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes, please reset my development database',
      }),
    )

    expect(text).not.toContain('must stop at this point')
    expect(text).toContain('Database reset successful')
  },
  testTimeout,
)
