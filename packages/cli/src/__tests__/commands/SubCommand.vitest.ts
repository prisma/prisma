import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as ni from '@antfu/ni'
import { defaultTestConfig } from '@prisma/config'
import * as execa from 'execa'
import { copy } from 'fs-extra'
import { beforeEach, expect, test, vi } from 'vitest'

import { SubCommand } from '../../SubCommand'

vi.mock('@antfu/ni')
vi.mock('execa')

vi.useFakeTimers().setSystemTime(new Date('2025-01-01'))

const getDayMillis = () => new Date().setHours(0, 0, 0, 0)

beforeEach(async () => {
  await rm(join(tmpdir(), `sub-command@0.0.0`), { recursive: true, force: true })
  await rm(join(tmpdir(), `sub-command@latest-${getDayMillis()}`), { recursive: true, force: true })
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
            "earlyAccess": true,
            "loadedFromFile": null,
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
            "earlyAccess": true,
            "loadedFromFile": null,
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

  vi.mocked(ni.getCommand).mockReturnValue('npm install sub-command --no-save --prefix /tmp/sub-command@0.0.0')
  // eslint-disable-next-line @typescript-eslint/unbound-method
  vi.mocked(execa.command).mockImplementation((async () => {
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
            "earlyAccess": true,
            "loadedFromFile": null,
          },
        ],
      ],
    ]
  `)

  // eslint-disable-next-line @typescript-eslint/unbound-method
  expect(execa.command).toHaveBeenCalled()
  expect(ni.getCommand).toHaveBeenCalled()

  consoleLogSpy.mockRestore()
})

test('cleans up corrupted tmp directory', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copySrcCorrupted = join(__dirname, '..', 'fixtures', 'sub-command-corrupted')
  const copyDest = join(tmpdir(), 'sub-command@0.0.0')

  await copy(copySrcCorrupted, copyDest)

  vi.mocked(ni.getCommand).mockReturnValue('npm install sub-command --no-save --prefix /tmp/sub-command@0.0.0')
  // eslint-disable-next-line @typescript-eslint/unbound-method
  vi.mocked(execa.command).mockImplementation((async () => {
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
            "earlyAccess": true,
            "loadedFromFile": null,
          },
        ],
      ],
    ]
  `)

  // eslint-disable-next-line @typescript-eslint/unbound-method
  expect(execa.command).toHaveBeenCalled()
  expect(ni.getCommand).toHaveBeenCalled()

  consoleLogSpy.mockRestore()
})
