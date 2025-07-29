# Developing on MongoDB

1. Make sure you have the mongod binary installed. I installed it with homebrew

   brew install mongodb-community

2. Create a location for your data _(from `packages/client/fixtures/mongo`)_

   mkdir -a ./data/db

3. Run a mongod server _(from `packages/client/fixtures/mongo`)_

   mongod --dbpath data/db

4. Generate a client _(from `packages/client`)_

   ts-node fixtures/generate.ts ./fixtures/mongo/

5. Run the `main.ts` _(from `packages/client/fixtures/mongo`)_

   ts-node main.ts

If you run into issues, I recommend using the `DEBUG=prisma:client`
