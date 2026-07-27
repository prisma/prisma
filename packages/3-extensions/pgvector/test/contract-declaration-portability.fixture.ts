import pgvector from '@prisma-next/extension-pgvector/pack';
import { defineContract } from '@prisma-next/postgres/contract-builder';

export const pgvectorContract = defineContract({ extensions: { pgvector } }, ({ type }) => ({
  types: {
    Vector3: type.pgvector.Vector(3),
  },
}));
