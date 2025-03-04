import * as ni from '@antfu/ni'
import { defaultTestConfig } from '@prisma/config'
import * as execa from 'execa'
import { rm } from 'node:fs/promises'
import { copy } from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SubCommand } from '../../SubCommand'

jest.mock('@antfu/ni')
jest.mock('execa')

jest.useFakeTimers().setSystemTime(new Date('2025-01-01'))

const getDayMillis = () => new Date().setHours(0, 0, 0, 0)

beforeEach(async () => {
  await rm(join(tmpdir(), 'sub-command@0.0.0'), { recursive: true, force: true })
  await rm(join(tmpdir(), `sub-command@latest-${getDayMillis()}`), { recursive: true, force: true })
})

test('@<version>', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), 'sub-command@0.0.0')
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
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

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
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), 'sub-command@0.0.0')

  jest.mocked(ni.getCommand).mockReturnValue('npm install sub-command --no-save --prefix /tmp/sub-command@0.0.0')
  // eslint-disable-next-line @typescript-eslint/unbound-method
  jest.mocked(execa.command).mockImplementation((async () => {
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
