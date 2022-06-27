# `@prisma/engines`

This package is used to download the Prisma Engines, namely the Query Engine, Migration Engine, Introspection Engine and Prisma Format.

Its version Before Prisma 4 had a one to one mapping to the engine hash in its version.
Since Prisma 4 its version follows the `prisma/prisma` monorepo versioning and it uses the `@prisma/engines-version` package to map to the engines hash.

In the `postinstall` hook of this package, all engines available for the current platform are downloaded from the Prisma CDN `https://binaries.prisma.sh`.

You should probably not use this package directly, but instead use one of these:

- [`prisma` CLI](https://www.npmjs.com/package/prisma)
- [`@prisma/client`](https://www.npmjs.com/package/@prisma/client)
