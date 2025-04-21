# Instructions

1. Run these commands

```sh
pnpm install
cd packages/db && pnpm exec prisma generate
cd ../service && pnpm exec next build
node .next/standalone/server.js
```

2. Open http://localhost:3000/api/test
