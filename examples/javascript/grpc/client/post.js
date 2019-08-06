const PROTO_PATH = __dirname + '/../service.proto'

const grpc = require('grpc')
const protoLoader = require('@grpc/proto-loader')
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
const blog = grpc.loadPackageDefinition(packageDefinition).blog

function main() {
  const client = new blog.Blog(
    'localhost:50051',
    grpc.credentials.createInsecure(),
  )

  const id = ''
  client.post({ id }, (err, response) => {
    if (err) {
      console.error(err)
      return
    }
    console.log(response)
  })
}

main()