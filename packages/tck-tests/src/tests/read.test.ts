import { TestClient } from '../TestClient'

describe('read-tck', () => {
  const schema = /* Prisma */ `
    generator client {
      provider = "prisma-client-js"
    }
    
    datasource db {
      provider = "postgresql"
      url      = "DATABASE_URI"
    }
    
    model User {
      id String @id
      username  String
    }
  `

  const client = new TestClient({
    schema,
    provider: 'postgresql',
    uri: process.env.TEST_POSTGRES_URI as string,
  })

  beforeAll(async () => {
    await client.generate()
  })

  test('simple findMany', async () => {
    const query = () => client.prisma?.user.findMany({ where: { id: 'some-random-id' } })

    const response = await client.query(query)

    expect(response.logs.length).toEqual(1)

    expect(response.logs[0].query).toMatchInlineSnapshot(
      `SELECT "public"."User"."id", "public"."User"."username" FROM "public"."User" WHERE "public"."User"."id" = $1 OFFSET $2`,
    )

    expect(response.logs[0].params).toMatchInlineSnapshot(`["some-random-id",0]`)
  })
})
