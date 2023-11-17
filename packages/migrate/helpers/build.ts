import fs from 'node:fs/promises'
import path from 'node:path'

async function run() {
  const dist = path.resolve(__dirname, '..', 'dist')
  await fs.mkdir(dist, { recursive: true })
  await fs.copyFile(require.resolve('prisma/build/migrate.js'), path.resolve(dist, 'index.js'))
  await fs.copyFile(require.resolve('prisma/build/migrate.d.ts'), path.resolve(dist, 'index.d.ts'))
}

void run()
