import { $ } from 'zx'

const consoleMock = jest.spyOn(global.console, 'warn').mockImplementation()

afterEach(() => {
  consoleMock.mockClear()
})

test('importing the the bundled prisma client produces warning messages', () => {
  require('../dist/index.js')

  expect(consoleMock.mock.calls[0]).toMatchInlineSnapshot(`
[
  "prisma:warn Your generated Prisma Client could not immediately find its \`schema.prisma\`, falling back to finding it via the current working directory.",
]
`)
  expect(consoleMock.mock.calls[1]).toMatchInlineSnapshot(`
[
  "prisma:warn We are interested in learning about your project setup. We'd appreciate if you could take the time to share some information with us.",
]
`)
  expect(consoleMock.mock.calls[2]).toMatchInlineSnapshot(`
[
  "prisma:warn Please help us by answering a few questions: https://pris.ly/bundler-investigation",
]
`)
})

test('bundled prisma client will re-use the schema.prisma via cwd', async () => {
  const { somePrismaCall } = require('../dist/index.js')

  const user = await somePrismaCall()

  expect(user).not.toBeNull()
  expect(user).not.toBeUndefined()
})

// ! this test must be run last because it deletes the generated client
test('bundled prisma client will fail if generated client is gone', async () => {
  await $`rm -rf generated`

  const { somePrismaCall } = require('../dist/index.js')

  await expect(somePrismaCall()).rejects.toThrowErrorMatchingInlineSnapshot(`
"Prisma Client could not find its \`schema.prisma\`. This is likely caused by a bundling step, which leads to \`schema.prisma\` not being copied near the resulting bundle. We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/bundler-investigation-error"
`)
})

export {}
