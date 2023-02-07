import fs from 'fs/promises'
import path from 'path'

import { PrismaClient } from '../prisma/client'

test('assert data proxy runtime is in use', async () => {
  try {
    const prisma = new PrismaClient()

    const data = await prisma.user.create({
      data: { email: 'jane@doe.io' },
    })
  } catch (e) {
    expect(e.message).toMatchInlineSnapshot(`"Datasource URL must use prisma:// protocol when --data-proxy is used"`)
  }
})

test('runtime files exists', async () => {
  const files = await fs.readdir(path.join(__dirname, '..', 'prisma', 'client', 'runtime'))

  console.log(files)

  expect(files).toMatchInlineSnapshot(`
[
  "data-proxy.d.ts",
  "data-proxy.js",
  "edge-esm.js",
  "edge.js",
  "index.d.ts",
  "library.d.ts",
  "library.js",
]
`)
})

export {}
