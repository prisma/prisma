# Simple Node Script Example

This example shows how to use the Prisma client in a **simple Node script** to read and write data in a database.

## How to use

### 1. Download example & install dependencies

Clone the repository:

```
git clone git@github.com:prisma/prisma-examples.git
```

Install Node dependencies:

```
cd examples/javascript/script
npm install
```

### 2. Install the Prisma CLI

To run the example, you need the Prisma CLI. Please install it via NPM.

```
npm install -g prisma2
```

### 3. Set up database & deploy Prisma schema

```
prisma2 lift save --name 'init'
prisma2 lift up
```

### 4. Run the script

Execute the script with this command: 

```
npm run start
```

## Next steps

- [Use Prisma with an existing database](https://www.prisma.io/docs/-a003/)
- [Explore the Prisma client API](https://www.prisma.io/client/client-javascript)
- [Learn more about the GraphQL schema](https://www.prisma.io/blog/graphql-server-basics-the-schema-ac5e2950214e/)