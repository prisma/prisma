# Upgrading to `preview019`

In version `2.0.0-preview019`, scalar list support has been removed for MySQL and SQLite. For PostgreSQL, Prisma is now using [PostgreSQL native scalar lists(_arrays_)](https://www.postgresql.org/docs/9.1/arrays.html) under the hood.

The way how scalar lists used to be supported in previous versions of Prisma is as follows, consider this Prisma schema:

```prisma
datasource db {
  provider = "postgresql"
  url      = "postgresql://nikolasburk:nikolasburk@localhost:5432/coinflips"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int       @id
  name      String    @default("")
  coinflips Boolean[]
}
```

This the SQL schema that gets generated when mapped to the DB:

```sql
-- Table Definition ----------------------------------------------

CREATE TABLE "User" (
    id integer DEFAULT nextval('"User_id_seq"'::regclass) PRIMARY KEY,
    name text NOT NULL DEFAULT ''::text
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX "User_pkey" ON "User"(id int4_ops);

-- Table Definition ----------------------------------------------

CREATE TABLE "User_coinflips" (
    "nodeId" integer REFERENCES "User"(id) ON DELETE CASCADE,
    position integer,
    value boolean NOT NULL,
    CONSTRAINT "User_coinflips_pkey" PRIMARY KEY ("nodeId", position)
);

-- Indices -------------------------------------------------------

CREATE UNIQUE INDEX "User_coinflips_pkey" ON "User_coinflips"("nodeId" int4_ops,position int4_ops);
```

This means the data for the `coinflips: Boolean[]` list from the Prisma schema is actually stored in another table called `User_coinflips` which include the foreign key `nodeId` pointing to a `User` record.  

## Workarounds when upgrading to `preview-019`

### PostgreSQL, MySQL and SQLite

Here's the envisioned workaround for MySQL and SQLite (note that PostgreSQL users alternatively can migrate their data to a native PostgreSQL array, more info [below](#only-postgresql)):

1. Copy the `User_coinflips` table, e.g. using:
    ```sql
    CREATE TABLE "User_coinflips_COPY" AS 
    TABLE "User_coinflips"; 
    ```

1. Add a primary key so it's compliant with the current Prisma conventions:
    ```sql
    ALTER TABLE "User_coinflips_COPY" ADD COLUMN ID SERIAL PRIMARY KEY;
    ```

1. Re-map this to your Prisma schema through introspection:
    ```
    prisma2 introspect --url="postgresql://nikolasburk:nikolasburk@localhost:5432/coinflips"
    ```

    This is the resulting Prisma schema:

    ```prisma
    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql"
      url      = "postgresql://nikolasburk:nikolasburk@localhost:5432/coinflips"
    }

    model User {
      id   Int    @id
      name String @default("")
    }

    model User_coinflips_COPY {
      id       Int      @id
      nodeId   Int?
      position Int?
      value    Boolean?
    }
    ```

1. Manually add `coinflips` relation:
    ```diff
    model User {
      id        Int                   @id
      name      String                @default("")
    +  coinflips User_coinflips_COPY[]
    }
    ```

1. Manually change the type of `nodeId` to `User?`
    ```diff
    model User_coinflips_COPY {
      id       Int      @id
    +  nodeId   User?
      position Int?
      value    Boolean?
    }
    ```

1. Re-generate Prisma Client JS:

    ```
    prisma2 generate
    ```

In your application code, you can now adjust the Prisma Client JS API calls. To access the `coinflips` data, you will now have to always [`include`](https://github.com/prisma/prisma2/blob/master/docs/prisma-client-js/api.md#include-additionally-via-include) it in yout API calls:

```ts
const user = await prisma.user.findOne({ 
  where: { id: 1 },
  include: {
    coinflips: {
      orderBy: { position: "asc" }
    }
  }
})
```

> The `orderBy` is important to retain the order of the list.

This is the result from the API call:

```js
{
  id: 1,
  name: 'Alice',
  coinflips: [
    { id: 1, position: 1000, value: false },
    { id: 2, position: 2000, value: true },
    { id: 3, position: 3000, value: false },
    { id: 4, position: 4000, value: true },
    { id: 5, position: 5000, value: true },
    { id: 6, position: 6000, value: false }
  ]
}
```

To access just the coinflip boolean values from the list, you can `map` of the `coinflips` on `user`:

```ts
const currentCoinflips = user!.coinflips.map(cf => cf.value)
```

> The exclamation mark above means that we're force unwrapping the `user` value. This is necessary because the `user` returned from the previous API call might be `null`.

Here's the value of `currentCoinflips` after the call to `map`:

```js
[ false, true, false, true, true, false ]
```

### Only PostgreSQL

As scalar lists (i.e. [arrays](https://www.postgresql.org/docs/9.1/arrays.html)) are available as a native PostgreSQL feature, you can keep using the same notation of `coinflips: Boolean[]` in your Prisma schema.

However, in order to do so you need to manually migrate the underlying data from the `User_coinflips` table into a PostgreSQL array. Here's how you can do that:

1. Add the new `coinflips` column to the `User` tables:
    ```sql
    ALTER TABLE "User" ADD COLUMN coinflips BOOLEAN[];
    ```

1. Migrate the data from `"User_coinflips".value` to `"User.coinflips"`:
    ```sql
    UPDATE "User"
      SET coinflips = t.flips
    FROM (
      SELECT "nodeId", array_agg(VALUE ORDER BY position) AS flips
      FROM "User_coinflips"
      GROUP BY "nodeId"
    ) t
    where t."nodeId" = "User"."id";
    ```

1. To cleanup, you can delete the `User_coinflips` table:
    ```sql
    DROP TABLE "User_coinflips"
    ```

You can keep using Prisma Client JS as before:

```ts
const user = await prisma.user.findOne({ 
  where: { id: 1 },
})
```

This is the result from the API call:

```js
{
  id: 1,
  name: 'Alice',
  coinflips: [ false, true, false, true, true, false ]
}
```