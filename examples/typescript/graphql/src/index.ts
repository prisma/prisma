import { GraphQLServer } from 'graphql-yoga'
import { join } from 'path'
import { makeSchema, objectType, idArg, stringArg } from '@prisma/nexus'
import Photon from '@generated/photon'
import { Context } from './types'
import { nexusPrismaMethod } from '@generated/nexus-prisma'

const photon = new Photon()

const nexusPrisma = nexusPrismaMethod({
  photon: (ctx: Context) => ctx.photon,
})

export const User = objectType({
  name: 'User',
  definition(t) {
    t.model.id()
    t.model.name()
    t.model.email()
    t.model.posts({
      pagination: false,
    })
  },
})

export const Post = objectType({
  name: 'Post',
  definition(t) {
    t.model.id()
    t.model.title()
    t.model.content()
    // t.model.createdAt()
    // t.model.updatedAt()
    t.model.published()
  },
})

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.crud.findOnePost({
      alias: 'post',
    })

    t.list.field('feed', {
      type: 'Post',
      resolve: (parent, args, ctx) => {
        return ctx.photon.posts.findMany({
          where: { published: true },
        })
      },
    })

    t.list.field('filterPosts', {
      type: 'Post',
      args: {
        searchString: stringArg({ nullable: true }),
      },
      resolve: (parent, { searchString }, ctx) => {
        return ctx.photon.posts.findMany({
          where: {
            OR: [
              {
                title: {
                  contains: searchString,
                },
              },
              {
                content: {
                  contains: searchString,
                },
              },
            ],
          },
        })
      },
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.crud.createOneUser({ alias: 'signupUser' })
    t.crud.deleteOnePost()

    t.field('createDraft', {
      type: 'Post',
      args: {
        title: stringArg(),
        content: stringArg({ nullable: true }),
        authorEmail: stringArg(),
      },
      resolve: (parent, { title, content, authorEmail }, ctx) => {
        return ctx.photon.posts.create({
          data: {
            title,
            content,
            published: false,
            // author: {
            //   connect: { email: authorEmail },
            // },
          },
        })
      },
    })

    t.field('publish', {
      type: 'Post',
      nullable: true,
      args: {
        id: idArg(),
      },
      resolve: (parent, { id }, ctx) => {
        return ctx.photon.posts.update({
          where: { id },
          data: { published: true },
        })
      },
    })
  },
})

const schema = makeSchema({
  types: [Query, Mutation, Post, User, nexusPrisma],
  outputs: {
    typegen: join(__dirname, '../generated/nexus-typegen.ts'),
    schema: join(__dirname, '/schema.graphql'),
  },
  typegenAutoConfig: {
    sources: [
      {
        source: '@generated/photon',
        alias: 'photon',
      },
      {
        source: join(__dirname, 'types.ts'),
        alias: 'ctx',
      },
    ],
    contextType: 'ctx.Context',
  },
})

const server = new GraphQLServer({
  schema,
  context: request => {
    return {
      ...request,
      photon,
    }
  },
})

server
  .start(() => console.log(`🚀 Server ready at http://localhost:4000`))
  .then(httpServer => {
    async function cleanup() {
      httpServer.close()
      await photon.disconnect()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })
