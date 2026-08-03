import type { ControlDriverInstance } from '@internal/framework-components/control';
import type { AnyMongoDdlWireCommand, AnyMongoDmlWireCommand } from '@internal/mongo-wire';
import type { Db } from 'mongodb';

export interface MongoDriver {
  execute<Row>(wireCommand: AnyMongoDmlWireCommand): AsyncIterable<Row>;
  run(wireCommand: AnyMongoDdlWireCommand): Promise<void>;
  close(): Promise<void>;
}

export interface MongoControlDriverInstance
  extends ControlDriverInstance<'mongo', 'mongo'>,
    MongoDriver {
  readonly db: Db;
}
