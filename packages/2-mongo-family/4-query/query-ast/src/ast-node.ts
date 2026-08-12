export abstract class MongoAstNode {
  abstract readonly kind: string;

  protected freeze(): void {
    Object.freeze(this);
  }
}
