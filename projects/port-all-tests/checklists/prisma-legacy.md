# Checklist — prisma/prisma legacy integration suites (secondary)

Source: prisma/prisma@a6d01554528e016bea1467a072776b0e2b94dcba — packages/integration-tests/, packages/client/src/__tests__/integration/

Scope: SECONDARY. These two suites are marked secondary in `inventory.md` — cases whose behavior is identically covered by a ported functional test are marked `covered-by <target>` instead of being re-ported; only cases with no functional-suite equivalent are ported. Every source test is still enumerated below.

Protocol: each line is one source test. `[ ]` = not yet dispositioned. The Opus reviewer sub-agent checks `[x]` ONLY when satisfied that the test is (a) faithfully ported and passing, (b) faithfully ported as `test.fails` with a `failing.md` entry, (c) covered by a justified individual `non-ported.md` entry, or (d) marked `covered-by` an already-ported functional test. Implementer sub-agents never check boxes.

## packages/integration-tests

### packages/integration-tests/src/__tests__/integration/postgresql/introspection.test.ts

- [ ] `findUnique where PK` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where PK with select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where PK with include` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `create with data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `create with empty data and SQL default` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `create with empty data and serial` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: postgresql]
- [ ] `update where with numeric data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where with boolean data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where with boolean data and select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where with string data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `updateMany where with string data - check returned count` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `updateMany where with string data - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `delete where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany - email text` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany - email varchar(50) not null unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where unique with foreign key and unpack` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where contains and boolean` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where OR[contains, contains] ` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `upsert (update)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `upsert (create)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany orderBy asc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany orderBy desc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany - default enum` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `create with data - not null enum` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: postgresql]
- [ ] `update with data - not null enum` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `updateMany with data - not null enum - check count` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update with data - not null enum - check findMany` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `deleteMany where enum - check count` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `deleteMany where enum - check findMany` — introspects the scenario's schema (tables: type:posts_status,posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where contains` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where startsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where endsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where in[string]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where in[]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: postgresql]
- [ ] `findMany where datetime lte - check instanceof Date` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where timestamp gte than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where timestamp gt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where timestamp lt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where integer data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime exact` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime gt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime gte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime lt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime lte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where datetime not` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where empty in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where id empty in[] and token in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where in[integer]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where empty notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: teams,users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: postgresql]
- [ ] `findMany where - case insensitive field` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where decimal - default value` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `create bigint data` — introspects the scenario's schema (tables: migrate) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `update where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `upsert where composite PK - update` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `upsert where composite PK - create` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `delete where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where unique composite` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where unique composite (PK is a composite)` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique where composite PK with foreign key` — introspects the scenario's schema (tables: a,b) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique - list all possible datatypes` — introspects the scenario's schema (tables: crazy) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: postgresql]
- [ ] `updateMany where null - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findMany on column_name_that_becomes_empty_string` — introspects the scenario's schema (tables: type:invalid_enum) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique - check typeof js object is object for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique - check typeof Date is string for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]
- [ ] `findUnique - check typeof array for Json field with array` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: postgresql]

### packages/integration-tests/src/__tests__/integration/postgresql/runtime.test.ts

