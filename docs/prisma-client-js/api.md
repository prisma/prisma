# Generated Prisma Client API (JavaScript/TypeScript)

Prisma Client JS is a type-safe database client auto-generated based on your [data model definition](../data-modeling.md#data-model-definition) (which is a declarative representation of your database schema). This page explains the generated API operations you have available when using Prisma Client JS.

- [Overview](#overview)
- [CRUD](#crud)
- [Aggregations](#aggregations)
- [Field selection](#field-selection)
- [Relations](#relations)
- [Raw databases access](#raw-database-access)
- [Scalar lists](#scalar-lists)
- [Bring your own ID](#bring-your-own-id)
- [API Reference](#api-reference)
- [Filtering](#filtering)
- [Debugging](#debugging)
- [Reusing query sub-parts](#reusing-query-sub-parts)
- [Managing connections](#managing-connections)

## Overview

Using Prisma Client JS typically follows this high-level workflow:

1. Add Prisma Client JS to your project using: `npm install @prisma/client`
1. Define/update your data model definition (e.g. by manually adding a new model or by (re)introspecting your database)
1. Generate your Prisma Client JS based on the changes in the data model definition

Note that steps 2. and 3. might happen repeatedly as you evolve your application.

The `PrismaClient` constructor can then be imported from `node_modules/@prisma/client`.

Assume you have the following data model definition:

```prisma
model User {
  id    Int    @id @default(autoincrement())
  name  String
  role  Role
  posts Post[]
}

model Post {
  id     Int    @id @default(autoincrement())
  title  String
  author User
}

enum Role {
  USER
  ADMIN
}
```

## CRUD

Your generated Prisma Client JS API will expose the following CRUD operations for the `User` and `Post` models:

- [`findOne`](#findOne)
- [`findMany`](#findMany)
- [`create`](#create)
- [`update`](#update)
- [`updateMany`](#updateMany)
- [`upsert`](#upsert)
- [`delete`](#delete)
- [`deleteMany`](#deleteMany)

You can access each function via the respective model property on your generated `PrismaClient` instance, e.g. `user` for the `User` model:

```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.connect()
  const result = await prisma.user.findOne({
    where: { id: 1 },
  })
  // result = { id: 1, name: "Alice", role: "USER" }
  await prisma.disconnect()
}
```

## Aggregations

In addition to CRUD operations, Prisma Client JS also allows for [_aggregation_ queries](https://github.com/prisma/prisma-client-js/issues/5). 

### `count`

To return the number of elements in a list, you can the `count()` method on any model property on your `PrismaClient` instance, for example:

```ts
const userCount = await prisma.user.count()
// userCount = 42
```

## Field selection

This section explains how to predict and control which fields of a model are returned in a Prisma Client JS API call.

### Selection sets

To understand which fields are being returned by a certain API call, you need to be aware of its **selection set**.

The selection set defines the **set of fields on a model instance that is returned in a Prisma Client JS API call**.

For example, in the `findOne` API call from above, the selection set includes the `id`, `name` and `role` fields of the model `User`. In that example, the selection set has not been manipulated and the API call therefore returns the _default selection set_ (read below).

### The default selection set

If the selection set is not manipulated (via `select` or `include`), a Prisma Client JS API call returns the **default selection set** for a model. It includes all [_scalar_](./data-modeling.md#scalar-types) fields (including [enums](./data-modeling.md#enums)) fields of the model.

Considering the sample datamodel from above:

- The default selection set for the `User` model includes `id`, `name`, `role`. It does **not** include `posts` because that's a _relation_ and not a scalar field.
- The default selection set for the `Post` model includes `id`, `title`. It does **not** include `author` because that's a _relation_ and not a scalar field.

### Manipulating the selection set

There are two ways how the _default selection set_ can be manipulated to specify which fields should be returned by a Prisma Client JS API call:

- **Select exclusively** (via `select`): When using `select`, the selection set only contains the fields that are explicitly provided as arguments to `select`.
- **Include additionally** (via `include`): When using `include`, the default selection set gets extended with additional fields that are provided as arguments to `include`.

Note that you can not combine `select` and `include` in the following ways:

- Within a `select` statement, you can't use `include`.
- Within an `include` statement, you can't use `select`.

#### Select exclusively via `select`

In this example, we're using `select` to exclusively select the `name` field of the returned `User` object:

```ts
const result = await prisma.user.findOne({
  where: { id: 1 },
  select: { name: true },
})
// result = { name: "Alice" }
```

#### Include additionally via `include`

Sometimes you want to directly include a relation when retrieving data from a database. To eagerly load and include the relations of a model in an API call right away, you can use `include`:

```ts
const result = await prisma.user.findOne({
  where: { id: 1 },
  include: { posts: true },
})
// result = {
//   id: 1,
//   name: "Alice",
//   role: "USER",
//   posts: [
//     { id: 1, title: "Hello World"},
//   ]
// }
```

## Relations

Learn more about relations in the generated Prisma Client JS API [here](../relations.md#relations-in-the-generated-prisma-client-js-api).

## Bring your own ID

With Prisma Client JS, you can set your own values for fields that are annotated with the `@id` attribute. This attribute express that the respective field is considered a _primary key_. Consider the following model:

```prisma
model User {
  id    Int    @id
  name  String
}
```

You can provide the `id` as input value in [`create`](#create) and [`update`](#update) operations, for example:

```ts
const user = await prisma.user.create({
  data: {
    id: 1
  }
})
```

Note that Prisma Client JS will throw an error if you're trying to create/update a record with an `id` value that already belongs to another record since the `@id` attribute always implies _uniqueness_.

## Raw database access

You can send raw SQL queries to your database using the `raw` function that's exposed by your `PrismaClient` instance. It returns the query results as plain old JavaScript objects:

```ts
const result = await prisma.raw('SELECT * FROM User;')
// result = [
//   { "id":1, "email":"sarah@prisma.io", "name":"Sarah" },
//   { "id":2, "email":"alice@prisma.io", "name":"Alice" }
// ]
```

### Tagged templates

Note that `raw` is implemented as a [tagged template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates). Therefore, you can also call `raw` as follows:

```ts
const result = await prisma.raw`SELECT * FROM User;`
```

### Setting variables

To include variables in your SQL query, you can use JavaScript string interpolation with [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals):

```ts
const userId = 42
const result = await prisma.raw`SELECT * FROM User WHERE id = ${userId};`
```

### Typing `raw` results

The `raw` function has the following function signature:

```ts
raw<T = any>(query: string | TemplateStringsArray): Promise<T>;
```

The return type of `raw` is a `Promise` for the [generic](https://www.typescriptlang.org/docs/handbook/generics.html) type parameter `T`. This means you can type the result manually by providing `T` when you invoke `raw`. If you don't provide any type, the return type of `raw` defaults to `any`.

```ts
// import the generated `User` type from the `@prisma/client` module
import { User } from '@prisma/client'

const result = await prisma.raw<User[]>('SELECT * FROM User;')
// result is of type: `User[]`
```

Now, `result` is statically typed to the generated `User` type (or rather an array thereof) from Prisma Client.

![](https://imgur.com/H2TCRc5.png)

If you're selecting only specific fields of the model or want to include relations, read the documentation about [leveraging Prisma Client's generated types](./generated-types.md) if you want to ensure that the query results are properly typed.

Note that calls to `SELECT` always return arrays of type `T`, but other SQL operations (like `INSERT` or `UPDATE`) might return single objects.

## Scalar lists

Prisma Client JS provides a dedicated API for (re)setting _scalar lists_ using a `set` field inside the `data` argument when creating or updating a [Prisma model](../data-modeling.md#models), for example:

```prisma
model User {
  id        Int       @id
  coinFlips Boolean[]
}
```

When creating or updating a `User` record, you can create a new list or replace the current one with a new list like so:

```ts
await  prisma.user.create({
  data: {
    coinFlips: {
      set: [true, false]
    }
  }
})

await  prisma.user.update({
  where: { id: 42 ,}
  data: {
    coinFlips: {
      set: [true, false]
    }
  }
})
```

## API reference

For simplicity, we're assuming the `User` model from above as foundation for the generated code.

### Constructor

Creates a new `PrismaClient` instance.

#### Options

| Name          | Type          | Required | Description                                                                                                                                                                                                                         |
| ------------- | ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug`       | `boolean`     | No       | When set to `true`, the `PrismaClient` instance prints additional logging output to the console when sending requests to Prisma's query engine. **Default**: `false`.                                                                     |
| `log` | `boolean | LogOption[]` | No | This allows to specify one of the following log levels: `INFO`, `WARN`, `QUERY`. If set to `true`, all log levels are applied. If set to `false`, no log levels are applied. **Default**: `true`.  

#### Examples

```ts
const prisma = new PrismaClient({ debug: true })
```

### `findOne`

Returns a single object identified by a _unique_ value (e.g. `id` or `email`). You can use the `select` and `include` arguments to determine which fields should be included on the returned object.

#### Options

| Name     | Type                   | Required | Description                                                                      |
| -------- | ---------------------- | -------- | -------------------------------------------------------------------------------- |
| `where`  | `UserWhereUniqueInput` | **Yes**  | Wraps all _unique_ fields of a model so that individual records can be selected. |
| `select` | `UserSelect`           | No       | Specifies which fields to include in the [selection set](#selection-sets).       |

#### Examples

```ts
const user = await prisma.user.findOne({
  where: { id: 1 },
})
```

### `findMany`

Returns a list of objects. The list can be altered using _pagination_, _filtering_ and _ordering_ arguments. You can use the `select` and `include` arguments to determine which fields should be included on each object in the returned list.

For more filtering examples, look [here](#filtering).

#### Options

| Name      | Type               | Required | Description                                                                                                 |
| --------- | ------------------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| `where`   | `UserWhereInput`   | No       | Wraps _all_ fields of a model so that the list can be filtered by any model property.                       |
| `orderBy` | `UserOrderByInput` | No       | Lets you order the returned list by any model property.                                                     |
| `skip`    | `string`           | No       | Specifies how many of the returned objects in the list should be skipped.                                   |
| `after`   | `string`           | No       | Specifies the starting object for the list (the value typically specifies an `id` or another unique value). |
| `before`  | `string`           | No       | Specifies the last object for the list (the value typically specifies an `id` or another unique value).     |
| `first`   | `number`           | No       | Specifies how many elements should be returned in the list (as seen from the _beginning_ of the list).      |
| `last`    | `number`           | No       | Specifies how many elements should be returned in the list (as seen from the _end_ of the list).            |
| `select`  | `UserSelect`       | No       | Specifies which fields to include in the [selection set](#selection-sets).                                  |

#### Examples

```ts
const user = await prisma.user.findMany({
  where: { name: 'Alice' },
})
```

### `create`

Creates a new record and returns the corresponding object. You can use the `select` and `include` arguments to determine which fields should be included on the returned object. `create` also lets you perform transactional _nested inserts_ (e.g. create a new `User` and `Post` in the same API call).

#### Options

| Name     | Type              | Required | Description                                                                                                                                                                                                                                                                          |
| -------- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data`   | `UserCreateInput` | **Yes**  | Wraps all the fields of the model so that they can be provided when creating new records. It also includes relation fields which lets you perform (transactional) nested inserts. Fields that are marked as optional or have default values in the datamodel are optional on `data`. |
| `select` | `UserSelect`      | No       | Specifies which fields to include in the [selection set](#selection-sets).                                                                                                                                                                                                           |

#### Examples

```ts
const user = await prisma.user.create({
  data: { name: 'Alice' },
})
```

### `update`

Updates an existing record and returns the corresponding object. You can use the `select` and `include` arguments to determine which fields should be included on the returned object.

#### Options

| Name     | Type                   | Required | Description                                                                                                                                                                                         |
| -------- | ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`   | `UserUpdateInput`      | **Yes**  | Wraps all the fields of the model so that they can be provided when updating an existing record. Fields that are marked as optional or have default values in the datamodel are optional on `data`. |
| `where`  | `UserWhereUniqueInput` | **Yes**  | Wraps all _unique_ fields of a model so that individual records can be selected.                                                                                                                    |
| `select` | `UserSelect`           | No       | Specifies which fields to include in the [selection set](#selection-sets).                                                                                                                          |

#### Examples

```ts
const user = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'ALICE' },
})
```

### `updateMany`

Updates a batch of existing records in bulk and returns the number of updated records.

#### Options

| Name    | Type                          | Required | Description                                                                                                                                                                                         |
| ------- | ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`  | `UserUpdateManyMutationInput` | **Yes**  | Wraps all the fields of the model so that they can be provided when updating an existing record. Fields that are marked as optional or have default values in the datamodel are optional on `data`. |
| `where` | `UserWhereInput`              | No       | Wraps _all_ fields of a model so that the list can be filtered by any model property.                                                                                                               |

#### Examples

```ts
const updatedUserCount = await prisma.user.updateMany({
  where: { name: 'Alice' },
  data: { name: 'ALICE' },
})
```

### `upsert`

Updates an existing or creates a new record and returns the corresponding object. You can use the `select` and `include` arguments to determine which fields should be included on the returned object.

#### Options

| Name     | Type                   | Required | Description                                                                                                                                                                                                                                                                          |
| -------- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create` | `UserCreateInput`      | **Yes**  | Wraps all the fields of the model so that they can be provided when creating new records. It also includes relation fields which lets you perform (transactional) nested inserts. Fields that are marked as optional or have default values in the datamodel are optional on `data`. |
| `update` | `UserUpdateInput`      | **Yes**  | Wraps all the fields of the model so that they can be provided when updating an existing record. Fields that are marked as optional or have default values in the datamodel are optional on `data`.                                                                                  |
| `where`  | `UserWhereUniqueInput` | **Yes**  | Wraps all _unique_ fields of a model so that individual records can be selected.                                                                                                                                                                                                     |
| `select` | `UserSelect`           | No       | Specifies which fields to include in the [selection set](#selection-sets).                                                                                                                                                                                                           |

#### Examples

```ts
const user = await prisma.user.upsert({
  where: { id: 1 },
  update: { name: "ALICE" },
  create: { name: "ALICE" }
})
```

### `delete`

Deletes an existing record and returns the corresponding object. You can use the `select` and `include` arguments to determine which fields should be included on the returned object.

#### Options

| Name     | Type                   | Required | Description                                                                      |
| -------- | ---------------------- | -------- | -------------------------------------------------------------------------------- |
| `where`  | `UserWhereUniqueInput` | **Yes**  | Wraps all _unique_ fields of a model so that individual records can be selected. |
| `select` | `UserSelect`           | No       | Specifies which fields to include in the [selection set](#selection-sets).       |

#### Examples

```ts
const user = await prisma.user.delete({
  where: { id: 1 },
})
```

### `deleteMany`

Deletes a batch of existing records in bulk and returns the number of deleted records.

#### Options

| Name    | Type             | Required | Description                                                                           |
| ------- | ---------------- | -------- | ------------------------------------------------------------------------------------- |
| `where` | `UserWhereInput` | No       | Wraps _all_ fields of a model so that the list can be filtered by any model property. |

#### Examples

```ts
const deletedUserCount = await prisma.user.deleteMany({
  where: { name: 'Alice' },
})
```

### `count`

Returns the number of elements in a list as a value of type `number`.

#### Options

The `count()` method doesn't take any input arguments.

#### Examples

```ts
const userCount = await  prisma.user.count()
// userCount = 42
```

## Filtering

The Prisma Client JS API offers filtering options for constraining the items that are returned from API calls that return lists via the `where` argument.

The following examples are based on this data model:

```prisma
model User {
  id     Int    @id
  name   String
  email  String
  role   String
  active Boolean
}

enum Role {
  USER
  ADMIN
}
```

Filtering can be applied to this data model. It is not the same as manipulating the selection set. Based on the `User` model, Prisma Client JS generates the `UserWhereInput` type, which holds the filtering properties.

```ts
export declare type UserWhereInput = {
  id?: number | IntFilter | null
  name?: string | StringFilter | null
  email?: string | StringFilter | null
  role?: Role | RoleFilter | null
  active?: boolean | BooleanFilter | null
  AND?: Enumerable<UserWhereInput>
  OR?: Enumerable<UserWhereInput>
  NOT?: Enumerable<UserWhereInput>
}
```

For example, to get the record for the user with the `id` 1, `where` is used in combination with the `id` `IntFilter`:

```ts
const result = await prisma.user.findMany({
  where: { id: 1 },
})
// result = [{
//   id: 1,
//   name: "Alice",
//   email: "alice@prisma.io",
//   role: "USER",
//   active: true
// }]
```

> Note: As a recap, the `findMany` API returns a list of objects which can be filtered by any model property.

To get the record for the user with the `name` Alice with a USER `role`, `where` is used in combination with the `name` `StringFilter` and the `role` `RoleFilter`:

```ts
const result = await prisma.user.findMany({
  where: {
    name: 'Alice',
    role: 'USER',
  },
})
// result = [{
//   id: 1,
//   name: "Alice",
//   email: "alice@prisma.io",
//   role: "USER",
//   active: true
// }]
```

To apply one of the operator filters (`AND`, `OR`, `NOT`), filter for the record where the user with the `name` Alice has a non-active status. Here, `where` is used in combination with the `name` `StringFilter`, the `active` `BooleanFilter`, and the `NOT` operator:

```ts
const result = await prisma.user.findMany({
  where: {
    name: 'Alice',
    NOT: {
      active: true,
    },
  },
})
```

## Debugging

You can view the generated database queries that Prisma Client JS sends to your database by setting the `debug` option to `true` when instantiating `PrismaClient`:

```ts
const prisma = new PrismaClient({ debug: true })
```

You can also configure log levels via the `log` option:

```ts
const prisma = new PrismaClient({ 
  debug: true,
  log: true
})
```

This logs all log levels:

- `INFO`: Logs general information
- `WARN`: Logs warnings
- `QUERY`: Logs the queries that generated by a Prisma Client JS API call

To specify more fine-grained log-levels, you can pass an array of log options to `log`:

```ts
const prisma = new PrismaClient({
  debug: true,
  log: [{
    level: 'QUERY'
  }]
})
```

## Reusing query sub-parts

You can reuse subparts of a Prisma Client JS query by not immediately evaluating the promise that's returned by any Prisma Client JS API call. Depending on your evaluating the promise, you can do this either by leaving out the prepended `await` keyword or the appended call to `.then()`. 

```ts
// Note the missing `await` here.
const currentUserQuery = prisma.user.findOne({ where: { id: prismarId } })

// Now you have the sub-part of a query that you can reuse.
const postsOfUser = await currentUserQuery.posts()
const profileOfUser = await currentUserQuery.profile()
```

## Managing connections

Prisma Client JS connects and disconnects from your data sources using the following two methods:

- `connect(): Promise<void>`
- `disconnect(): Promise<void>`

Unless you want to employ a specific optimization, calling `prisma.connect()` is not necessary thanks to the _lazy connect_ behavior: The `PrismaClient` instance connects lazily when the first request is made to the API (`connect()` is called for you under the hood).

If you need the first request to respond instantly and can't wait for the lazy connection to be established, you can explicitly call `prisma.connect()` to establish a connection to prismae data source.

**IMPORTANT**: It is recommended to always explicitly call `prisma.disconnect()` in your code. Generally the `PrismaClient` instance disconnects automatically. However, if your program terminates but still  prismas an unhandled promise rejection, the port will keep the connection to the data source open beyond the lifetime of your program!
