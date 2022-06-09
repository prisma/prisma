import { getDMMF } from '../generation/getDMMF'
import { DMMFClass, makeDocument } from '../runtime'

export const recommender = /* Prisma */ `
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Article {
  id      Int      @id
  url     String   @unique
  title   String
  clicks  Int
  content String
  date    DateTime
  likedBy User[]
  link    Link?
}

model Link {
  id        Int      @id
  articleId Int      @unique
  article   Article  @relation(fields: [articleId], references: [id])
  postedAt  DateTime
}

model User {
  id            Int       @id
  name          String
  email         String    @unique
  likedArticles Article[]
  age           Int?
  personaId     Int
  persona       Persona   @relation(fields: [personaId], references: [id])
}

model Persona {
  id          Int     @id
  isDeveloper Boolean
  User        User[]
}
`

let dmmf
describe('aggregate', () => {
  beforeAll(async () => {
    dmmf = new DMMFClass(
      await getDMMF({
        datamodel: recommender,
      }),
    )
  })

  test('count happy path', () => {
    const document = makeDocument({
      dmmf,
      select: {
        take: 10,
        select: {
          _count: {
            select: {
              _all: true,
            },
          },
        },
      },
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    document.validate(undefined, false, 'user', 'colorless')
    expect(String(document)).toMatchInlineSnapshot(`
      query {
        aggregateUser(take: 10) {
          _count {
            _all
          }
        }
      }
    `)
  })

  test('combined happy path', () => {
    const document = makeDocument({
      dmmf,
      select: {
        take: 10,
        cursor: {
          email: 'a@a.de',
        },
        orderBy: {
          age: 'asc',
        },
        skip: 12,
        where: {
          age: { gt: 500 },
        },
        select: {
          _count: true,
          _avg: {
            select: {
              age: true,
            },
          },
          _min: {
            select: {
              age: true,
            },
          },
          _max: {
            select: {
              age: true,
            },
          },
          _sum: {
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
    expect(String(document)).toMatchSnapshot()
  })

  test('unhappy path - incorrect arg', () => {
    const select = { mount: true }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'aggregateUser',
    })
    expect(() => document.validate(select, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })

  test('unhappy path - incorrect field', () => {
    const select = {
      select: {
        _avg: {
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
    expect(() => document.validate(select, false, 'user', 'colorless')).toThrowErrorMatchingSnapshot()
  })
})
