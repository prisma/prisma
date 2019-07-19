# Current limitations

- Does not work on Windows. Tested on Mac and Linux only.
- Processes 1 request at a time, no parallelism during the early preview period.
- Some edge cases for complex nested mutations don't work properly.
- Limited auto-complete in Typescript projects due to a compiler bug.
- No realtime API/subscriptions.
- Models must have an `@id` attribute and it must take one of these forms:
    - `Int @id`
    - `String @id @default(uuid())`
    - `String @id @default(cuid())`
- When [introspecting](./introspection.md) a database, Prisma only recognizes many-to-many relations that follow the Prisma conventions for [relation tables](https://github.com/prisma/prisma2-docs/blob/master/relations.md#mn).
