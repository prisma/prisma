import { DMMF } from '@prisma/generator-helper'

import { BaseDMMFHelper } from '../../dmmf'
import { visitQueryResult } from './visitQueryResult'

function field(kind: DMMF.FieldKind, name: string, type: string, extra?: Partial<DMMF.Field>): DMMF.Field {
  return {
    kind,
    name,
    type,
    isRequired: false,
    isList: false,
    isUnique: true,
    isId: true,
    isReadOnly: false,
    hasDefaultValue: false,
    ...extra,
  }
}

function model(name: string, fields: DMMF.Field[]): DMMF.Model {
  return {
    name,
    dbName: null,
    fields: [
      field('scalar', 'id', 'String', {
        isUnique: true,
        isId: true,
      }),
      ...fields,
    ],
    uniqueFields: [],
    uniqueIndexes: [],
    primaryKey: {
      name: 'id',
      fields: ['id'],
    },
  }
}

const UserModel = model('User', [
  field('scalar', 'name', 'String'),
  field('object', 'group', 'Group', { relationName: 'UserToGroup' }),
  field('object', 'posts', 'Post', { relationName: 'UserToPost', isList: true }),
])

const GroupModel = model('Group', [
  field('object', 'users', 'User', {
    isList: true,
    relationName: 'GroupToUser',
  }),
])

const PostModel = model('Post', [
  field('scalar', 'name', 'String'),
  field('object', 'author', 'User', {
    relationName: 'PostToUser',
  }),
])

const dmmf = new BaseDMMFHelper({
  datamodel: {
    models: [UserModel, GroupModel, PostModel],
    enums: [],
    types: [],
  },
  mappings: {
    modelOperations: [],
    otherOperations: {
      read: [],
      write: [],
    },
  },
})

