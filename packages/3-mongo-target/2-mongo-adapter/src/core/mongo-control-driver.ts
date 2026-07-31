import type { ControlDriverInstance } from '@internal/framework-components/control';
import type { MongoControlDriverInstance } from '@internal/mongo-lowering';

export function isMongoControlDriver(
  driver: ControlDriverInstance<'mongo', string>,
): driver is MongoControlDriverInstance {
  return (
    driver.familyId === 'mongo' &&
    driver.targetId === 'mongo' &&
    'execute' in driver &&
    typeof driver.execute === 'function'
  );
}
