import serializeError from 'serialize-error'
import { spawn } from 'child_process'
import path from 'path'
import stripAnsi from 'strip-ansi'

export function capture(e: any) {
  try {
    const json = serializeError(e)
    json.message = stripAnsi(json.message)

    const child = spawn(process.execPath, [path.resolve(__dirname, 'capture-worker.js')], {
      detached: true,
      stdio: ['pipe', 'ignore', 'ignore'],
    })

    child.stdin!.write(JSON.stringify(json) + '\n')
  } catch (e) {
    console.error(e)
  }
}
