import { DMMFClass, makeDocument } from '../runtime'
import { getDMMF } from '../generation/getDMMF'

export const recommender = /* GraphQL */ `
model Article {
  id      Int      @id
  url     String   @unique
  title   String
  clicks  Int
  content String
  date    DateTime
  likedBy User[]
  link    Link
}

model Link {
  id Int @id
  articleId Int
  article Article @relation(fields: [articleId], references: [id])
  postedAt DateTime
}

model User {
  id            Int       @id
  name          String
  email         String    @unique
  likedArticles Article[]
  age Int?
  personaId Int
  persona Persona @relation(fields: [personaId])
}

model Persona {
  id Int @id
  isDeveloper Boolean
}
`

let dmmf
describe('aggregate', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(
      await getDMMF({
        datamodel: recommender,
        enableExperimental: ['aggregations'],
      }),
    )
  })

  test('count happy path', () => {
    const document = makeDocument({
      dmmf,
      select: {
        take: 10,
        select: {
          count: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        aggregateUser(take: 10) {
          count
        }
      }"
    `)
  })

  test('combined happy path', () => {
    const document = makeDocument({
      dmmf,
      select: {
        take: 10,
        select: {
          count: true,
          avg: {
            select: {
              age: true,
            },
          },
          min: {
            select: {
              age: true,
            },
          },
          max: {
            select: {
              age: true,
            },
          },
          sum: {
            select: {
              age: true,
            },
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        aggregateUser(take: 10) {
          count
          avg {
            age
          }
          min {
            age
          }
          max {
            age
          }
          sum {
            age
          }
        }
      }"
    `)
  })

  test('unhappy path - incorrect arg', () => {
    const select = { mount: true }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    expect(() =>
      document.validate(select, false, 'user', 'colorless'),
    ).toThrowErrorMatchingSnapshot()
  })

  test('unhappy path - incorrect field', () => {
    const select = {
      select: {
        avg: {
          select: {
            blub: true,
          },
        },
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    expect(() =>
      document.validate(select, false, 'user', 'colorless'),
    ).toThrowErrorMatchingSnapshot()
  })
})
