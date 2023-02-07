import fs from 'fs/promises'
import path from 'path'

import { PrismaClient } from '../prisma/client'
import { PrismaClient as PrismaClientEdge } from '../prisma/client/edge'

test('assert node data proxy runtime can be used', async () => {
  try {
    const prisma = new PrismaClient()

    const data = await prisma.user.create({
      data: { email: 'jane@doe.io' },
    })
  } catch (e) {
    expect(e.message).toMatchInlineSnapshot(`"Datasource URL must use prisma:// protocol when --data-proxy is used"`)
  }
})

test('assert node data proxy index requires the right file', async () => {
  const data = await fs.readFile(path.join(__dirname, '..', 'prisma', 'client', 'index.js'))

  expect(data.includes('./runtime/data-proxy')).toBe(true)
})

test('assert edge data proxy runtime can be used', async () => {
  try {
    const prisma = new PrismaClientEdge()

    const data = await prisma.user.create({
      data: { email: 'jane@doe.io' },
    })
  } catch (e) {
    expect(e.message).toMatchInlineSnapshot(`"Datasource URL must use prisma:// protocol when --data-proxy is used"`)
  }
})

test('assert edge data proxy index requires the right file', async () => {
  const data = await fs.readFile(path.join(__dirname, '..', 'prisma', 'client', 'edge.js'))

  expect(data.includes('./runtime/edge')).toBe(true)
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