test('visits root node', () => {
  const visitor = jest.fn()
  const result = { name: 'Boaty McBoatface' }

  visitQueryResult({
    result,
    args: {},
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, UserModel, {})
  expect(visitor).toHaveBeenCalledTimes(1)
})

test('returns unchanged result if visitor return undefined', () => {
  const result = { name: 'Boaty McBoatface' }

  const visitResult = visitQueryResult({
    result,
    args: {},
    model: UserModel,
    dmmf,
    visitor: jest.fn(),
  })

  expect(visitResult).toBe(result)
})

test('returns new result if visitor returns the value', () => {
  const result = { name: 'Boaty McBoatface' }
  const replaceResult = { name: 'Replacy McReplaceFace' }

  const visitResult = visitQueryResult({
    result,
    args: {},
    model: UserModel,
    dmmf,
    visitor: jest.fn().mockReturnValue(replaceResult),
  })

  expect(visitResult).toBe(replaceResult)
})

test('in case of array, visits each item individually', () => {
  const result = [
    { id: '1', name: 'Firsty McFirstFace' },
    { id: '2', name: 'Secondy McSecondFace' },
  ]

  const visitor = jest.fn()

  visitQueryResult({
    result,
    args: {},
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledTimes(2)
  expect(visitor).toHaveBeenCalledWith(result[0], UserModel, {})
  expect(visitor).toHaveBeenCalledWith(result[1], UserModel, {})
})

test('allows to modify individual array items', () => {
  const result = [
    { id: '1', name: 'Firsty McFirstFace' },
    { id: '2', name: 'Secondy McSecondFace' },
  ]
  const originalSecond = result[1]
  const replaceResult = { id: 3, name: 'Replacy McReplaceFace' }

  const visitResult = visitQueryResult({
    result,
    args: {},
    model: UserModel,
    dmmf,
    visitor: (item) => {
      if ('id' in item && item['id'] === '1') {
        return replaceResult
      }
      return undefined
    },
  })

  expect(result[0]).toBe(replaceResult)
  expect(result[1]).toBe(originalSecond)
  expect(visitResult).toBe(result)
})

test('visits nested relations when using include', () => {
  const result = {
    id: '1',
    name: 'Boaty McBoatface',
    group: { id: '123' },
  }
  const visitor = jest.fn()

  visitQueryResult({
    result,
    args: {
      include: {
        group: true,
      },
    },
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, UserModel, { include: { group: true } })
  expect(visitor).toHaveBeenCalledWith(result.group, GroupModel, {})
})

test('visits nested relations when using select', () => {
  const result = {
    id: '1',
    name: 'Boaty McBoatface',
    group: { id: '123' },
  }
  const visitor = jest.fn()

  visitQueryResult({
    result,
    args: {
      select: {
        group: true,
      },
    },
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, UserModel, { select: { group: true } })
  expect(visitor).toHaveBeenCalledWith(result.group, GroupModel, {})
})

test('does not visit nested nested relations when include = false', () => {
  const result = {
    id: '1',
    name: 'Boaty McBoatface',
    group: { id: '123' },
  }
  const visitor = jest.fn()

  visitQueryResult({
    result,
    args: {
      include: {
        group: false,
      },
    },
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).not.toHaveBeenCalledWith(expect.anything(), GroupModel, expect.anything())
})

test('does not visit nested nested relations when corresponding field is null', () => {
  const result = {
    id: '1',
    name: 'Boaty McBoatface',
    group: null,
  }
  const visitor = jest.fn()

  visitQueryResult({
    result,
    args: {
      include: {
        group: true,
      },
    },
    model: UserModel,
    dmmf,
    visitor,
  })

  expect(visitor).not.toHaveBeenCalledWith(null, GroupModel, expect.anything())
})

test('visits deeply nested relations using include', () => {
  const result = {
    id: '123',
    title: 'Lorem impsum: is it really dolor sit amet?',
    author: {
      id: '1',
      name: 'Boaty McBoatface',
      group: { id: '456' },
    },
  }
  const visitor = jest.fn()
  visitQueryResult({
    result,
    args: {
      include: {
        author: {
          include: {
            group: true,
          },
        },
      },
    },
    model: PostModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, PostModel, { include: { author: { include: { group: true } } } })
  expect(visitor).toHaveBeenCalledWith(result.author, UserModel, { include: { group: true } })
  expect(visitor).toHaveBeenCalledWith(result.author.group, GroupModel, {})
})

test('visits deeply nested relations using select', () => {
  const result = {
    id: '123',
    title: 'Lorem impsum: is it really dolor sit amet?',
    author: {
      id: '1',
      name: 'Boaty McBoatface',
      group: { id: '456' },
    },
  }
  const visitor = jest.fn()
  visitQueryResult({
    result,
    args: {
      select: {
        author: {
          select: {
            group: true,
          },
        },
      },
    },
    model: PostModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, PostModel, { select: { author: { select: { group: true } } } })
  expect(visitor).toHaveBeenCalledWith(result.author, UserModel, { select: { group: true } })
  expect(visitor).toHaveBeenCalledWith(result.author.group, GroupModel, {})
})

test('visits deeply nested relations with mixed include and select', () => {
  const result = {
    id: '123',
    title: 'Lorem impsum: is it really dolor sit amet?',
    author: {
      id: '1',
      name: 'Boaty McBoatface',
      group: { id: '456' },
    },
  }
  const visitor = jest.fn()
  visitQueryResult({
    result,
    args: {
      include: {
        author: {
          select: {
            group: true,
          },
        },
      },
    },
    model: PostModel,
    dmmf,
    visitor,
  })

  expect(visitor).toHaveBeenCalledWith(result, PostModel, { include: { author: { select: { group: true } } } })
  expect(visitor).toHaveBeenCalledWith(result.author, UserModel, { select: { group: true } })
  expect(visitor).toHaveBeenCalledWith(result.author.group, GroupModel, {})
})

test('allows to replace deeply nested relations using include', () => {
  const result = {
    id: '123',
    title: 'Lorem impsum: is it really dolor sit amet?',
    author: {
      id: '1',
      name: 'Boaty McBoatface',
      group: { id: '456' },
    },
  }
  const replacementGroup = { id: 'brand-new-group' }

  const visitResult = visitQueryResult({
    result,
    args: {
      include: {
        author: {
          include: {
            group: true,
          },
        },
      },
    },
    model: PostModel,
    dmmf,
    visitor(value, model) {
      if (model.name === 'Group') {
        return replacementGroup
      }
      return undefined
    },
  })

  expect(visitResult['author']['group']).toBe(replacementGroup)
  expect(result.author.group).toBe(replacementGroup)
})

test('allows to replace deeply nested relations using select', () => {
  const result = {
    id: '123',
    title: 'Lorem impsum: is it really dolor sit amet?',
    author: {
      id: '1',
      name: 'Boaty McBoatface',
      group: { id: '456' },
    },
  }
  const replacementGroup = { id: 'brand-new-group' }

  const visitResult = visitQueryResult({
    result,
    args: {
      select: {
        author: {
          select: {
            group: true,
          },
        },
      },
    },
    model: PostModel,
    dmmf,
    visitor(value, model) {
      if (model.name === 'Group') {
        return replacementGroup
      }
      return undefined
    },
  })

  expect(visitResult['author']['group']).toBe(replacementGroup)
  expect(result.author.group).toBe(replacementGroup)
})
