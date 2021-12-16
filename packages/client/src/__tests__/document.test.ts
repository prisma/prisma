import { Arg, Args, Document, Field } from '../runtime/query'

test('document stringify', () => {
  const document = new Document('query', [
    new Field({
      name: 'users',
      args: new Args([
        new Arg({
          key: 'mirst',
          value: 100,
          error: {
            didYouMeanArg: 'first',
            providedName: 'mirst',
            providedValue: '',
            type: 'invalidName',
            originalType: 'String',
          },
        }),
        new Arg({
          key: 'skip',
          value: '200',
          error: {
            type: 'invalidType',
            providedValue: '200',
            argName: 'skip',
            requiredType: {
              inputType: [
                {
                  isList: false,
                  location: 'scalar',
                  type: 'number',
                },
              ],
              bestFittingType: {
                isList: false,
                location: 'scalar',
                type: 'number',
              },
            },
          },
        }),
        new Arg({
          key: 'where',
          value: new Args([
            new Arg({ key: 'age_gt', value: 10 }),
            new Arg({ key: 'age_in', value: [1, 2, 3] }),
            new Arg({ key: 'name_in', value: ['hans', 'peter', 'schmidt'] }),
            new Arg({
              key: 'OR',
              value: [
                new Args([
                  new Arg({ key: 'age_gt', value: 10123123123 }),
                  new Arg({
                    key: 'email_endsWith',
                    value: 'veryLongNameGoIntoaNewLineNow@gmail.com',
                  }),
                ]),
                new Args([
                  new Arg({ key: 'age_gt', value: 10123123123 }),
                  new Arg({
                    key: 'email_endsWith',
                    value: 'veryLongNameGoIntoaNewLineNow@gmail.com',
                  }),
                  new Arg({
                    key: 'OR',
                    value: [
                      new Args([
                        new Arg({ key: 'age_gt', value: 10123123123 }),
                        new Arg({
                          key: 'email_endsWith',
                          value: 'veryLongNameGoIntoaNewLineNow@gmail.com',
                        }),
                      ]),
                    ],
                  }),
                ]),
              ],
            }),
          ]),
        }),
      ]),
      children: [
        new Field({ name: 'id' }),
        new Field({
          name: 'name2',
          error: {
            modelName: 'User',
            didYouMean: 'name',
            providedName: 'name2',
            type: 'invalidFieldName',
            outputType: {
              fields: [],
              name: 'User',
              fieldMap: {},
            },
          },
        }),
        new Field({
          name: 'friends',
          args: new Args(),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
        new Field({
          name: 'posts',
          args: new Args([new Arg({ key: 'first', value: 200 })]),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
      ],
    }),
  ])

  expect(String(document)).toMatchInlineSnapshot(`
    query {
      users(
        mirst: 100
        skip: "200"
        where: {
          age_gt: 10
          age_in: [1, 2, 3]
          name_in: ["hans", "peter", "schmidt"]
          OR: [
            {
              age_gt: 10123123123
              email_endsWith: "veryLongNameGoIntoaNewLineNow@gmail.com"
            },
            {
              age_gt: 10123123123
              email_endsWith: "veryLongNameGoIntoaNewLineNow@gmail.com"
              OR: [
                {
                  age_gt: 10123123123
                  email_endsWith: "veryLongNameGoIntoaNewLineNow@gmail.com"
                }
              ]
            }
          ]
        }
      ) {
        id
        name2 # INVALID_FIELD
        friends {
          id
          name
        }
        posts(first: 200) {
          id
          name
        }
      }
    }
  `)
})
