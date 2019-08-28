# Generated Photon API (JavaScript/TypeScript)

Photon is a type-safe database client auto-generated based on your [data model definition](../data-modeling.md#data-model-definition) (which is a representation of your database schema). This page explains the generated API operations you have available when using Photon.

- [Overview](#overview)
- [CRUD](#crud)
- [Field selection](#field-selection)
- [Relations](#relations)
- [Raw databases access](#raw-database-access)
- [API Reference](#api-reference)
- [Debugging](#debugging)
- [Managing connections](#managing-connections)

## Overview

Using Photon typically follows this high-level workflow:

1. Define/update your data model definition (e.g. by manually adding a new model or by (re)introspecting your database)
2. Generate your Photon database client based on the changes in the data model definition

Your `Photon` instance can then be imported from `node_modules/@generated`.

Assume you have the following data model definition:

```groovy
model User {
  id    Int    @id
  name  String
  role  Role
  posts Post[]
}

model Post {
  id     Int    @id
  title  String
  author User
}

enum Role {
  USER
  ADMIN
}
```

## CRUD

Your generated Photon API will expose the following CRUD operations for the `User` and `Post` models:

- [`findOne`](#findOne)
- [`findMany`](#findMany)
- [`create`](#create)
- [`update`](#update)
- [`updateMany`](#updateMany)
- [`upsert`](#upsert)
- [`delete`](#delete)
- [`deleteMany`](#deleteMany)

You can access each function via the respective model property on your generated `Photon` instance, e.g. `users` for the `User` model:

```ts
import Photon from '@generated/photon'

const photon = new Photon()

async function main() {
  await photon.connect()
  const result = await photon.users.findOne({
    where: { id: 1 },
  })
  // result = { id: 1, name: "Alice", role: "USER" }
  await photon.disconnect()
}
```

Note that the name of the `users` property is auto-generated using the [`pluralize`](https://github.com/blakeembrey/pluralize) package.

## Field selection

This section explains how to predict and control which fields of a model are returned in a Photon API call.

### Selection sets

To understand which fields are being returned by a certain API call, you need to be aware of its **selection set**.

The selection set defines the **set of fields on a model instance that is returned in a Photon API call**.

For example, in the `findOne` API call from above, the selection set includes the `id`, `name` and `role` fields of the model `User`. In that example, the selection set has not been manipulated and the API call therefore returns the _default selection set_ (read below).

### The default selection set

If the selection set is not manipulated (via `select` or `include`), a Photon API call returns the **default selection set** for a model. It includes all [_scalar_](./data-modeling.md#scalar-types) fields (including [enums](./data-modeling.md#enums)) fields of the model.

Considering the sample datamodel from above:

- The default selection set for the `User` model includes `id`, `name`, `role`. It does **not** include `posts` because that's a _relation_ and not a scalar field.
- The default selection set for the `Post` model includes `id`, `title`. It does **not** include `author` because that's a _relation_ and not a scalar field.

### Manipulating the selection set

There are two ways how the _default selection set_ can be manipulated to specify which fields should be returned by a Photon API call:

- **Select exclusively** (via `select`): When using `select`, the selection set only contains the fields that are explicitly provided as arguments to `select`.
- **Include additionally** (via `include`): When using `include`, the default selection set gets extended with additional fields that are provided as arguments to `include`.

#### Select exclusively via `select`

In this example, we're using `select` to exclusively select the `name` field of the returned `User` object:

```ts
const result = await photon.users.findOne({
  where: { id: 1 },
  select: { name: true },
})
// result = { name: "Alice" }
```

#### Include additionally via `include`

Sometimes you want to directly include a relation when retrieving data from a database. To eagerly load and include the relations of a model in an API call right away, you can use `include`:

```ts
const result = await photon.users.findOne({
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

### Lazy loading

Coming soon.

## Relations

Learn more about relations in the generated Photon API [here](../relations.md#relations-in-the-generated-Photon-API).

## Raw database access

Coming soon.

## API reference

For simplicity, we're assuming the `User` model from above as foundation for the generated code.

### Constructor

Creates a new `Photon` instance.

#### Options

| Name          | Type          | Required | Description                                                                                                                                                                                       |
| ------------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug`       | `boolean`     | No       | When set to `true`, the `Photon` instance prints additional logging output to the console when sending requests to Prisma's query engine. **Default**: `false`.                                   |
| `datasources` | `Datasources` | No       | Lets you override the connection string for a data source. The keys of the `datasources` object are autogenerated and correspond to the names to the data sources specified in your [Prisma schema file](../prisma-schema-file.md). |

#### Examples

```ts
const Photon = new Photon({ debug: true })
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
const user = await photon.users.findOne({
  where: { id: 1 },
})
```

### `findMany`

Returns a list of objects. The list can be altered using _pagination_, _filtering_ and _ordering_ arguments. You can use the `select` and `include` arguments to determine which fields should be included on each object in the returned list.

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
const user = await photon.users.findMany({
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
const user = await photon.users.create({
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
const user = await photon.users.update({
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
const updatedUserCount = await photon.users.updateMany({
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
const user = await photon.users.upsert({
  where: { id: 1 },
  update: { name: "ALICE" }
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
const user = await photon.users.delete({
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
const deletedUserCount = await photon.users.deleteMany({
  where: { name: 'Alice' },
})
```

## Debugging

You can view the generated database queries that Photon sends to your database by setting the `debug` option to `true` when instantianting `Photon`:

```ts
const Photon = new Photon({ debug: true })
```

## Managing connections

Photon connects and disconnects from your data sources using the following two methods:

- `connect(): Promise<void>`
- `disconnect(): Promise<void>`

Unless you want to employ a specific optimization, calling `photon.connect()` is not necessary thanks to the _lazy connect_ behaviour: The `Photon` instance connects lazily when the first request is made to the API (`connect()` is called for you under the hood). 

If you need the first request to respond instantly and can't wait for the lazy connection to be established, you can explicitly call `photon.connect()` to establish a connection to the data source.

**IMPORTANT**: It is recommended to always explicitly call `photon.disconnect()` in your code. Generally the `Photon` instance disconnects automatically. However, if your program terminates but still has an unhandled promise rejection, the port will keep the connection to the data source open beyond the lifetime of your program!
