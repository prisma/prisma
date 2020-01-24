# Current limitations

During the Preview period of Prisma 2 there are missing features and other limitations you should be aware of.

## Functionality limitations

- Embedded types are not implemented yet ([tracking issue](https://github.com/prisma/migrate/issues/43)).
- Many other types are not fully implemented yet (e.g. `citext` or `varchar(n)` for PostgreSQL).
- Models must have an `@id` attribute and it must take one of these forms:
    - `Int  @id  @default(autoincrement())`
    - `String  @id  @default(uuid())`
    - `String  @id  @default(cuid())`  
- When [introspecting](./introspection.md) a database, Prisma for now only recognizes many-to-many relations that follow the Prisma conventions for [relation tables](https://github.com/prisma/prisma2/blob/master/docs/relations.md#mn).
- Non-interactive terminals (like Git Bash on Windows) are currently not supported by Prisma2 CLI ([tracking issues](https://github.com/prisma/prisma2/issues/554)).

## Out of scope functionality

The following functionality is currently not part of Prisma and will most probably not be added before GA:

- Realtime API or subscriptions (In the future (after GA), Prisma will have an events engine that might enable this feature, but there is no ETA for this yet) ([tracking issue](https://github.com/prisma/prisma2/issues/298)).
- Go client ("Prisma Client Go") ([tracking issue](https://github.com/prisma/prisma2/issues/571)).
- Using Prisma tools (e.g. Prisma Client JS or Migrate) in combination with a Prisma server/cluster ([tracking issue](https://github.com/prisma/prisma2/issues/370)).
