# Creating bug reports

You can help us improve Prisma by creating **bug reports**. When creating a bug report, it's important that you include as much information as possible about your issue. That way, it's easier to reproduce.

Note that you can also create **feature requests** or ask a **question** via the issue templates on GitHub.

## Ideal scenario: Share standalone repository with reproduction

In an ideal scenario, you're able to reproduce the bug in an isolated environment and put it into a GitHub repository that you can share in your report. That way, we already have a reproduction and the problem can be tackled without further triaging.

## Writing a bug report

If you don't have the time to create a full reproduction of the issue, please include as much information as possible about the problem. The [bug report template]() helps you  with that.

### Include logging and debugging output

Please make sure to include _any_ [logging](./prisma-client-js/api.md#logging) and [debugging](./prisma-client-js/api.md#debugging) output in the issue that may help to identify the problem.

**Setting the `DEBUG` env var**

To get additional output from Prisma, you can set `DEBUG` to `*`:

```bash
export DEBUG="*"
```

**Print logs of Prisma Client**

You can enable additional logs in Prisma Client by instantiating it with the `log` option:

```ts
const prisma = new PrismaClient({ log: ['query', 'info', 'warn'] })
```

### Include a bug description, reproduction and expected behaviour

When describing the bug, it's helpful to include the following information:

- A clear and concise description of what the bug is
- Steps to reproduce the bug
- A clear and concise description of what you expected to happen
- Screenshots (if applicable)

<details><summary>Expand for an example for a hypothetical bug report</summary>

#### Example

**Describe the bug**

`@unique` attribute on `email` field doesn't work on my model. I can create duplicate records with the same `email`.

**To reproduce**:

I have this Prisma schema (removed all unnecessary models and fields):

```prisma
model User {
  id    Int    @id @default(autoincrement())
  email String @unique
}
```

I then run `prisma generate` to generate Prisma Client.

I then have a Node.js script that creates two `User` records with the same `email`:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// A `main` function so that we can use async/await
async function main() {
  const user1 = await prisma.create({
    data: { email: 'alice@prisma.io' }
  })
  const user2 = await prisma.create({
    data: { email: 'alice@prisma.io' }
  })
  console.log(user1, user2)
}

main()
  .catch(e => {
    throw e
  })
  .finally(async () => {
    await prisma.disconnect()
  })
```

**Expected behavior**

I expected an exception when trying to create `user2` with the same `email` as `user1` because this violates the `@unique` constraint defined in the Prisma schema.

</details>

### Include environment and setup information

Please include any information about your environment and setup. Specifically it's important to include:

- Which **operating system** you use (e.g. Mac OS, Windows, Debian, CentOS, ...)
- Which **database** you use with Prisma (PostgreSQL, MySQL or SQLite)
- Which **version of Prisma** you use (run `prisma2 -v` to see your Prisma version)
- Which **version of Prisma Node.js** you use (run `node -v` to see your Node.js version)

Here's an example of what this could look like in your bug report:

- OS: Mac OS Cataline 10.15.1 
- Database: PostgreSQL v11
- Prisma version: `prisma2@2.0.0-preview024, binary version: 377df4fe30aa992f13f1ba152cf83d5770bdbc85`
- Node.js version: `v12.2.0`

### Include relevant Prisma info (e.g. the Prisma schema, Prisma Client queries, ...)

To help us reproduce your problem, it is helpful to include your Prisma schema in the bug report. **Please remove any database credentials before sharing your Prisma schema in a bug report**. If you're sure about which parts of the schema is causing the issue, please strip out the irrelevant parts of it and only show the parts that are related to the problem. If you're not sure, please include your entire schema.

If you have an issue with Prisma Client, please also include which Prisma Client query is causing the issue.


