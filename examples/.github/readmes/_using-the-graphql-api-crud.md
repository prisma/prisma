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