# `react-prisma`

This package allows using the Prisma Client in a React Server Component.
It is a thin wrapper around `@prisma/client`.

⚠️ **Warning**: **This is highly experimental. Don't use this in any real application**
We just publish this early for demonstration purposes.
Its release cycle does not follow SemVer, which means we might release breaking changes (change APIs, remove functionality) without any prior warning.

# This is unstable

We don't guarantee that this works. Any moment the underlying `react` api can change and break this package.

# Known limitations

Right now this package does not support:

- query chaining, like:

```ts
prisma.user.findUnique({ where: { id: 42 } }).posts()
```

- mutations, only `findMany`, `findFirst`, `findOne`, `findUnique`, `count` operations are allowed.
