# #6579 - migrate dev --create-only with empty schema but existing database schema detects drift and warns about deleting all data

This sandbox provides a reproduction of https://github.com/prisma/prisma/issues/6579.

## Reproduction

1. Starting from a simple schema with a single model,

    ```prisma
    generator client {
      provider        = "prisma-client-js"
      output          = "../node_modules/.prisma/client"
      previewFeatures = []
    }

    datasource db {
      provider = "sqlite"
      url      = "file:./dev.db"
    }

    model User {
      id        String   @id @default(uuid())
    }
    ```

    run `npx prisma migrate dev --name init`

    This should succeed with a message similar to:
    
    ```
    ❯ npx prisma migrate dev --name init
    Prisma schema loaded from prisma/schema.prisma
    Datasource "db": SQLite database "dev.db" at "file:./dev.db"

    SQLite database dev.db created at file:./dev.db

    Applying migration `20240119155220_init`

    The following migration(s) have been created and applied from new schema changes:

    migrations/
      └─ 20240119155220_init/
        └─ migration.sql

    Your database is now in sync with your schema.

    ✔ Generated Prisma Client (v0.0.0) to ./node_modules/.prisma/client in 36ms
    ```

2. Now, remove the `User` model in the schema:

    ```diff
    generator client {
      provider        = "prisma-client-js"
      output          = "../node_modules/.prisma/client"
      previewFeatures = []
    }

    datasource db {
      provider = "sqlite"
      url      = "file:./dev.db"
    }

    - model User {
    -   id        String   @id @default(uuid())
    - }
    ```

3. Run `rm -rf ./prisma/migrations`

4. Run `npx prisma migrate dev --create-only --name create-only`. This should prompt the following:

    ```
    ❯ npx prisma migrate dev --create-only --name create-only
    Prisma schema loaded from prisma/schema.prisma
    Datasource "db": SQLite database "dev.db" at "file:./dev.db"

    - Drift detected: Your database schema is not in sync with your migration history.

    The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

    It should be understood as the set of changes to get from the expected schema to the actual schema.

    [+] Added tables
      - User

    - The following migration(s) are applied to the database but missing from the local migrations directory: 20240119155220_init

    ? We need to reset the SQLite database "dev.db" at "file:./dev.db"
    Do you want to continue? All data will be lost. › (y/N)
    ```
