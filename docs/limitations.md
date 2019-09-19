# Current limitations

During the preview phase of Prisma 2 there are missing features, limited performance and stability issues you should be aware of:

## Functionality limitations

- `Embed` types are not implemented yet ([tracking issue](https://github.com/prisma/lift/issues/43))
- Many other types are not fully implemented yet
- Models must have an `@id` attribute and it must take one of these forms:
    - `Int @id`
    - `String @id @default(uuid())`
    - `String @id @default(cuid())`  
    TODO What is our plan on that?
- When [introspecting](./introspection.md) a database, Prisma only recognizes many-to-many relations that follow the Prisma conventions for [relation tables](https://github.com/prisma/prisma2/blob/master/docs/relations.md#mn). TODO What is our plan on that?
- Some edge cases for complex nested mutations don't work properly. TODO What edge cases? Issues? Plan?
- Non-interactive TTYs (like Git Bash on Windows) are currently not supported by Prisma2 CLI ([tracking issues](https://github.com/prisma/prisma2/issues/554))

## Stability limitations

- Limited auto-complete in Typescript projects due to a compiler bug. ([tracking issue](https://github.com/microsoft/TypeScript/issues/30507) over at `TypeScript`, and the [PR we raised that fixes that](https://github.com/microsoft/TypeScript/pull/32100) and waits to get merged.)

## Performance limitations

- Prisma currently processes only 1 request at a time, there is no parallelism during the early preview period. ([This will be fixed before GA, follow along in this issue](https://github.com/prisma/prisma2/issues/420))

## Out of scope functionality

The following functionality is currently not part of Prisma and will not be added before GA:

- Realtime API or subscriptions. (In the future (after GA), Prisma will have an events engine that might enable this feature, but there is no ETA for this yet.) TODO (spec) issue people can +1 and subscribe to
- Go client (Photon Go) ([tracking issue](https://github.com/prisma/prisma2/issues/571))
