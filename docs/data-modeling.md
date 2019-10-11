# Data modeling

- [Data model definition](#data-model-definition)
- [Example](#example)
- [Models](#models)
- [Fields](#fields)
- [Enums](#enums)
- [Type definitions](#type-definitions)
- [Attributes](#attributes)
- [Functions](#functions)
- [Scalar types](#scalar-types)
- [Relations](#relations)
- [Reserved model names](#reserved-model-names)

## Data model definition

The data model definition (short: data model or datamodel) is part of your [schema file](./prisma-schema-file.md).

It describes the shape of the data per data source. For example, when connecting to a _relational database_ as a data source, the data model definition is a declarative representation of the _database schema_ (tables, columns, indexes, ...).

## Example

Here is an example based on a local SQLite database located in the same directory of the schema file (called `data.db`):

```prisma
// schema.prisma

datasource sqlite {
  url      = "file:data.db"
  provider = "sqlite"
}

model User {
  id        Int      @id
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
}

model Profile {
  id   Int    @id
  user User
  bio  String
}

model Post {
  id         Int        @id
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  author     User
  title      String
  published  Boolean    @default(false)
  categories Category[]
}

model Category {
  id    Int    @id
  name  String
  posts Post[]
}

enum Role {
  USER
  ADMIN
}
```

While this file mostly consists of the data model definition, it is a valid [schema file](./prisma-schema-file.md) because it also specifies a data source connector (for SQLite, in this case).

## Models

Models represent the entities of your application domain. They are defined using `model` blocks in the data model. In the [example](#example) data model above, `User`, `Profile`, `Post` and `Category` are models. Here's the `User` model again for reference:

```
model User {
  id        Int      @id
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
  profile   Profile?
}
```

On a technical level, a model maps to the underlying structures of the data source, e.g.:

- In PostgreSQL, a model maps to a _table_
- In MySQL, a model maps to a _table_
- In SQLite, a model maps to a _table_

> **Note**: In the future there might be connectors for non-relational databases and other data sources. For example, for MongoDB a model would map to a _collection_, for a REST API it would map to a _resource_. 

### Naming models

Models are typically spelled in [PascalCase](http://wiki.c2.com/?PascalCase) and use the _singular_ form (e.g. `User` instead of `Users`).

Technically, a model can be named anything that adheres to this regular expression: 

```
[A-Za-z_][A-Za-z0-9_]*
```

### Model operations in the Photon API (CRUD)

Every _model_ in the data model definition will result in a number of CRUD operations in the generated [Photon API](./photon/api.md):

- `findMany`
- `findOne`
- `create`
- `update`
- `upsert`
- `delete`
- `updateMany`
- `deleteMany`

The operations are accessible via a generated property on the Photon instance. By default the name of the property is the plural, lowercase form of the model name, e.g. `users` for a `User` model or `posts` for a `Post` model. 

Here is an example illustrating the use of a `users` property from the [Photon.js API](./photon/api.md):

```js
const newUser = await photon.users.create({ data: {
  name: "Alice"
}})
const allUsers = await photon.users.findMany()
```

Note that for Photon.js the name of the `users` property is auto-generated using the [`pluralize`](https://github.com/blakeembrey/pluralize) package. 

## Fields

The properties of a [model](#models) are called _fields_. A field consists of several parts:

- [Name](#naming-fields)
- [Type](#types)
- [Type modifier](#type-modifiers) (optional)
- [Attributes](#attributes) (optional)

You can see examples of fields on the sample models [above](#examples).

### Naming fields

Field names are typically spelled in [camelCase](http://wiki.c2.com/?CamelCase) starting with a lowercase letter.

Technically, a model can be named anything that adheres to this regular expression: 

```
[A-Za-z_][A-Za-z0-9_]*
```

> **Note**: There's currently a [bug](https://github.com/prisma/prisma2/issues/259) that doesn't allow for field names prepended with an underscore. The current regular expression for valid field names therefore is: `[A-Za-z][A-Za-z0-9_]*`

### Types

The type of a field determines its _structure_. A type falls in either of two categories:

- [Scalar type](#scalar-types) (includes [enums](#enums))
- [Model](#models)

### Type modifiers

The type of a field can be modified by appending either of two modifiers:

- `[]`: Make a field a **list** 
- `?`: Make a field **optional**

In the main example above, the field `name` on the `User` model is _optional_ and the `posts` field is a _list_.

Lists can also be optional and will give the list a third state (which is `null`):

- `Blog[]`: Empty list or non-empty list (default: `[]`)
- `Blog[]?`: `null`, empty list or non-empty list (default: `null`)

The default value for a required list is an empty list. The default value for an optional list is `null`.

### Field attributes

Learn more about attributes [below](#attributes).

## Enums

An enum describes a _type_ that has a predefined set of values and is defined via an `enum` block:

```groovy
enum Color {
  Red
  Teal
}
```

## Attributes

Attributes modify the behavior of a [field](#fields) or block (e.g. [models](#models)). There are two ways to add attributes to your data model:

- [Field attributes](#field-attributes) are prefixed with `@`.
- [Block attributes](#block-attributes) are prefixed with `@@`.

Depending on their signature, attributes may be called in the following cases:

**Case 1. No arguments**

- _Signature_: `@attribute`
- _Description_: Parenthesis **must** be omitted.
- _Examples_:
  - `@id`
  - `@unique`
  - `@updatedAt`

**Case 2. One positional argument**

- _Signature_: `@attribute(_ p0: T0, p1: T1, ...)`
- _Description_: There may be up to one positional argument that doesn't need to be named.
- _Examples_:
  - `@field("my_column")`
  - `@default(10)`
  - `@createdAt(now())`

For arrays with a single parameter, you **may** omit the surrounding brackets:

```groovy
@attribute([email]) // is the same as
@attribute(email)
```

**Case 3. Many named arguments**

- _Signature_: `@attribute(_ p0: T0, p1: T1, ...)`
- _Description_: There may be any number of named arguments. If there is a positional argument, then it **may** appear anywhere in the function signature, but if it's present and required, the caller **must** place it before any named arguments. Named arguments may appear in any order.
- _Examples_:
  - `@@pg.index([ email, first_name ], name: "my_index", partial: true)`
  - `@@pg.index([ first_name, last_name ], unique: true, name: "my_index")`
  - `@@check(a > b, name: "a_b_constraint")`
  - `@pg.numeric(precision: 5, scale: 2)`

You must not have multiple arguments with the same name:

```groovy
// compiler error
@attribute(key: "a", key: "b")
```

For arrays with a single parameter, you may omit the surrounding brackets:

```groovy
@attribute([item], key: [item]) // is the same as
@attribute(item, key: item)
```

### Field attributes

Field attributes are marked by an `@` prefix placed at the _end_ of the field definition. A field can have any number of field arguments, potentially spanning multiple lines:

```
// A field with one attribute
model _ {
  myField String @attribute
}

// A field with two attributes
models _ {
  myField String @attribute @attribute2
}

// A type definition with three attributes
type MyType String @attribute("input")
         @attribute2("input", key: "value", key2: "value2")
         @attribute3
```

### Block attributes

Block attributes are marked by an `@@` prefix placed anywhere inside a block. You can have as many block attributes as you want and they may also span multiple lines:

```
model \_ { @@attribute0

---

@@attribute1("input") @attribute2("input", key: "value", key2: "value2")

---

@@attribute1 @@attribute2("input") }
```

### Core attributes

_Core_ attributes must be implemented by every [data source](./prisma-schema-file.md#data-sources) connector (with a _best-effort implementation_), this means they will be available in _any_ Prisma setup.

They may be used in `model` blocks as well as on `type` definitions. 

Here is a list of all available core **field** attributes:

- `@id`: Defines the primary key.
- `@unique`: Defines a unique constraint.
- `@map(_ name: String)`: Defines the raw column name the field is mapped to.
- `@default(_ expr: Expr)`: Specifies a default value.
- `@relation(_ fields?: Field[], name?: String, onDelete?: CascadeEnum)`: Disambiguates relationships when needed. More details [here](./relations.md/#the-relation-attribute).
- `@updatedAt`: Updates the time to `now()` whenever a record is updated.

Here is a list of all available core **block** attributes:

- `@@map(_ name: String)`: Defines the raw table name the field is mapped to.

### Connector attributes

_Connector_ attributes let you use the native features of your data source. With a PostgreSQL database, you can use it for example to X. 

Here is where you can find the documentation of connector attributes per data source connector:

- [MySQL](./core/connectors/mysql.md)
- [PostgreSQL](./core/connectors/postgresql.md)
- [SQLite](./core/connectors/sqlite.md)
- [MongoDB](./core/connectors/mongo.md)

## Functions

Prisma core provides a set of functions that _must_ be implemented by every connector with a _best-effort implementation_. Functions only work inside field and block attributes that accept them:

- `uuid()`: Generates a fresh [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier)
- `cuid()`: Generates a fresh [cuid](https://github.com/ericelliott/cuid)
- `between(min, max)`: Generates a random int in the specified range
- `now()`: Current date and time

Default values using a dynamic generator can be specified as follows:

```groovy
model User {
  age        Int       @default(between([ 1, 5 ]))
  height     Float     @default(between([ 1, 5 ]))
  createdAt  DateTime  @default(now())
}
```

Functions will always be provided at the Prisma level by the query engine.

The data types that these functions return will be defined by the data source connectors. For example, `now()` in a PostgreSQL database will return a `timestamp with time zone`, while `now()` with a JSON connector would return an `ISOString`.

## Scalar types

Prisma core provides the following scalar types:

| Prisma Type | Description           |
| --- | --- |
| `String`   | Variable length text  |
| `Boolean`  | True or false value   |
| `Int`      | Integer value         |
| `Float`    | Floating point number |
| `DateTime` | Timestamp             |

The _data source connector_ determines what _native database type_ each of these types map to. Similarly, the _generator_ determines what _type in the target programming language_  each of these types map to.

Expand below to see the mappings per connector and generator.

<Details><Summary>Scalar mapping to connectors and generators</Summary>
<br />

**Connectors**

| Prisma Type | PostgreSQL  | MySQL     | SQLite  | Mongo  | Raw JSON |
| ---------- | --------- | --------- | ------- | ------ | -------- |
| `String`   | `text`      | `TEXT`      | `TEXT`    | `string` | `string`   |
| `Boolean`  | `boolean`   | `BOOLEAN`   | _N/A_   | `bool`   | `boolean`  |
| `Int`      | `integer`   | `INT`       | `INTEGER` | `int32`  | `number`   |
| `Float`    | `real`      | `FLOAT`     | `REAL`    | `double` | `number`   |
| `DateTime` | `timestamp` | `TIMESTAMP` | _N/A_   | `date`   | _N/A_    |

**_N/A_:** Means that there is no perfect equivalent, but we can probably get pretty
close.

**Generators**

| Prisma Type | JS / TS | Go        |
| ---------- | ------- | --------- |
| `String`   | `string`  | `string`    |
| `Boolean`  | `boolean` | `bool`      |
| `Int`      | `number`  | `int`       |
| `Float`    | `number`  | `float64`   |
| `DateTime` | `Date`    | `time.Time` |


</Details>

## Relations

Learn more about relations [here](./relations.md).

## Reserved model names

When generating Photon.js based on your [data model definition](./data-modeling.md#data-model-definition), there are a number of reserved names that you can't use for your models. Here is a list of the reserved names:

- `String`
- `Int`
- `Float`
- `Subscription`
- `DateTime`
- `WhereInput`
- `IDFilter`
- `StringFilter`
