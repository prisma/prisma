# CRUD GraphQL API Example

This example shows how to implement a **CRUD GraphQL API with TypeScript** based on [Photon JS](https://photonjs.prisma.io/), [graphql-yoga](https://github.com/prisma/graphql-yoga) and [GraphQL Nexus](https://nexus.js.org/).

## How to use

### 1. Download example & install dependencies

Clone the repository:

```sh
git clone git@github.com:prisma/photonjs.git
```

Install Node dependencies:

```sh
cd photonjs/examples/typescript/graphql-crud
npm install
```

### 2. Install the Prisma 2 CLI

To run the example, you need the [Prisma 2 CLI](https://github.com/prisma/prisma2/blob/master/docs/prisma-2-cli.md):

```sh
npm install -g prisma2
```

### 3. Set up database

For this example, you'll use a simple [SQLite database](https://www.sqlite.org/index.html). To set up your database, run:

```sh
prisma2 lift save --name 'init'
prisma2 lift up
```

You can now use the [SQLite Browser](https://sqlitebrowser.org/) to view and edit your data in the `./prisma/dev.db` file that was created when you ran `prisma2 lift up`.

### 4. Generate Photon (type-safe database client)

Run the following command to generate [Photon JS](https://photonjs.prisma.io/):

```sh
prisma2 generate
```

Now you can seed your database using the `seed` script from `package.json`:

```sh
npm run seed
```

### 5. Start the GraphQL server

Launch your GraphQL server with this command:

```sh
npm run start
```

Navigate to [http://localhost:4000](http://localhost:4000) in your browser to explore the API of your GraphQL server in a [GraphQL Playground](https://github.com/prisma/graphql-playground).

### 6. Using the CRUD GraphQL API

The schema that specifies the API operations of your GraphQL server is defined in [`./src/schema.graphql`](./src/schema.graphql). Below are a number of operations that you can send to the API using the GraphQL Playground.

Feel free to adjust any operation by adding or removing fields. The GraphQL Playground helps you with its auto-completion and query validation features.

#### Retrieve all posts and their authors

```graphql
query {
  posts {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

<Details><Summary><strong>See more API operations</strong></Summary>

#### Create a new user

```graphql
mutation {
  createUser(data: {
    name: "Sarah"
    email: "sarah@prisma.io"
  }) {
    id
  }
}
```

#### Create a new post

```graphql
mutation {
  createPost(data: {
    title: "Join the Prisma Slack"
    content: "https://slack.prisma.io"
    author: {
      connect: { email: "alice@prisma.io" }
    }
  }) {
    id
    published
    author {
      id
      name
    }
  }
}
```

#### Update an existing draft

```graphql
mutation {
  updatePost(
    where: { id: "__POST_ID__" }
    data: { published: true }
  ) {
    id
    published
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `posts`-query.

#### Search for posts with a specific title or content

```graphql
{
  posts(where: {
    OR: [{
      title_contains: "graphql"
    }, {
      content_contains: "graphql"
    }]
  }) {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

#### Retrieve a single post

```graphql
{
  post(where: { id: "__POST_ID__"}) {
    id
    title
    content
    published
    author {
      id
      name
      email
    }
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `posts`-query.

#### Delete a post

```graphql
mutation {
  deletePost(where: { id: "__POST_ID__"}) {
    id
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `posts`-query.

</Details>

### 6. Changing the GraphQL schema

To make changes to the GraphQL schema, you need to manipulate the `Query` and `Mutation` types that are defined in [`index.ts`](./src/index.ts).

Note that the [`start`](./package.json#L6) script also starts a development server that automatically updates your schema every time you save a file. This way, the auto-generated [GraphQL schema](./src/generated/schema.graphql) updates whenever you make changes in to the `Query` or `Mutation` types inside your TypeScript code.

## Next steps

- Read the [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/)
- Check out the [Prisma 2 docs](https://github.com/prisma/prisma2)
- Share your feedback in the [`prisma2-preview`](https://prisma.slack.com/messages/CKQTGR6T0/) channel on the Prisma Slack
