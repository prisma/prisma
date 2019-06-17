const { GraphQLServer } = require('graphql-yoga')
const Photon = require('@generated/photon')
const photon = new Photon.default()

const resolvers = {
  Query: {
    feed: (parent, args, context) => {
      return context.photon.posts.findMany({ where: { published: true } })
    },
    filterPosts: (parent, { searchString }, context) => {
      return context.photon.posts.findMany({
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
    post: (parent, { id }, context) => {
      return context.photon.posts.findOne({
        where: {
          id,
        },
      })
    },
  },
  Mutation: {
    signupUser: (parent, { email, name }, context) => {
      return context.photon.users.create({
        data: {
          email,
          name,
        },
      })
    },
    createDraft: (parent, { title, content, authorEmail }, context) => {
      return context.photon.posts.create({
        data: {
          title,
          content,
          published: false,
          author: { connect: { email: authorEmail } },
        },
      })
    },
    publish: (parent, { id }, context) => {
      return context.photon.posts.update({
        where: { id },
        data: { published: true },
      })
    },
    deletePost: (parent, { id }, context) => {
      return context.photon.posts.delete({
        where: {
          id,
        },
      })
    },
  },
  Post: {
    author: ({ id }, args, context) => {
      return context.photon.posts
        .findOne({
          where: {
            id,
          },
        })
        .author()
    },
  },
  User: {
    posts: ({ id }, args, context) => {
      return context.photon.users
        .findOne({
          where: {
            id,
          },
        })
        .posts()
    },
  },
}

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: {
    photon,
  },
})

server
  .start(() => console.log(`🚀 Server ready at http://localhost:4000`))
  .then(httpServer => {
    async function cleanup() {
      await photon.disconnect()
      httpServer.close()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })
