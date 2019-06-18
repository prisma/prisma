const { GraphQLServer } = require('graphql-yoga')

const Photon = require('@generated/photon')
const { resolvers } = require('./resolvers')
const { permissions } = require('./permissions')

const photon = new Photon.default()

const server = new GraphQLServer({
  typeDefs: 'src/schema.graphql',
  resolvers,
  // middlewares: [permissions], TODO: Fix after https://github.com/maticzav/graphql-shield/issues/361
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
      await photon.disconnect()
      httpServer.close()
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })
