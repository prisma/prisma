import { getDMMF } from '@prisma/internals'

import { blog } from '../fixtures/blog'
import { DMMFClass } from '../runtime'
import { MergedExtensionsList } from '../runtime/core/extensions/MergedExtensionsList'
import { getField, makeDocument, unpack } from '../runtime/query'

let dmmf

beforeAll(async () => {
  const dmmfObj = await getDMMF({
    datamodel: blog,
  })
  dmmf = new DMMFClass(dmmfObj)
})

describe('getField', () => {
  test('blog findUniqueUser', () => {
    const document = makeDocument({
      dmmf,
      select: {
        select: {
          id: true,
          posts: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'findUniqueUser',
      extensions: MergedExtensionsList.empty(),
    })

    expect(getField(document, ['findUniqueUser']).name).toMatchInlineSnapshot(`findUniqueUser`)
    expect(getField(document, ['findUniqueUser', 'id']).name).toMatchInlineSnapshot(`id`)
    expect(getField(document, ['findUniqueUser', 'posts']).name).toMatchInlineSnapshot(`posts`)
    expect(getField(document, ['findUniqueUser', 'posts', 'title']).name).toMatchInlineSnapshot(`title`)
  })
})

describe('unpack', () => {
  test('findUniquePost', () => {
    const document = makeDocument({
      dmmf,
      select: {},
      rootTypeName: 'query',
      rootField: 'findUniquePost',
      extensions: MergedExtensionsList.empty(),
    })

    const path = ['findUniquePost']

    const data = {
      findUniquePost: {
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

    expect(result.createdAt).toBeInstanceOf(Date)
    expect(result.updatedAt).toBeInstanceOf(Date)

    expect(result).toMatchInlineSnapshot(`
      {
        createdAt: 2019-10-17T09:56:37.690Z,
        id: some-id,
        published: false,
        title: Some mighty hightly title,
        updatedAt: 2019-10-17T09:56:37.690Z,
      }
    `)
  })

  test('findManyPost', () => {
    const document = makeDocument({
      dmmf,
      select: {},
      rootTypeName: 'query',
      rootField: 'findManyPost',
      extensions: MergedExtensionsList.empty(),
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

    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)

    expect(result).toMatchInlineSnapshot(`
      [
        {
          createdAt: 2019-10-17T09:56:37.690Z,
          id: some-id,
          published: false,
          title: Some mighty hightly title,
          updatedAt: 2019-10-17T09:56:37.690Z,
        },
        {
          createdAt: 2019-11-17T09:56:37.690Z,
          id: some-id2,
          published: true,
          title: Having a title that is recital is just vital,
          updatedAt: 2019-11-17T09:56:37.690Z,
        },
        {
          createdAt: 2019-11-17T09:56:37.690Z,
          id: some-id3,
          published: true,
          title: One thing for sure: If you don't read the bible, you can't belong to the tribal.,
          updatedAt: 2019-11-17T09:56:37.690Z,
        },
      ]
    `)
  })

  test('findUniqueUser', () => {
    const document = makeDocument({
      dmmf,
      select: {
        include: {
          posts: true,
        },
      },
      rootTypeName: 'query',
      rootField: 'findUniqueUser',
      extensions: MergedExtensionsList.empty(),
    })

    const path = ['findUniqueUser']

    const data = {
      findUniqueUser: {
        id: 'some-id',
        email: 'a@a.com',
        json: '{"hello": "world"}',
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
      {
        email: a@a.com,
        id: some-id,
        json: {
          hello: world,
        },
        posts: [
          {
            createdAt: 2019-10-17T09:56:37.690Z,
            id: some-id,
            published: false,
            title: Some mighty hightly title,
            updatedAt: 2019-10-17T09:56:37.690Z,
          },
          {
            createdAt: 2019-11-17T09:56:37.690Z,
            id: some-id2,
            published: true,
            title: Having a title that is recital is just vital,
            updatedAt: 2019-11-17T09:56:37.690Z,
          },
          {
            createdAt: 2019-11-17T09:56:37.690Z,
            id: some-id3,
            published: true,
            title: Does the bible talk about the revival of the tribal?,
            updatedAt: 2019-11-17T09:56:37.690Z,
          },
        ],
      }
    `)
  })
})
