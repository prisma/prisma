import { field, model, runtimeDataModel } from '../../../testUtils/dataModelBuilder'
import { applyAllResultExtensions } from './applyAllResultExtensions'
import { MergedExtensionsList } from './MergedExtensionsList'
import { resolveResultExtensionContext } from './resolveResultExtensionContext'

const UserModel = model('User', [field('object', 'posts', 'Post', { relationName: 'UserToPost', isList: true })])

const PostModel = model('Post', [field('object', 'author', 'User', { relationName: 'PostToUser' })])

const datamodel = runtimeDataModel({
  models: [UserModel, PostModel],
})

test('returns root context if dataPath is empty', () => {
  const context = resolveResultExtensionContext({
    dataPath: [],
    modelName: 'User',
    args: { where: { id: '1' } },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'User',
    args: { where: { id: '1' } },
  })
})

test('resolves model and args for fluent one-hop select path', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['select', 'posts'],
    modelName: 'User',
    args: {
      select: {
        posts: {
          select: {
            id: true,
          },
        },
      },
    },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'Post',
    args: {
      select: {
        id: true,
      },
    },
  })
})

test('resolves model and args for fluent one-hop include path', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['include', 'posts'],
    modelName: 'User',
    args: {
      include: {
        posts: {
          where: { id: 'post-id' },
        },
      },
    },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'Post',
    args: {
      where: { id: 'post-id' },
    },
  })
})

test('resolves model and args for multi-hop fluent path', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['select', 'posts', 'select', 'author'],
    modelName: 'User',
    args: {
      select: {
        posts: {
          select: {
            author: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'User',
    args: {
      select: {
        id: true,
      },
    },
  })
})

test('falls back to root context when path relation is invalid', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['select', 'email'],
    modelName: 'User',
    args: {
      select: {
        email: true,
      },
    },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'User',
    args: {
      select: {
        email: true,
      },
    },
  })
})

test('defaults nested args to empty object when selection is true', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['select', 'posts'],
    modelName: 'User',
    args: {
      select: {
        posts: true,
      },
    },
    runtimeDataModel: datamodel,
  })

  expect(context).toEqual({
    modelName: 'Post',
    args: {},
  })
})

test('resolved context applies result extensions to fluent-style unwrapped results', () => {
  const context = resolveResultExtensionContext({
    dataPath: ['select', 'posts'],
    modelName: 'User',
    args: {
      select: {
        posts: true,
      },
    },
    runtimeDataModel: datamodel,
  })

  const extensions = MergedExtensionsList.single({
    result: {
      post: {
        postLabel: {
          needs: { id: true },
          compute(post) {
            return `post-${post.id}`
          },
        },
      },
    },
  })

  const result = applyAllResultExtensions({
    result: [{ id: 'post-id' }] as Array<{ id: string; postLabel?: string }>,
    modelName: context.modelName,
    args: context.args,
    extensions,
    runtimeDataModel: datamodel,
  })

  expect(result[0].postLabel).toBe('post-post-id')
})
