# Relations

This is an extension of the [data modeling](./data-modeling.md) chapter that discusses _relations_ in the data model definition in detail.

The examples on this page are based on this [schema file](./prisma-schema-file.md):

```prisma
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

## When are back-relation fields required?

You can leave out back-relations in many cases. Prisma 2 then interprets the relation in a specific way.

- **If you want a 1:1 relation, you must always specify both relation fields.** Prisma 2 guarantees that only one value can be stored for each side of the relation.
- **If you want an m:n relation, you must always specify both relation fields.** Prisma 2 will maintain a relation table to track all instances of the relation.
- **If you leave out a relation field, the relation will automatically be interpreted as a 1:n relation.**
  - If you leave out the back-relation field on a relation where the other end has a _non-list relation field_, this will be interpreted as a 1:n relation. This means that the missing back-relation field is implied to be a _list_.
  - If you leave out the back-relation field on a relation where the other end has a _list relation field_, this will be interpreted as a 1:n relation. This means that the missing back-relation field is implied to be a _single value_ (i.e. not a _list_).

> **Note**: This behaviour might change soon and relations might always be required to be explicit on both sides. Follow the [spec](https://github.com/prisma/specs/tree/master/schema#relations) for more info.

## The `@relation` attribute

The `@relation` attribute disambiguates relationships when needed.

It has the following signature:

```prisma
@relation(_name: String?, references: Identifier[]?)
```

- `references` _(optional)_: List of [field](./data-modeling.md#fields) names to reference.
- `name` _(optional)_: Defines the _name_ of the relationship. If this a m:m-relation, the name also determines the name of the relation table in the underlying database.


> **Note**: Cascading deletes are not yet implemented. You can track the progress of this feature in this [GitHub issue](https://github.com/prisma/prisma2/issues/267).

## 1:1

To maintain a 1:1 relationship, you must always specify the relation fields on both ends of the relation. Prisma prevents accidentally storing multiple records in the relation.

```prisma
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

```prisma
model User {
  id        Int      @id
  profile   Profile? @relation(references: [id])
}

model Profile {
  id   Int    @id
  user User
}
```

Now, the tables are structured like this:

| **User** |         |
| -------- | ------- |
| id       | integer |
| profile  | integer |

| **Profile** |         |
| ----------- | ------- |
| id          | integer |

If you're introspecting an existing database and the foreign key does not follow the alphanumeric convention, then Prisma uses the [`@relation`](#the-relation-attribute) attribute to clarify.

```prisma
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

To specify a 1:n relation, you can omit either side of the relation. The following three relations are therefore equivalent:

```prisma
// Specifying both relation fields
model User {
  id        Int      @id
  posts     Post[]
}

model Post {
  id         Int        @id
  author     User
}
```

```prisma
// Leaving out the `posts` field
model User {
  id        Int      @id
}

model Post {
  id         Int        @id
  author     User
}
```

```prisma
// Leaving out the `author` field
model User {
  id        Int      @id
  posts     Post[]
}

model Post {
  id         Int        @id
}
```

> **Note**: This behaviour might change soon and relations might always be required to be explicit on both sides. Follow the [spec](https://github.com/prisma/specs/blob/remove/implicit/schema/Readme.md#relations) for more info.

In this example, `Post.author` always points to the primary key on `User`.

Connectors for relational databases will implement this as two tables with a foreign key constraint on the `Post` table:

| **User** |         |
| -------- | ------- |
| id       | integer |

| **Post** |         |
| -------- | ------- |
| id       | integer |
| author   | integer |

You may omit `Post.author` and the relationship will remain intact. If one side of the relation is missing, Prisma implies the field name based on the name of the model it is pointing to. If you omitted `User.posts`, Prisma would add an implicit `User.post` field, making the relation `1:1` instead of `1:n`.

## m:n

The return value on both sides is a list that might be empty. This is an improvement over the standard implementation in relational databases that require the application developer to deal with implementation details such as an intermediate relation table. In Prisma, each connector will implement this concept in the way that is most efficient on the given storage engine and expose an API that hides the implementation details.

```prisma
model Post {
  id         Int        @id
  categories Category[]
}

