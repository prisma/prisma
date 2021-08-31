import { getTestClient } from '../../../../utils/getTestClient'
import { sanitizeEvents } from '../../__helpers__/sanitizeEvents'

describe('logging', () => {
  test('emit all as events)', async () => {
    // Client configuration
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
        {
          emit: 'event',
          level: 'error',
        },
      ],
    })

    // Logging configuration
    const queries: any[] = []
    prisma.$on('query', (l) => {
      queries.push(l)
    })
    const infos: any[] = []
    prisma.$on('info', (l) => {
      infos.push(l)
    })
    const warns: any[] = []
    prisma.$on('warn', (l) => {
      warns.push(l)
    })
    const errors: any[] = []
    prisma.$on('error', (l) => {
      errors.push(l)
    })

    // Exercice the client a bit
    const res = await prisma.user.findMany()
    await prisma.$disconnect()

    // Expectations
    expect(sanitizeEvents(queries)).toMatchInlineSnapshot(`
      Array [
        Object {
          params: [-1,0],
          query: SELECT \`main\`.\`User\`.\`id\`, \`main\`.\`User\`.\`email\`, \`main\`.\`User\`.\`name\` FROM \`main\`.\`User\` WHERE 1=1 LIMIT ? OFFSET ?,
          target: quaint::connector::metrics,
        },
      ]
    `)
    expect(sanitizeEvents(infos)).toMatchInlineSnapshot(`
      Array [
        Object {
          message: Starting a sqlite pool with 5 connections.,
          target: undefined,
        },
      ]
    `)
    expect(sanitizeEvents(warns)).toMatchInlineSnapshot(`Array []`)
    expect(sanitizeEvents(errors)).toMatchInlineSnapshot(`Array []`)

    expect(res).toMatchInlineSnapshot(`
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ]
    `)
  })
})
