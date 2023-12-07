import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { printMessageAndExitIfUnsupportedNodeVersion } from '../../scripts/preinstall'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should exit 1 and print a message when Node.js version is lower than minimum - 16.0', () => {
  const mockExit = jest.spyOn(process, 'exit').mockImplementation()

  printMessageAndExitIfUnsupportedNodeVersion('v16.0.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    ┌──────────────────────────────────────────────┐
    │    Prisma only supports Node.js >= 16.13.    │
    │    Please upgrade your Node.js version.      │
    └──────────────────────────────────────────────┘
  `)

  expect(mockExit).toHaveBeenCalledWith(1)
  mockExit.mockRestore()
})

it('should exit 1 and print a message when Node.js version is lower than minimum - 14.13', () => {
  const mockExit = jest.spyOn(process, 'exit').mockImplementation()

  printMessageAndExitIfUnsupportedNodeVersion('v14.13.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    ┌──────────────────────────────────────────────┐
    │    Prisma only supports Node.js >= 16.13.    │
    │    Please upgrade your Node.js version.      │
    └──────────────────────────────────────────────┘
  `)

  expect(mockExit).toHaveBeenCalledWith(1)
  mockExit.mockRestore()
})

it('should do nothing when Node.js version is supported - 16.13', () => {
  printMessageAndExitIfUnsupportedNodeVersion('v16.13.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
})

it('should do nothing when Node.js version is supported - current', () => {
  printMessageAndExitIfUnsupportedNodeVersion(process.version)

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
})

it('should do nothing when Node.js version is supported - 20.0', () => {
  printMessageAndExitIfUnsupportedNodeVersion('v20.0.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
})
