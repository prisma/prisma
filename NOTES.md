# Commands

## Run Tests

```
cd packages/client

# Driver Adapters pg only
pnpm run test:functional:code --adapter js_pg --preview-features driverAdapters /logging/tests.ts
pnpm run test:functional:code --adapter js_pg --preview-features driverAdapters /node-engine/test.ts

# Native driver only
pnpm run test:functional:code --provider postgresql --preview-features driverAdapters issues/11974/tests.ts
```

## Build in background

```
pnpm run watch
```

# Windows

1. Postgres: `cd docker` + `docker compose up postgres -d`
2. Watch: `pnpm run watch`
3. Sandbox: `cd sandbox/node-engine` + `pnpm start`
4. Test: `cd packages/client` + `pnpm run test:functional:code --adapter js_pg --preview-features driverAdapters /node-engine/test.ts`
