# Non-ported — legacy-execute-raw

- `packages/client/tests/functional/0-legacy-ports/execute-raw/tests.ts` › `update via executeRawUnsafe` — `$executeRawUnsafe` UPDATE returns affected count — update-with-where IS expressible via the builder; only the affected-row COUNT is not returned by `updateAll()`
- `packages/client/tests/functional/0-legacy-ports/execute-raw/tests.ts` › `update via queryRawUnsafe with values` — `$executeRawUnsafe` with positional params returns affected count — update-with-where IS expressible via the builder; only the affected-row COUNT is not returned
- `packages/client/tests/functional/0-legacy-ports/execute-raw/tests.ts` › `update via executeRaw` — tagged-template `$executeRaw` UPDATE returns affected count — update-with-where IS expressible via the builder; only the affected-row COUNT is not returned
- `packages/client/tests/functional/0-legacy-ports/execute-raw/tests.ts` › `update via executeRaw using Prisma.join` — `$executeRaw` with `Prisma.join` in IN clause — update-with-where IS expressible via the builder; only the affected-row COUNT is not returned
- `packages/client/tests/functional/0-legacy-ports/execute-raw/tests.ts` › `update via executeRaw using Prisma.join and Prisma.sql` — `$executeRaw(Prisma.sql\`...\`)` with `Prisma.join` — update-with-where IS expressible via the builder; only the affected-row COUNT is not returned
