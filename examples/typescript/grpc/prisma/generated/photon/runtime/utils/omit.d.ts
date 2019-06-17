export declare type Exclude<T, U> = T extends U ? never : T;
export declare type Omit<T, K extends keyof any> = {
    [P in Exclude<keyof T, K>]: T[P];
};
export declare function omit<T extends object, K extends keyof T>(object: T, path: K): Omit<T, K>;
