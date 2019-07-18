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
    readonly coreStores: CoreStoreDelegate;
    readonly migrations: MigrationDelegate;
    readonly posts: PostDelegate;
    readonly strapiAdministrators: StrapiAdministratorDelegate;
    readonly uploadFiles: UploadFileDelegate;
    readonly uploadFileMorphs: UploadFileMorphDelegate;
    readonly usersPermissionsPermissions: UsersPermissionsPermissionDelegate;
    readonly usersPermissionsRoles: UsersPermissionsRoleDelegate;
    readonly usersPermissionsUsers: UsersPermissionsUserDelegate;
}
export declare const OrderByArg: {
    asc: "asc";
    desc: "desc";
};
export declare type OrderByArg = (typeof OrderByArg)[keyof typeof OrderByArg];
/**
 * Model CoreStore
 */
export declare type CoreStore = {
    id: number;
    environment: string | null;
    key: string | null;
    tag: string | null;
    type: string | null;
    value: string | null;
};
export declare type CoreStoreScalars = 'id' | 'environment' | 'key' | 'tag' | 'type' | 'value';
export declare type CoreStoreSelect = {
    id?: boolean;
    environment?: boolean;
    key?: boolean;
    tag?: boolean;
    type?: boolean;
    value?: boolean;
};
declare type CoreStoreDefault = {};
declare type CoreStoreGetPayload<S extends boolean | CoreStoreSelect> = S extends true ? CoreStore : S extends CoreStoreSelect ? {
    [P in CleanupNever<MergeTruthyValues<CoreStoreDefault, S>>]: P extends CoreStoreScalars ? CoreStore[P] : never;
} : never;
export interface CoreStoreDelegate {
    <T extends FindManyCoreStoreArgs>(args?: Subset<T, FindManyCoreStoreArgs>): Promise<Array<CoreStoreGetPayload<ExtractFindManyCoreStoreArgsSelect<T>>>>;
    findOne<T extends FindOneCoreStoreArgs>(args: Subset<T, FindOneCoreStoreArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractFindOneCoreStoreArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    findMany<T extends FindManyCoreStoreArgs>(args?: Subset<T, FindManyCoreStoreArgs>): Promise<Array<CoreStoreGetPayload<ExtractFindManyCoreStoreArgsSelect<T>>>>;
    create<T extends CoreStoreCreateArgs>(args: Subset<T, CoreStoreCreateArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreCreateArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    delete<T extends CoreStoreDeleteArgs>(args: Subset<T, CoreStoreDeleteArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreDeleteArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    update<T extends CoreStoreUpdateArgs>(args: Subset<T, CoreStoreUpdateArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreUpdateArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    deleteMany<T extends CoreStoreDeleteManyArgs>(args: Subset<T, CoreStoreDeleteManyArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreDeleteManyArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    updateMany<T extends CoreStoreUpdateManyArgs>(args: Subset<T, CoreStoreUpdateManyArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreUpdateManyArgsSelect<T>>> : CoreStoreClient<CoreStore>;
    upsert<T extends CoreStoreUpsertArgs>(args: Subset<T, CoreStoreUpsertArgs>): 'select' extends keyof T ? Promise<CoreStoreGetPayload<ExtractCoreStoreUpsertArgsSelect<T>>> : CoreStoreClient<CoreStore>;
}
declare class CoreStoreClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: CoreStoreArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneCoreStoreArgs = {
    select?: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
};
export declare type FindOneCoreStoreArgsWithSelect = {
    select: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
};
declare type ExtractFindOneCoreStoreArgsSelect<S extends undefined | boolean | FindOneCoreStoreArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneCoreStoreArgsWithSelect ? S['select'] : true;
export declare type FindManyCoreStoreArgs = {
    select?: CoreStoreSelect;
    where?: CoreStoreWhereInput;
    orderBy?: CoreStoreOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyCoreStoreArgsWithSelect = {
    select: CoreStoreSelect;
    where?: CoreStoreWhereInput;
    orderBy?: CoreStoreOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyCoreStoreArgsSelect<S extends undefined | boolean | FindManyCoreStoreArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyCoreStoreArgsWithSelect ? S['select'] : true;
export declare type CoreStoreCreateArgs = {
    select?: CoreStoreSelect;
    data: CoreStoreCreateInput;
};
export declare type CoreStoreCreateArgsWithSelect = {
    select: CoreStoreSelect;
    data: CoreStoreCreateInput;
};
declare type ExtractCoreStoreCreateArgsSelect<S extends undefined | boolean | CoreStoreCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreCreateArgsWithSelect ? S['select'] : true;
export declare type CoreStoreUpdateArgs = {
    select?: CoreStoreSelect;
    data: CoreStoreUpdateInput;
    where: CoreStoreWhereUniqueInput;
};
export declare type CoreStoreUpdateArgsWithSelect = {
    select: CoreStoreSelect;
    data: CoreStoreUpdateInput;
    where: CoreStoreWhereUniqueInput;
};
declare type ExtractCoreStoreUpdateArgsSelect<S extends undefined | boolean | CoreStoreUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreUpdateArgsWithSelect ? S['select'] : true;
export declare type CoreStoreUpdateManyArgs = {
    select?: CoreStoreSelect;
    data: CoreStoreUpdateManyMutationInput;
    where?: CoreStoreWhereInput;
};
export declare type CoreStoreUpdateManyArgsWithSelect = {
    select: CoreStoreSelect;
    data: CoreStoreUpdateManyMutationInput;
    where?: CoreStoreWhereInput;
};
declare type ExtractCoreStoreUpdateManyArgsSelect<S extends undefined | boolean | CoreStoreUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreUpdateManyArgsWithSelect ? S['select'] : true;
export declare type CoreStoreUpsertArgs = {
    select?: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
    create: CoreStoreCreateInput;
    update: CoreStoreUpdateInput;
};
export declare type CoreStoreUpsertArgsWithSelect = {
    select: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
    create: CoreStoreCreateInput;
    update: CoreStoreUpdateInput;
};
declare type ExtractCoreStoreUpsertArgsSelect<S extends undefined | boolean | CoreStoreUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreUpsertArgsWithSelect ? S['select'] : true;
export declare type CoreStoreDeleteArgs = {
    select?: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
};
export declare type CoreStoreDeleteArgsWithSelect = {
    select: CoreStoreSelect;
    where: CoreStoreWhereUniqueInput;
};
declare type ExtractCoreStoreDeleteArgsSelect<S extends undefined | boolean | CoreStoreDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreDeleteArgsWithSelect ? S['select'] : true;
export declare type CoreStoreDeleteManyArgs = {
    select?: CoreStoreSelect;
    where?: CoreStoreWhereInput;
};
export declare type CoreStoreDeleteManyArgsWithSelect = {
    select: CoreStoreSelect;
    where?: CoreStoreWhereInput;
};
declare type ExtractCoreStoreDeleteManyArgsSelect<S extends undefined | boolean | CoreStoreDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends CoreStoreDeleteManyArgsWithSelect ? S['select'] : true;
export declare type CoreStoreArgs = {
    select?: CoreStoreSelect;
};
export declare type CoreStoreArgsWithSelect = {
    select: CoreStoreSelect;
};
/**
 * Model Migration
 */
export declare type Migration = {
    revision: number;
    applied: number;
    databaseMigration: string;
    datamodel: string;
    datamodelSteps: string;
    errors: string;
    finishedAt: string | null;
    name: string;
    rolledBack: number;
    startedAt: string;
    status: string;
};
export declare type MigrationScalars = 'revision' | 'applied' | 'databaseMigration' | 'datamodel' | 'datamodelSteps' | 'errors' | 'finishedAt' | 'name' | 'rolledBack' | 'startedAt' | 'status';
export declare type MigrationSelect = {
    revision?: boolean;
    applied?: boolean;
    databaseMigration?: boolean;
    datamodel?: boolean;
    datamodelSteps?: boolean;
    errors?: boolean;
    finishedAt?: boolean;
    name?: boolean;
    rolledBack?: boolean;
    startedAt?: boolean;
    status?: boolean;
};
declare type MigrationDefault = {};
declare type MigrationGetPayload<S extends boolean | MigrationSelect> = S extends true ? Migration : S extends MigrationSelect ? {
    [P in CleanupNever<MergeTruthyValues<MigrationDefault, S>>]: P extends MigrationScalars ? Migration[P] : never;
} : never;
export interface MigrationDelegate {
    <T extends FindManyMigrationArgs>(args?: Subset<T, FindManyMigrationArgs>): Promise<Array<MigrationGetPayload<ExtractFindManyMigrationArgsSelect<T>>>>;
    findMany<T extends FindManyMigrationArgs>(args?: Subset<T, FindManyMigrationArgs>): Promise<Array<MigrationGetPayload<ExtractFindManyMigrationArgsSelect<T>>>>;
    create<T extends MigrationCreateArgs>(args: Subset<T, MigrationCreateArgs>): 'select' extends keyof T ? Promise<MigrationGetPayload<ExtractMigrationCreateArgsSelect<T>>> : MigrationClient<Migration>;
    deleteMany<T extends MigrationDeleteManyArgs>(args: Subset<T, MigrationDeleteManyArgs>): 'select' extends keyof T ? Promise<MigrationGetPayload<ExtractMigrationDeleteManyArgsSelect<T>>> : MigrationClient<Migration>;
    updateMany<T extends MigrationUpdateManyArgs>(args: Subset<T, MigrationUpdateManyArgs>): 'select' extends keyof T ? Promise<MigrationGetPayload<ExtractMigrationUpdateManyArgsSelect<T>>> : MigrationClient<Migration>;
}
declare class MigrationClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: MigrationArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindManyMigrationArgs = {
    select?: MigrationSelect;
    where?: MigrationWhereInput;
    orderBy?: MigrationOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyMigrationArgsWithSelect = {
    select: MigrationSelect;
    where?: MigrationWhereInput;
    orderBy?: MigrationOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyMigrationArgsSelect<S extends undefined | boolean | FindManyMigrationArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyMigrationArgsWithSelect ? S['select'] : true;
export declare type MigrationCreateArgs = {
    select?: MigrationSelect;
    data: MigrationCreateInput;
};
export declare type MigrationCreateArgsWithSelect = {
    select: MigrationSelect;
    data: MigrationCreateInput;
};
declare type ExtractMigrationCreateArgsSelect<S extends undefined | boolean | MigrationCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends MigrationCreateArgsWithSelect ? S['select'] : true;
export declare type MigrationUpdateManyArgs = {
    select?: MigrationSelect;
    data: MigrationUpdateManyMutationInput;
    where?: MigrationWhereInput;
};
export declare type MigrationUpdateManyArgsWithSelect = {
    select: MigrationSelect;
    data: MigrationUpdateManyMutationInput;
    where?: MigrationWhereInput;
};
declare type ExtractMigrationUpdateManyArgsSelect<S extends undefined | boolean | MigrationUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends MigrationUpdateManyArgsWithSelect ? S['select'] : true;
export declare type MigrationDeleteManyArgs = {
    select?: MigrationSelect;
    where?: MigrationWhereInput;
};
export declare type MigrationDeleteManyArgsWithSelect = {
    select: MigrationSelect;
    where?: MigrationWhereInput;
};
declare type ExtractMigrationDeleteManyArgsSelect<S extends undefined | boolean | MigrationDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends MigrationDeleteManyArgsWithSelect ? S['select'] : true;
export declare type MigrationArgs = {
    select?: MigrationSelect;
};
export declare type MigrationArgsWithSelect = {
    select: MigrationSelect;
};
/**
 * Model Post
 */
export declare type Post = {
    id: number;
    content: string | null;
    createdAt: string | null;
    reads: number;
    title: string;
    updatedAt: string | null;
};
export declare type PostScalars = 'id' | 'content' | 'createdAt' | 'reads' | 'title' | 'updatedAt';
export declare type PostSelect = {
    id?: boolean;
    content?: boolean;
    createdAt?: boolean;
    reads?: boolean;
    title?: boolean;
    updatedAt?: boolean;
};
declare type PostDefault = {};
declare type PostGetPayload<S extends boolean | PostSelect> = S extends true ? Post : S extends PostSelect ? {
    [P in CleanupNever<MergeTruthyValues<PostDefault, S>>]: P extends PostScalars ? Post[P] : never;
} : never;
export interface PostDelegate {
    <T extends FindManyPostArgs>(args?: Subset<T, FindManyPostArgs>): Promise<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>;
    findOne<T extends FindOnePostArgs>(args: Subset<T, FindOnePostArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractFindOnePostArgsSelect<T>>> : PostClient<Post>;
    findMany<T extends FindManyPostArgs>(args?: Subset<T, FindManyPostArgs>): Promise<Array<PostGetPayload<ExtractFindManyPostArgsSelect<T>>>>;
    create<T extends PostCreateArgs>(args: Subset<T, PostCreateArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostCreateArgsSelect<T>>> : PostClient<Post>;
    delete<T extends PostDeleteArgs>(args: Subset<T, PostDeleteArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostDeleteArgsSelect<T>>> : PostClient<Post>;
    update<T extends PostUpdateArgs>(args: Subset<T, PostUpdateArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostUpdateArgsSelect<T>>> : PostClient<Post>;
    deleteMany<T extends PostDeleteManyArgs>(args: Subset<T, PostDeleteManyArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostDeleteManyArgsSelect<T>>> : PostClient<Post>;
    updateMany<T extends PostUpdateManyArgs>(args: Subset<T, PostUpdateManyArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostUpdateManyArgsSelect<T>>> : PostClient<Post>;
    upsert<T extends PostUpsertArgs>(args: Subset<T, PostUpsertArgs>): 'select' extends keyof T ? Promise<PostGetPayload<ExtractPostUpsertArgsSelect<T>>> : PostClient<Post>;
}
declare class PostClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: PostArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
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
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyPostArgsWithSelect = {
    select: PostSelect;
    where?: PostWhereInput;
    orderBy?: PostOrderByInput;
    skip?: number;
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
 * Model StrapiAdministrator
 */
export declare type StrapiAdministrator = {
    id: number;
    blocked: boolean | null;
    email: string;
    password: string;
    resetPasswordToken: string | null;
    username: string;
};
export declare type StrapiAdministratorScalars = 'id' | 'blocked' | 'email' | 'password' | 'resetPasswordToken' | 'username';
export declare type StrapiAdministratorSelect = {
    id?: boolean;
    blocked?: boolean;
    email?: boolean;
    password?: boolean;
    resetPasswordToken?: boolean;
    username?: boolean;
};
declare type StrapiAdministratorDefault = {};
declare type StrapiAdministratorGetPayload<S extends boolean | StrapiAdministratorSelect> = S extends true ? StrapiAdministrator : S extends StrapiAdministratorSelect ? {
    [P in CleanupNever<MergeTruthyValues<StrapiAdministratorDefault, S>>]: P extends StrapiAdministratorScalars ? StrapiAdministrator[P] : never;
} : never;
export interface StrapiAdministratorDelegate {
    <T extends FindManyStrapiAdministratorArgs>(args?: Subset<T, FindManyStrapiAdministratorArgs>): Promise<Array<StrapiAdministratorGetPayload<ExtractFindManyStrapiAdministratorArgsSelect<T>>>>;
    findOne<T extends FindOneStrapiAdministratorArgs>(args: Subset<T, FindOneStrapiAdministratorArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractFindOneStrapiAdministratorArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    findMany<T extends FindManyStrapiAdministratorArgs>(args?: Subset<T, FindManyStrapiAdministratorArgs>): Promise<Array<StrapiAdministratorGetPayload<ExtractFindManyStrapiAdministratorArgsSelect<T>>>>;
    create<T extends StrapiAdministratorCreateArgs>(args: Subset<T, StrapiAdministratorCreateArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorCreateArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    delete<T extends StrapiAdministratorDeleteArgs>(args: Subset<T, StrapiAdministratorDeleteArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorDeleteArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    update<T extends StrapiAdministratorUpdateArgs>(args: Subset<T, StrapiAdministratorUpdateArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorUpdateArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    deleteMany<T extends StrapiAdministratorDeleteManyArgs>(args: Subset<T, StrapiAdministratorDeleteManyArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorDeleteManyArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    updateMany<T extends StrapiAdministratorUpdateManyArgs>(args: Subset<T, StrapiAdministratorUpdateManyArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorUpdateManyArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
    upsert<T extends StrapiAdministratorUpsertArgs>(args: Subset<T, StrapiAdministratorUpsertArgs>): 'select' extends keyof T ? Promise<StrapiAdministratorGetPayload<ExtractStrapiAdministratorUpsertArgsSelect<T>>> : StrapiAdministratorClient<StrapiAdministrator>;
}
declare class StrapiAdministratorClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: StrapiAdministratorArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneStrapiAdministratorArgs = {
    select?: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
};
export declare type FindOneStrapiAdministratorArgsWithSelect = {
    select: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
};
declare type ExtractFindOneStrapiAdministratorArgsSelect<S extends undefined | boolean | FindOneStrapiAdministratorArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneStrapiAdministratorArgsWithSelect ? S['select'] : true;
export declare type FindManyStrapiAdministratorArgs = {
    select?: StrapiAdministratorSelect;
    where?: StrapiAdministratorWhereInput;
    orderBy?: StrapiAdministratorOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyStrapiAdministratorArgsWithSelect = {
    select: StrapiAdministratorSelect;
    where?: StrapiAdministratorWhereInput;
    orderBy?: StrapiAdministratorOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyStrapiAdministratorArgsSelect<S extends undefined | boolean | FindManyStrapiAdministratorArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyStrapiAdministratorArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorCreateArgs = {
    select?: StrapiAdministratorSelect;
    data: StrapiAdministratorCreateInput;
};
export declare type StrapiAdministratorCreateArgsWithSelect = {
    select: StrapiAdministratorSelect;
    data: StrapiAdministratorCreateInput;
};
declare type ExtractStrapiAdministratorCreateArgsSelect<S extends undefined | boolean | StrapiAdministratorCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorCreateArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorUpdateArgs = {
    select?: StrapiAdministratorSelect;
    data: StrapiAdministratorUpdateInput;
    where: StrapiAdministratorWhereUniqueInput;
};
export declare type StrapiAdministratorUpdateArgsWithSelect = {
    select: StrapiAdministratorSelect;
    data: StrapiAdministratorUpdateInput;
    where: StrapiAdministratorWhereUniqueInput;
};
declare type ExtractStrapiAdministratorUpdateArgsSelect<S extends undefined | boolean | StrapiAdministratorUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorUpdateArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorUpdateManyArgs = {
    select?: StrapiAdministratorSelect;
    data: StrapiAdministratorUpdateManyMutationInput;
    where?: StrapiAdministratorWhereInput;
};
export declare type StrapiAdministratorUpdateManyArgsWithSelect = {
    select: StrapiAdministratorSelect;
    data: StrapiAdministratorUpdateManyMutationInput;
    where?: StrapiAdministratorWhereInput;
};
declare type ExtractStrapiAdministratorUpdateManyArgsSelect<S extends undefined | boolean | StrapiAdministratorUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorUpdateManyArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorUpsertArgs = {
    select?: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
    create: StrapiAdministratorCreateInput;
    update: StrapiAdministratorUpdateInput;
};
export declare type StrapiAdministratorUpsertArgsWithSelect = {
    select: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
    create: StrapiAdministratorCreateInput;
    update: StrapiAdministratorUpdateInput;
};
declare type ExtractStrapiAdministratorUpsertArgsSelect<S extends undefined | boolean | StrapiAdministratorUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorUpsertArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorDeleteArgs = {
    select?: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
};
export declare type StrapiAdministratorDeleteArgsWithSelect = {
    select: StrapiAdministratorSelect;
    where: StrapiAdministratorWhereUniqueInput;
};
declare type ExtractStrapiAdministratorDeleteArgsSelect<S extends undefined | boolean | StrapiAdministratorDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorDeleteArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorDeleteManyArgs = {
    select?: StrapiAdministratorSelect;
    where?: StrapiAdministratorWhereInput;
};
export declare type StrapiAdministratorDeleteManyArgsWithSelect = {
    select: StrapiAdministratorSelect;
    where?: StrapiAdministratorWhereInput;
};
declare type ExtractStrapiAdministratorDeleteManyArgsSelect<S extends undefined | boolean | StrapiAdministratorDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends StrapiAdministratorDeleteManyArgsWithSelect ? S['select'] : true;
export declare type StrapiAdministratorArgs = {
    select?: StrapiAdministratorSelect;
};
export declare type StrapiAdministratorArgsWithSelect = {
    select: StrapiAdministratorSelect;
};
/**
 * Model UploadFile
 */
export declare type UploadFile = {
    id: number;
    createdAt: string | null;
    ext: string | null;
    hash: string;
    mime: string;
    name: string;
    provider: string;
    publicId: string | null;
    sha256: string | null;
    size: string;
    updatedAt: string | null;
    url: string;
};
export declare type UploadFileScalars = 'id' | 'createdAt' | 'ext' | 'hash' | 'mime' | 'name' | 'provider' | 'publicId' | 'sha256' | 'size' | 'updatedAt' | 'url';
export declare type UploadFileSelect = {
    id?: boolean;
    createdAt?: boolean;
    ext?: boolean;
    hash?: boolean;
    mime?: boolean;
    name?: boolean;
    provider?: boolean;
    publicId?: boolean;
    sha256?: boolean;
    size?: boolean;
    updatedAt?: boolean;
    url?: boolean;
};
declare type UploadFileDefault = {};
declare type UploadFileGetPayload<S extends boolean | UploadFileSelect> = S extends true ? UploadFile : S extends UploadFileSelect ? {
    [P in CleanupNever<MergeTruthyValues<UploadFileDefault, S>>]: P extends UploadFileScalars ? UploadFile[P] : never;
} : never;
export interface UploadFileDelegate {
    <T extends FindManyUploadFileArgs>(args?: Subset<T, FindManyUploadFileArgs>): Promise<Array<UploadFileGetPayload<ExtractFindManyUploadFileArgsSelect<T>>>>;
    findOne<T extends FindOneUploadFileArgs>(args: Subset<T, FindOneUploadFileArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractFindOneUploadFileArgsSelect<T>>> : UploadFileClient<UploadFile>;
    findMany<T extends FindManyUploadFileArgs>(args?: Subset<T, FindManyUploadFileArgs>): Promise<Array<UploadFileGetPayload<ExtractFindManyUploadFileArgsSelect<T>>>>;
    create<T extends UploadFileCreateArgs>(args: Subset<T, UploadFileCreateArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileCreateArgsSelect<T>>> : UploadFileClient<UploadFile>;
    delete<T extends UploadFileDeleteArgs>(args: Subset<T, UploadFileDeleteArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileDeleteArgsSelect<T>>> : UploadFileClient<UploadFile>;
    update<T extends UploadFileUpdateArgs>(args: Subset<T, UploadFileUpdateArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileUpdateArgsSelect<T>>> : UploadFileClient<UploadFile>;
    deleteMany<T extends UploadFileDeleteManyArgs>(args: Subset<T, UploadFileDeleteManyArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileDeleteManyArgsSelect<T>>> : UploadFileClient<UploadFile>;
    updateMany<T extends UploadFileUpdateManyArgs>(args: Subset<T, UploadFileUpdateManyArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileUpdateManyArgsSelect<T>>> : UploadFileClient<UploadFile>;
    upsert<T extends UploadFileUpsertArgs>(args: Subset<T, UploadFileUpsertArgs>): 'select' extends keyof T ? Promise<UploadFileGetPayload<ExtractUploadFileUpsertArgsSelect<T>>> : UploadFileClient<UploadFile>;
}
declare class UploadFileClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UploadFileArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneUploadFileArgs = {
    select?: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
};
export declare type FindOneUploadFileArgsWithSelect = {
    select: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
};
declare type ExtractFindOneUploadFileArgsSelect<S extends undefined | boolean | FindOneUploadFileArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUploadFileArgsWithSelect ? S['select'] : true;
export declare type FindManyUploadFileArgs = {
    select?: UploadFileSelect;
    where?: UploadFileWhereInput;
    orderBy?: UploadFileOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUploadFileArgsWithSelect = {
    select: UploadFileSelect;
    where?: UploadFileWhereInput;
    orderBy?: UploadFileOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUploadFileArgsSelect<S extends undefined | boolean | FindManyUploadFileArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUploadFileArgsWithSelect ? S['select'] : true;
export declare type UploadFileCreateArgs = {
    select?: UploadFileSelect;
    data: UploadFileCreateInput;
};
export declare type UploadFileCreateArgsWithSelect = {
    select: UploadFileSelect;
    data: UploadFileCreateInput;
};
declare type ExtractUploadFileCreateArgsSelect<S extends undefined | boolean | UploadFileCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileCreateArgsWithSelect ? S['select'] : true;
export declare type UploadFileUpdateArgs = {
    select?: UploadFileSelect;
    data: UploadFileUpdateInput;
    where: UploadFileWhereUniqueInput;
};
export declare type UploadFileUpdateArgsWithSelect = {
    select: UploadFileSelect;
    data: UploadFileUpdateInput;
    where: UploadFileWhereUniqueInput;
};
declare type ExtractUploadFileUpdateArgsSelect<S extends undefined | boolean | UploadFileUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileUpdateArgsWithSelect ? S['select'] : true;
export declare type UploadFileUpdateManyArgs = {
    select?: UploadFileSelect;
    data: UploadFileUpdateManyMutationInput;
    where?: UploadFileWhereInput;
};
export declare type UploadFileUpdateManyArgsWithSelect = {
    select: UploadFileSelect;
    data: UploadFileUpdateManyMutationInput;
    where?: UploadFileWhereInput;
};
declare type ExtractUploadFileUpdateManyArgsSelect<S extends undefined | boolean | UploadFileUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UploadFileUpsertArgs = {
    select?: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
    create: UploadFileCreateInput;
    update: UploadFileUpdateInput;
};
export declare type UploadFileUpsertArgsWithSelect = {
    select: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
    create: UploadFileCreateInput;
    update: UploadFileUpdateInput;
};
declare type ExtractUploadFileUpsertArgsSelect<S extends undefined | boolean | UploadFileUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileUpsertArgsWithSelect ? S['select'] : true;
export declare type UploadFileDeleteArgs = {
    select?: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
};
export declare type UploadFileDeleteArgsWithSelect = {
    select: UploadFileSelect;
    where: UploadFileWhereUniqueInput;
};
declare type ExtractUploadFileDeleteArgsSelect<S extends undefined | boolean | UploadFileDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileDeleteArgsWithSelect ? S['select'] : true;
export declare type UploadFileDeleteManyArgs = {
    select?: UploadFileSelect;
    where?: UploadFileWhereInput;
};
export declare type UploadFileDeleteManyArgsWithSelect = {
    select: UploadFileSelect;
    where?: UploadFileWhereInput;
};
declare type ExtractUploadFileDeleteManyArgsSelect<S extends undefined | boolean | UploadFileDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UploadFileArgs = {
    select?: UploadFileSelect;
};
export declare type UploadFileArgsWithSelect = {
    select: UploadFileSelect;
};
/**
 * Model UploadFileMorph
 */
export declare type UploadFileMorph = {
    id: number;
    field: string | null;
    relatedId: number | null;
    relatedType: string | null;
    uploadFileId: number | null;
};
export declare type UploadFileMorphScalars = 'id' | 'field' | 'relatedId' | 'relatedType' | 'uploadFileId';
export declare type UploadFileMorphSelect = {
    id?: boolean;
    field?: boolean;
    relatedId?: boolean;
    relatedType?: boolean;
    uploadFileId?: boolean;
};
declare type UploadFileMorphDefault = {};
declare type UploadFileMorphGetPayload<S extends boolean | UploadFileMorphSelect> = S extends true ? UploadFileMorph : S extends UploadFileMorphSelect ? {
    [P in CleanupNever<MergeTruthyValues<UploadFileMorphDefault, S>>]: P extends UploadFileMorphScalars ? UploadFileMorph[P] : never;
} : never;
export interface UploadFileMorphDelegate {
    <T extends FindManyUploadFileMorphArgs>(args?: Subset<T, FindManyUploadFileMorphArgs>): Promise<Array<UploadFileMorphGetPayload<ExtractFindManyUploadFileMorphArgsSelect<T>>>>;
    findOne<T extends FindOneUploadFileMorphArgs>(args: Subset<T, FindOneUploadFileMorphArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractFindOneUploadFileMorphArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    findMany<T extends FindManyUploadFileMorphArgs>(args?: Subset<T, FindManyUploadFileMorphArgs>): Promise<Array<UploadFileMorphGetPayload<ExtractFindManyUploadFileMorphArgsSelect<T>>>>;
    create<T extends UploadFileMorphCreateArgs>(args: Subset<T, UploadFileMorphCreateArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphCreateArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    delete<T extends UploadFileMorphDeleteArgs>(args: Subset<T, UploadFileMorphDeleteArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphDeleteArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    update<T extends UploadFileMorphUpdateArgs>(args: Subset<T, UploadFileMorphUpdateArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphUpdateArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    deleteMany<T extends UploadFileMorphDeleteManyArgs>(args: Subset<T, UploadFileMorphDeleteManyArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphDeleteManyArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    updateMany<T extends UploadFileMorphUpdateManyArgs>(args: Subset<T, UploadFileMorphUpdateManyArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphUpdateManyArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
    upsert<T extends UploadFileMorphUpsertArgs>(args: Subset<T, UploadFileMorphUpsertArgs>): 'select' extends keyof T ? Promise<UploadFileMorphGetPayload<ExtractUploadFileMorphUpsertArgsSelect<T>>> : UploadFileMorphClient<UploadFileMorph>;
}
declare class UploadFileMorphClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UploadFileMorphArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneUploadFileMorphArgs = {
    select?: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
};
export declare type FindOneUploadFileMorphArgsWithSelect = {
    select: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
};
declare type ExtractFindOneUploadFileMorphArgsSelect<S extends undefined | boolean | FindOneUploadFileMorphArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUploadFileMorphArgsWithSelect ? S['select'] : true;
export declare type FindManyUploadFileMorphArgs = {
    select?: UploadFileMorphSelect;
    where?: UploadFileMorphWhereInput;
    orderBy?: UploadFileMorphOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUploadFileMorphArgsWithSelect = {
    select: UploadFileMorphSelect;
    where?: UploadFileMorphWhereInput;
    orderBy?: UploadFileMorphOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUploadFileMorphArgsSelect<S extends undefined | boolean | FindManyUploadFileMorphArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUploadFileMorphArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphCreateArgs = {
    select?: UploadFileMorphSelect;
    data: UploadFileMorphCreateInput;
};
export declare type UploadFileMorphCreateArgsWithSelect = {
    select: UploadFileMorphSelect;
    data: UploadFileMorphCreateInput;
};
declare type ExtractUploadFileMorphCreateArgsSelect<S extends undefined | boolean | UploadFileMorphCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphCreateArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphUpdateArgs = {
    select?: UploadFileMorphSelect;
    data: UploadFileMorphUpdateInput;
    where: UploadFileMorphWhereUniqueInput;
};
export declare type UploadFileMorphUpdateArgsWithSelect = {
    select: UploadFileMorphSelect;
    data: UploadFileMorphUpdateInput;
    where: UploadFileMorphWhereUniqueInput;
};
declare type ExtractUploadFileMorphUpdateArgsSelect<S extends undefined | boolean | UploadFileMorphUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphUpdateArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphUpdateManyArgs = {
    select?: UploadFileMorphSelect;
    data: UploadFileMorphUpdateManyMutationInput;
    where?: UploadFileMorphWhereInput;
};
export declare type UploadFileMorphUpdateManyArgsWithSelect = {
    select: UploadFileMorphSelect;
    data: UploadFileMorphUpdateManyMutationInput;
    where?: UploadFileMorphWhereInput;
};
declare type ExtractUploadFileMorphUpdateManyArgsSelect<S extends undefined | boolean | UploadFileMorphUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphUpsertArgs = {
    select?: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
    create: UploadFileMorphCreateInput;
    update: UploadFileMorphUpdateInput;
};
export declare type UploadFileMorphUpsertArgsWithSelect = {
    select: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
    create: UploadFileMorphCreateInput;
    update: UploadFileMorphUpdateInput;
};
declare type ExtractUploadFileMorphUpsertArgsSelect<S extends undefined | boolean | UploadFileMorphUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphUpsertArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphDeleteArgs = {
    select?: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
};
export declare type UploadFileMorphDeleteArgsWithSelect = {
    select: UploadFileMorphSelect;
    where: UploadFileMorphWhereUniqueInput;
};
declare type ExtractUploadFileMorphDeleteArgsSelect<S extends undefined | boolean | UploadFileMorphDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphDeleteArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphDeleteManyArgs = {
    select?: UploadFileMorphSelect;
    where?: UploadFileMorphWhereInput;
};
export declare type UploadFileMorphDeleteManyArgsWithSelect = {
    select: UploadFileMorphSelect;
    where?: UploadFileMorphWhereInput;
};
declare type ExtractUploadFileMorphDeleteManyArgsSelect<S extends undefined | boolean | UploadFileMorphDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UploadFileMorphDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UploadFileMorphArgs = {
    select?: UploadFileMorphSelect;
};
export declare type UploadFileMorphArgsWithSelect = {
    select: UploadFileMorphSelect;
};
/**
 * Model UsersPermissionsPermission
 */
export declare type UsersPermissionsPermission = {
    id: number;
    action: string;
    controller: string;
    enabled: boolean;
    policy: string | null;
    role: number | null;
    type: string;
};
export declare type UsersPermissionsPermissionScalars = 'id' | 'action' | 'controller' | 'enabled' | 'policy' | 'role' | 'type';
export declare type UsersPermissionsPermissionSelect = {
    id?: boolean;
    action?: boolean;
    controller?: boolean;
    enabled?: boolean;
    policy?: boolean;
    role?: boolean;
    type?: boolean;
};
declare type UsersPermissionsPermissionDefault = {};
declare type UsersPermissionsPermissionGetPayload<S extends boolean | UsersPermissionsPermissionSelect> = S extends true ? UsersPermissionsPermission : S extends UsersPermissionsPermissionSelect ? {
    [P in CleanupNever<MergeTruthyValues<UsersPermissionsPermissionDefault, S>>]: P extends UsersPermissionsPermissionScalars ? UsersPermissionsPermission[P] : never;
} : never;
export interface UsersPermissionsPermissionDelegate {
    <T extends FindManyUsersPermissionsPermissionArgs>(args?: Subset<T, FindManyUsersPermissionsPermissionArgs>): Promise<Array<UsersPermissionsPermissionGetPayload<ExtractFindManyUsersPermissionsPermissionArgsSelect<T>>>>;
    findOne<T extends FindOneUsersPermissionsPermissionArgs>(args: Subset<T, FindOneUsersPermissionsPermissionArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractFindOneUsersPermissionsPermissionArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    findMany<T extends FindManyUsersPermissionsPermissionArgs>(args?: Subset<T, FindManyUsersPermissionsPermissionArgs>): Promise<Array<UsersPermissionsPermissionGetPayload<ExtractFindManyUsersPermissionsPermissionArgsSelect<T>>>>;
    create<T extends UsersPermissionsPermissionCreateArgs>(args: Subset<T, UsersPermissionsPermissionCreateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionCreateArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    delete<T extends UsersPermissionsPermissionDeleteArgs>(args: Subset<T, UsersPermissionsPermissionDeleteArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionDeleteArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    update<T extends UsersPermissionsPermissionUpdateArgs>(args: Subset<T, UsersPermissionsPermissionUpdateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionUpdateArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    deleteMany<T extends UsersPermissionsPermissionDeleteManyArgs>(args: Subset<T, UsersPermissionsPermissionDeleteManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionDeleteManyArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    updateMany<T extends UsersPermissionsPermissionUpdateManyArgs>(args: Subset<T, UsersPermissionsPermissionUpdateManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionUpdateManyArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
    upsert<T extends UsersPermissionsPermissionUpsertArgs>(args: Subset<T, UsersPermissionsPermissionUpsertArgs>): 'select' extends keyof T ? Promise<UsersPermissionsPermissionGetPayload<ExtractUsersPermissionsPermissionUpsertArgsSelect<T>>> : UsersPermissionsPermissionClient<UsersPermissionsPermission>;
}
declare class UsersPermissionsPermissionClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UsersPermissionsPermissionArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneUsersPermissionsPermissionArgs = {
    select?: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
export declare type FindOneUsersPermissionsPermissionArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
declare type ExtractFindOneUsersPermissionsPermissionArgsSelect<S extends undefined | boolean | FindOneUsersPermissionsPermissionArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUsersPermissionsPermissionArgsWithSelect ? S['select'] : true;
export declare type FindManyUsersPermissionsPermissionArgs = {
    select?: UsersPermissionsPermissionSelect;
    where?: UsersPermissionsPermissionWhereInput;
    orderBy?: UsersPermissionsPermissionOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUsersPermissionsPermissionArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    where?: UsersPermissionsPermissionWhereInput;
    orderBy?: UsersPermissionsPermissionOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUsersPermissionsPermissionArgsSelect<S extends undefined | boolean | FindManyUsersPermissionsPermissionArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUsersPermissionsPermissionArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionCreateArgs = {
    select?: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionCreateInput;
};
export declare type UsersPermissionsPermissionCreateArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionCreateInput;
};
declare type ExtractUsersPermissionsPermissionCreateArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionCreateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionUpdateArgs = {
    select?: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionUpdateInput;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
export declare type UsersPermissionsPermissionUpdateArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionUpdateInput;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
declare type ExtractUsersPermissionsPermissionUpdateArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionUpdateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionUpdateManyArgs = {
    select?: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionUpdateManyMutationInput;
    where?: UsersPermissionsPermissionWhereInput;
};
export declare type UsersPermissionsPermissionUpdateManyArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    data: UsersPermissionsPermissionUpdateManyMutationInput;
    where?: UsersPermissionsPermissionWhereInput;
};
declare type ExtractUsersPermissionsPermissionUpdateManyArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionUpsertArgs = {
    select?: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
    create: UsersPermissionsPermissionCreateInput;
    update: UsersPermissionsPermissionUpdateInput;
};
export declare type UsersPermissionsPermissionUpsertArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
    create: UsersPermissionsPermissionCreateInput;
    update: UsersPermissionsPermissionUpdateInput;
};
declare type ExtractUsersPermissionsPermissionUpsertArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionUpsertArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionDeleteArgs = {
    select?: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
export declare type UsersPermissionsPermissionDeleteArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    where: UsersPermissionsPermissionWhereUniqueInput;
};
declare type ExtractUsersPermissionsPermissionDeleteArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionDeleteArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionDeleteManyArgs = {
    select?: UsersPermissionsPermissionSelect;
    where?: UsersPermissionsPermissionWhereInput;
};
export declare type UsersPermissionsPermissionDeleteManyArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
    where?: UsersPermissionsPermissionWhereInput;
};
declare type ExtractUsersPermissionsPermissionDeleteManyArgsSelect<S extends undefined | boolean | UsersPermissionsPermissionDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsPermissionDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsPermissionArgs = {
    select?: UsersPermissionsPermissionSelect;
};
export declare type UsersPermissionsPermissionArgsWithSelect = {
    select: UsersPermissionsPermissionSelect;
};
/**
 * Model UsersPermissionsRole
 */
export declare type UsersPermissionsRole = {
    id: number;
    description: string | null;
    name: string;
    type: string | null;
};
export declare type UsersPermissionsRoleScalars = 'id' | 'description' | 'name' | 'type';
export declare type UsersPermissionsRoleSelect = {
    id?: boolean;
    description?: boolean;
    name?: boolean;
    type?: boolean;
};
declare type UsersPermissionsRoleDefault = {};
declare type UsersPermissionsRoleGetPayload<S extends boolean | UsersPermissionsRoleSelect> = S extends true ? UsersPermissionsRole : S extends UsersPermissionsRoleSelect ? {
    [P in CleanupNever<MergeTruthyValues<UsersPermissionsRoleDefault, S>>]: P extends UsersPermissionsRoleScalars ? UsersPermissionsRole[P] : never;
} : never;
export interface UsersPermissionsRoleDelegate {
    <T extends FindManyUsersPermissionsRoleArgs>(args?: Subset<T, FindManyUsersPermissionsRoleArgs>): Promise<Array<UsersPermissionsRoleGetPayload<ExtractFindManyUsersPermissionsRoleArgsSelect<T>>>>;
    findOne<T extends FindOneUsersPermissionsRoleArgs>(args: Subset<T, FindOneUsersPermissionsRoleArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractFindOneUsersPermissionsRoleArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    findMany<T extends FindManyUsersPermissionsRoleArgs>(args?: Subset<T, FindManyUsersPermissionsRoleArgs>): Promise<Array<UsersPermissionsRoleGetPayload<ExtractFindManyUsersPermissionsRoleArgsSelect<T>>>>;
    create<T extends UsersPermissionsRoleCreateArgs>(args: Subset<T, UsersPermissionsRoleCreateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleCreateArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    delete<T extends UsersPermissionsRoleDeleteArgs>(args: Subset<T, UsersPermissionsRoleDeleteArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleDeleteArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    update<T extends UsersPermissionsRoleUpdateArgs>(args: Subset<T, UsersPermissionsRoleUpdateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleUpdateArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    deleteMany<T extends UsersPermissionsRoleDeleteManyArgs>(args: Subset<T, UsersPermissionsRoleDeleteManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleDeleteManyArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    updateMany<T extends UsersPermissionsRoleUpdateManyArgs>(args: Subset<T, UsersPermissionsRoleUpdateManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleUpdateManyArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
    upsert<T extends UsersPermissionsRoleUpsertArgs>(args: Subset<T, UsersPermissionsRoleUpsertArgs>): 'select' extends keyof T ? Promise<UsersPermissionsRoleGetPayload<ExtractUsersPermissionsRoleUpsertArgsSelect<T>>> : UsersPermissionsRoleClient<UsersPermissionsRole>;
}
declare class UsersPermissionsRoleClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UsersPermissionsRoleArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneUsersPermissionsRoleArgs = {
    select?: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
};
export declare type FindOneUsersPermissionsRoleArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
};
declare type ExtractFindOneUsersPermissionsRoleArgsSelect<S extends undefined | boolean | FindOneUsersPermissionsRoleArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUsersPermissionsRoleArgsWithSelect ? S['select'] : true;
export declare type FindManyUsersPermissionsRoleArgs = {
    select?: UsersPermissionsRoleSelect;
    where?: UsersPermissionsRoleWhereInput;
    orderBy?: UsersPermissionsRoleOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUsersPermissionsRoleArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    where?: UsersPermissionsRoleWhereInput;
    orderBy?: UsersPermissionsRoleOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUsersPermissionsRoleArgsSelect<S extends undefined | boolean | FindManyUsersPermissionsRoleArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUsersPermissionsRoleArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleCreateArgs = {
    select?: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleCreateInput;
};
export declare type UsersPermissionsRoleCreateArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleCreateInput;
};
declare type ExtractUsersPermissionsRoleCreateArgsSelect<S extends undefined | boolean | UsersPermissionsRoleCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleCreateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleUpdateArgs = {
    select?: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleUpdateInput;
    where: UsersPermissionsRoleWhereUniqueInput;
};
export declare type UsersPermissionsRoleUpdateArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleUpdateInput;
    where: UsersPermissionsRoleWhereUniqueInput;
};
declare type ExtractUsersPermissionsRoleUpdateArgsSelect<S extends undefined | boolean | UsersPermissionsRoleUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleUpdateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleUpdateManyArgs = {
    select?: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleUpdateManyMutationInput;
    where?: UsersPermissionsRoleWhereInput;
};
export declare type UsersPermissionsRoleUpdateManyArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    data: UsersPermissionsRoleUpdateManyMutationInput;
    where?: UsersPermissionsRoleWhereInput;
};
declare type ExtractUsersPermissionsRoleUpdateManyArgsSelect<S extends undefined | boolean | UsersPermissionsRoleUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleUpsertArgs = {
    select?: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
    create: UsersPermissionsRoleCreateInput;
    update: UsersPermissionsRoleUpdateInput;
};
export declare type UsersPermissionsRoleUpsertArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
    create: UsersPermissionsRoleCreateInput;
    update: UsersPermissionsRoleUpdateInput;
};
declare type ExtractUsersPermissionsRoleUpsertArgsSelect<S extends undefined | boolean | UsersPermissionsRoleUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleUpsertArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleDeleteArgs = {
    select?: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
};
export declare type UsersPermissionsRoleDeleteArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    where: UsersPermissionsRoleWhereUniqueInput;
};
declare type ExtractUsersPermissionsRoleDeleteArgsSelect<S extends undefined | boolean | UsersPermissionsRoleDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleDeleteArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleDeleteManyArgs = {
    select?: UsersPermissionsRoleSelect;
    where?: UsersPermissionsRoleWhereInput;
};
export declare type UsersPermissionsRoleDeleteManyArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
    where?: UsersPermissionsRoleWhereInput;
};
declare type ExtractUsersPermissionsRoleDeleteManyArgsSelect<S extends undefined | boolean | UsersPermissionsRoleDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsRoleDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsRoleArgs = {
    select?: UsersPermissionsRoleSelect;
};
export declare type UsersPermissionsRoleArgsWithSelect = {
    select: UsersPermissionsRoleSelect;
};
/**
 * Model UsersPermissionsUser
 */
export declare type UsersPermissionsUser = {
    id: number;
    blocked: boolean | null;
    confirmed: boolean | null;
    createdAt: string | null;
    email: string;
    password: string | null;
    provider: string | null;
    resetPasswordToken: string | null;
    role: number | null;
    updatedAt: string | null;
    username: string;
};
export declare type UsersPermissionsUserScalars = 'id' | 'blocked' | 'confirmed' | 'createdAt' | 'email' | 'password' | 'provider' | 'resetPasswordToken' | 'role' | 'updatedAt' | 'username';
export declare type UsersPermissionsUserSelect = {
    id?: boolean;
    blocked?: boolean;
    confirmed?: boolean;
    createdAt?: boolean;
    email?: boolean;
    password?: boolean;
    provider?: boolean;
    resetPasswordToken?: boolean;
    role?: boolean;
    updatedAt?: boolean;
    username?: boolean;
};
declare type UsersPermissionsUserDefault = {};
declare type UsersPermissionsUserGetPayload<S extends boolean | UsersPermissionsUserSelect> = S extends true ? UsersPermissionsUser : S extends UsersPermissionsUserSelect ? {
    [P in CleanupNever<MergeTruthyValues<UsersPermissionsUserDefault, S>>]: P extends UsersPermissionsUserScalars ? UsersPermissionsUser[P] : never;
} : never;
export interface UsersPermissionsUserDelegate {
    <T extends FindManyUsersPermissionsUserArgs>(args?: Subset<T, FindManyUsersPermissionsUserArgs>): Promise<Array<UsersPermissionsUserGetPayload<ExtractFindManyUsersPermissionsUserArgsSelect<T>>>>;
    findOne<T extends FindOneUsersPermissionsUserArgs>(args: Subset<T, FindOneUsersPermissionsUserArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractFindOneUsersPermissionsUserArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    findMany<T extends FindManyUsersPermissionsUserArgs>(args?: Subset<T, FindManyUsersPermissionsUserArgs>): Promise<Array<UsersPermissionsUserGetPayload<ExtractFindManyUsersPermissionsUserArgsSelect<T>>>>;
    create<T extends UsersPermissionsUserCreateArgs>(args: Subset<T, UsersPermissionsUserCreateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserCreateArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    delete<T extends UsersPermissionsUserDeleteArgs>(args: Subset<T, UsersPermissionsUserDeleteArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserDeleteArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    update<T extends UsersPermissionsUserUpdateArgs>(args: Subset<T, UsersPermissionsUserUpdateArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserUpdateArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    deleteMany<T extends UsersPermissionsUserDeleteManyArgs>(args: Subset<T, UsersPermissionsUserDeleteManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserDeleteManyArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    updateMany<T extends UsersPermissionsUserUpdateManyArgs>(args: Subset<T, UsersPermissionsUserUpdateManyArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserUpdateManyArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
    upsert<T extends UsersPermissionsUserUpsertArgs>(args: Subset<T, UsersPermissionsUserUpsertArgs>): 'select' extends keyof T ? Promise<UsersPermissionsUserGetPayload<ExtractUsersPermissionsUserUpsertArgsSelect<T>>> : UsersPermissionsUserClient<UsersPermissionsUser>;
}
declare class UsersPermissionsUserClient<T> implements Promise<T> {
    private readonly dmmf;
    private readonly fetcher;
    private readonly queryType;
    private readonly rootField;
    private readonly clientMethod;
    private readonly args;
    private readonly path;
    private callsite;
    private requestPromise?;
    constructor(dmmf: DMMFClass, fetcher: PhotonFetcher, queryType: 'query' | 'mutation', rootField: string, clientMethod: string, args: UsersPermissionsUserArgs, path: string[]);
    readonly [Symbol.toStringTag]: 'PhotonPromise';
    private readonly document;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export declare type FindOneUsersPermissionsUserArgs = {
    select?: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
};
export declare type FindOneUsersPermissionsUserArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
};
declare type ExtractFindOneUsersPermissionsUserArgsSelect<S extends undefined | boolean | FindOneUsersPermissionsUserArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindOneUsersPermissionsUserArgsWithSelect ? S['select'] : true;
export declare type FindManyUsersPermissionsUserArgs = {
    select?: UsersPermissionsUserSelect;
    where?: UsersPermissionsUserWhereInput;
    orderBy?: UsersPermissionsUserOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
export declare type FindManyUsersPermissionsUserArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    where?: UsersPermissionsUserWhereInput;
    orderBy?: UsersPermissionsUserOrderByInput;
    skip?: number;
    after?: string;
    before?: string;
    first?: number;
    last?: number;
};
declare type ExtractFindManyUsersPermissionsUserArgsSelect<S extends undefined | boolean | FindManyUsersPermissionsUserArgs> = S extends undefined ? false : S extends boolean ? S : S extends FindManyUsersPermissionsUserArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserCreateArgs = {
    select?: UsersPermissionsUserSelect;
    data: UsersPermissionsUserCreateInput;
};
export declare type UsersPermissionsUserCreateArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    data: UsersPermissionsUserCreateInput;
};
declare type ExtractUsersPermissionsUserCreateArgsSelect<S extends undefined | boolean | UsersPermissionsUserCreateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserCreateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserUpdateArgs = {
    select?: UsersPermissionsUserSelect;
    data: UsersPermissionsUserUpdateInput;
    where: UsersPermissionsUserWhereUniqueInput;
};
export declare type UsersPermissionsUserUpdateArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    data: UsersPermissionsUserUpdateInput;
    where: UsersPermissionsUserWhereUniqueInput;
};
declare type ExtractUsersPermissionsUserUpdateArgsSelect<S extends undefined | boolean | UsersPermissionsUserUpdateArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserUpdateArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserUpdateManyArgs = {
    select?: UsersPermissionsUserSelect;
    data: UsersPermissionsUserUpdateManyMutationInput;
    where?: UsersPermissionsUserWhereInput;
};
export declare type UsersPermissionsUserUpdateManyArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    data: UsersPermissionsUserUpdateManyMutationInput;
    where?: UsersPermissionsUserWhereInput;
};
declare type ExtractUsersPermissionsUserUpdateManyArgsSelect<S extends undefined | boolean | UsersPermissionsUserUpdateManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserUpdateManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserUpsertArgs = {
    select?: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
    create: UsersPermissionsUserCreateInput;
    update: UsersPermissionsUserUpdateInput;
};
export declare type UsersPermissionsUserUpsertArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
    create: UsersPermissionsUserCreateInput;
    update: UsersPermissionsUserUpdateInput;
};
declare type ExtractUsersPermissionsUserUpsertArgsSelect<S extends undefined | boolean | UsersPermissionsUserUpsertArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserUpsertArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserDeleteArgs = {
    select?: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
};
export declare type UsersPermissionsUserDeleteArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    where: UsersPermissionsUserWhereUniqueInput;
};
declare type ExtractUsersPermissionsUserDeleteArgsSelect<S extends undefined | boolean | UsersPermissionsUserDeleteArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserDeleteArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserDeleteManyArgs = {
    select?: UsersPermissionsUserSelect;
    where?: UsersPermissionsUserWhereInput;
};
export declare type UsersPermissionsUserDeleteManyArgsWithSelect = {
    select: UsersPermissionsUserSelect;
    where?: UsersPermissionsUserWhereInput;
};
declare type ExtractUsersPermissionsUserDeleteManyArgsSelect<S extends undefined | boolean | UsersPermissionsUserDeleteManyArgs> = S extends undefined ? false : S extends boolean ? S : S extends UsersPermissionsUserDeleteManyArgsWithSelect ? S['select'] : true;
export declare type UsersPermissionsUserArgs = {
    select?: UsersPermissionsUserSelect;
};
export declare type UsersPermissionsUserArgsWithSelect = {
    select: UsersPermissionsUserSelect;
};
/**
 * Deep Input Types
 */
export declare type CoreStoreWhereInput = {
    id?: number | IntFilter;
    environment?: string | NullableStringFilter | null;
    key?: string | NullableStringFilter | null;
    tag?: string | NullableStringFilter | null;
    type?: string | NullableStringFilter | null;
    value?: string | NullableStringFilter | null;
    AND?: Enumerable<CoreStoreWhereInput>;
    OR?: Enumerable<CoreStoreWhereInput>;
    NOT?: Enumerable<CoreStoreWhereInput>;
};
export declare type CoreStoreWhereUniqueInput = {
    id?: number;
};
export declare type MigrationWhereInput = {
    revision?: number | IntFilter;
    applied?: number | IntFilter;
    databaseMigration?: string | StringFilter;
    datamodel?: string | StringFilter;
    datamodelSteps?: string | StringFilter;
    errors?: string | StringFilter;
    finishedAt?: string | Date | NullableDateTimeFilter | null;
    name?: string | StringFilter;
    rolledBack?: number | IntFilter;
    startedAt?: string | Date | DateTimeFilter;
    status?: string | StringFilter;
    AND?: Enumerable<MigrationWhereInput>;
    OR?: Enumerable<MigrationWhereInput>;
    NOT?: Enumerable<MigrationWhereInput>;
};
export declare type PostWhereInput = {
    id?: number | IntFilter;
    content?: string | NullableStringFilter | null;
    createdAt?: string | Date | NullableDateTimeFilter | null;
    reads?: number | IntFilter;
    title?: string | StringFilter;
    updatedAt?: string | Date | NullableDateTimeFilter | null;
    AND?: Enumerable<PostWhereInput>;
    OR?: Enumerable<PostWhereInput>;
    NOT?: Enumerable<PostWhereInput>;
};
export declare type PostWhereUniqueInput = {
    id?: number;
};
export declare type StrapiAdministratorWhereInput = {
    id?: number | IntFilter;
    blocked?: boolean | NullableBooleanFilter | null;
    email?: string | StringFilter;
    password?: string | StringFilter;
    resetPasswordToken?: string | NullableStringFilter | null;
    username?: string | StringFilter;
    AND?: Enumerable<StrapiAdministratorWhereInput>;
    OR?: Enumerable<StrapiAdministratorWhereInput>;
    NOT?: Enumerable<StrapiAdministratorWhereInput>;
};
export declare type StrapiAdministratorWhereUniqueInput = {
    id?: number;
};
export declare type UploadFileWhereInput = {
    id?: number | IntFilter;
    createdAt?: string | Date | NullableDateTimeFilter | null;
    ext?: string | NullableStringFilter | null;
    hash?: string | StringFilter;
    mime?: string | StringFilter;
    name?: string | StringFilter;
    provider?: string | StringFilter;
    publicId?: string | NullableStringFilter | null;
    sha256?: string | NullableStringFilter | null;
    size?: string | StringFilter;
    updatedAt?: string | Date | NullableDateTimeFilter | null;
    url?: string | StringFilter;
    AND?: Enumerable<UploadFileWhereInput>;
    OR?: Enumerable<UploadFileWhereInput>;
    NOT?: Enumerable<UploadFileWhereInput>;
};
export declare type UploadFileWhereUniqueInput = {
    id?: number;
};
export declare type UploadFileMorphWhereInput = {
    id?: number | IntFilter;
    field?: string | NullableStringFilter | null;
    relatedId?: number | NullableIntFilter | null;
    relatedType?: string | NullableStringFilter | null;
    uploadFileId?: number | NullableIntFilter | null;
    AND?: Enumerable<UploadFileMorphWhereInput>;
    OR?: Enumerable<UploadFileMorphWhereInput>;
    NOT?: Enumerable<UploadFileMorphWhereInput>;
};
export declare type UploadFileMorphWhereUniqueInput = {
    id?: number;
};
export declare type UsersPermissionsPermissionWhereInput = {
    id?: number | IntFilter;
    action?: string | StringFilter;
    controller?: string | StringFilter;
    enabled?: boolean | BooleanFilter;
    policy?: string | NullableStringFilter | null;
    role?: number | NullableIntFilter | null;
    type?: string | StringFilter;
    AND?: Enumerable<UsersPermissionsPermissionWhereInput>;
    OR?: Enumerable<UsersPermissionsPermissionWhereInput>;
    NOT?: Enumerable<UsersPermissionsPermissionWhereInput>;
};
export declare type UsersPermissionsPermissionWhereUniqueInput = {
    id?: number;
};
export declare type UsersPermissionsRoleWhereInput = {
    id?: number | IntFilter;
    description?: string | NullableStringFilter | null;
    name?: string | StringFilter;
    type?: string | NullableStringFilter | null;
    AND?: Enumerable<UsersPermissionsRoleWhereInput>;
    OR?: Enumerable<UsersPermissionsRoleWhereInput>;
    NOT?: Enumerable<UsersPermissionsRoleWhereInput>;
};
export declare type UsersPermissionsRoleWhereUniqueInput = {
    id?: number;
};
export declare type UsersPermissionsUserWhereInput = {
    id?: number | IntFilter;
    blocked?: boolean | NullableBooleanFilter | null;
    confirmed?: boolean | NullableBooleanFilter | null;
    createdAt?: string | Date | NullableDateTimeFilter | null;
    email?: string | StringFilter;
    password?: string | NullableStringFilter | null;
    provider?: string | NullableStringFilter | null;
    resetPasswordToken?: string | NullableStringFilter | null;
    role?: number | NullableIntFilter | null;
    updatedAt?: string | Date | NullableDateTimeFilter | null;
    username?: string | StringFilter;
    AND?: Enumerable<UsersPermissionsUserWhereInput>;
    OR?: Enumerable<UsersPermissionsUserWhereInput>;
    NOT?: Enumerable<UsersPermissionsUserWhereInput>;
};
export declare type UsersPermissionsUserWhereUniqueInput = {
    id?: number;
};
export declare type CoreStoreCreateInput = {
    environment?: string;
    key?: string;
    tag?: string;
    type?: string;
    value?: string;
};
export declare type CoreStoreUpdateInput = {
    environment?: string;
    key?: string;
    tag?: string;
    type?: string;
    value?: string;
};
export declare type CoreStoreUpdateManyMutationInput = {
    environment?: string;
    key?: string;
    tag?: string;
    type?: string;
    value?: string;
};
export declare type MigrationCreateInput = {
    revision: number;
    applied: number;
    databaseMigration: string;
    datamodel: string;
    datamodelSteps: string;
    errors: string;
    finishedAt?: string | Date;
    name: string;
    rolledBack: number;
    startedAt: string | Date;
    status: string;
};
export declare type MigrationUpdateManyMutationInput = {
    revision?: number;
    applied?: number;
    databaseMigration?: string;
    datamodel?: string;
    datamodelSteps?: string;
    errors?: string;
    finishedAt?: string | Date;
    name?: string;
    rolledBack?: number;
    startedAt?: string | Date;
    status?: string;
};
export declare type PostCreateInput = {
    content?: string;
    reads: number;
    title: string;
};
export declare type PostUpdateInput = {
    content?: string;
    reads?: number;
    title?: string;
};
export declare type PostUpdateManyMutationInput = {
    content?: string;
    reads?: number;
    title?: string;
};
export declare type StrapiAdministratorCreateInput = {
    blocked?: boolean;
    email: string;
    password: string;
    resetPasswordToken?: string;
    username: string;
};
export declare type StrapiAdministratorUpdateInput = {
    blocked?: boolean;
    email?: string;
    password?: string;
    resetPasswordToken?: string;
    username?: string;
};
export declare type StrapiAdministratorUpdateManyMutationInput = {
    blocked?: boolean;
    email?: string;
    password?: string;
    resetPasswordToken?: string;
    username?: string;
};
export declare type UploadFileCreateInput = {
    ext?: string;
    hash: string;
    mime: string;
    name: string;
    provider: string;
    publicId?: string;
    sha256?: string;
    size: string;
    url: string;
};
export declare type UploadFileUpdateInput = {
    ext?: string;
    hash?: string;
    mime?: string;
    name?: string;
    provider?: string;
    publicId?: string;
    sha256?: string;
    size?: string;
    url?: string;
};
export declare type UploadFileUpdateManyMutationInput = {
    ext?: string;
    hash?: string;
    mime?: string;
    name?: string;
    provider?: string;
    publicId?: string;
    sha256?: string;
    size?: string;
    url?: string;
};
export declare type UploadFileMorphCreateInput = {
    field?: string;
    relatedId?: number;
    relatedType?: string;
    uploadFileId?: number;
};
export declare type UploadFileMorphUpdateInput = {
    field?: string;
    relatedId?: number;
    relatedType?: string;
    uploadFileId?: number;
};
export declare type UploadFileMorphUpdateManyMutationInput = {
    field?: string;
    relatedId?: number;
    relatedType?: string;
    uploadFileId?: number;
};
export declare type UsersPermissionsPermissionCreateInput = {
    action: string;
    controller: string;
    enabled: boolean;
    policy?: string;
    role?: number;
    type: string;
};
export declare type UsersPermissionsPermissionUpdateInput = {
    action?: string;
    controller?: string;
    enabled?: boolean;
    policy?: string;
    role?: number;
    type?: string;
};
export declare type UsersPermissionsPermissionUpdateManyMutationInput = {
    action?: string;
    controller?: string;
    enabled?: boolean;
    policy?: string;
    role?: number;
    type?: string;
};
export declare type UsersPermissionsRoleCreateInput = {
    description?: string;
    name: string;
    type?: string;
};
export declare type UsersPermissionsRoleUpdateInput = {
    description?: string;
    name?: string;
    type?: string;
};
export declare type UsersPermissionsRoleUpdateManyMutationInput = {
    description?: string;
    name?: string;
    type?: string;
};
export declare type UsersPermissionsUserCreateInput = {
    blocked?: boolean;
    confirmed?: boolean;
    email: string;
    password?: string;
    provider?: string;
    resetPasswordToken?: string;
    role?: number;
    username: string;
};
export declare type UsersPermissionsUserUpdateInput = {
    blocked?: boolean;
    confirmed?: boolean;
    email?: string;
    password?: string;
    provider?: string;
    resetPasswordToken?: string;
    role?: number;
    username?: string;
};
export declare type UsersPermissionsUserUpdateManyMutationInput = {
    blocked?: boolean;
    confirmed?: boolean;
    email?: string;
    password?: string;
    provider?: string;
    resetPasswordToken?: string;
    role?: number;
    username?: string;
};
export declare type IntFilter = {
    equals?: number;
    not?: number | IntFilter;
    in?: Enumerable<number>;
    notIn?: Enumerable<number>;
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
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
export declare type NullableDateTimeFilter = {
    equals?: string | Date | null;
    not?: string | Date | null | NullableDateTimeFilter;
    in?: Enumerable<string | Date>;
    notIn?: Enumerable<string | Date>;
    lt?: string | Date;
    lte?: string | Date;
    gt?: string | Date;
    gte?: string | Date;
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
export declare type NullableBooleanFilter = {
    equals?: boolean | null;
    not?: boolean | null | NullableBooleanFilter;
};
export declare type NullableIntFilter = {
    equals?: number | null;
    not?: number | null | NullableIntFilter;
    in?: Enumerable<number>;
    notIn?: Enumerable<number>;
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
};
export declare type BooleanFilter = {
    equals?: boolean;
    not?: boolean | BooleanFilter;
};
export declare type CoreStoreOrderByInput = {
    id?: OrderByArg;
    environment?: OrderByArg;
    key?: OrderByArg;
    tag?: OrderByArg;
    type?: OrderByArg;
    value?: OrderByArg;
};
export declare type MigrationOrderByInput = {
    revision?: OrderByArg;
    applied?: OrderByArg;
    databaseMigration?: OrderByArg;
    datamodel?: OrderByArg;
    datamodelSteps?: OrderByArg;
    errors?: OrderByArg;
    finishedAt?: OrderByArg;
    name?: OrderByArg;
    rolledBack?: OrderByArg;
    startedAt?: OrderByArg;
    status?: OrderByArg;
};
export declare type PostOrderByInput = {
    id?: OrderByArg;
    content?: OrderByArg;
    createdAt?: OrderByArg;
    reads?: OrderByArg;
    title?: OrderByArg;
    updatedAt?: OrderByArg;
};
export declare type StrapiAdministratorOrderByInput = {
    id?: OrderByArg;
    blocked?: OrderByArg;
    email?: OrderByArg;
    password?: OrderByArg;
    resetPasswordToken?: OrderByArg;
    username?: OrderByArg;
};
export declare type UploadFileOrderByInput = {
    id?: OrderByArg;
    createdAt?: OrderByArg;
    ext?: OrderByArg;
    hash?: OrderByArg;
    mime?: OrderByArg;
    name?: OrderByArg;
    provider?: OrderByArg;
    publicId?: OrderByArg;
    sha256?: OrderByArg;
    size?: OrderByArg;
    updatedAt?: OrderByArg;
    url?: OrderByArg;
};
export declare type UploadFileMorphOrderByInput = {
    id?: OrderByArg;
    field?: OrderByArg;
    relatedId?: OrderByArg;
    relatedType?: OrderByArg;
    uploadFileId?: OrderByArg;
};
export declare type UsersPermissionsPermissionOrderByInput = {
    id?: OrderByArg;
    action?: OrderByArg;
    controller?: OrderByArg;
    enabled?: OrderByArg;
    policy?: OrderByArg;
    role?: OrderByArg;
    type?: OrderByArg;
};
export declare type UsersPermissionsRoleOrderByInput = {
    id?: OrderByArg;
    description?: OrderByArg;
    name?: OrderByArg;
    type?: OrderByArg;
};
export declare type UsersPermissionsUserOrderByInput = {
    id?: OrderByArg;
    blocked?: OrderByArg;
    confirmed?: OrderByArg;
    createdAt?: OrderByArg;
    email?: OrderByArg;
    password?: OrderByArg;
    provider?: OrderByArg;
    resetPasswordToken?: OrderByArg;
    role?: OrderByArg;
    updatedAt?: OrderByArg;
    username?: OrderByArg;
};
/**
 * DMMF
 */
export declare const dmmf: DMMF.Document;
export {};
