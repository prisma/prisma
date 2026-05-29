import fs from 'fs'

import { CommandState, daysSinceFirstCommand, loadOrInitializeCommandState } from '../utils/commandState'

describe('command state', () => {
  let mockRead: jest.SpyInstance
  let mockWrite: jest.SpyInstance
  let mockMkdir: jest.SpyInstance

  afterEach(() => {
    mockRead?.mockRestore()
    mockWrite?.mockRestore()
    mockMkdir?.mockRestore()
  })

  it("initialize with the date when the state file doesn't exist", async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValue({ code: 'ENOENT' })
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()
    mockMkdir = jest.spyOn(fs.promises, 'mkdir').mockImplementation()

    const state = await loadOrInitializeCommandState()

    expect(state).toEqual({
      firstCommandTimestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/),
    })
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockMkdir).toHaveBeenCalledWith(expect.anything(), { recursive: true })
    expect(mockWrite).toHaveBeenCalledWith(expect.anything(), JSON.stringify(state))
  })

  it('return the date when the state file does exist', async () => {
    const date = new Date('2023-01-01T00:00:00Z')

    mockRead = jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(JSON.stringify({ firstCommandTimestamp: date.toISOString() }))
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const state = await loadOrInitializeCommandState()

    expect(state).toEqual({ firstCommandTimestamp: date.toISOString() })
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(0)
  })

  it('calculate the days since last command', () => {
    const start = new Date('2023-01-01T00:00:00Z')
    const end = new Date('2025-05-14T12:00:00Z')

    const state: CommandState = {
      firstCommandTimestamp: start.toISOString(),
    }

    expect(daysSinceFirstCommand(state, end)).toEqual(864)
  })
})
