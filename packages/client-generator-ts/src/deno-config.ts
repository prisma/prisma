import fs from 'node:fs'
import path from 'node:path'

/**
 * Walks upward from the generated output directory to detect native Deno
 * projects via a nearby `deno.json` or `deno.jsonc`.
 */
export function findDenoConfigFromOutputDir(outputDir: string): boolean {
  let currentDir = path.resolve(outputDir)

  while (true) {
    if (fs.existsSync(path.join(currentDir, 'deno.json')) || fs.existsSync(path.join(currentDir, 'deno.jsonc'))) {
      return true
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir) {
      return false
    }
    currentDir = parentDir
  }
}
