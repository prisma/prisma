import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { printMessageAndExitIfUnsupportedNodeVersion } from '../../scripts/preinstall'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('should exit 1 and print a message when Node.js minor version is lower than minimum - 18.0', () => {
  const mockExit = jest.spyOn(process, 'exit').mockImplementation()

  printMessageAndExitIfUnsupportedNodeVersion('18.0.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    "┌──────────────────────────────────────────────┐
    │    Prisma only supports Node.js >= 18.18.    │
    │    Please upgrade your Node.js version.      │
    └──────────────────────────────────────────────┘"
  `)

  expect(mockExit).toHaveBeenCalledWith(1)
  mockExit.mockRestore()
})

it('should exit 1 and print a message when Node.js major version is lower than minimum - 16.18', () => {
  const mockExit = jest.spyOn(process, 'exit').mockImplementation()

  printMessageAndExitIfUnsupportedNodeVersion('16.18.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    "┌──────────────────────────────────────────────┐
    │    Prisma only supports Node.js >= 18.18.    │
    │    Please upgrade your Node.js version.      │
    └──────────────────────────────────────────────┘"
  `)

  expect(mockExit).toHaveBeenCalledWith(1)
  mockExit.mockRestore()
})

it('should do nothing when Node.js version is supported - 18.18', () => {
  printMessageAndExitIfUnsupportedNodeVersion('18.18.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
})

it('should do nothing when Node.js version is supported - current', () => {
  printMessageAndExitIfUnsupportedNodeVersion(process.versions.node as `${number}.${number}.${number}`)

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
})

it('should do nothing when Node.js version is supported - 20.0', () => {
  printMessageAndExitIfUnsupportedNodeVersion('20.0.0')

  expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
})
