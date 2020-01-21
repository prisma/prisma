# Deployment

Prisma Client JS depends on a query engine that's running as a binary on the same host as your application. When deploying your Prisma-based application to production, you need to ensure that the binary used by Prisma Client JS can run in your production environment, i.e. it needs to be compatible with the runtime of your deployment provider.

The query engine binary is downloaded when you run `prisma2 generate`, it is then stored alongside the generated Prisma Client JS code inside `node_modules/@prisma` (or the [custom `output` path](./codegen-and-node-setup.md) you specified).

**IMPORTANT**: To ensure the query engine binary is compatible with your production environment, you have to [specify the right platform for Prisma Client JS](../core/generators/prisma-client-js.md#specifying-the-right-platform-for-prisma-client-js).

## Prisma Client JS in FaaS environment (e.g. AWS Lambda, Netlify, ...)

### Database connection handling

Nuances around handling database connections in Lambda are not new and most of those nuances also apply to Prisma Client JS.

Lambda has the concept of [reusing a container](https://aws.amazon.com/blogs/compute/container-reuse-in-lambda/) which means that for subsequent invocations of
the same function it may use an already existing container that has the allocated processes, memory, file system (`/tmp` is writable in Lambda), and even DB
connection still available.

Any piece of code [outside the handler](https://docs.aws.amazon.com/lambda/latest/dg/programming-model-v2.html) remains initialized. This is a great place for
`PrismaClient` to call `connect` or at least call `PrismaClient` constructor so that subsequent invocations can share a connection. There are some implications though that are not directly related to Prisma Client JS but any system that would require a DB connection from Lambda:

| Implication               | Description                                                                                                                                                                                                                                                                                                                           | Potential Solution                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container reuse           | It is not guaranteed that subsequent nearby invocations of a function will hit the same container. AWS can choose to create a new container at any time.                                                                                                                                                                              | Code should assume the container to be stateless and create a connection only if it does not exist. Prisma Client JS already implements that logic.                        |
| Zombie connections        | The containers that are marked to be removed and are not being reused still keep a connection open and can stay in that state for some time (unknown and not documented from AWS), this can lead to a sub-optimal utilization of the DB connections                                                                                   | One potential solution is to use a lower idle connection timeout. Another solution can be to clean up the idle connections in a separate service<sup>1, 2</sup>. |
| Connection pooling issues | Concurrent requests might spin up separate containers i.e. new connections. This makes connection pooling a bit difficult to manage because if there is a pool of size N and C concurrent containers, the effective number of connections is N \* C. It is very easy to exhaust `max_connection` limits of the underlying data source | Prisma Client JS does not implement connection pooling right now. This can also be handled by limiting the concurrency levels of a Lambda function.                        |

<br />
<sup>
1. Note that these are recommendations and not best practices. These would vary from system to system.
</sup>
<br />
<sup>
2. <a href="https://github.com/jeremydaly/serverless-mysql"><code>serverless-mysql</code></a> is a library that implements this idea.
</sup>

### Cold starts

A serverless function container may be recycled at any point. There is no official documented amount of time on when that happen but running a function warmer
does not work, containers are recycled regardless.

## Examples

Here are a number of example projects demonstrating how to deploy Prisma Client JS to various deployment providers:

- [Google Cloud Functions](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/google-cloud-functions)
- [Netlify](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/netlify)
- [Serverless](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/serverless)
- [Up](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/up)
- [ZEIT Now](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/zeit-now)

## Deployment providers

### AWS Lambda

In order to not exhaust the connection limits of your database, you should set the `connection_limit` parameter of your database connection string in the Prisma schema to `1` when deploying your Prisma-based application to [AWS Lambda]().

**PostgreSQL**

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?connection_limit=1
```

**MySQL**

```
mysql://USER:PASSWORD@HOST:PORT/DATABASE?connection_limit=1
```

Note that depending on your Lambda concurrency limit, you might still exhaust your database's connection limit. This can happen when too many Lambdas are invoked concurrently (i.e. the number of concurrent Lambdas that each hold a DB connection exceeds the connection limit of your database). To prevent this, you should [set your Lambda concurrency limit](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html) to number that represents the connection limit of your database.

| Instance size | Connection limit |
| :----------- | :------------ |
|   t2.micro    |       77       |
|   t2.small    |      188       |
|   t2.medium   |      403       |
|   t2.large    |      846       |
|   t2.xlarge   |      1733      |
|  t2.2xlarge   |      3508      |
|   m5.large    |      813       |
|   m5.xlarge   |      1681      |
|  m5.2xlarge   |      3419      |
|  m5.4xlarge   |      4990      |

This means that if you're e.g. using a `m5.large` PostgreSQL instance, you need to set your Lambda concurrency limit to `813`.

### ZEIT Now

You can deploy your Prisma-based application to [ZEIT Now](https://zeit.co/now).

When deploying to ZEIT Now, you must configure the following in your `now.json`:

- `use`: `@now/node@canary`
- `maxLambdaSize`: `25mb`

Here is an example `now.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@now/node@canary",
      "config": {
        "maxLambdaSize": "25mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

You can find an example for a ZEIT Now deployment [here](https://github.com/prisma/prisma-examples/tree/prisma2/deployment-platforms/zeit-now).
