import fs from 'node:fs'
import path from 'node:path'

import type { LoadedFile } from './loadSchemaFiles'

export function line(text: string) {
  return `${text}${process.platform === 'win32' ? '\r\n' : '\n'}`
}

export function fixturePath(...parts: string[]) {
  return path.join(__dirname, '__fixtures__', ...parts)
}

export function loadedFile(...parts: string[]): LoadedFile {
  const filePath = fixturePath(...parts)
  return [filePath, fs.readFileSync(filePath, 'utf8')]
}
