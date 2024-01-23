import fs from 'fs'
import path from 'path'
import { $ } from 'zx'

const WARNING_GENERATE = 'Make it a dependency of your project'
const WARNING_IMPORT = 'Once you know where your client is located, add your own client as a dependency.'

const src = path.resolve(__dirname, '../src')

const listFiles = (subPath: string) =>
  fs
    .readdirSync(path.join(src, subPath))
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(subPath, name))

test('custom output: shows warning on generate', async () => {
  const { stdout } = await $`pnpm prisma generate --schema prisma/schema-custom.prisma`

  expect(stdout).toContain(WARNING_GENERATE)
})

for (const filePath of listFiles('warning')) {
  test(`${filePath}: produces warning`, async () => {
    const absPath = path.join(src, filePath)
    const { stderr } = await $`node ${absPath}`
    expect(stderr).toContain(WARNING_IMPORT)
  })
}

test('default output: does not show warning on generate', async () => {
  const { stdout } = await $`pnpm prisma generate --schema prisma/schema-default.prisma`

  expect(stdout).not.toContain(WARNING_GENERATE)
})

for (const filePath of listFiles('no-warning')) {
  test(`${filePath}: does not produce warning`, async () => {
    const absPath = path.join(src, filePath)
    const { stderr } = await $`node ${absPath}`
    expect(stderr).not.toContain(WARNING_IMPORT)
  })
}
