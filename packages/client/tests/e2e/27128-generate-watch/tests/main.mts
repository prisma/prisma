import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import timers from 'node:timers/promises'

const generate = spawn('pnpm', ['prisma', 'generate', '--watch'], {
  stdio: ['pipe', 'pipe', 'inherit'],
})

const generateEvents = (async function* () {
  for await (const chunk of generate.stdout) {
    console.log(chunk.toString())
    if (chunk.toString().includes('Generated')) {
      yield
    }
  }
})()

await generateEvents.next()

const modelsPath = new URL('../generated/models', import.meta.url)
assert.deepEqual(await fs.readdir(modelsPath), ['A.ts'])

const schemaPath = new URL('../prisma/schema.prisma', import.meta.url)

await fs.appendFile(
  schemaPath,
  `
  model B {
    id String @id
  }
`,
)

await generateEvents.next()

// TODO: `fs.readdir` returns just `['A.ts']` if we don't wait a little bit
// after the "Generated Prisma Client" log line — why?
await timers.setTimeout(1000)

assert.deepEqual(await fs.readdir(modelsPath), ['A.ts', 'B.ts'])

generate.kill()

// Consume the stream till the end so we don't get EPIPE if the process tries to write something
// in response to SIGINT.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
for await (const _ of generateEvents) {
}
