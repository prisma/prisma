npm install

```

### 2. Install the Prisma CLI

To run the example, you need the Prisma CLI. Please install it via NPM.

```

npm install -g prisma2

```

### 3. Set up database & deploy Prisma schema

To set up your database, run:

```

prisma2 lift save --name 'init'
prisma2 lift up

```

Your database is now set up, to try out this example please run

```

yarn start

```

```
