import { defineConfig } from 'src/index'
import fs from 'node:fs/promises'

// Notice the usage of a top-level `await` here, which is only possible in ESM.
const env = await fs.readFile('.env', 'utf-8')
for (const line of env.split('\n')) {
  const [key, value] = line.split('=')
  process.env[key] = value
}

export default defineConfig({
  earlyAccess: true,
})
