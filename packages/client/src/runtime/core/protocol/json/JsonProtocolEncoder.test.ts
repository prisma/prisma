import { field, model, runtimeDataModel } from '../../../../testUtils/dataModelBuilder'
import { MergedExtensionsList } from '../../extensions/MergedExtensionsList'
import { JsonProtocolMessage } from './JsonProtocolEncoder'
import { serializeJsonQuery, SerializeParams } from './serialize'

const User = model('User', [
  field('scalar', 'name', 'String'),
  field('scalar', 'nickname', 'String'),
  field('object', 'posts', 'Post', {
    isList: true,
    relationName: 'UserToPost',
  }),
])

const Post = model('Post', [
  field('scalar', 'title', 'String'),
  field('scalar', 'userId', 'String'),
  field('scalar', 'published', 'Boolean'),
  field('object', 'user', 'User', {
    relationName: 'PostToUser',
  }),
  field('object', 'attachments', 'Attachment', {
    relationName: 'PostToAttachment',
    isList: true,
  }),
])

const Attachment = model('Attachment', [
  field('scalar', 'fileName', 'String'),
  field('scalar', 'postId', 'String'),
  field('object', 'post', 'Post', {
    relationName: 'AttachmentToPost',
  }),
])

const datamodel = runtimeDataModel({ models: [User, Post, Attachment] })

type SimplifiedParams = Omit<SerializeParams, 'runtimeDataModel' | 'extensions' | 'clientMethod' | 'errorFormat'> & {
  extensions?: MergedExtensionsList
}

function createMessage(params: SimplifiedParams) {
  return new JsonProtocolMessage(
    serializeJsonQuery({
      ...params,
      runtimeDataModel: datamodel,
      extensions: params.extensions ?? MergedExtensionsList.empty(),
      clientMethod: 'foo',
      errorFormat: 'colorless',
    }),
  )
}

test('getBatchId for findMany', () => {
  expect(
    createMessage({
      modelName: 'User',
      action: 'findMany',
      args: {
        where: {
          id: '123',
        },
      },
    }).getBatchId(),
  ).toBeUndefined()
})

test('getBatchId for findUnique', () => {
  expect(
    createMessage({
      modelName: 'User',
      action: 'findUnique',
      args: {
        where: {
          id: '123',
        },
      },
    }).getBatchId(),
  ).toMatchInlineSnapshot(`User((where (id)))($composites $scalars)`)
})

test('getBatchId for findUniqueOrThrow', () => {
  expect(
    createMessage({
      modelName: 'User',
      action: 'findUniqueOrThrow',
      args: {
        where: {
          id: '123',
        },
      },
    }).getBatchId(),
  ).toMatchInlineSnapshot(`User((where (id)))($composites $scalars)`)
})
