# Transactions

A _transaction_ refers to a sequence of read/write operations that are _guaranteed_ to either succeed or fail as a whole. 

Transactions are a great tool since they allow developers to disregard a number of potential concurrency problems that can occur when a database processes multiple operations in a short amount of time. Developers take advantage of the _safety guarantees_ provided by the database by wrapping the operations in a transaction.

> "Transactions are an abstraction layer that allows an application to pretend that certain concurrency problems and certain kinds of hardware and software faults don’t exist. A large class of errors is reduced down to a simple transaction abort, and the application just needs to try again." **[Designing Data-Intensive Applications](https://dataintensive.net/), [Martin Kleppmann](https://twitter.com/martinkl)** 

## How Prisma 2 (Photon) supports transactions today

Photon provides a data access API to read and write data from a database. For relational databases, Photon's API abstracts over SQL where transactions are a common feature. While Photon doesn't allow for the same flexibility a SQL-level transaction provides, it covers the vast majority of use cases developers have for transactions with [**nested writes**](./relations.md#nested-writes).

A nested write lets you perform a single Photon API call with multiple _operations_ that touch multiple [_related_](./relations.md#nested-writes) records, for example creating a _user_ together with a _post_ or updating an _order_ together with an _invoice_.

