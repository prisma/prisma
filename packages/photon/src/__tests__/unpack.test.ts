import { blog } from '../fixtures/blog'
import { DMMFClass } from '../runtime'
import { makeDocument, getField, unpack } from '../runtime/query'
import { getDMMF } from '../utils/getDMMF'

let dmmf

beforeAll(async () => {
  const dmmfObj = await getDMMF({
    datamodel: blog,
  })
  dmmf = new DMMFClass(dmmfObj)
})

describe('getField', () => {
  test('blog findOneUser', async () => {
    const document = makeDocument({
      dmmf,
      select: {
        select: {
          id: true,
          posts: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'findOneUser',
    })

    expect(getField(document, ['findOneUser']).name).toMatchInlineSnapshot(`"findOneUser"`)
    expect(getField(document, ['findOneUser', 'id']).name).toMatchInlineSnapshot(`"id"`)
    expect(getField(document, ['findOneUser', 'posts']).name).toMatchInlineSnapshot(`"posts"`)
    expect(getField(document, ['findOneUser', 'posts', 'title']).name).toMatchInlineSnapshot(`"title"`)
  })
})

describe('unpack', () => {
  test('findOnePost', async () => {
    const document = makeDocument({
      dmmf,
      select: {
        // select: {
        //   id: true,
        //   posts: true,
        // },
      },
      rootTypeName: 'query',
      rootField: 'findOnePost',
    })

    const path = ['findOnePost']

    const data = {
      findOnePost: {
        id: 'some-id',
        createdAt: '2019-10-17T09:56:37.690Z',
        updatedAt: '2019-10-17T09:56:37.690Z',
        published: false,
        title: 'Some mighty hightly title',
      },
    }

    const result = unpack({
      document,
      path,
      data,
    })

    expect(result.createdAt instanceof Date).toBe(true)
    expect(result.updatedAt instanceof Date).toBe(true)

    expect(result).toMatchInlineSnapshot(`
      Object {
        "createdAt": 2019-10-17T09:56:37.690Z,
        "id": "some-id",
        "published": false,
        "title": "Some mighty hightly title",
        "updatedAt": 2019-10-17T09:56:37.690Z,
      }
    `)
  })

  test('findManyPost', async () => {
    const document = makeDocument({
      dmmf,
      select: {},
      rootTypeName: 'query',
      rootField: 'findManyPost',
    })

    const path = ['findManyPost']

    const data = {
      findManyPost: [
        {
          id: 'some-id',
          createdAt: '2019-10-17T09:56:37.690Z',
          updatedAt: '2019-10-17T09:56:37.690Z',
          published: false,
          title: 'Some mighty hightly title',
        },
        {
          id: 'some-id2',
          createdAt: '2019-11-17T09:56:37.690Z',
          updatedAt: '2019-11-17T09:56:37.690Z',
          published: true,
          title: 'Having a title that is recital is just vital',
        },
        {
          id: 'some-id3',
          createdAt: '2019-11-17T09:56:37.690Z',
          updatedAt: '2019-11-17T09:56:37.690Z',
          published: true,
          title: "One thing for sure: If you don't read the bible, you can't belong to the tribal.",
        },
      ],
    }

    const result = unpack({
      document,
      path,
      data,
    })

    expect(result[0].createdAt instanceof Date).toBe(true)
    expect(result[0].updatedAt instanceof Date).toBe(true)

    expect(result).toMatchInlineSnapshot(`
      Array [
        Object {
          "createdAt": 2019-10-17T09:56:37.690Z,
          "id": "some-id",
          "published": false,
          "title": "Some mighty hightly title",
          "updatedAt": 2019-10-17T09:56:37.690Z,
        },
        Object {
          "createdAt": 2019-11-17T09:56:37.690Z,
          "id": "some-id2",
          "published": true,
          "title": "Having a title that is recital is just vital",
          "updatedAt": 2019-11-17T09:56:37.690Z,
        },
        Object {
          "createdAt": 2019-11-17T09:56:37.690Z,
          "id": "some-id3",
          "published": true,
          "title": "One thing for sure: If you don't read the bible, you can't belong to the tribal.",
          "updatedAt": 2019-11-17T09:56:37.690Z,
        },
      ]
    `)
  })

  test('findOneUser', async () => {
    const document = makeDocument({
      dmmf,
      select: {
        include: {
          posts: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'findOneUser',
    })

    const path = ['findOneUser']

    const data = {
      findOneUser: {
        id: 'some-id',
        email: 'a@a.com',
        posts: [
          {
            id: 'some-id',
            createdAt: '2019-10-17T09:56:37.690Z',
            updatedAt: '2019-10-17T09:56:37.690Z',
            published: false,
            title: 'Some mighty hightly title',
          },
          {
            id: 'some-id2',
            createdAt: '2019-11-17T09:56:37.690Z',
            updatedAt: '2019-11-17T09:56:37.690Z',
            published: true,
            title: 'Having a title that is recital is just vital',
          },
          {
            id: 'some-id3',
            createdAt: '2019-11-17T09:56:37.690Z',
            updatedAt: '2019-11-17T09:56:37.690Z',
            published: true,
            title: 'Does the bible talk about the revival of the tribal?',
          },
        ],
      },
    }

    const result = unpack({
      document,
      path,
      data,
    })

    expect(result).toMatchInlineSnapshot(`
      Object {
        "email": "a@a.com",
        "id": "some-id",
        "posts": Array [
          Object {
            "createdAt": 2019-10-17T09:56:37.690Z,
            "id": "some-id",
            "published": false,
            "title": "Some mighty hightly title",
            "updatedAt": 2019-10-17T09:56:37.690Z,
          },
          Object {
            "createdAt": 2019-11-17T09:56:37.690Z,
            "id": "some-id2",
            "published": true,
            "title": "Having a title that is recital is just vital",
            "updatedAt": 2019-11-17T09:56:37.690Z,
          },
          Object {
            "createdAt": 2019-11-17T09:56:37.690Z,
            "id": "some-id3",
            "published": true,
            "title": "Does the bible talk about the revival of the tribal?",
            "updatedAt": 2019-11-17T09:56:37.690Z,
          },
        ],
      }
    `)
  })
})
