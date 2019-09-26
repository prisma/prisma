import serializeError from 'serialize-error'
import { spawn } from 'child_process'
import path from 'path'
import stripAnsi from 'strip-ansi'
import fs from 'fs'

export function capture(e: any) {
  try {
    const json = serializeError(e)
    json.message = stripAnsi(json.message)

    const workerPath = path.resolve(__dirname, 'capture-worker.js')
    if (fs.existsSync(workerPath)) {
      const child = spawn(process.execPath, [workerPath], {
        detached: true,
        stdio: ['pipe', 'ignore', 'ignore'],
      })

      child.stdin!.write(JSON.stringify(json) + '\n')
    }
  } catch (e) {
    // console.error(e)
  }
}
