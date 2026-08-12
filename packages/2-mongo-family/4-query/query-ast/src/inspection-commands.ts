import { MongoAstNode } from './ast-node';
import type { MongoInspectionCommandVisitor } from './ddl-visitors';

export class ListIndexesCommand extends MongoAstNode {
  readonly kind = 'listIndexes' as const;
  readonly collection: string;

  constructor(collection: string) {
    super();
    this.collection = collection;
    this.freeze();
  }

  accept<R>(visitor: MongoInspectionCommandVisitor<R>): R {
    return visitor.listIndexes(this);
  }
}

export class ListCollectionsCommand extends MongoAstNode {
  readonly kind = 'listCollections' as const;

  constructor() {
    super();
    this.freeze();
  }

  accept<R>(visitor: MongoInspectionCommandVisitor<R>): R {
    return visitor.listCollections(this);
  }
}

export type AnyMongoInspectionCommand = ListIndexesCommand | ListCollectionsCommand;
