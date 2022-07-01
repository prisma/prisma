# `@prisma/engines`

This package ships the Prisma Engines, namely the Query Engine, Migration Engine, Introspection Engine and Prisma Format.
The postinstall hook of this package downloads all engines available for the current platform are from the Prisma CDN.
The engines to be downloaded are directly determined by the version of its `@prisma/engines-version` dependency.

You should probably not use this package directly, but instead use one of these:

- [`prisma` CLI](https://www.npmjs.com/package/prisma)
- [`@prisma/client`](https://www.npmjs.com/package/@prisma/client)
