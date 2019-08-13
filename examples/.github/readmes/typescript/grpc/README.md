# gRPC Server Example

This example shows how to implement a **gRPC API with TypeScript** and [Photon.js](https://photonjs.prisma.io/).

__INLINE(../_setup-1.md)__
cd photonjs/examples/typescript/grpc
__INLINE(../_setup-2.md)__

### 5. Start the gRPC server

```
npm run start
```

The server is now running on `0.0.0.0:50051`. 

### 6. Using the gRPC API

To use the gRPC API, you need a gRPC client. We provide several client scripts inside the [`./client`](./client) directory. Each script is named according to the operation it performs against the gRPC API (e.g. the [`feed.js`](./client/feed.js) script sends the [`Feed`](./service.proto#L7) operation). Each script can be invoked by running the corresponding NPM script defined in [`package.json`](./package.json), e.g. `npm run feed`.

In case you prefer a GUI client, we recommend [BloomRPC](https://github.com/uw-labs/bloomrpc):

![](https://imgur.com/0EiIo03.png)

__INLINE(../_next-steps.md)__