model Category {
  id    Int    @id
  posts Post[]
}
```

Prisma will create one table per model, plus a relation table as follows:

| **Post** |         |
| -------- | ------- |
| id       | integer |

| **Category** |         |
| ------------ | ------- |
| id           | integer |

| **\_CategoryToPost** |         |
| ------------------ | ------- |
| id                 | integer |

To change the name of the relation table, you use the `name` argument of the `@relation` attribute:

```prisma
model Post {
  id         Int        @id
  categories Category[] @relation(name: "MyRelationTable")
}

model Category {
  id    Int    @id
  posts Post[] @relation(name: "MyRelationTable")
}
```

This results in the following table structure in the underlying database:

| **Post** |         |
| -------- | ------- |
| id       | integer |

| **Category** |         |
| ------------ | ------- |
| id           | integer |

| **\_MyRelationTable** |         |
| ------------------ | ------- |
| id                 | integer |



> **Note**: It is currently not possible to remove the prepending underscore of the relation table name but will be enabled soon. Learn more in the [spec](https://github.com/prisma/specs/blob/master/schema/Readme.md#explicit-many-to-many-mn-relationships).

## Self-relations

Prisma supports _self-referential relations_ (short: _self relations_). A self relation is a relation where the model references itself instead of another model, for example:

```prisma
model User {
  id         Int   @id
  reportsTo  User
}
```

This is interpreted as a 1:1 relation and results in the following table:

| **User** |         |
| ------------ | ------- |
| id           | integer |
| reportsTo    | integer |

For a 1:n relation, you need to make the self-relation field a list:

```prisma
model User {
  id         Int     @id
  reportsTo  User[]
}
```

If you want to add a back-relation field, you need to add the `@relation` attribute to both relation fields to disambiguate:

```prisma
model User {
  id           String  @default(cuid()) @id
  email        String? @unique
  reportsTo    User[]  @relation(name: "reportsTo")
  reportedToBy User    @relation(name: "reportsTo")
}
```

Consequently, the `@relation` attribute is also required for m:n relations:

```prisma
model User {
  id           String  @default(cuid()) @id
  email        String? @unique
  reportsTo    User[]  @relation(name: "reportsTo")
  reportedToBy User[]  @relation(name: "reportsTo")
}
```

If your model should have more than one self-relation, you need to explicitly add all relation fields and annotate them with the `@relation` attribute

```prisma
model User {
  id           String  @default(cuid()) @id
  email        String? @unique
  reportsTo    User[]  @relation(name: "reportsTo")
  reportedToBy User[]  @relation(name: "reportsTo")
  created      User    @relation(name: "created")
  createdBy    User    @relation(name: "created")
}
```

## Relations in the generated Prisma Client JS API

The [generated Prisma Client JS API](./prisma-client-js/api.md) comes with many helpful features for relations (find examples below):

- Fluent API to traverse relations on the returned object
- Nested creates, updates and connects (also referred to as _nested writes_) with transactional guarantees
- Nested reads (eager loading) via `select` and `include`
- Relation filters (a filter on a related object, i.e. a JOIN is performed before the filter is applied)

### Fluent API

The fluent API lets you _fluently_ traverse the relations of your models via function calls. Note that the last the model of the _last_ function call determines what is being returned from the entire request.

This request returns all posts by a specific user:

```ts
const postsByUser: Post[] = await prisma.user
  .findOne({ where: { email: 'ada@prisma.io' } })
  .posts()
```

This request returns all categories by a specific post:

```ts
const categoriesOfPost: Category[] = await prisma.post
  .findOne({ where: { id: 1 } })
  .categories()
