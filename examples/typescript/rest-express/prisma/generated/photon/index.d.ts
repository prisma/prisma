import { DMMF, DMMFClass, Engine, Datasource } from './runtime';
/**
 * Utility Types
 */
export declare type Enumerable<T> = T | Array<T>;
export declare type MergeTruthyValues<R extends object, S extends object> = {
    [key in keyof S | keyof R]: key extends false ? never : key extends keyof S ? S[key] extends false ? never : S[key] : key extends keyof R ? R[key] : never;
};
export declare type CleanupNever<T> = {
    [key in keyof T]: T[key] extends never ? never : key;
}[keyof T];
/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export declare type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
};
declare class PhotonFetcher {
    private readonly engine;
    private readonly debug;
    private readonly hooks?;
    private url?;
    constructor(engine: Engine, debug?: boolean, hooks?: Hooks | undefined);
    request<T>(document: any, path?: string[], rootField?: string, typeName?: string): Promise<T>;
    protected unpack(result: any, path: string[], rootField?: string): any;
}
/**
 * Client
**/
export declare type Datasources = {
    db?: Datasource;
};
export interface PhotonOptions {
    datasources?: Datasources;
    autoConnect?: boolean;
    debug?: boolean | {
        engine?: boolean;
        library?: boolean;
    };
    /**
     * You probably don't want to use this. `__internal` is used by internal tooling.
     */
    __internal?: {
        hooks?: Hooks;
        engine?: {
            cwd?: string;
            binaryPath?: string;
        };
    };
}
export declare type Hooks = {
    beforeRequest?: (options: {
        query: string;
        path: string[];
        rootField?: string;
        typeName?: string;
        document: any;
    }) => any;
};
export default class Photon {
    private fetcher;
    private readonly dmmf;
    private readonly engine;
    private readonly autoConnect;
    private readonly internalDatasources;
    private readonly datamodel;
    private connectionPromise?;
    constructor(options?: PhotonOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    private _query?;
    readonly query: QueryDelegate;
    private _users?;
    readonly users: UserDelegate;
    private _posts?;
    readonly posts: PostDelegate;
}
/**
 * Query
 */
export declare type QueryArgs = {
    findOneUser?: FindOneUserArgs;
    findManyUser?: FindManyUserArgs;
    findOnePost?: FindOnePostArgs;
    findManyPost?: FindManyPostArgs;
};
declare type QueryGetPayload<S extends QueryArgs> = S extends QueryArgs ? {
    [P in keyof S]: P extends 'findManyUser' ? Array<UserGetPayload<ExtractFindManyUserArgsSelect<S[P]>>> : P extends 'findOneUser' ? UserGetPayload<ExtractFindOneUserArgsSelect<S[P]>> : P extends 'findManyPost' ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>> : P extends 'findOnePost' ? PostGetPayload<ExtractFindOnePostArgsSelect<S[P]>> : never;
} : never;
interface QueryDelegate {
    <T extends QueryArgs>(args: Subset<T, QueryArgs>): PromiseLike<QueryGetPayload<T>>;
}
declare function QueryDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): QueryDelegate;
export declare const OrderByArg: {
    asc: "asc";
    desc: "desc";
};
export declare type OrderByArg = (typeof OrderByArg)[keyof typeof OrderByArg];
/**
 * Model User
 */
