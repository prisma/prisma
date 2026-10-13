# Deferred work: runtime activity tree

Gaps found while building the project that are outside its scope. Each existed before the project started.

- **Stream in-flight tracking ends before the statement's hooks.** `SqlRuntimeBase` ends a query's in-flight record when the driver answers (`onDriverAnswered`), before `activityEnded` and `activityFinalized` run. A `close()` with `closeRefusal: 'when-idle'` can therefore close the driver while those hooks run. On main the same held for `afterQuery`.
- **A dropped iterator never ends its statement.** A caller that reads the first row and drops the iterator without calling `return()` leaves the statement open: no `activityEnded`, and outside a transaction no `activityFinalized`.
- **`intercept.onQuery` and `intercept.onExecute` are not raced against the abort signal**, unlike `beforeEncode`.
- **Runtime logs are invisible through the client facades.** `postgres()`, `sqlite()` and `supabase()` take no `log` option, so the runtime's `ctx.log` events, including the `runtime.close.waiting-for-activities` warning for a handle never ended and `runtime.connection.release.error`, reach no logger an application can see. #30707 (TML-2682) adds the option; after it merges, the facade READMEs name these events.