```

While the Fluent API allows you to write chainable queries, sometimes you may want to address specific models where you already know specific fields (i.e., get all posts of a specific author).

You can also rewrite the query like this:

```ts
const postsByUser: Post[] = await prisma.post.findMany({
  where: {
    author: { id: author.id },
  },
})
```

Note that, if you query a relationship, you must specify the fields (`id`) you want to search for.

### Nested writes (transactions)

Nested writes provide a powerful API to write relational data to your database. They further provide _transactional guarantees_ to create, update or delete data across multiple tables in a single Prisma Client JS API call. The level of nesting of a nested writes can be arbitrarily deep.

Nested writes are available for relation fields of a model when using the model's `create` or `update` function. The following nested write operations are available per function:

- On to-one relation fields (e.g. `profile` on `User` in the sample data model above)
  - `create`
    - `create`: Create a new user and a new profile
    - `connect`: Create a new user and connect it to an existing profile
  - `update`
    - `create`: Update an existing user by creating a new profile
    - `connect`: Update an an existing user by connecting it to an existing profile
    - `update`: Update an existing user by updating their existing profile
    - `upsert`: Update an existing user by updating their existing profile or by creating a new profile
    - `delete` (only if relation is optional): Update an existing user by deleting their existing profile
    - `disconnect` (only if relation is optional): Update an existing user by removing the connection to their existing profile
- On to-many relation fields (e.g. `posts` on `User` in the sample data model above)
  - `create`
    - `create`: Create a new user and one or more new posts
    - `connect`: Create a new user and connect it to one or more existing posts
  - `update`
    - `create`: Update an existing user by creating one or more new posts
    - `connect`: Update an existing user by connecting it to one or more existing posts
    - `set`: Update an existing user by replacing their existing posts with one or more existing posts
    - `disconnect`: Update an existing by removing the connection(s) to one or more of their existing posts
    - `update`: Update an existing user by updating one or more of their existing posts
    - `delete`: Update an existing user by deleting one or more of their existing posts
    - `updateMany`: Update an existing user by updating one or more of their existing posts
    - `deleteMany`: Update an existing user by deleting one or more of their existing posts
    - `upsert`: Update an existing user by updating one or more of their existing posts or by creating one or more new posts

Here are some examples of nested writes:

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
  where: { id: 5424 },
  data: {
    author: {
      connect: { email: 'alice@prisma.io' },
    },
  },
})
```

```ts
// Remove the author from an existing post in a single transaction
const post: Post = await prisma.post.update({
  data: {
    author: { disconnect: true },
  },
  where: {
    id: 'ck0c7jl4t0001jpcbfxft600e',
  },
})
```

For the next example, assume there's another model called `Comment` related to `User` and `Post` as follows:

```prisma
model User {
  id       String    @default(cuid()) @id
  posts    Post[]
  comments Comment[]
  // ...
}

model Post {
  id         String     @default(cuid()) @id
  author     User?
  comments   Comment[]
  // ...
}

model Comment {
  id        String @default(cuid()) @id
  text      String
  writtenBy User
  post      Post
  // ...
}

// ...
```

Because there are circular relations between `User`, `Post` and `Comment`, you can nest your write operations arbitrarily deep:

```ts
// Create a new post, connect to an existing user and create new,
// comments, users and posts in deeply nested operations
const post = await prisma.post.create({
  data: {
    author: {
      connect: {
        email: 'alice@prisma.io',
      },
    },
    comments: {
      create: {
        text: 'I am Sarah and I like your post, Alice!',
        writtenBy: {
          create: {
            email: 'sarah@prisma.io',
            name: 'Sarah',
            posts: {
              create: {
                title: "Sarah's first blog post",
                comments: {
                  create: {
                    text: 'Hi Sarah, I am Bob. I like your blog post.',
                    writtenBy: {
                      create: {
                        email: 'bob@prisma.io',
                        name: 'Bob',
                        posts: {
                          create: {
                            title:
                              'I am Bob and this is the first post on my blog',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
})
```

### Nested reads (eager loading)

You can eagerly load relations on a model via `select` and `include` (learn more about the difference [here](./prisma-client-js/api.md#manipulating-the-selection-set)). The nesting of eagerly loaded relations can be arbitrarily deep.

```ts
// The returned post objects will only have the  `id` and
// `author` property which carries the respective user object
const allPosts = await prisma.post.findMany({
  select: {
    id: true,
    author: true,
  },
})
```

```ts
// The returned posts objects will have all scalar fields of the `Post` model
// and additionally all the categories for each post
const allPosts = await prisma.post.findMany({
  include: {
    categories: true,
  },
})
```

```ts
// The returned objects will have all scalar fields of the `User` model
// and additionally all the posts with their authors with their posts
await prisma.user.findMany({
  include: {
    posts: {
      include: {
        author: {
          include: {
            posts: true,
          },
        },
      },
    },
  },
})
```

### Relation filters

A relation filter is a filter operation that's applied to a related object of a model. In SQL terms, this means a JOIN is performed before the filter is applied.

```ts
// Retrieve all posts of a particular user
// that start with "Hello"
const posts: Post[] = await prisma.user
  .findOne({
    where: { email: 'ada@prisma.io' },
  })
  .posts({
    where: {
      title: { startsWith: 'Hello' },
    },
  })
```
