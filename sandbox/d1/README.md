# Sandbox for D1 adapter

This is a playground for testing the Prisma Client with the Cloudflare D1 Driver Adapter.

## How to setup

```bash
npm i
npm run execute -- --file=./sql/schema.sql
npm run start

# type b to open the browser
# or run:
open http://localhost:8787/
```

### Remote database
```
npx wrangler d1 execute MY_DATABASE --file=./sql/schema.sql
```
