import { enums } from '../fixtures/enums'
import { DMMFClass, makeDocument, transformDocument } from '../runtime'
import { getDMMF } from '../utils/getDMMF'

describe('scalar where transformation', () => {
  let dmmf
  beforeEach(async () => {
    dmmf = new DMMFClass(await getDMMF(enums))
  })

  test('transform correctly', () => {
    const select = {
      where: {
        AND: [
          {
            email: {
              equals: 'a@a.de',
              gt: '0',
            },
            AND: [
              {
                name: {
                  equals: '5',
                  not: '7',
                },
                OR: [
                  {
                    id: {
                      not: '8',
                    },
                  },
                  {
                    id: {
                      not: '9',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: {
              equals: '1',
              gt: '0',
            },
          },
        ],
      },
    }
    const document = makeDocument({
      dmmf,
      select,
      rootTypeName: 'query',
      rootField: 'users',
    })
    expect(String(document)).toMatchInlineSnapshot(`
      "query {
        users(where: {
          AND: [
            {
              email: {
                equals: \\"a@a.de\\"
                gt: \\"0\\"
              }
              AND: [
                {
                  name: {
                    equals: \\"5\\"
                    not: \\"7\\"
                  }
                  OR: [
                    {
                      id: {
                        not: \\"8\\"
                      }
                    },
                    {
                      id: {
                        not: \\"9\\"
                      }
                    }
                  ]
                }
              ]
            },
            {
              id: {
                equals: \\"1\\"
                gt: \\"0\\"
              }
            }
          ]
        }) {
          id
          name
          email
          status
          nicknames
        }
      }"
    `)
    expect(String(transformDocument(document))).toMatchInlineSnapshot(`
      "query {
        users(where: {
          AND: [
            {
              email: \\"a@a.de\\"
              email_gt: \\"0\\"
              AND: [
                {
                  name: \\"5\\"
                  name_not: \\"7\\"
                  OR: [
                    {
                      id_not: \\"8\\"
                    },
                    {
                      id_not: \\"9\\"
                    }
                  ]
                }
              ]
            },
            {
              id: \\"1\\"
              id_gt: \\"0\\"
            }
          ]
        }) {
          id
          name
          email
          status
          nicknames
        }
      }"
    `)
  })
})
