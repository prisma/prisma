# Instructions

1. Run these commands

```sh
pnpm install
cd packages/db && pnpm exec prisma generate
cd ../service && pnpm exec next build
rm -fr .next/standalone/node_modules/next # to workaround https://github.com/vercel/next.js/issues/42651
node .next/standalone/server.js
```

2. Open http://localhost:3000/api/test
3. Broken
4. Uncomment workaround in next.config.js
5. Re-run step 1
6. Works
