const PROTO_PATH = __dirname + '/../service.proto'

import * as protoLoader from '@grpc/proto-loader'
import * as grpc from 'grpc'
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})
const { blog } = grpc.loadPackageDefinition(packageDefinition) as any

function main() {
  const client = new blog.Blog(
    'localhost:50051',
    grpc.credentials.createInsecure(),
  )

  client.feed({}, (err: any, response: any) => {
    if (err) {
      console.error(err)
      return
    }
    console.log(response)
  })
}

main()
