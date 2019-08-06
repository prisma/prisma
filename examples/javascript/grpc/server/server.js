const chalk = require('chalk')
const PROTO_PATH = __dirname + '/../service.proto'

const Photon = require('@generated/photon')
const photon = new Photon()

const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
const { blog } = grpc.loadPackageDefinition(packageDefinition)

async function post(call, callback) {
  const { id } = call.request
  const post = await photon.posts.findOne({
    where: {
      id,
    },
  })
  callback(null, post)
}

async function feed(call, callback) {
  const feed = await photon.posts.findMany({
    where: { published: true },
  })
  callback(null, { feed })
}

async function filterPosts(call, callback) {
  const { searchString } = call.request
  const filteredPosts = await photon.posts.findMany({
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
  callback(null, { filteredPosts })
}

async function signupUser(call, callback) {
  const { email, name } = call.request
  try {
    const newUser = await photon.users.create({
      where: {
        name,
        email,
      },
    })
    callback(null, newUser)
  } catch (e) {
    callback(e, null)
  }
}

async function createDraft(call, callback) {
  const { title, content, authorEmail } = call.request
  try {
    const newDraft = await photon.posts.create({
      data: {
        title,
        content,
        published: false,
        // author: { connect: { email: authorEmail } },
      },
    })
    callback(null, newDraft)
  } catch (e) {
    callback(e, null)
  }
}

async function deletePost(call, callback) {
  const { id } = call.request
  try {
    const deletedPost = await prisma.deletePost({
      where: {
        id,
      },
    })
    callback(null, deletedPost)
  } catch (e) {
    callback(e, null)
  }
}

async function publish(call, callback) {
  const { id } = call.request
  try {
    const publishedPost = await photon.posts.update({
      where: { id },
      data: { published: true },
    })
    callback(null, publishedPost)
  } catch (e) {
    callback(e, null)
  }
}

const server = new grpc.Server()
server.addService(blog.Blog.service, {
  feed,
  post,
  filterPosts,
  signupUser,
  createDraft,
  publish,
  deletePost,
})
server.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure())
const message = `
The gRPC server is being started on ${chalk.bold(
  `0.0.0.0:50051`,
)}. You now can invoke any client script by its name, e.g.:

${chalk.bold(`$ npm run feed`)}
or
${chalk.bold(`$ npm run signupUser`)}

See ${chalk.bold(
  `package.json`,
)} for a list of all available scripts or use ${chalk.bold(
  `BloomRPC`,
)} if you prefer a GUI client (download: ${chalk.bold(
  `https://github.com/uw-labs/bloomrpc`,
)}).
`
console.log(message)
server.start()
