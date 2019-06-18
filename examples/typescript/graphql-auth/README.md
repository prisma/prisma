# GraphQL Server with Authentication & Permissions

This example shows how to implement a **GraphQL server with an email-password-based authentication workflow and authentication rules**, based on Prisma, [graphql-yoga](https://github.com/prisma/graphql-yoga), [graphql-shield](https://github.com/maticzav/graphql-shield) & [GraphQL Nexus](https://graphql-nexus.com/).

## How to use

### 1. Download example & install dependencies

Clone the repository:

```
git clone git@github.com:prisma/prisma-examples.git
```

Install Node dependencies:

```
cd examples/typescript/graphql-auth
npm install
```

### 2. Install the Prisma CLI

To run the example, you need the Prisma CLI. Please install it via NPM or [using another method](https://www.prisma.io/docs/prisma-cli-and-configuration/using-the-prisma-cli-alx4/#installation):

```
npm install -g prisma
```

### 3. Set up database & deploy Prisma datamodel

For this example, you'll use a free _demo database_ (AWS Aurora) hosted in Prisma Cloud. To set up your database, run:

```
prisma deploy
```

Then, follow these steps in the interactive CLI wizard:

1. Select **Demo server**
1. **Authenticate** with Prisma Cloud in your browser (if necessary)
1. Back in your terminal, **confirm all suggested values**

<details>
 <summary>Alternative: Run Prisma locally via Docker</summary>

1. Ensure you have Docker installed on your machine. If not, you can get it from [here](https://store.docker.com/search?offering=community&type=edition).
1. Create `docker-compose.yml` for MySQL (see [here](https://www.prisma.io/docs/prisma-server/database-connector-POSTGRES-jgfr/) for Postgres):
    ```yml
    version: '3'
    services:
      prisma:
        image: prismagraphql/prisma:1.34
        restart: always
        ports:
        - "4466:4466"
        environment:
          PRISMA_CONFIG: |
            port: 4466
            databases:
              default:
                connector: mysql
                host: mysql
                port: 3306
                user: root
                password: prisma
                migrations: true
      mysql:
        image: mysql:5.7
        restart: always
        environment:
          MYSQL_ROOT_PASSWORD: prisma
        volumes:
          - mysql:/var/lib/mysql
    volumes:
      mysql:
    ```
1. Run `docker-compose up -d`
1. Set the `endpoint` in `prisma.yml` to `http://localhost:4466`
1. Run `prisma deploy`

</details>

You can now use [Prisma Admin](https://www.prisma.io/docs/prisma-admin/overview-el3e/) to view and edit your data by appending `/_admin` to your Prisma endpoint.

### 4. Start the GraphQL server

Launch your GraphQL server with this command:

```
npm run start
```

Navigate to [http://localhost:4000](http://localhost:4000) in your browser to explore the API of your GraphQL server in a [GraphQL Playground](https://github.com/prisma/graphql-playground).

### 5. Using the GraphQL API

The schema that specifies the API operations of your GraphQL server is defined in [`./src/schema.graphql`](./src/schema.graphql). Below are a number of operations that you can send to the API using the GraphQL Playground.

Feel free to adjust any operation by adding or removing fields. The GraphQL Playground helps you with its auto-completion and query validation features.

#### Retrieve all published posts and their authors

```graphql
query {
  feed {
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

#### Register a new user

You can send the following mutation in the Playground to sign up a new user and retrieve an authentication token for them:

```graphql
mutation {
  signup(name: "Alice", email: "alice@prisma.io", password: "graphql") {
    token
  }
}
```

#### Log in an existing user

This mutation will log in an existing user by requesting a new authentication token for them:

```graphql
mutation {
  login(email: "alice@prisma.io", password: "graphql") {
    token
  }
}
```

#### Check whether a user is currently logged in with the `me` query

For this query, you need to make sure a valid authentication token is sent along with the `Bearer`-prefix in the `Authorization` header of the request:

```json
{
  "Authorization": "Bearer __YOUR_TOKEN__"
}
```

With a real token, this looks similar to this:

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjanAydHJyczFmczE1MGEwM3kxaWl6c285IiwiaWF0IjoxNTQzNTA5NjY1fQ.Vx6ad6DuXA0FSQVyaIngOHYVzjKwbwq45flQslnqX04"
}
```

Inside the Playground, you can set HTTP headers in the bottom-left corner:

![](https://imgur.com/ToRcCTj.png)

Once you've set the header, you can send the following query to check whether the token is valid:

```graphql
{
  me {
    id
    name
    email
  }
}
```

#### Create a new draft

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground.

```graphql
mutation {
  createDraft(
    title: "Join the Prisma Slack"
    content: "https://slack.prisma.io"
  ) {
    id
    published
  }
}
```

#### Publish an existing draft

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. The authentication token must belong to the user who created the post.

```graphql
mutation {
  publish(id: "__POST_ID__") {
    id
    published
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

#### Search for posts with a specific title or content

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. 

```graphql
{
  filterPosts(searchString: "graphql") {
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

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. 

```graphql
{
  post(id: "__POST_ID__") {
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

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

#### Delete a post

You need to be logged in for this query to work, i.e. an authentication token that was retrieved through a `signup` or `login` mutation needs to be added to the `Authorization` header in the GraphQL Playground. The authentication token must belong to the user who created the post.

```graphql
mutation {
  deletePost(id: "__POST_ID__") {
    id
  }
}
```

> **Note**: You need to replace the `__POST_ID__`-placeholder with an actual `id` from a `Post` item. You can find one e.g. using the `filterPosts`-query.

</Details>

### 6. Changing the GraphQL schema

To make changes to the GraphQL schema, you need to manipulate the [`Query`](./src/resolvers/Query.ts) and [`Mutation`](./src/resolvers/Mutation.ts) types. 

Note that the [`start`](./package.json#L6) script also starts a development server that automatically updates your schema every time you save a file. This way, the auto-generated [GraphQL schema](./src/generated/schema.graphql) updates whenever you make changes in to the `Query` or `Mutation` types inside your TypeScript code.

## Next steps

- [Use Prisma with an existing database](https://github.com/prisma/prisma2-docs/blob/master/introspection.md)
- [Explore the Photon API](https://github.com/prisma/prisma2-docs/blob/master/photon/api.md)
