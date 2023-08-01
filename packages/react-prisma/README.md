# `react-prisma`

⚠️ **Warning**: **This package is now deprecated.**

When `react-prisma` package was introduced, it made it easier to use React Server Components.
This approach is not needed anymore, thanks to all the changes that the React Team made in React Server Components since.

Note: As of today (August 1st, 2021), RSC are:

- only available in Next.js framework (the App Router must be used).
- coming soon to Redwood.js framework.

## Resources on how to use RSC today

- RSC demo repository from the React Team https://github.com/reactjs/server-components-demo
- Example from CoderOne using Prisma in RSC (video + repository)
  - https://github.com/ipenywis/nextjs-rsc
  - https://www.youtube.com/watch?v=V9Y3PurNA4c

## Legacy README

This package allows using Prisma Client in a React Server Component.
It is a thin wrapper around `@prisma/client`.

⚠️ **Warning**: **This is highly experimental. Don't use this in any real application**
We just publish this early for demonstration purposes.
Its release cycle does not follow SemVer, which means we might release breaking changes (change APIs, remove functionality) without any prior warning.

### This is unstable

We don't guarantee that this works. Any moment the underlying `react` api can change and break this package.

### Known limitations

Right now this package does not support:

- query chaining, like:

```ts
prisma.user.findUnique({ where: { id: 42 } }).posts()
```

- mutations, only `findMany`, `findFirst`, `findOne`, `findUnique`, `count` operations are allowed.
