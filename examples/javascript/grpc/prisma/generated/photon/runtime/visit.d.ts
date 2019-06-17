import { Arg, Document } from './query';
interface Visitor {
    Arg: {
        enter: (node: Arg) => Arg | undefined;
    };
}
export declare function visit(document: Document, visitor: Visitor): Document;
export {};
