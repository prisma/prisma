# `@prisma/engines`

This package ships the Prisma Engines, namely the Query Engine, Migration Engine, Introspection Engine and Prisma Format.
It has a one to one mapping to the engine releases in its version.
In the postinall hook of this package, all engines available for the current platform are downloaded from the Prisma CDN.

You should probably not use this package directly, but instead use one of these:

- [`prisma` CLI](https://www.npmjs.com/package/prisma)
- [`@prisma/client`](https://www.npmjs.com/package/@prisma/client)
