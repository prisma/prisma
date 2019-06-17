export interface MissingItem {
    path: string;
    isRequired: boolean;
    type: string | object;
}
export declare function printJsonWithErrors(ast: object, keyPaths: string[], valuePaths: string[], missingItems?: MissingItem[]): any;
