import { defineConfig } from 'src/index'
import fs from 'node:fs/promises'

// Notice the usage of a top-level `await` here, which is only possible in ESM.
// This is loosely inspired by `dotenv`:
// https://github.com/motdotla/dotenv/blob/11acd9fc33ee81b2bfbf8ef5924c800a7454a8dd/lib/main.js#L45-L82
const env = await fs.readFile('.env', 'utf-8')
for (const line of env.split('\n')) {
  if (!line.trim() || line.startsWith('#')) {
    continue
  }

  let [key, value] = line.split('=')

  // Remove whitespace
  value = value.trim()

  // Remove surrounding quotes
  value = value.replace(/^(['"`])([\s\S]*)\1$/gm, '$2')

  process.env[key] = value
}

export default defineConfig({})
