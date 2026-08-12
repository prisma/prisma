# Testing

- Core guide: `docs/Testing Guide.md`
- Language: `.cursor/rules/omit-should-in-tests.mdc`
- Patterns: `.cursor/rules/vitest-expect-typeof.mdc`, `.cursor/rules/test-file-organization.mdc`, `.cursor/rules/test-import-patterns.mdc`

## Test Commands

```bash
pnpm test:packages      # Unit tests for packages only
pnpm test:integration   # Integration tests (pretest builds first)
pnpm test:e2e           # End-to-end tests
pnpm test:all           # All tests (packages + examples + integration + e2e)
pnpm coverage:packages  # Coverage for packages only
```

> Integration tests (`test/integration`) run against each package's built `dist`, not its source. After changing a package's source, rebuild it (e.g. `pnpm --filter <pkg> build`) before running a bare `vitest` filter, or the test will exercise stale output. The full `pnpm test:integration` pretest builds automatically, so this only bites targeted runs.

## CI

CI runs on pull requests via GitHub Actions (`.github/workflows/ci.yml`):

- **typecheck** + **lint**: Run in parallel, no dependencies
- **build**: Compiles all packages
- **test** + **test-e2e**: Run after build, require Postgres service
- **coverage**: Generates coverage reports, uploaded as artifacts

Environment: Node 24.16.0, pnpm 10, Postgres 15. `TEST_TIMEOUT_MULTIPLIER=2` in CI.
