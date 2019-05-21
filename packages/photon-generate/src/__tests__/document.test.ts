import { Document, Field, Args, Arg } from '../runtime/query'

test('document stringify', () => {
  const document = new Document('query', [
    new Field({
      name: 'users',
      args: new Args([
        new Arg('mirst', 100, false, {
          didYouMeanArg: 'first',
          providedName: 'mirst',
          providedValue: '',
          type: 'invalidName',
          originalType: 'String',
        }),
        new Arg('skip', '200', false, {
          type: 'invalidType',
          providedValue: '200',
          argName: 'skip',
          requiredType: {
            isEnum: false,
            isRequired: false,
            types: ['number'],
            isList: false,
            isScalar: false,
            bestFittingType: 'number',
          },
        }),
        new Arg(
          'where',
          new Args([
            new Arg('age_gt', 10),
            new Arg('age_in', [1, 2, 3]),
            new Arg('name_in', ['hans', 'peter', 'schmidt']),
            new Arg('OR', [
              new Args([
                new Arg('age_gt', 10123123123),
                new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
              ]),
              new Args([
                new Arg('age_gt', 10123123123),
                new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
                new Arg('OR', [
                  new Args([
                    new Arg('age_gt', 10123123123),
                    new Arg('email_endsWith', 'veryLongNameGoIntoaNewLineNow@gmail.com'),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ),
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
          },
        }),
        new Field({
          name: 'friends',
          args: new Args(),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
        new Field({
          name: 'posts',
          args: new Args([new Arg('first', 200)]),
          children: [new Field({ name: 'id' }), new Field({ name: 'name' })],
        }),
      ],
    }),
  ])

  expect(String(document)).toMatchInlineSnapshot(`
    "query {
      users(
        mirst: 100
        skip: \\"200\\"
        where: {
          age_gt: 10
          age_in: [1, 2, 3]
          name_in: [\\"hans\\", \\"peter\\", \\"schmidt\\"]
          OR: [
            {
              age_gt: 10123123123
              email_endsWith: \\"veryLongNameGoIntoaNewLineNow@gmail.com\\"
            },
            {
              age_gt: 10123123123
              email_endsWith: \\"veryLongNameGoIntoaNewLineNow@gmail.com\\"
              OR: [
                {
                  age_gt: 10123123123
                  email_endsWith: \\"veryLongNameGoIntoaNewLineNow@gmail.com\\"
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
    }"
  `)
})