export declare type User = {
    id: string;
    email: string;
    name: string | null;
};
export declare type UserScalars = 'id' | 'email' | 'name';
export declare type UserSelect = {
    id?: boolean;
    email?: boolean;
    name?: boolean;
    posts?: boolean | FindManyPostArgs;
};
declare type UserDefault = {};
declare type UserGetPayload<S extends boolean | UserSelect> = S extends true ? User : S extends UserSelect ? {
    [P in CleanupNever<MergeTruthyValues<UserDefault, S>>]: P extends UserScalars ? User[P] : P extends 'posts' ? Array<PostGetPayload<ExtractFindManyPostArgsSelect<S[P]>>> : never;
} : never;
export interface UserDelegate {
    <T extends FindManyUserArgs>(args?: Subset<T, FindManyUserArgs>): PromiseLike<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>;
    findOne<T extends FindOneUserArgs>(args: Subset<T, FindOneUserArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractFindOneUserArgsSelect<T>>> : UserClient<User>;
    findMany<T extends FindManyUserArgs>(args?: Subset<T, FindManyUserArgs>): PromiseLike<Array<UserGetPayload<ExtractFindManyUserArgsSelect<T>>>>;
    create<T extends UserCreateArgs>(args: Subset<T, UserCreateArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserCreateArgsSelect<T>>> : UserClient<User>;
    delete<T extends UserDeleteArgs>(args: Subset<T, UserDeleteArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserDeleteArgsSelect<T>>> : UserClient<User>;
    update<T extends UserUpdateArgs>(args: Subset<T, UserUpdateArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserUpdateArgsSelect<T>>> : UserClient<User>;
    deleteMany<T extends UserDeleteManyArgs>(args: Subset<T, UserDeleteManyArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserDeleteManyArgsSelect<T>>> : UserClient<User>;
    updateMany<T extends UserUpdateManyArgs>(args: Subset<T, UserUpdateManyArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserUpdateManyArgsSelect<T>>> : UserClient<User>;
    upsert<T extends UserUpsertArgs>(args: Subset<T, UserUpsertArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserUpsertArgsSelect<T>>> : UserClient<User>;
}
declare class UserClient<T> implements PromiseLike<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UserArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private _posts?;
    posts<T extends FindManyPostArgs = {}>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>;
    protected readonly document: any;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
}
export declare type FindOneUserArgs = {
    select?: UserSelect;
    where: UserWhereUniqueInput;
};
export declare type FindOneUserArgsWithSelect = {
    select: UserSelect;
    where: UserWhereUniqueInput;
};
declare type ExtractFindOneUserArgsSelect<S extends undefined | boolean | FindOneUserArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUserArgsWithSelect ? S['select'] : true;
export declare type FindManyUserArgs = {
    select?: UserSelect;
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: string;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUserArgsWithSelect = {
    select: UserSelect;
    where?: UserWhereInput;
    orderBy?: UserOrderByInput;
    skip?: string;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUserArgsSelect<S extends undefined | boolean | FindManyUserArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUserArgsWithSelect ? S['select'] : true;
export declare type UserCreateArgs = {
    select?: UserSelect;
    data: UserCreateInput;
};
export declare type UserCreateArgsWithSelect = {
    select: UserSelect;
    data: UserCreateInput;
};
declare type ExtractUserCreateArgsSelect<S extends undefined | boolean | UserCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserCreateArgsWithSelect ? S['select'] : true;
export declare type UserUpdateArgs = {
    select?: UserSelect;
    data: UserUpdateInput;
    where: UserWhereUniqueInput;
};
export declare type UserUpdateArgsWithSelect = {
    select: UserSelect;
    data: UserUpdateInput;
    where: UserWhereUniqueInput;
};
declare type ExtractUserUpdateArgsSelect<S extends undefined | boolean | UserUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserUpdateArgsWithSelect ? S['select'] : true;
export declare type UserUpdateManyArgs = {
    select?: UserSelect;
    data: UserUpdateManyMutationInput;
    where?: UserWhereInput;
};
export declare type UserUpdateManyArgsWithSelect = {
    select: UserSelect;
    data: UserUpdateManyMutationInput;
    where?: UserWhereInput;
};
declare type ExtractUserUpdateManyArgsSelect<S extends undefined | boolean | UserUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UserUpsertArgs = {
    select?: UserSelect;
    where: UserWhereUniqueInput;
    create: UserCreateInput;
    update: UserUpdateInput;
};
export declare type UserUpsertArgsWithSelect = {
    select: UserSelect;
    where: UserWhereUniqueInput;
    create: UserCreateInput;
    update: UserUpdateInput;
};
declare type ExtractUserUpsertArgsSelect<S extends undefined | boolean | UserUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserUpsertArgsWithSelect ? S['select'] : true;
export declare type UserDeleteArgs = {
    select?: UserSelect;
    where: UserWhereUniqueInput;
};
export declare type UserDeleteArgsWithSelect = {
    select: UserSelect;
    where: UserWhereUniqueInput;
};
declare type ExtractUserDeleteArgsSelect<S extends undefined | boolean | UserDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserDeleteArgsWithSelect ? S['select'] : true;
export declare type UserDeleteManyArgs = {
    select?: UserSelect;
    where?: UserWhereInput;
};
export declare type UserDeleteManyArgsWithSelect = {
    select: UserSelect;
    where?: UserWhereInput;
};
declare type ExtractUserDeleteManyArgsSelect<S extends undefined | boolean | UserDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UserArgs = {
    select?: UserSelect;
};
export declare type UserArgsWithSelect = {
    select: UserSelect;
};
declare type ExtractUserArgsSelect<S extends undefined | boolean | UserArgs> = S extends undefined ? false : S extends boolean ? S : S extends UserArgsWithSelect ? S['select'] : true;
/**
 * Model Post
 */
export declare type Post = {
    id: string;
    createdAt: string;
    updatedAt: string;
    published: boolean;
    title: string;
    content: string | null;
};
export declare type PostScalars = 'id' | 'createdAt' | 'updatedAt' | 'published' | 'title' | 'content';
export declare type PostSelect = {
    id?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    published?: boolean;
    title?: boolean;
    content?: boolean;
    author?: boolean | UserArgs;
};
declare type PostDefault = {};
declare type PostGetPayload<S extends boolean | PostSelect> = S extends true ? Post : S extends PostSelect ? {
    [P in CleanupNever<MergeTruthyValues<PostDefault, S>>]: P extends PostScalars ? Post[P] : P extends 'author' ? UserGetPayload<ExtractUserArgsSelect<S[P]>> : never;
} : never;
export interface PostDelegate {
    <T extends FindManyPostArgs>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>;
    findOne<T extends FindOnePostArgs>(args: Subset<T, FindOnePostArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractFindOnePostArgsSelect<T>>> : PostClient<Post>;
    findMany<T extends FindManyPostArgs>(args?: Subset<T, FindManyPostArgs>): PromiseLike<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>;
    create<T extends PostCreateArgs>(args: Subset<T, PostCreateArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostCreateArgsSelect<T>>> : PostClient<Post>;
    delete<T extends PostDeleteArgs>(args: Subset<T, PostDeleteArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostDeleteArgsSelect<T>>> : PostClient<Post>;
    update<T extends PostUpdateArgs>(args: Subset<T, PostUpdateArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostUpdateArgsSelect<T>>> : PostClient<Post>;
    deleteMany<T extends PostDeleteManyArgs>(args: Subset<T, PostDeleteManyArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostDeleteManyArgsSelect<T>>> : PostClient<Post>;
    updateMany<T extends PostUpdateManyArgs>(args: Subset<T, PostUpdateManyArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostUpdateManyArgsSelect<T>>> : PostClient<Post>;
    upsert<T extends PostUpsertArgs>(args: Subset<T, PostUpsertArgs>): 'select' extends keyof T ? PromiseLike<PostGetPayload<ExtractPostUpsertArgsSelect<T>>> : PostClient<Post>;
}
declare class PostClient<T> implements PromiseLike<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: PostArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private _author?;
    author<T extends UserArgs = {}>(args?: Subset<T, UserArgs>): 'select' extends keyof T ? PromiseLike<UserGetPayload<ExtractUserArgsSelect<T>>> : UserClient<User>;
    protected readonly document: any;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
}
export declare type FindOnePostArgs = {
    select?: PostSelect;
    where: PostWhereUniqueInput;
};
export declare type FindOnePostArgsWithSelect = {
    select: PostSelect;
    where: PostWhereUniqueInput;
};
declare type ExtractFindOnePostArgsSelect<S extends undefined | boolean | FindOnePostArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOnePostArgsWithSelect ? S['select'] : true;
export declare type FindManyPostArgs = {
    select?: PostSelect;
    where?: PostWhereInput;
    orderBy?: PostOrderByInput;
    skip?: string;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyPostArgsWithSelect = {
    select: PostSelect;
    where?: PostWhereInput;
    orderBy?: PostOrderByInput;
    skip?: string;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyPostArgsSelect<S extends undefined | boolean | FindManyPostArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyPostArgsWithSelect ? S['select'] : true;
export declare type PostCreateArgs = {
    select?: PostSelect;
    data: PostCreateInput;
};
export declare type PostCreateArgsWithSelect = {
    select: PostSelect;
    data: PostCreateInput;
};
declare type ExtractPostCreateArgsSelect<S extends undefined | boolean | PostCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostCreateArgsWithSelect ? S['select'] : true;
export declare type PostUpdateArgs = {
    select?: PostSelect;
    data: PostUpdateInput;
    where: PostWhereUniqueInput;
};
export declare type PostUpdateArgsWithSelect = {
    select: PostSelect;
    data: PostUpdateInput;
    where: PostWhereUniqueInput;
};
declare type ExtractPostUpdateArgsSelect<S extends undefined | boolean | PostUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostUpdateArgsWithSelect ? S['select'] : true;
export declare type PostUpdateManyArgs = {
    select?: PostSelect;
    data: PostUpdateManyMutationInput;
    where?: PostWhereInput;
};
export declare type PostUpdateManyArgsWithSelect = {
    select: PostSelect;
    data: PostUpdateManyMutationInput;
    where?: PostWhereInput;
};
declare type ExtractPostUpdateManyArgsSelect<S extends undefined | boolean | PostUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostUpdateManyArgsWithSelect ? S['select'] : true;
export declare type PostUpsertArgs = {
    select?: PostSelect;
    where: PostWhereUniqueInput;
    create: PostCreateInput;
    update: PostUpdateInput;
};
export declare type PostUpsertArgsWithSelect = {
    select: PostSelect;
    where: PostWhereUniqueInput;
    create: PostCreateInput;
    update: PostUpdateInput;
};
declare type ExtractPostUpsertArgsSelect<S extends undefined | boolean | PostUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostUpsertArgsWithSelect ? S['select'] : true;
export declare type PostDeleteArgs = {
    select?: PostSelect;
    where: PostWhereUniqueInput;
};
export declare type PostDeleteArgsWithSelect = {
    select: PostSelect;
    where: PostWhereUniqueInput;
};
declare type ExtractPostDeleteArgsSelect<S extends undefined | boolean | PostDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostDeleteArgsWithSelect ? S['select'] : true;
export declare type PostDeleteManyArgs = {
    select?: PostSelect;
    where?: PostWhereInput;
};
export declare type PostDeleteManyArgsWithSelect = {
    select: PostSelect;
    where?: PostWhereInput;
};
declare type ExtractPostDeleteManyArgsSelect<S extends undefined | boolean | PostDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends PostDeleteManyArgsWithSelect ? S['select'] : true;
export declare type PostArgs = {
    select?: PostSelect;
};
export declare type PostArgsWithSelect = {
    select: PostSelect;
};
/**
 * Deep Input Types
 */
export declare type PostWhereInput = {
    id?: string | StringFilter;
    createdAt?: string | Date | DateTimeFilter;
    updatedAt?: string | Date | DateTimeFilter;
    published?: boolean | BooleanFilter;
    title?: string | StringFilter;
    content?: string | NullableStringFilter | null;
    AND?: Enumerable<PostWhereInput>;
    OR?: Enumerable<PostWhereInput>;
    NOT?: Enumerable<PostWhereInput>;
    author?: UserWhereInput;
};
export declare type UserWhereInput = {
    id?: string | StringFilter;
    email?: string | StringFilter;
    name?: string | NullableStringFilter | null;
    posts?: PostFilter;
    AND?: Enumerable<UserWhereInput>;
    OR?: Enumerable<UserWhereInput>;
    NOT?: Enumerable<UserWhereInput>;
};
export declare type UserWhereUniqueInput = {
    id?: string;
    email?: string;
};
export declare type PostWhereUniqueInput = {
    id?: string;
};
export declare type PostCreateWithoutAuthorInput = {
    id?: string;
    published: boolean;
    title: string;
    content?: string;
};
export declare type PostCreateManyWithoutPostsInput = {
    create?: Enumerable<PostCreateWithoutAuthorInput>;
    connect?: Enumerable<PostWhereUniqueInput>;
};
export declare type UserCreateInput = {
    id?: string;
    email: string;
    name?: string;
    posts?: PostCreateManyWithoutPostsInput;
};
export declare type PostUpdateWithoutAuthorDataInput = {
    published?: boolean;
    title?: string;
    content?: string;
};
export declare type PostUpdateWithWhereUniqueWithoutAuthorInput = {
    where: PostWhereUniqueInput;
    data: PostUpdateWithoutAuthorDataInput;
};
export declare type PostScalarWhereInput = {
    AND?: Enumerable<PostScalarWhereInput>;
    OR?: Enumerable<PostScalarWhereInput>;
    NOT?: Enumerable<PostScalarWhereInput>;
    id?: string;
    id_not?: string;
    id_in?: Enumerable<string>;
    id_not_in?: Enumerable<string>;
    id_lt?: string;
    id_lte?: string;
    id_gt?: string;
    id_gte?: string;
    id_contains?: string;
    id_not_contains?: string;
    id_starts_with?: string;
    id_not_starts_with?: string;
    id_ends_with?: string;
    id_not_ends_with?: string;
    createdAt?: string | Date;
    createdAt_not?: string | Date;
    createdAt_in?: Enumerable<string | Date>;
    createdAt_not_in?: Enumerable<string | Date>;
    createdAt_lt?: string | Date;
    createdAt_lte?: string | Date;
    createdAt_gt?: string | Date;
    createdAt_gte?: string | Date;
    updatedAt?: string | Date;
    updatedAt_not?: string | Date;
    updatedAt_in?: Enumerable<string | Date>;
    updatedAt_not_in?: Enumerable<string | Date>;
    updatedAt_lt?: string | Date;
    updatedAt_lte?: string | Date;
    updatedAt_gt?: string | Date;
    updatedAt_gte?: string | Date;
    published?: boolean;
    published_not?: boolean;
    title?: string;
    title_not?: string;
    title_in?: Enumerable<string>;
    title_not_in?: Enumerable<string>;
    title_lt?: string;
    title_lte?: string;
    title_gt?: string;
    title_gte?: string;
    title_contains?: string;
    title_not_contains?: string;
    title_starts_with?: string;
    title_not_starts_with?: string;
    title_ends_with?: string;
    title_not_ends_with?: string;
    content?: string;
    content_not?: string;
    content_in?: Enumerable<string>;
    content_not_in?: Enumerable<string>;
    content_lt?: string;
    content_lte?: string;
    content_gt?: string;
    content_gte?: string;
    content_contains?: string;
    content_not_contains?: string;
    content_starts_with?: string;
    content_not_starts_with?: string;
    content_ends_with?: string;
    content_not_ends_with?: string;
};
export declare type PostUpdateManyDataInput = {
    published?: boolean;
    title?: string;
    content?: string;
};
export declare type PostUpdateManyWithWhereNestedInput = {
    where: PostScalarWhereInput;
    data: PostUpdateManyDataInput;
};
export declare type PostUpsertWithWhereUniqueWithoutAuthorInput = {
    where: PostWhereUniqueInput;
    update: PostUpdateWithoutAuthorDataInput;
    create: PostCreateWithoutAuthorInput;
};
export declare type PostUpdateManyWithoutAuthorInput = {
    create?: Enumerable<PostCreateWithoutAuthorInput>;
    connect?: Enumerable<PostWhereUniqueInput>;
    set?: Enumerable<PostWhereUniqueInput>;
    disconnect?: Enumerable<PostWhereUniqueInput>;
    delete?: Enumerable<PostWhereUniqueInput>;
    update?: Enumerable<PostUpdateWithWhereUniqueWithoutAuthorInput>;
    updateMany?: Enumerable<PostUpdateManyWithWhereNestedInput>;
    deleteMany?: Enumerable<PostScalarWhereInput>;
    upsert?: Enumerable<PostUpsertWithWhereUniqueWithoutAuthorInput>;
};
export declare type UserUpdateInput = {
    email?: string;
    name?: string;
    posts?: PostUpdateManyWithoutAuthorInput;
};
export declare type UserUpdateManyMutationInput = {
    email?: string;
    name?: string;
};
export declare type UserCreateWithoutPostsInput = {
    id?: string;
    email: string;
    name?: string;
};
export declare type UserCreateOneWithoutAuthorInput = {
    create?: UserCreateWithoutPostsInput;
    connect?: UserWhereUniqueInput;
};
export declare type PostCreateInput = {
    id?: string;
    published: boolean;
    title: string;
    content?: string;
    author: UserCreateOneWithoutAuthorInput;
};
export declare type UserUpdateWithoutPostsDataInput = {
    email?: string;
    name?: string;
};
export declare type UserUpsertWithoutPostsInput = {
    update: UserUpdateWithoutPostsDataInput;
    create: UserCreateWithoutPostsInput;
};
export declare type UserUpdateOneRequiredWithoutPostsInput = {
    create?: UserCreateWithoutPostsInput;
    connect?: UserWhereUniqueInput;
    update?: UserUpdateWithoutPostsDataInput;
    upsert?: UserUpsertWithoutPostsInput;
};
export declare type PostUpdateInput = {
    published?: boolean;
    title?: string;
    content?: string;
    author?: UserUpdateOneRequiredWithoutPostsInput;
};
export declare type PostUpdateManyMutationInput = {
    published?: boolean;
    title?: string;
    content?: string;
};
export declare type StringFilter = {
    equals?: string;
    not?: string | StringFilter;
    in?: Enumerable<string>;
    notIn?: Enumerable<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
};
export declare type DateTimeFilter = {
    equals?: string | Date;
    not?: string | Date | DateTimeFilter;
    in?: Enumerable<string | Date>;
    notIn?: Enumerable<string | Date>;
    lt?: string | Date;
    lte?: string | Date;
    gt?: string | Date;
    gte?: string | Date;
};
export declare type BooleanFilter = {
    equals?: boolean;
    not?: boolean | BooleanFilter;
};
export declare type NullableStringFilter = {
    equals?: string | null;
    not?: string | null | NullableStringFilter;
    in?: Enumerable<string>;
    notIn?: Enumerable<string>;
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
};
export declare type PostFilter = {
    every?: PostWhereInput;
    some?: PostWhereInput;
    none?: PostWhereInput;
};
export declare type UserOrderByInput = {
    id?: OrderByArg;
    email?: OrderByArg;
    name?: OrderByArg;
};
export declare type PostOrderByInput = {
    id?: OrderByArg;
    createdAt?: OrderByArg;
    updatedAt?: OrderByArg;
    published?: OrderByArg;
    title?: OrderByArg;
    content?: OrderByArg;
};
/**
 * DMMF
 */
export declare const dmmf: DMMF.Document;
export {};
