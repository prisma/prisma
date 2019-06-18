import chalk from 'chalk'
const PROTO_PATH = __dirname + '/../service.proto'

import Photon from '@generated/photon'
import * as grpc from 'grpc'
import * as protoLoader from '@grpc/proto-loader'

const photon = new Photon()

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
const { blog } = grpc.loadPackageDefinition(packageDefinition) as any

async function post(call: any, callback: any) {
  const { id } = call.request
  const post = await photon.posts.findOne({
    where: {
      id,
    },
  })
  callback(null, post)
}

async function feed(call: any, callback: any) {
  const feed = await photon.posts.findMany({
    where: { published: true },
  })
  callback(null, { feed })
}

async function filterPosts(call: any, callback: any) {
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

async function signupUser(call: any, callback: any) {
  const { email, name, password } = call.request
  try {
    const newUser = await photon.users.create({
      data: {
        name,
        email,
        password,
      },
    })
    callback(null, newUser)
  } catch (e) {
    callback(e, null)
  }
}

async function createDraft(call: any, callback: any) {
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

async function deletePost(call: any, callback: any) {
  const { id } = call.request
  try {
    const deletedPost = await photon.posts.delete({
      where: {
        id,
      },
    })
    callback(null, deletedPost)
  } catch (e) {
    callback(e, null)
  }
}

async function publish(call: any, callback: any) {
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
