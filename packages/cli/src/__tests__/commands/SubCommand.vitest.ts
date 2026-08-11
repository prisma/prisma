import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defaultTestConfig } from '@prisma/config'
import * as execa from 'execa'
import { copy } from 'fs-extra'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { SubCommand } from '../../SubCommand'

vi.mock('execa')

vi.useFakeTimers().setSystemTime(new Date('2025-01-01'))

const getDayMillis = () => new Date().setHours(0, 0, 0, 0)

beforeEach(async () => {
  await rm(join(tmpdir(), `sub-command@0.0.0`), { recursive: true, force: true })
  await rm(join(tmpdir(), `sub-command@latest-${getDayMillis()}`), { recursive: true, force: true })
})

afterEach(() => {
  vi.clearAllMocks()
  globalThis.Deno = undefined
})

test('@<version>', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), `sub-command@0.0.0`)
  await copy(copySrc, copyDest)

  await cmd.parse(['@0.0.0', '--help'], defaultTestConfig())

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "sub-command",
        [
          [
            "--help",
          ],
          {
            "loadedFromFile": null,
          },
          {
            "cliVersion": "0.0.0",
          },
        ],
      ],
    ]
  `)

  consoleLogSpy.mockRestore()
})

test('@latest', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), `sub-command@latest-${getDayMillis()}`)
  await copy(copySrc, copyDest)

  await cmd.parse(['--help'], defaultTestConfig())

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "sub-command",
        [
          [
            "--help",
          ],
          {
            "loadedFromFile": null,
          },
          {
            "cliVersion": "0.0.0",
          },
        ],
      ],
    ]
  `)

  consoleLogSpy.mockRestore()
})

test('autoinstall', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), 'sub-command@0.0.0')

  vi.mocked(execa.default).mockImplementation((async () => {
    await copy(copySrc, copyDest)
  }) as () => any)

  await cmd.parse(['@0.0.0', '--help'], defaultTestConfig())

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "sub-command",
        [
          [
            "--help",
          ],
          {
            "loadedFromFile": null,
          },
          {
            "cliVersion": "0.0.0",
          },
        ],
      ],
    ]
  `)

  expect(execa.default).toHaveBeenCalled()

  consoleLogSpy.mockRestore()
})

describe.each([
  { identity: 'prisma' as const, otherIdentity: 'prisma7' as const },
  { identity: 'prisma7' as const, otherIdentity: 'prisma' as const },
])('deno guidance for $identity', ({ identity, otherIdentity }) => {
  test('aborts on deno with the selected executable guidance', async () => {
    globalThis.Deno = { version: '2.0.0' } // fake being Deno

    const cmd = new SubCommand('sub-command', identity)
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await cmd.parse(['@0.0.0', '--help'], defaultTestConfig())

    expect(execa.default).not.toHaveBeenCalled()
    expect(consoleLogSpy.mock.calls[0]?.[0]).toContain(`npx ${identity} <cmd>`)
    expect(consoleLogSpy.mock.calls[0]?.[0]).not.toContain(`npx ${otherIdentity} <cmd>`)

    consoleLogSpy.mockRestore()
  })
})
