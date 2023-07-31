import path from 'path'

const consoleMock = jest.spyOn(global.console, 'warn').mockImplementation()

afterEach(() => {
  consoleMock.mockClear()
})

test('bundled prisma client will re-use the schema.prisma via cwd', async () => {
  process.chdir(path.join(__dirname, '..', 'dist'))

  // console.log('cd', process.cwd())

  const { somePrismaCall } = require(path.join(__dirname, '..', 'dist', 'index.js'))

  const user = await somePrismaCall()

  expect(user).not.toBeNull()
  expect(user).not.toBeUndefined()
})

export {}
