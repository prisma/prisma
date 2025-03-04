import path from 'node:path'

const consoleMock = jest.spyOn(global.console, 'warn').mockImplementation()

afterEach(() => {
  consoleMock.mockClear()
})

test('bundled prisma client will re-use the schema.prisma via cwd', async () => {
  // emulate https://github.com/prisma/prisma/issues/19819#issuecomment-1597138099
  process.chdir(path.join(__dirname, '..', 'dist'))

  const { somePrismaCall } = require(path.join(__dirname, '..', 'dist', 'index.js'))

  const user = await somePrismaCall()

  expect(user).not.toBeNull()
  expect(user).not.toBeUndefined()
})
