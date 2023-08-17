import fs from 'fs/promises'
import path from 'path'

import { PrismaClient } from '../prisma/client'
import { PrismaClient as PrismaClientEdge } from '../prisma/client/edge'

test('assert node data proxy runtime can be used', async () => {
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'prisma://localhost:5555',
        },
      },
    })

    await prisma.user.create({
      data: { email: 'jane@doe.io' },
    })
  } catch (e) {
    expect(e.message).toMatchInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation in
/test/runtimes/data-proxy-custom-output/tests/main.ts:17:23

  14   },
  15 })
  16 
→ 17 await prisma.user.create(
No valid API key found in the datasource URL"
`)
  }
})

test('assert edge data proxy runtime can be used', async () => {
  try {
    const prisma = new PrismaClientEdge({
      datasources: {
        db: {
          url: 'prisma://localhost:5555',
        },
      },
    })

    await prisma.user.create({
      data: { email: 'jane@doe.io' },
    })
  } catch (e) {
    expect(e.message).toMatchInlineSnapshot(`
"
Invalid \`prisma.user.create()\` invocation:


No valid API key found in the datasource URL"
`)
  }
})

test('runtime files exists', async () => {
  const files = await fs.readdir(path.join(__dirname, '..', 'prisma', 'client', 'runtime'))

  console.log(files)

  expect(files).toMatchInlineSnapshot(`
[
  "edge-esm.js",
  "edge.js",
  "index-browser.d.ts",
  "index-browser.js",
  "library.d.ts",
  "library.js",
]
`)
})

export {}
