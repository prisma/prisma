import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterEach, expect, test } from 'vitest'

const cliPath = path.resolve(__dirname, '..', '..', 'build', 'index.js')

if (!fs.existsSync(cliPath)) {
  throw new Error(
    `The MCP tools test drives the built CLI over stdio, but ${cliPath} does not exist. ` +
      'Build the CLI first, e.g. `pnpm exec turbo build --filter=prisma` from the repository root.',
  )
}

const tmpDirs: string[] = []

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    // Retries cover Windows, where the server child's file handles can
    // still be released asynchronously after the process exits.
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
})

test('the MCP server does not expose a migrate-reset tool', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tools-test-'))
  tmpDirs.push(cwd)

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, 'mcp'],
    env: {
      ...getDefaultEnvironment(),
      // keeps the child CLI from printing the version-update box (and from
      // calling out to the network for it)
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
    cwd,
  })
  const client = new Client({ name: 'mcp-tools-test', version: '0.0.0' })

  try {
    await client.connect(transport)
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name).sort()

    // `migrate reset` drops the database, and the MCP server is only ever
    // driven by AI agents, so no tool exposes it. An agent that needs a
    // reset must run the CLI, where the AI safety checkpoint in
    // @prisma/migrate requires explicit user consent.
    expect(names).not.toContain('migrate-reset')
    expect(names).toEqual(['Prisma-Studio', 'migrate-dev', 'migrate-status'])
  } finally {
    await client.close()
  }
}, 60_000)
