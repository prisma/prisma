import { defaultTestConfig } from '@prisma/config'
import type { Command } from '@prisma/internals'

import { CLI } from '../CLI'
import { runCheckpointClientCheck } from '../utils/checkpoint'
import type { CliDistributionIdentity } from '../utils/cli-distribution-identity'
import { printUpdateMessage } from '../utils/printUpdateMessage'

jest.mock('../utils/checkpoint', () => ({
  runCheckpointClientCheck: jest.fn(),
}))

jest.mock('../utils/printUpdateMessage', () => ({
  printUpdateMessage: jest.fn(),
}))

const runCheckpointClientCheckMock = jest.mocked(runCheckpointClientCheck)
const printUpdateMessageMock = jest.mocked(printUpdateMessage)

function createCli(identity: CliDistributionIdentity, parse = jest.fn(() => Promise.resolve('done'))) {
  const command = { parse } as Command

  return {
    cli: CLI.new(
      {
        validate: command,
      },
      [],
      jest.fn(),
      identity,
    ),
    parse,
  }
}

describe('distribution identity update check', () => {
  const previousPrismaHideUpdateMessage = process.env.PRISMA_HIDE_UPDATE_MESSAGE

  beforeEach(() => {
    delete process.env.PRISMA_HIDE_UPDATE_MESSAGE
    runCheckpointClientCheckMock.mockReset()
    printUpdateMessageMock.mockReset()
  })

  afterAll(() => {
    process.env.PRISMA_HIDE_UPDATE_MESSAGE = previousPrismaHideUpdateMessage
  })

  it('prisma7 does not start the checkpoint request or print updates', async () => {
    runCheckpointClientCheckMock.mockResolvedValue({ status: 'ok', data: { outdated: true } } as never)
    const { cli, parse } = createCli('prisma7')

    await expect(cli.parse(['validate'], defaultTestConfig(), '/tmp/project')).resolves.toBe('done')

    expect(parse).toHaveBeenCalledWith([], defaultTestConfig(), '/tmp/project')
    expect(runCheckpointClientCheckMock).not.toHaveBeenCalled()
    expect(printUpdateMessageMock).not.toHaveBeenCalled()
  })

  it('prisma starts the checkpoint request once and prints the resolved result', async () => {
    const checkResult = { status: 'ok', data: { outdated: false } } as never
    runCheckpointClientCheckMock.mockResolvedValue(checkResult)
    const { cli, parse } = createCli('prisma')

    await expect(cli.parse(['validate'], defaultTestConfig(), '/tmp/project')).resolves.toBe('done')

    expect(parse).toHaveBeenCalledWith([], defaultTestConfig(), '/tmp/project')
    expect(runCheckpointClientCheckMock).toHaveBeenCalledTimes(1)
    expect(runCheckpointClientCheckMock).toHaveBeenCalledWith({
      schemaPathFromConfig: undefined,
      baseDir: '/tmp/project',
    })
    expect(printUpdateMessageMock).toHaveBeenCalledTimes(1)
    expect(printUpdateMessageMock).toHaveBeenCalledWith(checkResult)
  })

  it('prisma still runs the ordinary update path when PRISMA_HIDE_UPDATE_MESSAGE is set', async () => {
    process.env.PRISMA_HIDE_UPDATE_MESSAGE = 'true'
    const checkResult = { status: 'ok', data: { outdated: true } } as never
    runCheckpointClientCheckMock.mockResolvedValue(checkResult)
    const { cli } = createCli('prisma')

    await expect(cli.parse(['validate'], defaultTestConfig(), '/tmp/project')).resolves.toBe('done')

    expect(runCheckpointClientCheckMock).toHaveBeenCalledTimes(1)
    expect(printUpdateMessageMock).toHaveBeenCalledTimes(1)
    expect(printUpdateMessageMock).toHaveBeenCalledWith(checkResult)
  })
})
