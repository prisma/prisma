# Transactions

A _database transaction_ refers to a sequence of read/write operations that are _guaranteed_ to either succeed or fail as a whole. 

Transactions are a great tool since they allow developers to disregard a number of potential concurrency problems that can occur when a database processes multiple operations in a short amount of time. Developers take advantage of the _safety guarantees_ provided by the database by wrapping the operations in a transaction.

These guarantees are often summarized using the ACID acronym:

- **Atomic**: Ensures that either _all_ or _none_ operations of the transactions succeed. The transaction is either _committed_ successfully or _aborted_ and _rolled back_.
- **Consistent**: Ensures that the states of the database before and after the transaction are _valid_ (i.e. any existing invariants about the data are maintained).
- **Isolated**: Ensures that concurrently running transactions have the same effect as if they were running in serial.
- **Durability**: Ensures that after the transaction succeeded, any writes are being stored persistently.

While there's a lot of of ambiguity and nuance to each of these properties (e.g. consistency could actually be considered an _application-level responsibility_ rather than a database property or isolation is typically guaranteed in terms of stronger and weaker _isolation levels_), overall they serve as a good high-level guideline for expectations developers have when thinking about database transactions. 

> "Transactions are an abstraction layer that allows an application to pretend that certain concurrency problems and certain kinds of hardware and software faults don’t exist. A large class of errors is reduced down to a simple transaction abort, and the application just needs to try again." **[Designing Data-Intensive Applications](https://dataintensive.net/), [Martin Kleppmann](https://twitter.com/martinkl)** 

## How Prisma Client JS supports transactions today

Prisma Client JS provides a data access API to read and write data from a database. For relational databases, Prisma Client JS's API abstracts over SQL where transactions are a common feature. While Prisma Client JS doesn't allow for the same flexibility a SQL-level transaction provides, it covers the vast majority of use cases developers have for transactions with [**nested writes**](./relations.md#nested-writes).

A nested write lets you perform a single Prisma Client JS API call with multiple _operations_ that touch multiple [_related_](./relations.md#nested-writes) records, for example creating a _user_ together with a _post_ or updating an _order_ together with an _invoice_. When a nested write is performed, Prisma Client JS ensures that it will either succeed or fail as a whole.

Here are examples for nested writes in the Prisma Client JS API:

```ts
// Create a new user with two posts in a 
// single transaction
const newUser: User = await prisma.user.create({
  data: {
    email: 'alice@prisma.io',
    posts: {
      create: [
        { title: 'Join the Prisma Slack on https://slack.prisma.io' },
        { title: 'Follow @prisma on Twitter' },
      ],
    },
  },
})
```

```ts
// Change the author of a post in a single transaction
const updatedPost: Post = await prisma.post.update({
  where: { id: 42 },
  data: {
    author: {
      connect: { email: 'alice@prisma.io' },
    },
  },
})
```

## Future transaction support in the Prisma Client JS API

Transactions are a commonly used feature in relational as well as non-relational databases and Prisma Client JS might support more transaction mechanisms in the future. Specifically, the following two use cases will be supported:

- Sending multiple operations in bulk.
- Enabling longer-running transactions where operations can depend on each other.

The first use case of sending multiple operations in bulk could be implemented with an API similar to this:

```ts
const write1 = prisma.user.create()
const write2 = prisma.orders.create()
const write3 = prisma.invoices.create()

await prisma.transaction([write1, write2, write3])
```

Instead of immediately awaiting the result of each operation when it's performed, the operation itself is stored in a variable first which later is submitted to the database via a method called `transaction`. Prisma Client JS will ensure that either all three `create`-operations or none of them succeed.

The second use case of longer-running transactions where operations can depend on each other is a bit more involved. Prisma Client JS would need to expose a _transaction API_ which enables developers to initiate and commit a transaction themselves while Prisma Client JS takes care of ensuring the safety guarantees associated with transactions. It could look similar to this:

```ts
prisma.transaction(async tx => {
  const user = await tx.users.create({
    data: { email: "alice@prisma.io" }
  })
  const order = await tx.orders.create({
    data: {
      customer: {
        connect: { id: user.id }
      }
    }
  })
  await tx.commit()
})
```

In this case, the API provides a way to wrap a sequence of operations in a callback which gets executed as a transaction, therefore is guaranteed to either succeed or fail as a whole.

If you'd like to see transactions supported in the future, [please join the discussion on GitHub](https://github.com/prisma/prisma2/issues/312).
