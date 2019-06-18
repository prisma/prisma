# Simple Node Script Example

This example shows how to use the Prisma client in a **simple Node script** to read and write data in a database.

## How to use

### 1. Download example & install dependencies

Clone the repository:

```
git clone git@github.com:prisma/photonjs.git
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
prisma2 generate
```

### 4. Run the script

Execute the script with this command: 

```
npm run start
```

## Next steps

- [Use Prisma with an existing database](https://github.com/prisma/prisma2-docs/blob/master/introspection.md)
- [Explore the Photon API](https://github.com/prisma/prisma2-docs/blob/master/photon/api.md)