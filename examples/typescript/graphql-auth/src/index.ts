import { nexusPrismaPlugin } from "@generated/nexus-prisma";
import Photon from "@generated/photon";
import { makeSchema } from "@prisma/nexus";
import { GraphQLServer } from "graphql-yoga";
import { join } from "path";
import { permissions } from "./permissions";
import * as allTypes from "./resolvers";
import { Context } from "./types";

const photon = new Photon({
  debug: true
});

const nexusPrisma = nexusPrismaPlugin({
  photon: (ctx: Context) => ctx.photon
});

const schema = makeSchema({
  types: [allTypes, nexusPrisma],
  outputs: {
    typegen: join(__dirname, "../generated/nexus-typegen.ts"),
    schema: join(__dirname, "/schema.graphql")
  },
  typegenAutoConfig: {
    sources: [
      {
        source: "@generated/photon",
        alias: "photon"
      },
      {
        source: join(__dirname, "types.ts"),
        alias: "ctx"
      }
    ],
    contextType: "ctx.Context"
  }
});

const server = new GraphQLServer({
  schema,
  // middlewares: [permissions], // TODO: Fix after https://github.com/maticzav/graphql-shield/issues/361
  context: request => {
    return {
      ...request,
      photon
    };
  }
});

server
  .start(() => console.log(`🚀 Server ready at http://localhost:4000`))
  .then(httpServer => {
    async function cleanup() {
      await photon.disconnect();
      httpServer.close();
    }

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  });
