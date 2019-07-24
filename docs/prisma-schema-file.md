# Prisma schema file

The Prisma schema file (short: _schema file_, _Prisma schema_ or just _schema_) is the main configuration file for your Prisma setup. It is typically called `schema.prisma` and consists of the following parts:

- [**Data sources**](./data-sources.md): Specify the details of the data sources Prisma should connect to (e.g. a PostgreSQL database)
- [**Data model definition**](./data-modeling.md): Specifies your application models (the shape of the data per data source)
- [**Generators**](#generators-optional) (optional): Specifies what clients should be generated based on the data model (e.g. Photon JS)

Whenever a `prisma2` command is invoked, the CLI typically reads some information from the schema file, e.g.:

- `prisma2 generate`: Reads _all_ above mentioned information from the datamodel to generated the right data source client code (e.g. Photon JS).
- `prisma2 lift save`: Reads the data sources and data model definition to create a new [migration](). 

You can also [use environment variables](#using-environment-variables) inside the schema file to provide configuration options when a CLI command is invoked. 

## Example

Here is a simple example for a schema file that specifies a data source (SQLite), a generator (Photon JS) and a simple data model definition:

```groovy
// schema.prisma

datasource mysql {
  url      = "file:data.db"
  provider = "sqlite"
}

generator photonjs {
  provider = "photonjs"
}

model User {
  id        Int      @id
  createdAt DateTime @default(now())
  email     String   @unique
  name      String?
  role      Role     @default(USER)
  posts     Post[]
}

model Post {
  id         Int        @id
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  author     User
  title      String
  published  Boolean    @default(false)
}

enum Role {
  USER
  ADMIN
}
```

## Naming

The default name for the schema file is `schema.prisma`. When your schema file is named like this, the Prisma 2 CLI will detect it automatically in the directory where you invoke the CLI command.

If the schema file is named differently, you can provide an explicit option to the command to point the CLI to the location of the schema file.

> **Note**: The CLI option to specify the path to the schema file is not yet implemented. You can track the progress of this issue [here](https://github.com/prisma/prisma2/issues/225).

## Syntax

The schema file is written in Prisma Schema Language (PSL). You can find a full reference for PSL in the [spec](https://github.com/prisma/specs/tree/master/prisma-schema).

## Building blocks

### Data sources

A data source can be specified using a `datasource` block in the schema file.

#### Fields

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `provider` | **Yes** | Enum (`postgresql`, `mysql`, `sqlite`) | Describes which data source connector to use. |
| `url` | **Yes** | String (URL) | Connection URL including authentication info. Each data source connector documents the URL syntax. Most connectors use the syntax provided by the database. |
| `enabled` | No | Boolean | Use environment variables to enable/disable a data source. **Default**: `true`. |

A data source connector may bring its own fields to allow users to tailor their data models according to specific features of the connected data sources.

#### Naming conventions

Data sources are typically named according to the `provider`:

```groovy
datasource sqlite {
  provider  = "sqlite"
  url       = env("SQLITE_URL")
}

datasource mysql {
  provider  = "mysql"
  url       = env("SQLITE_URL")
}

datasource postgresql {
  provider  = "postgresql"
  url       = env("SQLITE_URL")
}

datasource mongo {
  provider  = "mongo"
  url       = env("SQLITE_URL")
}
```

This is just a general convention, technically data sources can be named anything. Lowercase spelling is typically preferred. There might be special circumstances, such as [switching data sources based on environments](#switching-data-sources-based-on-environments), when it can make sense to apply a different naming scheme.


#### Examples

```groovy
datasource pg {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
  enabled  = true
}

datasource mysql {
  provider = "mysql"
  url      = env("MYSQL_URL")
}

datasource mongo {
  provider = "mongodb"
  url      = env("MONGO_URL")
}
```

### Generators (optional)

A generator configures what data source clients are generated and how they're generated. Language preferences and configuration will go in here.


#### Fields

| Name | Required | Type | Description |
| --- | --- | --- | --- |
| `provider` | **Yes** | String (file path) or Enum (`javascript`, `typescript`, `golang`) | Describes which generator to use. This can point to a file that implements a generator or specify a built-in generator directly. |
| `output` | **Yes** | String (file path) | Determines the location for the generated client. |

A generator may bring its own fields to allow users to customize the generation behaviour.

#### Examples

```groovy
generator js {
  provider = "photonjs"
}

generator js-custom-output {
  provider = "photonjs"
  output   = "../src/generated/photon"
}

generator nexus-prisma {
  provider = "nexus-prisma"
}

generator ts {
  provider = "./path/to/custom/generator"
}

generator go {
  snakeCase = true
  provider  = "my-go-provider"
}
```

> **Note**: The default `output` for the `photonjs` and `nexus-prisma` providers is your `node_modules` directory. This can be customized as seen in the second example in the code snippet above.

### Data model definition

There are several blocks you can use for _data modeling_ in your schema file:

- `model`
- `enum`
- `type`
- `embed`

There also are _attributes_ and _functions_ you can use to enhance the functionality of your data model definition.

Learn about the data modeling components in detail [here](./data-modeling.md)

## Using environment variables

You can use environment variables to provide configuration options when a CLI command is invoked. This is helpful e.g. to:

- Keep secrets out of the schema file
- Improve portability of the schema file

### The `env` function

Environment variables can be provided using the `env` function:

```
datasource pg {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}
```

### Switching data sources based on environments

Sometimes it's helpful to target different environments based in the same schema file, for example:

```groovy
datasource db {
  enabled   = env("SQLITE_URL")
  provider  = "sqlite"
  url       = env("SQLITE_URL")
}

datasource db {
  enabled   = env("POSTGRES_URL")
  provider  = "postgresql"
  url       = env("POSTGRES_URL")
}

model User {
  id         Int    @id @db.int
  first_name String @unique
}
```

Depending on which environment variable is set (in this case `SQLITE_URL` or `POSTGRES_URL`), the respective data source will be used.

## Writing comments

There are two types of comments that are supported in the schema file:

- `// comment`: This comment is for the reader's clarity and is not present in the AST of the schema file.
- `/// comment`: These comments will show up in the AST of the schema file, either as descriptions to AST nodes or as free-floating comments. Tools can then use these comments to provide additional information to the user.

Here are some different examples:

```groovy
/// This comment will get attached to the `User` node
model User {
  /// This comment will get attached to the `id` node
  id      Int
  // This comment is just for you
  weight  Float /// This comment gets attached to the `weight` node
}

// This comment is just for you. This comment will not
// show up in the AST.

/// This is a free-floating comment that will show up
/// in the AST as a `Comment` node, but is not attached
/// to any other node. We can use these for documentation
/// in the same way that godoc.org works.

model Customer {}
```


## Auto Formatting

Following the lead of [gofmt](https://golang.org/cmd/gofmt/) and [prettier](https://github.com/prettier/prettier), PDL syntax ships with a formatter for `.prisma` files.

Like `gofmt` and unlike `prettier`, there are no options for configurability here. **There is exactly one way to format a prisma file**.

This strictness serves two benefits:

1. No bikeshedding. There's a saying in the Go community that, "Gofmt's style is nobody's favorite, but gofmt is everybody's favorite."
2. No pull requests with different spacing schemes.

### Formatting Rules

#### Configuration blocks are align by their `=` sign

```groovy
block _ {
  key      = "value"
  key2     = 1
  long_key = true
}
```

Formatting may be reset up by a newline:

```groovy
block _ {
  key   = "value"
  key2  = 1
  key10 = true

  long_key   = true
  long_key_2 = true
}
```

Multiline objects follow their own nested formatting rules:

```groovy
block _ {
  key   = "value"
  key2  = 1
  key10 = {
    a = "a"
    b = "b"
  }
  key10 = [
    1,
    2
  ]
}
```

#### Field definitions are aligned into columns separated by 2 or more spaces

```groovy
block _ {
  id          String       @id
  first_name  LongNumeric  @default
}
```

Multiline field attributes are properly aligned with the rest of the field
attributes:

```groovy
block _ {
  id          String       @id
                           @default
  first_name  LongNumeric  @default
}
```

Formatting may be reset by a newline:

```groovy
block _ {
  id  String  @id
              @default

  first_name  LongNumeric  @default
}
```

Inline embeds add their own nested formatting rules:

```groovy
model User {
  id        String
  name      String
  customer  embed {
    id         String
    full_name  String
    cards   embed {
      type  Card
    }[]
  }?
  age   Int
  email String
}
```
