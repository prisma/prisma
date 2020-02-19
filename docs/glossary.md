# Glossary


<!-- ### Composite model

A composite model is a model that doesn't directly map to a structure (e.g. a _table_ or a _collection_) in the underlying data source. Instead, it's composed out of multiple parts from the underlying database. -->

## Table of contents

- [Data source]()
- [Data source client]()
- [Data source connector](#data-source-connector)
- [Prisma Schema Language (PSL)](#prisma-schema-language-psl)
- [Generator](#generator)
- [Migration](#migration)
- [Migration engine](#migration-engine)
- [Model](#model)
- [Data model definition](#data-model-definition)
- [Nested write](#nested-write)
- [Prisma Client](#prisma-client)
- [Prisma schema file](#prisma-schema-file)
- [Scalar type](#scalar-type)
- [Selection set](#selection-set)
- [Type modifier](#type-modifier)
- [Query engine](#query-engine)

## Terminology

### Data source

A data source can be anything that Prisma can connect to via a [connector](#data-source-connector), e.g. a database, a GraphQL API, a REST API or a 3rd-party service.

### Data source client

A data source client provides a type-safe data access API for a data source. Depending on the data source, the API can be read-only, write-only or allow both. Note that the most common data source connectors allows for both.

### Data source connector

Also sometimes referred to as:

- Connector

A data source connector connects Prisma to a [data source](#data-source). 

Prisma currently supports the following built-in connectors:

- [`sqlite`](./core/connectors/sqlite.md): A connector for SQLite databases
- [`postgresql`](./core/connectors/postgresql.md): A connector for PostgreSQL databases
- [`mysql`](./core/connectors/mysql.md): A connector for MySQL databases

### Prisma Schema Language (PSL)

PSL is the name of the syntax used to write a [schema file](#prisma-schema-file).

> Learn more about PSL in the [spec](https://github.com/prisma/specs/tree/master/prisma-schema-language).

### Generator

A generator determines what kind of code should be generated from the [data model](#data-model-definition). For example, you can specify the _Prisma Client JS generator_ to generate Prisma Client JS as a type-safe database client based on the data model.

You can include various generators in your [schema file](#prisma-schema-file). When running `prisma2 generate`, the Prisma CLI reads the specified generators from the Prisma schema and invokes each of them.


### Migration

Also sometimes referred to as:

- Database migration
- Schema migration

A migration refers to the transition from a data model state to another data model state. 

### Migration engine

The migration engine generates the database operations needed to apply a migration to a database.

### Model

[Models](./data-modeling.md#models) represent the _entities of your application domain_. They directly map to structures in the underlying data source, e.g. a _table_ for a relational database or a _collection_ for a document database. The [generated Prisma Client JS API](./prisma-client-js/api.md) will expose CRUD operations for each model in your [data model](#data-model-definition).

### Data model definition

Also sometimes referred to as: 

- Data model (or datamodel)
- Prisma schema
- Application schema
- Model schema

Contains the definitions of all your models. The [data model definition](./data-modeling.md#data-model-definition) is part of the [schema file](#prisma-schema-file).

### Nested write

Prisma Client JS lets you perform nested creates, nested updates and nested connects for related models. A [nested write](./relations.md#nested-writes) is always performed as an atomic transaction. Learn more about the generated Prisma Client JS API [here](./prisma-client-js/api.md).

### Prisma Client

> **Note**: Prisma Client has formerly been called Photon. It has been renamed to Prisma Client to simplify the naming and packaging of Prisma 2.

An auto-generated and type-safe database client. Prisma Client is generated using a [generator](#generator) that's specified in your [schema file](#prisma-schema-file). The [generated Prisma Client JS API](./prisma-client-js/api.md) exposes powerful CRUD operations for you to programmatically access your database.

Prisma currently supports the following languages for Prisma Client:

- JavaScript (Node.js)
- TypeScript

A generator for Go is coming soon.

### Prisma schema file

Also sometimes referred to as:

- Schema file
- Project file
- Prisma file
- Prisma schema

The [Prisma schema file](./prisma-schema-file.md) specifies the main parts of your Prisma setup:

- [**Data sources**](#data-source): Specify the details of the data sources Prisma should connect to (e.g. a PostgreSQL database)
- [**Data model definition**](#data-model-definition): Specifies the shape of the data per data source
- [**Generators**](#generator): Specifies what data source clients should be generated (e.g. Prisma Client JS)

### Scalar type

Also sometimes referred to as: 

- Scalar

### Selection set

Also sometimes referred to as: 

- Payload

Determines what fields of a model are returned in a Prisma Client JS API call. By default, the [selection set](./prisma-client-js/api.md#selection-sets) contains the fields of the following types:

- non-lazy [scalar fields](./data-modeling.md#scalar-types)
- enums
- [embed](./data-modeling.md#embeds) fields

The selection set can be manipulated by passing the [`select`](./prisma-client-js/api.md#select-exclusively-via-select) or [`include`](./prisma-client-js/api.md#include-additionally-via-include) option to a Prisma Client JS API call.

### Type modifier

[Type modifiers](./data-modeling.md#type-modifiers) let you turn the type of a field on a model. There are two type modifiers: `[]` for lists and `?` to make a field optional. 

### Query engine

The query engine generates and optimizes database queries based on incoming requests from Prisma Client JS. 
