import { Suite } from 'benchmark'
import { Field, Document, Args, Arg, makeDocument } from '../query'
import { dmmf } from '../dmmf'

const suite = new Suite()

const arr = new Array(100).fill(0)

suite
  .add('bench', () => {
    const document = new Document('query', [
      new Field({
        name: 'users',
        args: new Args([
          new Arg('first', 100),
          new Arg('skip', 200),
          new Arg('where', new Args([new Arg('age_gt', 10), new Arg('email_endsWith', '@gmail.com')])),
        ]),
        children: [
          new Field({ name: 'id' }),
          new Field({ name: 'name2', invalid: true }),
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
    document.toString()
  })
  .add('makeDocument', () => {
    const bigAst = {
      first: 200,
      skip: 200,
      where: {
        age_gt: 10,
        email_endsWith: '@gmail.com',
      },
      select: {
        id: true,
        mosts: {
          first: 100,
          where: {
            isPublished: true,
          },
          select: {
            id: false,
            author: {
              where: {
                age: {
                  gt: 10,
                },
              },
              select: {
                id: true,
              },
            },
          },
        },
      },
    }
    const document = makeDocument({ dmmf, select: bigAst, rootTypeName: 'query', rootField: 'users' })
    document.toString()
  })
  .on('cycle', function(event) {
    console.log(String(event.target))
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  // run async
  .run()
