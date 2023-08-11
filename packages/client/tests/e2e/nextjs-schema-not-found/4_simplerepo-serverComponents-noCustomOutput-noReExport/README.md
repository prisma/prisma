# Instructions

1. Run these commands

```sh
pnpm install
pnpm exec prisma generate
pnpm exec next build
rm -fr .next/standalone/node_modules/next # to workaround https://github.com/vercel/next.js/issues/42651
node .next/standalone/server.js
```

2. Open http://localhost:3000/test/42
3. Works
