# Non-ported — tracing-disabled

- `packages/client/tests/functional/tracing-disabled/tests.ts` › `should perform a query and assert that no spans were generated` — with PrismaInstrumentation not registered, user.findMany produces 0 finished spans [providers: all] — prisma-next has no public OpenTelemetry instrumentation registration surface or Prisma span emitter; merely running a query and observing zero unrelated spans would not exercise the subject
