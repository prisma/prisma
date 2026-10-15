import { geometry } from '@prisma/orm-extension-postgis/column-types';
import postgis from '@prisma/orm-extension-postgis/pack';
import { defineContract } from '@prisma/orm-postgres/contract-builder';

export const geo = defineContract({ extensions: { postgis } }, ({ field, model }) => {
  const Place = model('Place', {
    fields: { id: field.id.uuidv4String(), loc: field.column(geometry({ srid: 4326 })) },
  });
  return { models: { Place: Place.sql({ table: 'place' }) } };
});
