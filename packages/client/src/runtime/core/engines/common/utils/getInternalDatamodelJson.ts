import { spawn } from 'child_process'
import path from 'path'

import byline from '../../tools/byline'

export function getInternalDatamodelJson(
  datamodel: string,
  schemaInferrerPath: string = path.join(__dirname, '../schema-inferrer-bin'),
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(schemaInferrerPath, {
      stdio: ['pipe', 'pipe', process.stderr],
    })

    proc.on('error', function (err) {
      console.error('[schema-inferrer-bin] error: %s', err)
      reject(err)
    })

    proc.on('exit', function (code, signal) {
      if (code !== 0) {
        console.error('[schema-inferrer-bin] exit: code=%s signal=%s', code, signal)
      }
      reject()
    })

    const out = byline(proc.stdout)
    out.on('data', (line) => {
      const result = JSON.parse(line)
      const resultB64 = Buffer.from(JSON.stringify(result)).toString('base64')
      resolve(resultB64)
    })

    const cut = datamodel.replace(/\n/g, ' ')

    proc.stdin.write(JSON.stringify({ dataModel: cut }) + '\n')
  })
}
