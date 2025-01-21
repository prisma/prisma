import * as ni from '@antfu/ni'
import * as execa from 'execa'
import { rm } from 'fs/promises'
import { copy } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'

import { SubCommand } from '../../SubCommand'

jest.mock('@antfu/ni')
jest.mock('execa')

jest.useFakeTimers().setSystemTime(new Date('2025-01-01'))

const getDayMillis = () => new Date().setHours(0, 0, 0, 0)

beforeEach(async () => {
  await rm('/tmp/sub-command@0.0.0', { recursive: true, force: true })
  await rm(`/tmp/sub-command@latest-${getDayMillis()}`, { recursive: true, force: true })
})

test('@<version>', async () => {
  const cmd = new SubCommand('sub-command')
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

  const copySrc = join(__dirname, '..', 'fixtures', 'sub-command')
  const copyDest = join(tmpdir(), `sub-command@0.0.0`)
  await copy(copySrc, copyDest, { recursive: true })

  await cmd.parse(['@0.0.0', '--help'])

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "sub-command",
        [
          [
            "--help",
          ],
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
  await copy(copySrc, copyDest, { recursive: true })

  await cmd.parse(['--help'])

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "sub-command",
        [
          [
            "--help",
          ],
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
    await copy(copySrc, copyDest, { recursive: true })
  }) as () => any)

  await cmd.parse(['@0.0.0', '--help'])

  expect(consoleLogSpy.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "sub-command",
          [
            [
              "--help",
            ],
          ],
        ],
      ]
    `)

  // eslint-disable-next-line @typescript-eslint/unbound-method
  expect(execa.command).toHaveBeenCalled()
  expect(ni.getCommand).toHaveBeenCalled()

  consoleLogSpy.mockRestore()
})
