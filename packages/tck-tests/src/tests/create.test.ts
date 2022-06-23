import { TestClient } from '../TestClient'

describe('create-tck', () => {
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

  test('simple create', async () => {
    const query = () => client.prisma?.user.create({ data: { id: 'some-random-id', username: 'some-random-username' } })

    const response = await client.query(query)

    expect(response.logs.length).toEqual(2)

    expect(response.logs[0].query).toMatchInlineSnapshot(
      `INSERT INTO "public"."User" ("id","username") VALUES ($1,$2) RETURNING "public"."User"."id"`,
    )

    expect(response.logs[0].params).toMatchInlineSnapshot(`["some-random-id","some-random-username"]`)

    expect(response.logs[1].query).toMatchInlineSnapshot(
      `SELECT "public"."User"."id", "public"."User"."username" FROM "public"."User" WHERE "public"."User"."id" = $1 LIMIT $2 OFFSET $3`,
    )
  })
})
