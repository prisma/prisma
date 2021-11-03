import events from 'events'
import type { ExecaChildProcess } from 'execa'
import execa from 'execa'
import path from 'path'
import { EXIT_MESSAGE, READY_MESSAGE } from './__helpers__/constants'

function spawnChild() {
  const childPath = path.join(__dirname, '__helpers__', 'client.ts')
  return execa('node', ['-r', 'ts-node/register', childPath])
}

async function waitMessageOnStdout(child: ExecaChildProcess): Promise<string> {
  const [message] = await events.once(child.stdout!, 'data')
  return message.toString().trim()
}

describe('signals that should terminate the process', () => {
  test('SIGINT', async () => {
    const child = spawnChild()
    expect(await waitMessageOnStdout(child)).toBe(READY_MESSAGE)
    child.kill('SIGINT')
    expect((await child).stdout).toBe('')
  })

  test('SIGTERM', async () => {
    const child = spawnChild()
    expect(await waitMessageOnStdout(child)).toBe(READY_MESSAGE)
    child.kill('SIGTERM')
    expect((await child).stdout).toBe('')
  })

  test('SIGUSR2', async () => {
    const child = spawnChild()
    expect(await waitMessageOnStdout(child)).toBe(READY_MESSAGE)
    child.kill('SIGUSR2')
    expect((await child).stdout).toBe('')
  })
})

describe('Node.js debugger signal', () => {
  test('SIGUSR1', async () => {
    const child = spawnChild()
    expect(await waitMessageOnStdout(child)).toBe(READY_MESSAGE)
    child.kill('SIGUSR1')
    const result = await child
    expect(result.stdout).toBe(EXIT_MESSAGE)
    expect(result.stderr).toMatch(/Debugger listening/)
  })
})
