# Relations

This is an extension of the [data modeling](./data-modeling.md) chapter that discusses _relations_ in the data model definition in detail.

The examples on this page are based on this [schema file](./prisma-schema-file.md):

```groovy
// schema.prisma

datasource mysql {
  url      = "file:data.db"
  provider = "sqlite"
}

model User {
  id        Int      @id
  posts     Post[]
  profile   Profile?
}

model Profile {
  id   Int    @id
  user User
}

model Post {
  id         Int        @id
  author     User
  categories Category[]
}

model Category {
  id    Int    @id
  posts Post[]
}

enum Role {
  USER
  ADMIN
}
```

> Note that here all [scalars](./data-modeling.md/#scalar-types) been removed from the [example data model](./data-modeling.md/#example) so you can focus on the relations.

It contains the following relations:

- 1:1: `User` <-> `Profile`
- 1:n: `User` <-> `Post`
- m:n: `Post` <-> `Category`

## The `@relation` attribute

The `@relation` attribute disambiguates relationships when needed.

It has the following signature:

```groovy
@relation(_name: String?, references: Identifier[]?, onDelete: OnDeleteEnum?)
```

- `references` _(optional)_: List of [field](./data-modeling.md#fields) names to reference.
- `name` _(optional)_: Defines the _name_ of the relationship. If this a m:m-relation, the name also determines the name of the relation table in the underlying database.
- `onDelete` _(optional)_: Defines what to do when the referenced relation is deleted.
  - `NONE` (_default_): Set the field to `null`.
  - `CASCADE`: Also delete this entry.

> **Note**: Cascading deletes are not yet implemented. You can track the progress of this feature in this [GitHub issue](https://github.com/prisma/prisma2/issues/267).

## 1:1

The return value on both sides is a nullable single value. Prisma prevents accidentally storing multiple records in the relation.

```groovy
model User {
  id        Int      @id
  profile   Profile?
}

model Profile {
  id   Int    @id
  user User
}
```

For 1:1 relationships, it doesn't matter on which side you store the foreign key. Prisma has a convention that the foreign key is added to the model which appears _first alphanumerically_ in your data model. In the example above, that's the `Profile` model.

Under the hood, the tables looks like this:

| **User** |         |
| -------- | ------- |
| id       | integer |

| **Profile** |         |
| ----------- | ------- |
| id          | integer |
| user        | integer |

You can use the `@relation` attribute to explicitly determine the side of the relation on which the foreign key should be stored. If you prefer storing it in the `User` table instead of the `Profile` table, you can use achieve this as follows:

```groovy
model User {
  id        Int      @id
  profile   Profile? @relation(references: [id])
}

model Profile {
  id   Int    @id
  user User
}
```

Now, the tables are structured liks this:

| **User** |         |
| -------- | ------- |
| id       | integer |
| profile  | integer |

| **Profile** |         |
| ----------- | ------- |
| id          | integer |

You _may_ omit either `User.profile` or `Profile.user` and the relationship will remain intact. This makes either the back-relation or the forward-relation optional. If one side of the relation is missing, Prisma implies the field name based on the name of the model it is pointing to.

If you're introspecting an existing database and the foreign key does not follow the alphanumeric convention, then Prisma uses the [`@relation`](#the-relation-attribute) attribute to clarify.

```groovy
model User {
  id        Int        @id
  customer  Profile?   @relation(references: id)
}

model Profile {
  id    Int     @id
  user  User?
}
```

## 1:n

The return value on one side is a optional single value, on the other side a list that might be empty.

```groovy
model User {
  id        Int      @id
  posts     Post[]
}

model Post {
  id         Int        @id
  author     User
}
```

In this example, `Post.author` points to the primary key on `User`.

Connectors for relational databases will implement this as two tables with a
foreign key constraint on the `Post` table:

| **User** |         |
| -------- | ------- |
| id       | integer |

| **Post** |         |
| -------- | ------- |
| id       | integer |
| author   | integer |

You may omit `Post.author` and the relationship will remain intact. If one
side of the relation is missing, Prisma implies the field name based on the name
of the model it is pointing to. If you omitted `User.posts`, Prisma would add
an implicit `User.post` field, making the relation `1:1` instead of `1:n`.

You may also map to composite primary keys:

```groovy
model User {
  first_name  String  @id
  last_name   String
  blogs       Blog[]

  @@id([ first_name, last_name ])
}

model Post {
  id         Int @id
  author     Writer
}
```

This results in the following tables:

| **User**   |      |
| ---------- | ---- |
| first_name | text |
| last_name  | text |

| **Post**          |      |
| ----------------- | ---- |
| id                | Int  |
| author_first_name | text |
| author_last_name  | text |

## m:n

The return value on both sides is a list that might be empty. This is an improvement over the standard implementation in relational databases that require the application developer to deal with implementation details such as an intermediate table / join table. In Prisma, each connector will implement this concept in the way that is most efficient on the given storage engine and expose an API that hides the implementation details.

```groovy
model Post {
  id         Int        @id
  categories Category[]
}

model Category {
  id    Int    @id
  posts Post[]
}
```

## Self-relations

Prisma supports self-referential relations:

```groovy
model Employee {
  id         Int       @id
  reportsTo  Employee
}
```

This results in the following table:

| **Employee** |         |
| ------------ | ------- |
| id           | integer |
| reportsTo    | integer |

## Relations in the generated Photon API

The [generated Photon API](./photon/api.md) comes with many helpful features for relations (find examples below):

- Fluent API to traverse relations on the returned object
- Eagerly load relations via `select` or `include`
- Relation filters (a filter on a related object, i.e. a JOIN is performed before the filter is applied)
- Nested creates, updates and connects (also referred to as _nested writes_)

### Fluent API

```ts
// Retrieve the posts of a user
const postsByUser: Post[] = await photon.users
  .findOne({ where: { email: 'ada@prisma.io' } })
  .posts()
```

```ts
// Retrieve the categories of a post
const categoriesOfPost: Category[] = await photon.posts
  .findOne({ where: { id: 1 } })
  .categories()
```

### Eager loading

```ts
// The returned post objects will only have the  `id` and
// `author` property which carries the respective user object
const allPosts: Post[] = await photon.posts.findMany({
  select: ['id', 'author'],
})
```

```ts
// The returned posts objects will have all scalar fields of the `Post` model and additionally all the categories for each post
const allPosts: Post[] = await photon.posts.findMany({
  include: ['categories'],
})
```

### Relation filters

```ts
// Retrieve all posts of a particular user
// that start with "Hello"
const posts: Post[] = await photon.users
  .findOne({
    where: { email: 'ada@prisma.io' },
  })
  .posts({
    where: {
      title: { startsWith: 'Hello' },
    },
  })
```

### Nested writes

```ts
// Create a new user with two posts in a
// single transaction
const newUser: User = await photon.users.create({
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
const updatedPost: Post = await photon.posts.update({
  where: { id: 5424 },
  data: {
    author: {
      connect: { email: 'alice@prisma.io' },
    },
  },
})
```
