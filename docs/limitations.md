# Current limitations

During the preview phase of Prisma 2 there are missing features, limited performance and stability issues you should be aware of:

## Functionality limitations
 
- Prisma does not yet work on Windows and is tested on Mac and Linux only. ([Track our progress on supporting Windows](https://github.com/prisma/prisma2/issues/4))
- Models must have an `@id` attribute and it must take one of these forms:
    - `Int @id`
    - `String @id @default(uuid())`
    - `String @id @default(cuid())`
    TODO What is our plan on that?
- When [introspecting](./introspection.md) a database, Prisma only recognizes many-to-many relations that follow the Prisma conventions for [relation tables](https://github.com/prisma/prisma2/blob/master/docs/relations.md#mn). TODO What is our plan on that?
- Some edge cases for complex nested mutations don't work properly. TODO What edge cases? Issues? Plan?

## Stability limitations

- Limited auto-complete in Typescript projects due to a compiler bug. ([We raised a PR to `TypeScript` that fixes that](https://github.com/microsoft/TypeScript/pull/32100))

## Performance limitations

- Prisma currently processes only 1 request at a time, there is no parallelism during the early preview period. ([This will be fixed before GA, follow along in this issue](https://github.com/prisma/prisma2/issues/420))

## Out of scope functionality

- Realtime API or subscriptions. (In the future (after GA), Prisma will have an events engine that might enable this feature, but there is no ETA for this yet.) TODO (spec) issue people can +1 and subscribe to
