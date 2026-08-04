import type { FamilyPackRef } from '@internal/framework-components/components';
import {
  mongoFamilyEntityTypes,
  mongoFamilyPslBlockDescriptors,
} from '../core/authoring-entity-types';

const mongoFamilyPack = {
  kind: 'family',
  id: 'mongo',
  familyId: 'mongo',
  version: '0.0.1',
  authoring: {
    entityTypes: mongoFamilyEntityTypes,
    pslBlockDescriptors: mongoFamilyPslBlockDescriptors,
  },
} as const satisfies FamilyPackRef<'mongo'>;

export default mongoFamilyPack;
export { mongoFamilyEntityTypes, mongoFamilyPslBlockDescriptors };
