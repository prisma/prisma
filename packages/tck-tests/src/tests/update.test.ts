import { TestClient } from '../TestClient'

describe('update-tck', () => {
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

  test('simple update', async () => {
    const id = 'some-random-id'
    const username = 'some-random-username'
    await client.prisma.user.create({ data: { id, username } })

    const query = () => client.prisma?.user.update({ where: { id }, data: { username } })

    const response = await client.query(query)

    expect(response.logs.length).toEqual(3)

    expect(response.logs[0].query).toMatchInlineSnapshot(
      `SELECT "public"."User"."id" FROM "public"."User" WHERE "public"."User"."id" = $1`,
    )

    expect(response.logs[0].params).toMatchInlineSnapshot(`["some-random-id"]`)

    expect(response.logs[1].query).toMatchInlineSnapshot(
      `UPDATE "public"."User" SET "username" = $1 WHERE "public"."User"."id" IN ($2)`,
    )

    expect(response.logs[1].params).toMatchInlineSnapshot(`["some-random-username","some-random-id"]`)

    expect(response.logs[2].query).toMatchInlineSnapshot(
      `SELECT "public"."User"."id", "public"."User"."username" FROM "public"."User" WHERE "public"."User"."id" = $1 LIMIT $2 OFFSET $3`,
    )

    expect(response.logs[2].params).toMatchInlineSnapshot(`["some-random-id",1,0]`)
  })
})
