import fs from 'node:fs'
import readline from 'node:readline'
import { PassThrough } from 'node:stream'

import { createSafeReadlineProxy, handleNpsSurveyImpl } from '../utils/nps/survey'

const currentDate = new Date('2022-01-01T00:00:00.000Z')
const laterDate = new Date('2023-01-01T00:00:00.000Z')
const earlierDate = new Date('2021-01-01T00:00:00.000Z')
const evenEarlierDate = new Date('2020-01-01T00:00:00.000Z')

describe('nps survey', () => {
  const originalEnv = { ...process.env }

  let mockRead: jest.SpyInstance
  let mockWrite: jest.SpyInstance
  let mockExists: jest.SpyInstance

  beforeEach(() => {
    process.env = {}
  })

  afterEach(() => {
    mockRead?.mockRestore()
    mockWrite?.mockRestore()
    mockExists?.mockRestore()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should exit immediately if running in CI', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    process.env.CI = 'true'
    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit immediately if running in a Podman container', async () => {
    mockExists = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      return path === '/run/.containerenv'
    })

    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit immediately if running in a Docker container', async () => {
    mockExists = jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
      return path === '/.dockerenv'
    })

    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit immediately if running in a Kubernetes pod', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    process.env.KUBERNETES_SERVICE_HOST = '10.96.0.1'
    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit immediately if running in a pre-commit git hook', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    process.env.GIT_EXEC_PATH = '/nix/store/9z3jhc0rlj3zaw8nd1zka9vli6w0q11g-git-2.47.2/libexec/git-core'
    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit immediately if running in a post-install npm hook or similar', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockImplementation()
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    process.env.npm_command = 'install'
    process.env.npm_lifecycle_event = 'prepare'
    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(0)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should read the config and exit when the current survey has been acknowledged', async () => {
    mockRead = jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(
        JSON.stringify({ acknowledgedTimeframe: { start: earlierDate.toISOString(), end: laterDate.toISOString() } }),
      )
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn()
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(0)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should check the status if there is no config and exit if there is no survey', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValue({ code: 'ENOENT' })
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest
      .fn()
      .mockResolvedValue({ currentTimeframe: { start: evenEarlierDate.toISOString(), end: earlierDate.toISOString() } })
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(1)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should check the status if the acknowledged survey has expired', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({
        acknowledgedTimeframe: { start: evenEarlierDate.toISOString(), end: earlierDate.toISOString() },
      }),
    )
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn().mockResolvedValue({})
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn()

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(1)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should exit if the status is undefined', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValue({ code: 'ENOENT' })
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const status = jest.fn().mockResolvedValue({})
    const readline = {
      question: jest.fn(),
      write: jest.fn(),
    }
    const capture = jest.fn().mockReturnValue(Promise.resolve())

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledTimes(0)
    expect(status).toHaveBeenCalledTimes(1)
    expect(readline.question).toHaveBeenCalledTimes(0)
    expect(capture).toHaveBeenCalledTimes(0)
  })

  it('should prompt the user if the survey is active and update the config', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValue({ code: 'ENOENT' })
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const currentTimeframe = { start: earlierDate.toISOString(), end: laterDate.toISOString() }
    const status = jest.fn().mockResolvedValue({ currentTimeframe })
    const readline = {
      question: jest.fn().mockResolvedValueOnce('5').mockResolvedValueOnce('Great!'),
      write: jest.fn(),
    }
    const capture = jest.fn().mockReturnValue(Promise.resolve())

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalled()
    expect(mockWrite).toHaveBeenLastCalledWith(
      expect.anything(),
      JSON.stringify({ acknowledgedTimeframe: currentTimeframe }),
    )
    expect(status).toHaveBeenCalledTimes(1)
    expect(readline.question).toHaveBeenCalledTimes(2)
    expect(readline.write).toHaveBeenCalledWith('Thanks for your feedback!\n')
    expect(capture).toHaveBeenCalledWith(expect.anything(), 'NPS feedback', { rating: 5, feedback: 'Great!' })
  })

  it('should allow the user to skip the survey and still update the config', async () => {
    mockRead = jest.spyOn(fs.promises, 'readFile').mockRejectedValue({ code: 'ENOENT' })
    mockWrite = jest.spyOn(fs.promises, 'writeFile').mockImplementation()

    const currentTimeframe = { start: earlierDate.toISOString(), end: laterDate.toISOString() }
    const status = jest.fn().mockResolvedValue({ currentTimeframe })
    const readline = {
      question: jest.fn().mockResolvedValueOnce('no'),
      write: jest.fn(),
    }
    const capture = jest.fn().mockReturnValue(Promise.resolve())

    await handleNpsSurveyImpl(currentDate, { status }, readline, { capture })

    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockWrite).toHaveBeenCalledWith(
      expect.anything(),
      JSON.stringify({ acknowledgedTimeframe: currentTimeframe }),
    )
    expect(status).toHaveBeenCalledTimes(1)
    expect(readline.question).toHaveBeenCalledTimes(1)
    expect(readline.write).toHaveBeenCalledWith('Not received a valid rating. Exiting the survey.\n')
    expect(capture).toHaveBeenCalledTimes(0)
  })
})

describe('createSafeReadlineProxy', () => {
  it('should handle an input stream that closes', async () => {
    const input = new PassThrough()
    const output = new PassThrough()

    const rl = readline.promises.createInterface({
      input,
      output,
    })
    const proxy = createSafeReadlineProxy(rl)

    process.nextTick(() => proxy.write('answer\n'))
    await expect(proxy.question('question')).resolves.toBe('answer')

    rl.close()
    expect(() => proxy.question('question')).toThrow('This operation was aborted')
  })
})
