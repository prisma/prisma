Run Tests:

```
cd packages/client

# Driver Adapters pg only
pnpm run test:functional:code --adapter js_pg --preview-features driverAdapters /logging/tests.ts
pnpm run test:functional:code --adapter js_pg --preview-features driverAdapters /node-engine/test.ts

# Native driver only
pnpm run test:functional:code --provider postgresql --preview-features driverAdapters issues/11974/tests.ts
```

Build in background:

```
pnpm run watch
```
