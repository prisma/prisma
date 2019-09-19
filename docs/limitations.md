# Current limitations

1. Does not work on Windows. Tested on Mac and Linux only. Tracking issue: https://github.com/prisma/prisma2/issues/4
2. Processes 1 request at a time, no parallelism during the early preview period. This will be fixed before GA. 
3. Some edge cases for complex nested mutations don't work properly. 
4. Limited auto-complete in Typescript projects due to a compiler bug. We raised a PR to fix that [here](https://github.com/microsoft/TypeScript/pull/32100). 
5. No realtime API/subscriptions. In the future, we will have Prisma events engine (after the GA) that would pave way for such a feature, there is no ETA for this yet. 
6. Models must have an `@id` attribute and it must take one of these forms:
    - `Int @id`
    - `String @id @default(uuid())`
    - `String @id @default(cuid())`
7. When [introspecting](./introspection.md) a database, Prisma only recognizes many-to-many relations that follow the Prisma conventions for [relation tables](https://github.com/prisma/prisma2/blob/master/docs/relations.md#mn).
