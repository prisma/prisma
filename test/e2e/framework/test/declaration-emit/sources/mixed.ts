import paradedb from '@prisma/orm-extension-paradedb/pack';
import pgvector from '@prisma/orm-extension-pgvector/pack';
import postgis from '@prisma/orm-extension-postgis/pack';
import { defineContract } from '@prisma/orm-postgres/contract-builder';

export const mixed = defineContract(
  { extensions: { pgvector, postgis, paradedb } },
  ({ field, model }) => {
    const Item = model('Item', { fields: { id: field.id.uuidv4String() } });
    return { models: { Item: Item.sql({ table: 'item' }) } };
  },
);
