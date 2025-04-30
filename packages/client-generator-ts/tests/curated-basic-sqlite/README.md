# curated-basic-sqlite

This package contains two main directories:

- `original`: This includes the raw output of `schema.prisma` (copied from the [basic-sqlite sandbox](../../../../sandbox/basic-sqlite/package.json)) from `client-generator-ts`.

- `curated`: This includes the same types, a subset of which have been manually optimized by @ssalbdivad to demonstrate ideal output in terms of type performance. I've also included some correctness-related recommendations.

In addition to mirroring these recommendations as closely as possible, as mentioned elsewhere, **ideal `client-generator-ts` output should include `.js` and `.d.ts` files rather than raw `.ts`.**

Unfortunately, when resolving `.ts` files, there is no way to avoid checking them as if they were your own source.

## Recommendations

### 1. Structural Deduplication

Defining common structures with DRY interfaces can drastically reduce file size, reduce parse time and improve cachability and check speed. These benefits far exceed the cost of interface extension, which is extremely efficient in TS.

[`commonInputTypes`](./curated/commonInputTypes.ts) has been fully translated to the recommended representation and saw the following improvements without any semantic changes:

# Performance Comparison

| Metric             | Before (Original) | After (Curated) | Improvement |
| ------------------ | ----------------- | --------------- | ----------- |
| Lines of Code      | 339               | 82              | 76%         |
| `createSourceFile` | 796us             | 246us           | 69%         |
| `bindSourceFile`   | 607us             | 164us           | 73%         |
| `checkSourceFile`  | 4064us            | 2218us          | 45%         |

These metrics can be found by running `pnpm attest trace` from this directory.

Among other type-perf analytics, it will output a file at `.attest/trace/trace.json`. This file can be uploaded to a trace viewer like the one at https://ui.perfetto.dev, which allows searching for individual files and drilling down on comparison metrics.

Structural duplication in individual model files like [`curated/models/User.ts`](./curated/models/User.ts) can be addressed in the same way, and should result in a 50%+ improvement in overall type performance.

### 2. Prefer homomorphic mapped types

Types like the following:

```ts
export type GetUserAggregateType<T extends UserAggregateArgs> = {
  [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
    ? T[P] extends true
      ? number
      : Prisma.GetScalarType<T[P], AggregateUser[P]>
    : Prisma.GetScalarType<T[P], AggregateUser[P]>
}
```

Are logically correct and totally reasonable, but aren't [homomorphic](https://andreasimonecosta.dev/posts/what-the-heck-is-a-homomorphic-mapped-type/), which means they lose access to internal performance and DX optimizations including modifier preservation (optional keys), JSDoc preservation, and go-to-definition support.

Generally, homomorphic mapped types have a signature of the form `K in keyof T` with a suffix like ` as K extends SomeCondition ? K : never` if needed to filter keys:

```ts
export type GetUserAggregateType<T extends UserAggregateArgs> = {
  [P in keyof T as P extends keyof AggregateUser ? P : never]: P extends '_count' | 'count'
    ? T[P] extends true
      ? number
      : Prisma.GetScalarType<T[P], AggregateUser[P & keyof AggregateUser]>
    : Prisma.GetScalarType<T[P], AggregateUser[P & keyof AggregateUser]>
}
```

### 3. Use `readonly` for base array type

Array mutability is a big footgun in TS because it means `readonly string[]` will not extend `any[]`.

Types like the following that are meant to accept any array should be modified to accept `readonly` variants of the arrays they handle to avoid bad inference behavior:

```ts
// Warning: when passed `readonly [1]`, this will return `readonly [1]` instead of `1` because `any[]` was not specified as `readonly`.
export type MaybeTupleToUnion<T> = T extends any[] ? T[number] : T

// Solution: Update this and similar expressions to:
export type MaybeTupleToUnion<T> = T extends readonly any[] ? T[number] : T
```

### 4. Remove unnecessary and/or convoluted abstractions

Types like `MaybeTupleToUnion` from 3 as well as many types in `prismaNamespace.ts` are very specialized and should not be abstracted at such a broad level.

Many of them like `Record` actually mirror built-in types directly, adding extra parse overhead and confusion in cases where the behavior is subtly different.

This file and these kind of generic utilities should be broadly simplified and cleaned up, with most being removed unless the generic can be defined in a way that is easy to name, explain and reuse.

### 5. Improving function input validation patterns

Parameter chains like those defined in `groupBy` can be inefficient, fragile and difficult to read.

This recommendation was discussed in person during the team's second perf optimization session. Though mostly beyond the scope of this README in terms of complexity, a validated input approach like the following should be preferred to limit the number of mapped types and clarify logic:

```ts
groupBy<arg>(validateGroupBy<arg>): inferGroupBy<arg>
```

A full example of this approach can be found in [ArkType's input validation types](https://github.com/arktypeio/arktype/blob/049bc4dcede23a620cd0fc43176ce7b5aaaf2f48/ark/type/type.ts#L62). This strategy is very flexible and can be adapted to give precise feedback for arbitrary inputs.

### 6. Type testing with `@ark/attest`

This is not a direct recommendation for the output of `client-generator-ts`, but considering the complexity of these types as well as those I encountered through Prisma's repo, I would highly recommend supplementing the benchmarks I added in my last PR by starting to add `attest` type assertions to your functional unit tests.

Once the team has the tools and gets in the habit of thinking about both runtime and type-level behavior for each test case they write, many of these problems will be solved before they're shipped and reported in the first place.

attest assertions can be made directly from existing unit tests with `jest` or `vitest` alongside runtime assertions. Type checking can be toggled off via `--skipTypes` to facilitate fast iteration on runtime assertions, e.g. when running in watch mode. Full docs can be found here:

https://github.com/arktypeio/arktype/tree/main/ark/attest#readme
