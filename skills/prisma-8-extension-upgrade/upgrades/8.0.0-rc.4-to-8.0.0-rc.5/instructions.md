---
from: "8.0.0-rc.4"
to: "8.0.0-rc.5"
changes:
  - id: wrap-pg-constructions-with-suppress-idle-connection-errors
    summary: |
      Wrap every pg `Pool` or `Client` your extension constructs with `suppressIdleConnectionErrors`, newly exported from `@internal/driver-postgres/runtime` (canonical home `@internal/utils/suppress-idle-connection-errors`). node-postgres emits 'error' on the pool or client when an idle connection drops; with no listener Node kills the host process. The helper attaches a no-op listener, is idempotent per emitter, and returns the same instance. Bindings handed to the driver (`pgPool`/`pgClient`/`url`) are wrapped by the driver itself since rc.5, so this applies to pg handles your extension uses outside a driver binding.
    detection:
      glob: "**/*.ts"
      contains:
        - "new Pool("
        - "new Client("
      anyMatch: true
---

# 8.0.0-rc.4 → 8.0.0-rc.5 — Extension author upgrade instructions

## `wrap-pg-constructions-with-suppress-idle-connection-errors`

Walk every file matched by `detection.glob`. For each pg `Pool` or `Client` the extension constructs, wrap the construction:

```ts
import { suppressIdleConnectionErrors } from '@internal/driver-postgres/runtime';

const pool = suppressIdleConnectionErrors(
  new Pool({ connectionString: options.url }),
);
```

This is the same translation applied to the in-repo `@internal/postgres` and `@internal/extension-supabase` runtimes in this transition. The helper only attaches a no-op `'error'` listener (connect/query failures still reject their own promises), so behavior is otherwise unchanged; without it, a dropped idle connection crashes the process that hosts the extension.

If your extension's test suite fakes the `pg` module, the fakes need an `on` method (`on = vi.fn().mockReturnThis()` on a class fake, or `on: vi.fn()` on an object literal) — the runtime now calls `.on('error', ...)` on every pool, client, and checked-out pool client.
