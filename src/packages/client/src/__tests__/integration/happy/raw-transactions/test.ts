import { getTestClient } from '../../../../utils/getTestClient'

// describe, because we need to run them sequentially
describe('transaction', () => {
  test('queryRaw', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const res = await prisma.$transaction([
      prisma.$queryRaw`SELECT * FROM "User"`,
      prisma.$queryRaw`SELECT * FROM "Post"`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "User",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "Post",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ],
      Array [],
    ]
  `)
  })

  test('queryRaw & updateMany 1', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const updateUsers = prisma.user.updateMany({
      where: {
        name: 'A',
      },
      data: {
        name: 'B',
      },
    })

    const res = await prisma.$transaction([
      prisma.$queryRaw`SELECT * FROM "User"`,
      updateUsers,
      prisma.$queryRaw`SELECT * FROM "Post"`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "User",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["A"],
        query: SELECT \`dev\`.\`User\`.\`id\` FROM \`dev\`.\`User\` WHERE \`dev\`.\`User\`.\`name\` = ?,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "Post",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ],
      Object {
        count: 0,
      },
      Array [],
    ]
  `)
  })

  test('queryRaw & updateMany 2', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const updateUsers = prisma.user.updateMany({
      where: {
        name: 'A',
      },
      data: {
        name: 'B',
      },
    })

    const res = await prisma.$transaction([
      updateUsers,
      prisma.$queryRaw`SELECT * FROM "User"`,
      prisma.$queryRaw`SELECT * FROM "Post"`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["A"],
        query: SELECT \`dev\`.\`User\`.\`id\` FROM \`dev\`.\`User\` WHERE \`dev\`.\`User\`.\`name\` = ?,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "User",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "Post",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      Object {
        count: 0,
      },
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ],
      Array [],
    ]
  `)
  })

  test('executeRaw', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const res = await prisma.$transaction([
      prisma.$executeRaw`UPDATE User SET name = ${'blub1'} WHERE id = ${'THIS_DOES_NOT_EXIT1'};`,
      prisma.$executeRaw`UPDATE User SET name = ${'blub2'} WHERE id = ${'THIS_DOES_NOT_EXIT2'};`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub1","THIS_DOES_NOT_EXIT1"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub2","THIS_DOES_NOT_EXIT2"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      0,
      0,
    ]
  `)
  })

  test('queryRaw & executeRaw', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const res = await prisma.$transaction([
      prisma.$queryRaw`SELECT * FROM "Post"`,
      prisma.$executeRaw`UPDATE User SET name = ${'blub1'} WHERE id = ${'THIS_DOES_NOT_EXIT1'};`,
      prisma.$queryRaw`SELECT * FROM "User"`,
      prisma.$executeRaw`UPDATE User SET name = ${'blub2'} WHERE id = ${'THIS_DOES_NOT_EXIT2'};`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "Post",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub1","THIS_DOES_NOT_EXIT1"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "User",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub2","THIS_DOES_NOT_EXIT2"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      Array [],
      0,
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ],
      0,
    ]
  `)
  })

  // TODO: Enable this test, once query engine allows it
  // will be fixed in https://github.com/prisma/prisma-engines/issues/1481
  test.skip('all mixed', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
      ],
    })
    const queries: any[] = []
    prisma.$on('query', (q) => {
      queries.push(q)
    })

    const updateUsers = prisma.user.updateMany({
      where: {
        name: 'A',
      },
      data: {
        name: 'B',
      },
    })

    const res = await prisma.$transaction([
      // prisma.$queryRaw`SELECT * FROM "Post"`,
      prisma.$executeRaw`UPDATE User SET name = ${'blub1'} WHERE id = ${'THIS_DOES_NOT_EXIT1'};`,
      updateUsers,
      // prisma.$queryRaw`SELECT * FROM "User"`,
      // prisma.$executeRaw`UPDATE User SET name = ${'blub2'} WHERE id = ${'THIS_DOES_NOT_EXIT2'};`,
    ])
    await prisma.$disconnect()

    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
    Array [
      Object {
        duration: 0,
        params: [],
        query: BEGIN,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "Post",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub1","THIS_DOES_NOT_EXIT1"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: SELECT * FROM "User",
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: ["blub2","THIS_DOES_NOT_EXIT2"],
        query: UPDATE User SET name = ? WHERE id = ?;,
        target: quaint::connector::metrics,
      },
      Object {
        duration: 0,
        params: [],
        query: COMMIT,
        target: quaint::connector::metrics,
      },
    ]
  `)

    expect(res).toMatchInlineSnapshot(`
    Array [
      Array [],
      0,
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ],
      0,
    ]
  `)
  })
})

function sanitizeEvents(e: any[]) {
  return e.map(({ timestamp, ...event }) => event)
}
