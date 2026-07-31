import pgvector from '@internal/extension-pgvector/pack';
import { defineContract } from '@internal/postgres/contract-builder';

export const pgvectorContract = defineContract({ extensions: { pgvector } }, ({ type }) => ({
  types: {
    Vector3: type.pgvector.Vector(3),
  },
}));