- [ ] `findUnique where PK` — executes `client.teams.findUnique({ where: { id: 2 } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where PK with select` — executes `client.teams.findUnique({ where: { id: 2 }, select: { name: true }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where PK with include` — executes `client.users.findUnique({ where: { id: 1 }, include: { posts: true }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `create with data` — executes `client.teams.create({ data: { name: 'c' } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `create with empty data and SQL default` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `create with empty data and serial` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [todo: skipped in source] [providers: postgresql]
- [ ] `update where with numeric data` — executes `client.teams.update({ where: { id: 1 }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where with boolean data` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where with boolean data and select` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where with string data` — executes `client.teams.update({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `updateMany where with string data - check returned count` — executes `client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `updateMany where with string data - check findMany` — executes `await client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where unique` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where composite unique` — executes `client.users.findUnique({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where composite unique` — executes `client.users.update({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, data: { name: 'Marco' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `delete where composite unique` — executes `client.users.delete({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany - email text` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where unique` — executes `client.users.findMany({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany - email varchar(50) not null unique` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where unique with foreign key and unpack` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } }).posts()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where contains and boolean` — executes `client.posts.findMany({ where: { title: { contains: 'A' }, published: true, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where OR[contains, contains] ` — executes `client.posts.findMany({ where: { OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }], published: true, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `upsert (update)` — executes `client.posts.upsert({ where: { id: 1 }, create: { title: 'D', published: true }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `upsert (create)` — executes `client.posts.upsert({ where: { id: 4 }, create: { title: 'D', published: false }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany orderBy asc` — executes `client.posts.findMany({ orderBy: { title: 'asc', }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany orderBy desc` — executes `client.posts.findMany({ orderBy: { title: 'desc', }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany - default enum` — executes `client.posts.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `create with data - not null enum` — executes `client.posts.create({ data: { title: 'D' } })` and asserts the result equals the expected value [todo: skipped in source] [providers: postgresql]
- [ ] `update with data - not null enum` — executes `client.posts.update({ where: { id: 1 }, data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `updateMany with data - not null enum - check count` — executes `client.posts.updateMany({ data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update with data - not null enum - check findMany` — executes `await client.posts.updateMany({ data: { published: 'PUBLISHED' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `deleteMany where enum - check count` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `deleteMany where enum - check findMany` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where contains` — executes `client.crons.findMany({ where: { job: { contains: 'j2' } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where startsWith` — executes `client.crons.findMany({ where: { job: { startsWith: 'j2' } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where endsWith` — executes `client.crons.findMany({ where: { job: { endsWith: '1' } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where in[string]` — executes `client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where in[]` — executes `client.crons.findUnique({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [todo: skipped in source] [providers: postgresql]
- [ ] `findMany where datetime lte - check instanceof Date` — executes `const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where timestamp gte than now` — executes `client.posts.findMany({ where: { created_at: { gte: new Date() } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where timestamp gt than now` — executes `client.posts.findMany({ where: { created_at: { gt: new Date() } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where timestamp lt than now` — executes `const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where integer data` — executes `client.teams.update({ where: { token: 11 }, data: { token: 10 }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime exact` — executes `client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime gt` — executes `client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime gte` — executes `client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime lt` — executes `client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime lte` — executes `client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where datetime not` — executes `client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where null` — executes `client.events.findMany({ where: { time: null } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where empty in[]` — executes `client.teams.findMany({ where: { id: { in: [] } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where id empty in[] and token in[]` — executes `client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where in[integer]` — executes `client.teams.findMany({ where: { token: { in: [11, 22] } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [11, 22] } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where empty notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [] } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where null` — executes `client.users.findMany({ where: { team_id: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: postgresql]
- [ ] `findMany where - case insensitive field` — executes `expect: [ { email: 'max@prisma.io', id: 1, }, ], },` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany where decimal` — executes `{ name: 'findMany where decimal', up: ' create table exercises ( id serial primary key not null, distance decimal(5, 3) not null ); insert into exercises (distance) values (12.213); ', client.exercises.findMany({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where decimal` — executes `client.exercises.findUnique({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where decimal - default value` — executes `client.exercises.findUnique({ where: { distance: 12.3 } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `create bigint data` — executes `client.migrate.create({ data: { version: 1 } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where composite PK` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `update where composite PK` — executes `client.variables.update({ where: { name_key: { key: 'b', name: 'a' } }, data: { email: 'e' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `upsert where composite PK - update` — executes `client.variables.upsert({ where: { name_key: { key: 'b', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `upsert where composite PK - create` — executes `client.variables.upsert({ where: { name_key: { key: 'd', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `delete where composite PK` — executes `client.variables.delete({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where unique composite` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where unique composite (PK is a composite)` — executes `client.variables.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique where composite PK with foreign key` — executes `client.a.findUnique({ where: { one_two: { one: 1, two: 2 } } })` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique - list all possible datatypes` — executes `client.crazy.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: postgresql]
- [ ] `updateMany where null - check findMany` — executes `await client.teams.updateMany({ data: { name: 'b' }, where: { name: null }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findMany on column_name_that_becomes_empty_string` — executes `await client.column_name_that_becomes_empty_string.findMany({})` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique - check typeof js object is object for Json field` — executes `await client.posts.create({ data: { title: 'A', data: { somekey: 'somevalue', somekeyarray: ['somevalueinsidearray'], }, }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('object') }) posts` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique - check typeof Date is string for Json field` — executes `await client.posts.create({ data: { title: 'B', data: new Date('2020-01-01'), }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('string') }) posts` and asserts the result equals the expected value [providers: postgresql]
- [ ] `findUnique - check typeof array for Json field with array` — executes `await client.posts.create({ data: { title: 'Hello', data: ['some', 'array', 1, 2, 3, { object: 'value' }], }, }) const post = await client.posts.findUnique({ where: { id: 1 }, }) post` and asserts the result equals the expected value [providers: postgresql]

### packages/integration-tests/src/__tests__/integration/sqlite/introspection.test.ts

- [ ] `findUnique where PK` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where PK with select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where PK with include` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `create with data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `create with empty data and SQL default` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `create with empty data and serial` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `update where with numeric data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `update where with boolean data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `update where with boolean data and select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `update where with string data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `updateMany where with string data - check returned count` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `updateMany where with string data - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `update where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `delete where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `findMany - email text` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany - email varchar(50) not null unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where unique with foreign key and unpack` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where contains and boolean` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where OR[contains, contains] ` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `upsert (update)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `upsert (create)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany orderBy asc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany orderBy desc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where contains` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where startsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where endsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where in[string]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where in[]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where datetime lte - check instanceof Date` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where timestamp gte than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where timestamp gt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where timestamp lt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `update where integer data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime exact` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime gt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime gte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime lt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime lte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where datetime not` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where null` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where empty in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where id empty in[] and token in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where in[integer]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where empty notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where null` — introspects the scenario's schema (tables: teams,users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where - case insensitive field` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where decimal - default value` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `create bigint data` — introspects the scenario's schema (tables: migrate) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `update where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `upsert where composite PK - update` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `upsert where composite PK - create` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `delete where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where unique composite` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where unique composite (PK is a composite)` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique where composite PK with foreign key` — introspects the scenario's schema (tables: a,b) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findUnique - list all possible datatypes` — introspects the scenario's schema (tables: crazy) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: sqlite]
- [ ] `updateMany where null - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: sqlite]
- [ ] `findMany on column_name_that_becomes_empty_string` — introspects the scenario's schema (tables: n/a) and snapshots the generated datamodel + warnings [providers: sqlite]

### packages/integration-tests/src/__tests__/integration/sqlite/runtime.test.ts

- [ ] `findUnique where PK` — executes `client.teams.findUnique({ where: { id: 2 } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where PK with select` — executes `client.teams.findUnique({ where: { id: 2 }, select: { name: true }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where PK with include` — executes `client.users.findUnique({ where: { id: 1 }, include: { posts: true }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `create with data` — executes `client.teams.create({ data: { name: 'c' } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `create with empty data and SQL default` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `create with empty data and serial` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `update where with numeric data` — executes `client.teams.update({ where: { id: 1 }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `update where with boolean data` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `update where with boolean data and select` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `update where with string data` — executes `client.teams.update({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `updateMany where with string data - check returned count` — executes `client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `updateMany where with string data - check findMany` — executes `await client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where unique` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where composite unique` — executes `client.users.findUnique({ where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `update where composite unique` — executes `client.users.update({ where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' }, }, data: { name: 'Marco' }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `delete where composite unique` — executes `client.users.delete({ where: { users_email_name_key: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `findMany - email text` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where unique` — executes `client.users.findMany({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany - email varchar(50) not null unique` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where unique with foreign key and unpack` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } }).posts()` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where contains and boolean` — executes `client.posts.findMany({ where: { title: { contains: 'A' }, published: true, }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where OR[contains, contains] ` — executes `client.posts.findMany({ where: { OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }], published: true, }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `upsert (update)` — executes `client.posts.upsert({ where: { id: 1 }, create: { title: 'D', published: true }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `upsert (create)` — executes `client.posts.upsert({ where: { id: 4 }, create: { title: 'D', published: false }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany orderBy asc` — executes `client.posts.findMany({ orderBy: { title: 'asc', }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany orderBy desc` — executes `client.posts.findMany({ orderBy: { title: 'desc', }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where contains` — executes `client.crons.findMany({ where: { job: { contains: 'j2' } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where startsWith` — executes `client.crons.findMany({ where: { job: { startsWith: 'j2' } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where endsWith` — executes `client.crons.findMany({ where: { job: { endsWith: '1' } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where in[string]` — executes `client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where in[]` — executes `client.crons.findUnique({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where datetime lte - check instanceof Date` — executes `const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where timestamp gte than now` — executes `client.posts.findMany({ where: { created_at: { gte: new Date() } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where timestamp gt than now` — executes `client.posts.findMany({ where: { created_at: { gt: new Date() } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where timestamp lt than now` — executes `const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: sqlite]
- [ ] `update where integer data` — executes `client.teams.update({ where: { token: 11 }, data: { token: 10 }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime exact` — executes `await client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime gt` — executes `client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime gte` — executes `client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime lt` — executes `client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime lte` — executes `client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where datetime not` — executes `client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where null` — executes `client.events.findMany({ where: { time: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where empty in[]` — executes `client.teams.findMany({ where: { id: { in: [] } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where id empty in[] and token in[]` — executes `client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where in[integer]` — executes `client.teams.findMany({ where: { token: { in: [11, 22] } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [11, 22] } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where empty notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [] } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where null` — executes `client.users.findMany({ where: { team_id: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `findMany where - case insensitive field` — executes `client.users.findMany({ where: { email: 'MAX@PRISMA.IO' } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany where decimal` — executes `client.exercises.findMany({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where decimal` — executes `client.exercises.findUnique({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where decimal - default value` — executes `client.exercises.findUnique({ where: { distance: 12.3 } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `create bigint data` — executes `client.migrate.create({ data: { version: 1 } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where composite PK` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `update where composite PK` — executes `client.variables.update({ where: { name_key: { key: 'b', name: 'a' } }, data: { email: 'e' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `upsert where composite PK - update` — executes `client.variables.upsert({ where: { name_key: { key: 'b', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `upsert where composite PK - create` — executes `client.variables.upsert({ where: { name_key: { key: 'd', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `delete where composite PK` — executes `client.variables.delete({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where unique composite` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where unique composite (PK is a composite)` — executes `client.variables.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique where composite PK with foreign key` — executes `client.a.findUnique({ where: { one_two: { one: 1, two: 2 } } })` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findUnique - list all possible datatypes` — executes `client.crazy.findUnique({ where: { variables_value_email_key: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: sqlite]
- [ ] `updateMany where null - check findMany` — executes `await client.teams.updateMany({ data: { name: 'b' }, where: { name: null }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: sqlite]
- [ ] `findMany on column_name_that_becomes_empty_string` — executes `await client.column_name_that_becomes_empty_string.findMany({})` and asserts the result equals the expected value [providers: sqlite]

### packages/integration-tests/src/__tests__/integration/mysql/introspection.test.ts

- [ ] `findUnique where PK` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where PK with select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where PK with include` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `create with data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `create with empty data and SQL default` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `create with empty data and serial` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `update where with numeric data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where with boolean data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where with boolean data and select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where with string data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `updateMany where with string data - check returned count` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `updateMany where with string data - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `delete where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany - email text` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany - email varchar(50) not null unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where unique with foreign key and unpack` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where contains and boolean` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where OR[contains, contains] ` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `upsert (update)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `upsert (create)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany orderBy asc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany orderBy desc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany - default enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `create with data - not null enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `update with data - not null enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `updateMany with data - not null enum - check count` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update with data - not null enum - check findMany` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `deleteMany where enum - check count` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `deleteMany where enum - check findMany` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where contains` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where startsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where endsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where in[string]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where in[]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `findMany where datetime lte - check instanceof Date` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where timestamp gte than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where timestamp gt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where timestamp lt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where integer data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime exact` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime gt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime gte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime lt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime lte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where datetime not` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where empty in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where id empty in[] and token in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where in[integer]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where empty notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: teams,users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `findMany where - case insensitive field` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where decimal - default value` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `create bigint data` — introspects the scenario's schema (tables: migrate) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `update where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `upsert where composite PK - update` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `upsert where composite PK - create` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `delete where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where unique composite` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where unique composite (PK is a composite)` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique where composite PK with foreign key` — introspects the scenario's schema (tables: a,b) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findUnique - list all possible datatypes` — introspects the scenario's schema (tables: crazy) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `updateMany where null - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mysql]
- [ ] `findMany on column_name_that_becomes_empty_string` — introspects the scenario's schema (tables: n/a) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof js object is object for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof Date is string for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof array for Json field with array` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mysql]

### packages/integration-tests/src/__tests__/integration/mysql/runtime.test.ts

- [ ] `findUnique where PK` — executes `client.teams.findUnique({ where: { id: 2 } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where PK with select` — executes `client.teams.findUnique({ where: { id: 2 }, select: { name: true }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where PK with include` — executes `client.users.findUnique({ where: { id: 1 }, include: { posts: true }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `create with data` — executes `client.teams.create({ data: { name: 'c' } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `create with empty data and SQL default` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [providers: mysql]
- [ ] `create with empty data and serial` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `update where with numeric data` — executes `client.teams.update({ where: { id: 1 }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where with boolean data` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where with boolean data and select` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where with string data` — executes `client.teams.update({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `updateMany where with string data - check returned count` — executes `client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `updateMany where with string data - check findMany` — executes `await client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where unique` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where composite unique` — executes `client.users.findUnique({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where composite unique` — executes `client.users.update({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, data: { name: 'Marco' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `delete where composite unique` — executes `client.users.delete({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany - email text` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where unique` — executes `client.users.findMany({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany - email varchar(50) not null unique` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where unique with foreign key and unpack` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } }).posts()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where contains and boolean` — executes `client.posts.findMany({ where: { title: { contains: 'A' }, published: true, }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where OR[contains, contains] ` — executes `client.posts.findMany({ where: { OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }], published: true, }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `upsert (update)` — executes `client.posts.upsert({ where: { id: 1 }, create: { title: 'D', published: true }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `upsert (create)` — executes `client.posts.upsert({ where: { id: 4 }, create: { title: 'D', published: false }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany orderBy asc` — executes `client.posts.findMany({ orderBy: { title: 'asc', }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany orderBy desc` — executes `client.posts.findMany({ orderBy: { title: 'desc', }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany - default enum` — executes `client.posts.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `create with data - not null enum` — executes `client.posts.create({ data: { title: 'D' } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `update with data - not null enum` — executes `client.posts.update({ where: { id: 1 }, data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `updateMany with data - not null enum - check count` — executes `client.posts.updateMany({ data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update with data - not null enum - check findMany` — executes `await client.posts.updateMany({ data: { published: 'PUBLISHED' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `deleteMany where enum - check count` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `deleteMany where enum - check findMany` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where contains` — executes `client.crons.findMany({ where: { job: { contains: 'j2' } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where startsWith` — executes `client.crons.findMany({ where: { job: { startsWith: 'j2' } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where endsWith` — executes `client.crons.findMany({ where: { job: { endsWith: '1' } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where in[string]` — executes `client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where in[]` — executes `client.crons.findUnique({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `findMany where datetime lte - check instanceof Date` — executes `const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where timestamp gte than now` — executes `client.posts.findMany({ where: { created_at: { gte: new Date() } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where timestamp gt than now` — executes `client.posts.findMany({ where: { created_at: { gt: new Date() } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where timestamp lt than now` — executes `const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where integer data` — executes `client.teams.update({ where: { token: 11 }, data: { token: 10 }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime exact` — executes `client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime gt` — executes `client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime gte` — executes `client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime lt` — executes `client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime lte` — executes `client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where datetime not` — executes `client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where null` — executes `client.events.findMany({ where: { time: null } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where empty in[]` — executes `client.teams.findMany({ where: { id: { in: [] } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where id empty in[] and token in[]` — executes `client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where in[integer]` — executes `client.teams.findMany({ where: { token: { in: [11, 22] } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [11, 22] } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where empty notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [] } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where null` — executes `client.users.findMany({ where: { team_id: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `findMany where - case insensitive field` — executes `client.users.findMany({ where: { email: 'MAX@PRISMA.IO' } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany where decimal` — executes `client.exercises.findMany({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where decimal` — executes `client.exercises.findUnique({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where decimal - default value` — executes `client.exercises.findUnique({ where: { distance: 12.3 } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `create bigint data` — executes `client.migrate.create({ data: { version: 1 } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where composite PK` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `update where composite PK` — executes `client.variables.update({ where: { name_key: { key: 'b', name: 'a' } }, data: { email: 'e' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `upsert where composite PK - update` — executes `client.variables.upsert({ where: { name_key: { key: 'b', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `upsert where composite PK - create` — executes `client.variables.upsert({ where: { name_key: { key: 'd', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `delete where composite PK` — executes `client.variables.delete({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where unique composite` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where unique composite (PK is a composite)` — executes `client.variables.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique where composite PK with foreign key` — executes `client.a.findUnique({ where: { one_two: { one: 1, two: 2 } } })` and asserts the result equals the expected value [providers: mysql]
- [ ] `findUnique - list all possible datatypes` — executes `client.crazy.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `updateMany where null - check findMany` — executes `await client.teams.updateMany({ data: { name: 'b' }, where: { name: null }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mysql]
- [ ] `findMany on column_name_that_becomes_empty_string` — executes `await client.column_name_that_becomes_empty_string.findMany({})` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof js object is object for Json field` — executes `await client.posts.create({ data: { title: 'A', data: { somekey: 'somevalue', somekeyarray: ['somevalueinsidearray'], }, }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('object') }) posts` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof Date is string for Json field` — executes `await client.posts.create({ data: { title: 'B', data: new Date('2020-01-01'), }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('string') }) posts` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]
- [ ] `findUnique - check typeof array for Json field with array` — executes `await client.posts.create({ data: { title: 'Hello', data: ['some', 'array', 1, 2, 3, { object: 'value' }], }, }) const post = await client.posts.findUnique({ where: { id: 1 }, }) post` and asserts the result equals the expected value [todo: skipped in source] [providers: mysql]

### packages/integration-tests/src/__tests__/integration/mariadb/introspection.test.ts

- [ ] `findUnique where PK` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where PK with select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where PK with include` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `create with data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `create with empty data and SQL default` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `create with empty data and serial` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `update where with numeric data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where with boolean data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where with boolean data and select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where with string data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `updateMany where with string data - check returned count` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `updateMany where with string data - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `delete where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany - email text` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany - email varchar(50) not null unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where unique with foreign key and unpack` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where contains and boolean` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where OR[contains, contains] ` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `upsert (update)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `upsert (create)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany orderBy asc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany orderBy desc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany - default enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `create with data - not null enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `update with data - not null enum` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `updateMany with data - not null enum - check count` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update with data - not null enum - check findMany` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `deleteMany where enum - check count` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `deleteMany where enum - check findMany` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where contains` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where startsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where endsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where in[string]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where in[]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `findMany where datetime lte - check instanceof Date` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where timestamp gte than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where timestamp gt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where timestamp lt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where integer data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime exact` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime gt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime gte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime lt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime lte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where datetime not` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where null` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where empty in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where id empty in[] and token in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where in[integer]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where empty notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where null` — introspects the scenario's schema (tables: teams,users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `findMany where - case insensitive field` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where decimal - default value` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `create bigint data` — introspects the scenario's schema (tables: migrate) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `update where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `upsert where composite PK - update` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `upsert where composite PK - create` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `delete where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where unique composite` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where unique composite (PK is a composite)` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique where composite PK with foreign key` — introspects the scenario's schema (tables: a,b) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique - list all possible datatypes` — introspects the scenario's schema (tables: crazy) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `updateMany where null - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findMany on column_name_that_becomes_empty_string` — introspects the scenario's schema (tables: n/a) and snapshots the generated datamodel + warnings [providers: mariadb]
- [ ] `findUnique - check typeof js object is object for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `findUnique - check typeof Date is string for Json field` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]
- [ ] `findUnique - check typeof array for Json field with array` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mariadb]

### packages/integration-tests/src/__tests__/integration/mariadb/runtime.test.ts

- [ ] `findUnique where PK` — executes `client.teams.findUnique({ where: { id: 2 } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where PK with select` — executes `client.teams.findUnique({ where: { id: 2 }, select: { name: true }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where PK with include` — executes `client.users.findUnique({ where: { id: 1 }, include: { posts: true }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `create with data` — executes `client.teams.create({ data: { name: 'c' } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `create with empty data and SQL default` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `create with empty data and serial` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `update where with numeric data` — executes `client.teams.update({ where: { id: 1 }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where with boolean data` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where with boolean data and select` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where with string data` — executes `client.teams.update({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `updateMany where with string data - check returned count` — executes `client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `updateMany where with string data - check findMany` — executes `await client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where unique` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where composite unique` — executes `client.users.findUnique({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where composite unique` — executes `client.users.update({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, data: { name: 'Marco' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `delete where composite unique` — executes `client.users.delete({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany - email text` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where unique` — executes `client.users.findMany({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany - email varchar(50) not null unique` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where unique with foreign key and unpack` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } }).posts()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where contains and boolean` — executes `client.posts.findMany({ where: { title: { contains: 'A' }, published: true, }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where OR[contains, contains] ` — executes `client.posts.findMany({ where: { OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }], published: true, }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `upsert (update)` — executes `client.posts.upsert({ where: { id: 1 }, create: { title: 'D', published: true }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `upsert (create)` — executes `client.posts.upsert({ where: { id: 4 }, create: { title: 'D', published: false }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany orderBy asc` — executes `client.posts.findMany({ orderBy: { title: 'asc', }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany orderBy desc` — executes `client.posts.findMany({ orderBy: { title: 'desc', }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany - default enum` — executes `client.posts.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `create with data - not null enum` — executes `client.posts.create({ data: { title: 'D' } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `update with data - not null enum` — executes `client.posts.update({ where: { id: 1 }, data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `updateMany with data - not null enum - check count` — executes `client.posts.updateMany({ data: { published: 'PUBLISHED' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update with data - not null enum - check findMany` — executes `await client.posts.updateMany({ data: { published: 'PUBLISHED' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `deleteMany where enum - check count` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `deleteMany where enum - check findMany` — executes `await client.posts.deleteMany({ where: { published: 'DRAFT' }, }) client.posts.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where contains` — executes `client.crons.findMany({ where: { job: { contains: 'j2' } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where startsWith` — executes `client.crons.findMany({ where: { job: { startsWith: 'j2' } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where endsWith` — executes `client.crons.findMany({ where: { job: { endsWith: '1' } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where in[string]` — executes `client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where in[]` — executes `client.crons.findUnique({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `findMany where datetime lte - check instanceof Date` — executes `const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where timestamp gte than now` — executes `client.posts.findMany({ where: { created_at: { gte: new Date() } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where timestamp gt than now` — executes `client.posts.findMany({ where: { created_at: { gt: new Date() } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where timestamp lt than now` — executes `const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where integer data` — executes `client.teams.update({ where: { token: 11 }, data: { token: 10 }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime exact` — executes `client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime gt` — executes `client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime gte` — executes `client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime lt` — executes `client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime lte` — executes `client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where datetime not` — executes `client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where null` — executes `client.events.findMany({ where: { time: null } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where empty in[]` — executes `client.teams.findMany({ where: { id: { in: [] } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where id empty in[] and token in[]` — executes `client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where in[integer]` — executes `client.teams.findMany({ where: { token: { in: [11, 22] } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [11, 22] } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where empty notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [] } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where null` — executes `client.users.findMany({ where: { team_id: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `findMany where - case insensitive field` — executes `client.users.findMany({ where: { email: 'MAX@PRISMA.IO' } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany where decimal` — executes `client.exercises.findMany({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where decimal` — executes `client.exercises.findUnique({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where decimal - default value` — executes `client.exercises.findUnique({ where: { distance: 12.3 } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `create bigint data` — executes `client.migrate.create({ data: { version: 1 } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where composite PK` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `update where composite PK` — executes `client.variables.update({ where: { name_key: { key: 'b', name: 'a' } }, data: { email: 'e' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `upsert where composite PK - update` — executes `client.variables.upsert({ where: { name_key: { key: 'b', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `upsert where composite PK - create` — executes `client.variables.upsert({ where: { name_key: { key: 'd', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `delete where composite PK` — executes `client.variables.delete({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where unique composite` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where unique composite (PK is a composite)` — executes `client.variables.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique where composite PK with foreign key` — executes `client.a.findUnique({ where: { one_two: { one: 1, two: 2 } } })` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique - list all possible datatypes` — executes `client.crazy.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `updateMany where null - check findMany` — executes `await client.teams.updateMany({ data: { name: 'b' }, where: { name: null }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findMany on column_name_that_becomes_empty_string` — executes `await client.column_name_that_becomes_empty_string.findMany({})` and asserts the result equals the expected value [providers: mariadb]
- [ ] `findUnique - check typeof js object is object for Json field` — executes `await client.posts.create({ data: { title: 'A', data: { somekey: 'somevalue', somekeyarray: ['somevalueinsidearray'], }, }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('object') }) posts` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `findUnique - check typeof Date is string for Json field` — executes `await client.posts.create({ data: { title: 'B', data: new Date('2020-01-01'), }, }) const posts = await client.posts.findMany() posts.forEach((post) => { expect(typeof post.data).toEqual('string') }) posts` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]
- [ ] `findUnique - check typeof array for Json field with array` — executes `await client.posts.create({ data: { title: 'Hello', data: ['some', 'array', 1, 2, 3, { object: 'value' }], }, }) const post = await client.posts.findUnique({ where: { id: 1 }, }) expect(typeof post.data).toEqual('string') post` and asserts the result equals the expected value [todo: skipped in source] [providers: mariadb]

### packages/integration-tests/src/__tests__/integration/mssql/introspection.test.ts

- [ ] `findUnique where PK` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where PK with select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where PK with include` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `create with data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `create with empty data and SQL default` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `create with empty data and identity` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mssql]
- [ ] `update where with numeric data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where with boolean data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where with boolean data and select` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where with string data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `updateMany where with string data - check returned count` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `updateMany where with string data - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `delete where composite unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany - email text` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany - email varchar(50) not null unique` — introspects the scenario's schema (tables: users) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where unique with foreign key and unpack` — introspects the scenario's schema (tables: users,posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where contains and boolean` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where OR[contains, contains] ` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `upsert (update)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `upsert (create)` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany orderBy asc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany orderBy desc` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where contains` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where startsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where endsWith` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where in[string]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where in[]` — introspects the scenario's schema (tables: crons) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mssql]
- [ ] `findMany where datetime lte - check instanceof Date` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime gte than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime gt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime lt than now` — introspects the scenario's schema (tables: posts) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where integer data` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime exact` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime gt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime gte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime lt` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime lte` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where datetime not` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: events) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where empty in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where id empty in[] and token in[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where in[integer]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where empty notIn[]` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findMany where null` — introspects the scenario's schema (tables: teams,users) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mssql]
- [ ] `findMany where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where decimal` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where decimal - default value` — introspects the scenario's schema (tables: exercises) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `create bigint data` — introspects the scenario's schema (tables: migrate) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `update where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `upsert where composite PK - update` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `upsert where composite PK - create` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `delete where composite PK` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where unique composite` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where unique composite (PK is a composite)` — introspects the scenario's schema (tables: variables) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique where composite PK with foreign key` — introspects the scenario's schema (tables: a,b) and snapshots the generated datamodel + warnings [providers: mssql]
- [ ] `findUnique - list all possible datatypes` — introspects the scenario's schema (tables: crazy) and snapshots the generated datamodel + warnings [todo: skipped in source] [providers: mssql]
- [ ] `updateMany where null - check findMany` — introspects the scenario's schema (tables: teams) and snapshots the generated datamodel + warnings [providers: mssql]

### packages/integration-tests/src/__tests__/integration/mssql/runtime.test.ts

- [ ] `findUnique where PK` — executes `client.teams.findUnique({ where: { id: 2 } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where PK with select` — executes `client.teams.findUnique({ where: { id: 2 }, select: { name: true }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where PK with include` — executes `client.users.findUnique({ where: { id: 1 }, include: { posts: true }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `create with data` — executes `client.teams.create({ data: { name: 'c' } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `create with empty data and SQL default` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [providers: mssql]
- [ ] `create with empty data and identity` — executes `client.teams.create({ data: {} })` and asserts the result equals the expected value [todo: skipped in source] [providers: mssql]
- [ ] `update where with numeric data` — executes `client.teams.update({ where: { id: 1 }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where with boolean data` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where with boolean data and select` — executes `client.teams.update({ where: { id: 1 }, data: { active: false }, select: { active: true }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where with string data` — executes `client.teams.update({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `updateMany where with string data - check returned count` — executes `client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `updateMany where with string data - check findMany` — executes `await client.teams.updateMany({ where: { name: 'c' }, data: { name: 'd' }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where unique` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where composite unique` — executes `client.users.findUnique({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where composite unique` — executes `client.users.update({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, data: { name: 'Marco' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `delete where composite unique` — executes `client.users.delete({ where: { email_name: { email: 'ada@prisma.io', name: 'Ada' }, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany - email text` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where unique` — executes `client.users.findMany({ where: { email: 'ada@prisma.io' } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany - email varchar(50) not null unique` — executes `client.users.findMany()` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where unique with foreign key and unpack` — executes `client.users.findUnique({ where: { email: 'ada@prisma.io' } }).posts()` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where contains and boolean` — executes `client.posts.findMany({ where: { title: { contains: 'A' }, published: true, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where OR[contains, contains] ` — executes `client.posts.findMany({ where: { OR: [{ title: { contains: 'A' } }, { title: { contains: 'C' } }], published: true, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `upsert (update)` — executes `client.posts.upsert({ where: { id: 1 }, create: { title: 'D', published: true }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `upsert (create)` — executes `client.posts.upsert({ where: { id: 4 }, create: { title: 'D', published: false }, update: { title: 'D', published: true }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany orderBy asc` — executes `client.posts.findMany({ orderBy: { title: 'asc', }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany orderBy desc` — executes `client.posts.findMany({ orderBy: { title: 'desc', }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where contains` — executes `client.crons.findMany({ where: { job: { contains: 'j2' } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where startsWith` — executes `client.crons.findMany({ where: { job: { startsWith: 'j2' } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where endsWith` — executes `client.crons.findMany({ where: { job: { endsWith: '1' } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where in[string]` — executes `client.crons.findMany({ where: { job: { in: ['j20', 'j1'] } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where in[]` — executes `client.crons.findUnique({ where: { job: { in: ['j20', 'j1'] } } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mssql]
- [ ] `findMany where datetime lte - check instanceof Date` — executes `const posts = await client.posts.findMany({ where: { created_at: { lte: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime gte than now` — executes `client.posts.findMany({ where: { created_at: { gte: new Date() } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime gt than now` — executes `client.posts.findMany({ where: { created_at: { gt: new Date() } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime lt than now` — executes `const posts = await client.posts.findMany({ where: { created_at: { lt: new Date() } }, }) posts.forEach((post) => { expect(post.created_at).toBeInstanceOf(Date) delete post.created_at }) posts` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where integer data` — executes `client.teams.update({ where: { token: 11 }, data: { token: 10 }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime exact` — executes `client.events.findMany({ where: { time: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime gt` — executes `client.events.findMany({ where: { time: { gt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime gte` — executes `client.events.findMany({ where: { time: { gte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime lt` — executes `client.events.findMany({ where: { time: { lt: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime lte` — executes `client.events.findMany({ where: { time: { lte: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where datetime not` — executes `client.events.findMany({ where: { time: { not: new Date(Date.UTC(2018, 8, 4, 0, 0, 0, 0)) }, }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where null` — executes `client.events.findMany({ where: { time: null } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where empty in[]` — executes `client.teams.findMany({ where: { id: { in: [] } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where id empty in[] and token in[]` — executes `client.teams.findMany({ where: { id: { in: [] }, token: { in: [11, 22] } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where in[integer]` — executes `client.teams.findMany({ where: { token: { in: [11, 22] } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [11, 22] } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where empty notIn[]` — executes `client.teams.findMany({ where: { token: { notIn: [] } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findMany where null` — executes `client.users.findMany({ where: { team_id: null } })` and asserts the result equals the expected value [todo: skipped in source] [providers: mssql]
- [ ] `findMany where decimal` — executes `client.exercises.findMany({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where decimal` — executes `client.exercises.findUnique({ where: { distance: 12.213 } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where decimal - default value` — executes `client.exercises.findUnique({ where: { distance: 12.3 } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `create bigint data` — executes `client.migrate.create({ data: { version: 1 } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where composite PK` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `update where composite PK` — executes `client.variables.update({ where: { name_key: { key: 'b', name: 'a' } }, data: { email: 'e' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `upsert where composite PK - update` — executes `client.variables.upsert({ where: { name_key: { key: 'b', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `upsert where composite PK - create` — executes `client.variables.upsert({ where: { name_key: { key: 'd', name: 'a' } }, create: { name: '1', key: '2', value: '3', email: '4' }, update: { email: 'e' }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `delete where composite PK` — executes `client.variables.delete({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where unique composite` — executes `client.variables.findUnique({ where: { name_key: { key: 'b', name: 'a' } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where unique composite (PK is a composite)` — executes `client.variables.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique where composite PK with foreign key` — executes `client.a.findUnique({ where: { one_two: { one: 1, two: 2 } } })` and asserts the result equals the expected value [providers: mssql]
- [ ] `findUnique - list all possible datatypes` — executes `client.crazy.findUnique({ where: { value_email: { value: 'c', email: 'd' } }, })` and asserts the result equals the expected value [todo: skipped in source] [providers: mssql]
- [ ] `updateMany where null - check findMany` — executes `await client.teams.updateMany({ data: { name: 'b' }, where: { name: null }, }) client.teams.findMany()` and asserts the result equals the expected value [providers: mssql]

## packages/client legacy integration

### packages/client/src/__tests__/integration/errors/can-not-connect-to-database/test.ts

- [ ] `can-not-connect-to-database > auto-connect` — error surfaced when the database is unreachable [providers: postgresql]
- [ ] `can-not-connect-to-database > explicit connect` — error surfaced when the database is unreachable [providers: postgresql]

### packages/client/src/__tests__/integration/errors/client-version-error/test.ts

- [ ] `client-version-error` — error surfaced on client/engine version mismatch [providers: sqlite]

### packages/client/src/__tests__/integration/errors/color-format/test.ts

- [ ] `client colorless errorFormat argument` — error message color formatting [providers: sqlite]

### packages/client/src/__tests__/integration/errors/connection-limit-mysql/test.ts

- [ ] `the client cannot query the db with 152 connections already open` — connection-pool exhaustion error on MySQL [providers: mysql]

### packages/client/src/__tests__/integration/errors/connection-limit-postgres/test.ts

- [ ] `the client cannot query the db with 100 connections already open` — connection-pool exhaustion error on Postgres [providers: postgresql]

### packages/client/src/__tests__/integration/errors/executeRaw-alter-postgres/test.ts

- [ ] `executeRaw-alter-postgres` — $executeRaw ALTER statement error handling on Postgres [providers: postgresql]

### packages/client/src/__tests__/integration/errors/incorrect-column-type/test.ts

- [ ] `incorrect-column-type` — error when a column type mismatches the schema [providers: sqlite]

### packages/client/src/__tests__/integration/errors/int-errors/test.ts

- [ ] `int-errors > char-int` — integer overflow / invalid-int input errors [providers: mysql]
- [ ] `int-errors > overflow-int` — integer overflow / invalid-int input errors [providers: mysql]
- [ ] `int-errors > signed-int` — integer overflow / invalid-int input errors [providers: mysql]

### packages/client/src/__tests__/integration/errors/invalid-input/test.ts

- [ ] `invalid-input` — validation error on invalid query input [providers: sqlite]

### packages/client/src/__tests__/integration/errors/invalid-url/test.ts

- [ ] `invalid connection string url parameter > should throw with auto-connect` — error on an invalid datasource URL [providers: postgresql]
- [ ] `invalid connection string url parameter > show through with explicit connect` — error on an invalid datasource URL [providers: postgresql]

### packages/client/src/__tests__/integration/errors/missing-column/test.ts

- [ ] `missing-column` — error when a schema column is missing in the DB [providers: sqlite]

### packages/client/src/__tests__/integration/errors/missing-relation/test.ts

- [ ] `missing-relation` — error when a related record/relation is missing [providers: sqlite]

### packages/client/src/__tests__/integration/errors/missing-table/test.ts

- [ ] `missing-table` — error when a schema table is missing in the DB [providers: sqlite]

### packages/client/src/__tests__/integration/errors/multi-schema/test.ts

- [ ] `multischema > create` — multiSchema CRUD across Postgres schemas [providers: postgresql]
- [ ] `multischema > read` — multiSchema CRUD across Postgres schemas [providers: postgresql]
- [ ] `multischema > update` — multiSchema CRUD across Postgres schemas [providers: postgresql]
- [ ] `multischema > delete` — multiSchema CRUD across Postgres schemas [providers: postgresql]

### packages/client/src/__tests__/integration/errors/object-transaction/test.ts

- [ ] `object-transaction undefined` — validation error for object-form (array) $transaction misuse [providers: sqlite]
- [ ] `object-transaction object` — validation error for object-form (array) $transaction misuse [providers: sqlite]

### packages/client/src/__tests__/integration/errors/raw-transaction/test.ts

- [ ] `raw-transaction: queryRaw` — error handling for raw queries in a transaction [providers: sqlite]

### packages/client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-mysql/test.ts

- [ ] `referentialActions-onDelete-default-foreign-key-error(mysql) > delete 1 user, should error` — FK violation error with default onDelete on MySQL [providers: mysql]

### packages/client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-postgresql/test.ts

- [ ] `referentialActions-onDelete-default-foreign-key-error(postgresql) > delete 1 user, should error` — FK violation error with default onDelete on Postgres [providers: postgresql]

### packages/client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-sqlite/test.ts

- [ ] `referentialActions-onDelete-default-foreign-key-error(sqlite) > delete 1 user, should error` — FK violation error with default onDelete on SQLite [providers: sqlite]

### packages/client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-sqlserver/test.ts

- [ ] `delete 1 user, should error` — FK violation error with default onDelete on SQL Server [providers: sqlserver]

### packages/client/src/__tests__/integration/errors/source-map-support/test.ts

- [ ] `source-map-support` — stack traces map back to source [providers: sqlite]

### packages/client/src/__tests__/integration/errors/uncheckedScalarValidation/test.ts

- [ ] `uncheckedScalarInputs validation` — validation error for unchecked scalar inputs [providers: sqlite]

### packages/client/src/__tests__/integration/errors/union-validation/test.ts

- [ ] `union validation` — validation error for invalid union-type input [providers: sqlite]

### packages/client/src/__tests__/integration/errors/wrong-native-types-mysql/test.ts

- [ ] `wrong-native-types-mysql A: Int, SmallInt, TinyInt, MediumInt, BigInt` — error on out-of-range values for MySQL native types [providers: mysql]
- [ ] `wrong-native-types-mysql B: Float, Double, Decimal, Numeric` — error on out-of-range values for MySQL native types [providers: mysql]
- [ ] `wrong-native-types-mysql C: Char, VarChar, TinyText, Text, MediumText, LongText` — error on out-of-range values for MySQL native types [providers: mysql]
- [ ] `wrong-native-types-mysql D: Date, Time, DateTime, Timestamp, Year` — error on out-of-range values for MySQL native types [providers: mysql]
- [ ] `wrong-native-types-mysql E: Bit, Binary, VarBinary, Blob, TinyBlob, MediumBlob, LongBlob` — error on out-of-range values for MySQL native types [providers: mysql]

### packages/client/src/__tests__/integration/errors/wrong-native-types-postgres/test.ts

- [ ] `wrong-native-types-postgres A: Integer, SmallInt, BigInt, Serial, SmallSerial, BigSerial` — error on out-of-range values for Postgres native types [providers: postgresql]
- [ ] `wrong-native-types-postgres B: Real, DoublePrecision, Decimal, Numeric` — error on out-of-range values for Postgres native types [providers: postgresql]
- [ ] `wrong-native-types-postgres C: Char, VarChar, Text, Bit, VarBit, Uuid` — error on out-of-range values for Postgres native types [providers: postgresql]
- [ ] `wrong-native-types-postgres D: Boolean, Bytes, Json, JsonB` — error on out-of-range values for Postgres native types [providers: postgresql]
- [ ] `wrong-native-types-postgres E: Date, Time, Timestamp` — error on out-of-range values for Postgres native types [providers: postgresql]

### packages/client/src/__tests__/integration/happy/browser/test.ts

- [ ] `browser-build` — generated client's browser build exposes a working Decimal [providers: sqlite]

### packages/client/src/__tests__/integration/happy/disconnect-finally/test.ts

- [ ] `disconnect-finally` — $disconnect in a finally block after a query resolves cleanly [providers: sqlite]

### packages/client/src/__tests__/integration/happy/disconnect-race/test.ts

- [ ] `disconnect-race` — concurrent queries during $disconnect do not race/deadlock [providers: sqlite]

### packages/client/src/__tests__/integration/happy/disconnect-while-query/test.ts

- [ ] `disconnect-while-query` — $disconnect issued mid-query behaves correctly [providers: sqlite]

### packages/client/src/__tests__/integration/happy/enums/test.ts

- [ ] `enums` — enum field round-trips through create/read [providers: sqlite]

### packages/client/src/__tests__/integration/happy/filter-nullable/test.ts

- [ ] `filter-nullable` — filtering on a nullable field returns the correct rows [providers: sqlite]

### packages/client/src/__tests__/integration/happy/findFirst/test.ts

- [ ] `findFirst with a result` — findFirst returns the first matching row [providers: sqlite]
- [ ] `findFirst without a result` — findFirst returns the first matching row [providers: sqlite]

### packages/client/src/__tests__/integration/happy/float-napi/test.ts

- [ ] `float-node-api` — float scalar precision is preserved [providers: sqlite]

### packages/client/src/__tests__/integration/happy/groupBy/test.ts

- [ ] `groupBy > email` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > name` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > 2 fields` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > count field and aggregations` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > by  [name, count, min, sum, max, avg] with aggregations` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > name and aggregations` — groupBy aggregations return the correct grouped results [providers: sqlite]
- [ ] `groupBy > name and with count` — groupBy aggregations return the correct grouped results [providers: sqlite]

### packages/client/src/__tests__/integration/happy/ignore/test.ts

- [ ] `findMany with ignore` — @@ignore/@ignore models/fields are excluded from the client [providers: sqlite]

### packages/client/src/__tests__/integration/happy/insensitive-postgresql-feature-flag/test.ts

- [ ] `insensitive-postgresql` — case-insensitive filtering behind the preview feature flag [providers: postgresql]

### packages/client/src/__tests__/integration/happy/insensitive-postgresql/test.ts

- [ ] `insensitive-postgresql` — case-insensitive string filtering (mode: insensitive) [providers: postgresql]

### packages/client/src/__tests__/integration/happy/json-filtering-mysql/test.ts

- [ ] `json-filtering(mysql) > lt(2)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > lte(2)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > gte(2)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > gt(2)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > string_contains(bc)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > string_starts_with(a)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > string_ends_with(c)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > array_contains([1, 2, 3])` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > array_starts_with(5)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > array_ends_with(12)` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > filter with Prisma.JsonNull` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > filter with Prisma.DbNull` — JSON path filter operators on MySQL [providers: mysql]
- [ ] `json-filtering(mysql) > filter with Prisma.AnyNull` — JSON path filter operators on MySQL [providers: mysql]

### packages/client/src/__tests__/integration/happy/json-filtering-postgres/test.ts

- [ ] `json-filtering(postgres) > lt(2)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > lte(2)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > gte(2)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > gt(2)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > string_contains(bc)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > string_starts_with(a)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > string_ends_with(c)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > array_contains([1, 2, 3])` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > array_starts_with(5)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > array_ends_with(12)` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > filter with Prisma.JsonNull` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > filter with Prisma.DbNull` — JSON path filter operators on Postgres [providers: postgresql]
- [ ] `json-filtering(postgres) > filter with Prisma.AnyNull` — JSON path filter operators on Postgres [providers: postgresql]

### packages/client/src/__tests__/integration/happy/minimal/test.ts

- [ ] `minimal` — a minimal schema client connects and runs a basic query [providers: sqlite]

### packages/client/src/__tests__/integration/happy/mixed-transaction/test.ts

- [ ] `mixed transaction` — mixing interactive and sequential transaction operations [providers: sqlite]

### packages/client/src/__tests__/integration/happy/modify-client/test.ts

- [ ] `modify-client > override method` — runtime client modification / extension hooks [providers: sqlite]
- [ ] `modify-client > override model` — runtime client modification / extension hooks [providers: sqlite]
- [ ] `modify-client > class extends` — runtime client modification / extension hooks [providers: sqlite]
- [ ] `modify-client > class extends keys` — runtime client modification / extension hooks [providers: sqlite]
- [ ] `modify-client > class extends override` — runtime client modification / extension hooks [providers: sqlite]

### packages/client/src/__tests__/integration/happy/multi-connect/test.ts

- [ ] `multi-connect` — repeated $connect calls are idempotent [providers: sqlite]

### packages/client/src/__tests__/integration/happy/mysql-binary-id/test.ts

- [ ] `find by binary id` — binary-typed id column on MySQL round-trips [providers: mysql]

### packages/client/src/__tests__/integration/happy/namedConstraints/test.ts

- [ ] `namedConstraints(sqlite) - with preview flag > findUnique using @@id by default name` — named unique/PK/FK constraints are honored [providers: sqlite]
- [ ] `namedConstraints(sqlite) - with preview flag > findUnique using @@id by custom name` — named unique/PK/FK constraints are honored [providers: sqlite]
- [ ] `namedConstraints(sqlite) - with preview flag > findUnique using @@unique by default name` — named unique/PK/FK constraints are honored [providers: sqlite]
- [ ] `namedConstraints(sqlite) - with preview flag > findUnique using @@unique by custom name` — named unique/PK/FK constraints are honored [providers: sqlite]

### packages/client/src/__tests__/integration/happy/native-types-mysql/test.ts

- [ ] `native-types-mysql A: Int, SmallInt, TinyInt, MediumInt, BigInt` — MySQL native column types round-trip [providers: mysql]
- [ ] `native-types-mysql B: Float, Double, Decimal, Numeric` — MySQL native column types round-trip [providers: mysql]
- [ ] `native-types-mysql C: Char, VarChar, TinyText, Text, MediumText, LongText` — MySQL native column types round-trip [providers: mysql]
- [ ] `native-types-mysql D: Date, Time, DateTime, Timestamp, Year` — MySQL native column types round-trip [providers: mysql]
- [ ] `native-types-mysql E: Bit, Binary, VarBinary, Blob, TinyBlob, MediumBlob, LongBlob` — MySQL native column types round-trip [providers: mysql]

### packages/client/src/__tests__/integration/happy/native-types-postgres/test.ts

- [ ] `native-types-postgres A: Integer, SmallInt, BigInt, Serial, SmallSerial, BigSerial` — Postgres native column types round-trip [providers: postgresql]
- [ ] `native-types-postgres B: Real, DoublePrecision, Decimal, Numeric` — Postgres native column types round-trip [providers: postgresql]
- [ ] `native-types-postgres C: Char, VarChar, Text, Bit, VarBit, Uuid` — Postgres native column types round-trip [providers: postgresql]
- [ ] `native-types-postgres D: Boolean, Bytes, Json, JsonB` — Postgres native column types round-trip [providers: postgresql]
- [ ] `native-types-postgres E: Date, Time, Timestamp` — Postgres native column types round-trip [providers: postgresql]

### packages/client/src/__tests__/integration/happy/not-so-exhaustive-schema/dmmf-types.test.ts

- [ ] `dmmf-types` — generated DMMF types for a broad Postgres schema [providers: postgresql]

### packages/client/src/__tests__/integration/happy/not-so-exhaustive-schema-mongo/dmmf-types.test.ts

- [ ] `dmmf-types` — generated DMMF types for a broad MongoDB schema [providers: mongodb]

### packages/client/src/__tests__/integration/happy/orderBy-relation/test.ts

- [ ] `orderBy relation` — orderBy on a relation field [providers: sqlite]

### packages/client/src/__tests__/integration/happy/postgres-json-list/test.ts

- [ ] `postgres-json-list` — Postgres Json[] list field round-trips [providers: postgresql]

### packages/client/src/__tests__/integration/happy/raw-transactions/test.ts

- [ ] `transaction > queryRaw` — $queryRaw/$executeRaw inside interactive transactions [providers: sqlite]
- [ ] `transaction > queryRaw & updateMany 1` — $queryRaw/$executeRaw inside interactive transactions [providers: sqlite]
- [ ] `transaction > queryRaw & updateMany 2` — $queryRaw/$executeRaw inside interactive transactions [providers: sqlite]
- [ ] `transaction > executeRaw` — $queryRaw/$executeRaw inside interactive transactions [providers: sqlite]
- [ ] `transaction > queryRaw & executeRaw in separate transactions` — $queryRaw/$executeRaw inside interactive transactions [providers: sqlite]
- [ ] `transaction > all mixed` — $queryRaw/$executeRaw inside interactive transactions [skipped in source] [providers: sqlite]

### packages/client/src/__tests__/integration/happy/referentialActions-onDelete-cascade-mysql/test.ts

- [ ] `referentialActions(mysql) > delete 1 user, should cascade` — onDelete: Cascade referential action on MySQL [providers: mysql]

### packages/client/src/__tests__/integration/happy/referentialActions-onDelete-cascade-postgresql/test.ts

- [ ] `referentialActions(postgresql) > delete 1 user, should cascade` — onDelete: Cascade referential action on Postgres [providers: postgresql]

### packages/client/src/__tests__/integration/happy/referentialActions-onDelete-cascade-sqlite/test.ts

- [ ] `referentialActions(postgresql) > delete 1 user, should cascade` — onDelete: Cascade referential action on SQLite [providers: sqlite]

### packages/client/src/__tests__/integration/happy/referentialActions-onDelete-cascade-sqlserver/test.ts

- [ ] `delete 1 user, should cascade` — onDelete: Cascade referential action on SQL Server [providers: sqlserver]

### packages/client/src/__tests__/integration/happy/relations/test.ts

- [ ] `relations` — relation queries via include/select [providers: sqlite]

### packages/client/src/__tests__/integration/happy/removed-preview-flags/test.ts

- [ ] `removed-preview-flags` — client works with previously-required preview flags removed [providers: sqlite]

### packages/client/src/__tests__/integration/happy/rfc3339/test.ts

- [ ] `findMany filter by rfc3339 date string` — RFC3339 datetime values round-trip [providers: sqlite]

### packages/client/src/__tests__/integration/happy/scalar-list/test.ts

- [ ] `scalar-list filter` — scalar list field round-trips [providers: postgresql]

### packages/client/src/__tests__/integration/happy/selectRelationCount/test.ts

- [ ] `selectRelationCount` — _count on a relation via select [providers: sqlite]

### packages/client/src/__tests__/integration/happy/signals/test.ts

- [ ] `signals that should terminate the process > SIGINT` — process terminates on OS signals during client use [providers: sqlite]
- [ ] `signals that should terminate the process > SIGTERM` — process terminates on OS signals during client use [providers: sqlite]

### packages/client/src/__tests__/integration/happy/sqlite-variable-limit/test.ts

- [ ] `sqlite-variable-limit` — queries exceeding SQLite's bound-variable limit [providers: sqlite]

### packages/client/src/__tests__/integration/happy/transaction/test.ts

- [ ] `transaction` — interactive $transaction commit/rollback semantics [providers: sqlite]

### packages/client/src/__tests__/integration/happy/uncheckedScalarInputs/test.ts

- [ ] `uncheckedScalarInputs` — unchecked scalar FK inputs on create/update [providers: sqlite]

### packages/client/src/__tests__/integration/happy/validator/test.ts

- [ ] `validator` — Prisma.validator input validation helper [providers: sqlite]

**Total: 840 tests**
