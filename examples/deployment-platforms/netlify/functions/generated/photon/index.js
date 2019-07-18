"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const runtime_1 = require("./runtime");
const debug = runtime_1.debugLib('photon');
class PhotonFetcher {
    constructor(engine, debug = false, hooks) {
        this.engine = engine;
        this.debug = debug;
        this.hooks = hooks;
    }
    request(document, path = [], rootField, typeName) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = String(document);
            debug(query);
            if (this.hooks && this.hooks.beforeRequest) {
                this.hooks.beforeRequest({ query, path, rootField, typeName, document });
            }
            yield this.engine.start();
            try {
                const result = yield this.engine.request(query, typeName);
                debug(result);
                return this.unpack(result, path, rootField);
            }
            catch (e) {
                throw new Error(`Error in Photon${path}: \n` + e.message);
            }
        });
    }
    unpack(result, path, rootField) {
        const getPath = [];
        if (rootField) {
            getPath.push(rootField);
        }
        getPath.push(...path.filter(p => p !== 'select'));
        return runtime_1.deepGet(result, getPath);
    }
}
class Photon {
    constructor(options = { autoConnect: true }) {
        const useDebug = options.debug === true ? true : typeof options.debug === 'object' ? Boolean(options.debug.library) : false;
        if (useDebug) {
            runtime_1.debugLib.enable('photon');
        }
        const debugEngine = options.debug === true ? true : typeof options.debug === 'object' ? Boolean(options.debug.engine) : false;
        // datamodel = datamodel without datasources + printed datasources
        this.datamodel = "model CoreStore {\n  id          Int     @id\n  environment String?\n  key         String?\n  tag         String?\n  type        String?\n  value       String?\n\n  @@map(\"core_store\")\n}\n\nmodel Migration {\n  revision          Int       @id\n  applied           Int\n  databaseMigration String    @map(\"database_migration\")\n  datamodel         String\n  datamodelSteps    String    @map(\"datamodel_steps\")\n  errors            String\n  finishedAt        DateTime? @map(\"finished_at\")\n  name              String\n  rolledBack        Int       @map(\"rolled_back\")\n  startedAt         DateTime  @map(\"started_at\")\n  status            String\n\n  @@map(\"_Migration\")\n}\n\nmodel Post {\n  id        Int       @id\n  content   String?\n  createdAt DateTime? @map(\"created_at\")\n  reads     Int\n  title     String\n  updatedAt DateTime? @map(\"updated_at\")\n\n  @@map(\"posts\")\n}\n\nmodel StrapiAdministrator {\n  id                 Int      @id\n  blocked            Boolean?\n  email              String\n  password           String\n  resetPasswordToken String?\n  username           String\n\n  @@map(\"strapi_administrator\")\n}\n\nmodel UploadFile {\n  id        Int       @id\n  createdAt DateTime? @map(\"created_at\")\n  ext       String?\n  hash      String\n  mime      String\n  name      String\n  provider  String\n  publicId  String?   @map(\"public_id\")\n  sha256    String?\n  size      String\n  updatedAt DateTime? @map(\"updated_at\")\n  url       String\n\n  @@map(\"upload_file\")\n}\n\nmodel UploadFileMorph {\n  id           Int     @id\n  field        String?\n  relatedId    Int?    @map(\"related_id\")\n  relatedType  String? @map(\"related_type\")\n  uploadFileId Int?    @map(\"upload_file_id\")\n\n  @@map(\"upload_file_morph\")\n}\n\nmodel UsersPermissionsPermission {\n  id         Int     @id\n  action     String\n  controller String\n  enabled    Boolean\n  policy     String?\n  role       Int?\n  type       String\n\n  @@map(\"users-permissions_permission\")\n}\n\nmodel UsersPermissionsRole {\n  id          Int     @id\n  description String?\n  name        String\n  type        String?\n\n  @@map(\"users-permissions_role\")\n}\n\nmodel UsersPermissionsUser {\n  id                 Int       @id\n  blocked            Boolean?\n  confirmed          Boolean?\n  createdAt          DateTime? @map(\"created_at\")\n  email              String\n  password           String?\n  provider           String?\n  resetPasswordToken String?\n  role               Int?\n  updatedAt          DateTime? @map(\"updated_at\")\n  username           String\n\n  @@map(\"users-permissions_user\")\n}";
        this.internalDatasources = [
            {
                "name": "db",
                "connectorType": "mysql",
                "url": "mysql://prisma:qd58rcCywPRS4Stk@introspection-database-mysql.cluster-clfeqqifnebj.eu-west-1.rds.amazonaws.com:3306/strapi",
                "config": {}
            }
        ];
        const printedDatasources = runtime_1.printDatasources(options.datasources || {}, this.internalDatasources);
        const datamodel = printedDatasources + '\n\n' + this.datamodel;
        debug('datamodel:');
        debug(datamodel);
        const internal = options.__internal || {};
        const engineConfig = internal.engine || {};
        this.engine = new runtime_1.Engine({
            cwd: engineConfig.cwd,
            debug: debugEngine,
            datamodel,
            prismaPath: engineConfig.binaryPath || undefined
        });
        this.dmmf = new runtime_1.DMMFClass(exports.dmmf);
        this.fetcher = new PhotonFetcher(this.engine, false, internal.hooks);
        this.autoConnect = typeof options.autoConnect === 'boolean' ? options.autoConnect : true;
        if (this.autoConnect) {
            this.connect();
        }
    }
    connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }
        this.connectionPromise = this.engine.start();
        return this.connectionPromise;
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.engine.stop();
        });
    }
    // won't be generated for now
    // private _query?: QueryDelegate
    // get query(): QueryDelegate {
    //   return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
    // }
    get coreStores() {
        this.connect();
        return CoreStoreDelegate(this.dmmf, this.fetcher);
    }
    get migrations() {
        this.connect();
        return MigrationDelegate(this.dmmf, this.fetcher);
    }
    get posts() {
        this.connect();
        return PostDelegate(this.dmmf, this.fetcher);
    }
    get strapiAdministrators() {
        this.connect();
        return StrapiAdministratorDelegate(this.dmmf, this.fetcher);
    }
    get uploadFiles() {
        this.connect();
        return UploadFileDelegate(this.dmmf, this.fetcher);
    }
    get uploadFileMorphs() {
        this.connect();
        return UploadFileMorphDelegate(this.dmmf, this.fetcher);
    }
    get usersPermissionsPermissions() {
        this.connect();
        return UsersPermissionsPermissionDelegate(this.dmmf, this.fetcher);
    }
    get usersPermissionsRoles() {
        this.connect();
        return UsersPermissionsRoleDelegate(this.dmmf, this.fetcher);
    }
    get usersPermissionsUsers() {
        this.connect();
        return UsersPermissionsUserDelegate(this.dmmf, this.fetcher);
    }
}
exports.default = Photon;
/**
 * Enums
 */
// Based on
// https://github.com/microsoft/TypeScript/issues/3192#issuecomment-261720275
function makeEnum(x) { return x; }
exports.OrderByArg = makeEnum({
    asc: 'asc',
    desc: 'desc'
});
function CoreStoreDelegate(dmmf, fetcher) {
    const CoreStore = (args) => new CoreStoreClient(dmmf, fetcher, 'query', 'findManyCoreStore', 'coreStores', args, []);
    CoreStore.findOne = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'query', 'findOneCoreStore', 'coreStores.findOne', args, []) : new CoreStoreClient(dmmf, fetcher, 'query', 'findOneCoreStore', 'coreStores.findOne', args, []);
    CoreStore.findMany = (args) => new CoreStoreClient(dmmf, fetcher, 'query', 'findManyCoreStore', 'coreStores.findMany', args, []);
    CoreStore.create = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'createOneCoreStore', 'coreStores.create', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'createOneCoreStore', 'coreStores.create', args, []);
    CoreStore.delete = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'deleteOneCoreStore', 'coreStores.delete', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'deleteOneCoreStore', 'coreStores.delete', args, []);
    CoreStore.update = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'updateOneCoreStore', 'coreStores.update', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'updateOneCoreStore', 'coreStores.update', args, []);
    CoreStore.deleteMany = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'deleteManyCoreStore', 'coreStores.deleteMany', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'deleteManyCoreStore', 'coreStores.deleteMany', args, []);
    CoreStore.updateMany = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'updateManyCoreStore', 'coreStores.updateMany', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'updateManyCoreStore', 'coreStores.updateMany', args, []);
    CoreStore.upsert = (args) => args.select ? new CoreStoreClient(dmmf, fetcher, 'mutation', 'upsertOneCoreStore', 'coreStores.upsert', args, []) : new CoreStoreClient(dmmf, fetcher, 'mutation', 'upsertOneCoreStore', 'coreStores.upsert', args, []);
    return CoreStore; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class CoreStoreClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'CoreStore');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'CoreStore');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'CoreStore');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function MigrationDelegate(dmmf, fetcher) {
    const Migration = (args) => new MigrationClient(dmmf, fetcher, 'query', 'findManyMigration', 'migrations', args, []);
    Migration.findMany = (args) => new MigrationClient(dmmf, fetcher, 'query', 'findManyMigration', 'migrations.findMany', args, []);
    Migration.create = (args) => args.select ? new MigrationClient(dmmf, fetcher, 'mutation', 'createOneMigration', 'migrations.create', args, []) : new MigrationClient(dmmf, fetcher, 'mutation', 'createOneMigration', 'migrations.create', args, []);
    Migration.deleteMany = (args) => args.select ? new MigrationClient(dmmf, fetcher, 'mutation', 'deleteManyMigration', 'migrations.deleteMany', args, []) : new MigrationClient(dmmf, fetcher, 'mutation', 'deleteManyMigration', 'migrations.deleteMany', args, []);
    Migration.updateMany = (args) => args.select ? new MigrationClient(dmmf, fetcher, 'mutation', 'updateManyMigration', 'migrations.updateMany', args, []) : new MigrationClient(dmmf, fetcher, 'mutation', 'updateManyMigration', 'migrations.updateMany', args, []);
    return Migration; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class MigrationClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Migration');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Migration');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Migration');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function PostDelegate(dmmf, fetcher) {
    const Post = (args) => new PostClient(dmmf, fetcher, 'query', 'findManyPost', 'posts', args, []);
    Post.findOne = (args) => args.select ? new PostClient(dmmf, fetcher, 'query', 'findOnePost', 'posts.findOne', args, []) : new PostClient(dmmf, fetcher, 'query', 'findOnePost', 'posts.findOne', args, []);
    Post.findMany = (args) => new PostClient(dmmf, fetcher, 'query', 'findManyPost', 'posts.findMany', args, []);
    Post.create = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'createOnePost', 'posts.create', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'createOnePost', 'posts.create', args, []);
    Post.delete = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'deleteOnePost', 'posts.delete', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'deleteOnePost', 'posts.delete', args, []);
    Post.update = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'updateOnePost', 'posts.update', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'updateOnePost', 'posts.update', args, []);
    Post.deleteMany = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'deleteManyPost', 'posts.deleteMany', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'deleteManyPost', 'posts.deleteMany', args, []);
    Post.updateMany = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'updateManyPost', 'posts.updateMany', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'updateManyPost', 'posts.updateMany', args, []);
    Post.upsert = (args) => args.select ? new PostClient(dmmf, fetcher, 'mutation', 'upsertOnePost', 'posts.upsert', args, []) : new PostClient(dmmf, fetcher, 'mutation', 'upsertOnePost', 'posts.upsert', args, []);
    return Post; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class PostClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Post');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Post');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'Post');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function StrapiAdministratorDelegate(dmmf, fetcher) {
    const StrapiAdministrator = (args) => new StrapiAdministratorClient(dmmf, fetcher, 'query', 'findManyStrapiAdministrator', 'strapiAdministrators', args, []);
    StrapiAdministrator.findOne = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'query', 'findOneStrapiAdministrator', 'strapiAdministrators.findOne', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'query', 'findOneStrapiAdministrator', 'strapiAdministrators.findOne', args, []);
    StrapiAdministrator.findMany = (args) => new StrapiAdministratorClient(dmmf, fetcher, 'query', 'findManyStrapiAdministrator', 'strapiAdministrators.findMany', args, []);
    StrapiAdministrator.create = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'createOneStrapiAdministrator', 'strapiAdministrators.create', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'createOneStrapiAdministrator', 'strapiAdministrators.create', args, []);
    StrapiAdministrator.delete = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'deleteOneStrapiAdministrator', 'strapiAdministrators.delete', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'deleteOneStrapiAdministrator', 'strapiAdministrators.delete', args, []);
    StrapiAdministrator.update = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'updateOneStrapiAdministrator', 'strapiAdministrators.update', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'updateOneStrapiAdministrator', 'strapiAdministrators.update', args, []);
    StrapiAdministrator.deleteMany = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'deleteManyStrapiAdministrator', 'strapiAdministrators.deleteMany', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'deleteManyStrapiAdministrator', 'strapiAdministrators.deleteMany', args, []);
    StrapiAdministrator.updateMany = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'updateManyStrapiAdministrator', 'strapiAdministrators.updateMany', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'updateManyStrapiAdministrator', 'strapiAdministrators.updateMany', args, []);
    StrapiAdministrator.upsert = (args) => args.select ? new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'upsertOneStrapiAdministrator', 'strapiAdministrators.upsert', args, []) : new StrapiAdministratorClient(dmmf, fetcher, 'mutation', 'upsertOneStrapiAdministrator', 'strapiAdministrators.upsert', args, []);
    return StrapiAdministrator; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class StrapiAdministratorClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'StrapiAdministrator');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'StrapiAdministrator');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'StrapiAdministrator');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function UploadFileDelegate(dmmf, fetcher) {
    const UploadFile = (args) => new UploadFileClient(dmmf, fetcher, 'query', 'findManyUploadFile', 'uploadFiles', args, []);
    UploadFile.findOne = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'query', 'findOneUploadFile', 'uploadFiles.findOne', args, []) : new UploadFileClient(dmmf, fetcher, 'query', 'findOneUploadFile', 'uploadFiles.findOne', args, []);
    UploadFile.findMany = (args) => new UploadFileClient(dmmf, fetcher, 'query', 'findManyUploadFile', 'uploadFiles.findMany', args, []);
    UploadFile.create = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'createOneUploadFile', 'uploadFiles.create', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'createOneUploadFile', 'uploadFiles.create', args, []);
    UploadFile.delete = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'deleteOneUploadFile', 'uploadFiles.delete', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'deleteOneUploadFile', 'uploadFiles.delete', args, []);
    UploadFile.update = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'updateOneUploadFile', 'uploadFiles.update', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'updateOneUploadFile', 'uploadFiles.update', args, []);
    UploadFile.deleteMany = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'deleteManyUploadFile', 'uploadFiles.deleteMany', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'deleteManyUploadFile', 'uploadFiles.deleteMany', args, []);
    UploadFile.updateMany = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'updateManyUploadFile', 'uploadFiles.updateMany', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'updateManyUploadFile', 'uploadFiles.updateMany', args, []);
    UploadFile.upsert = (args) => args.select ? new UploadFileClient(dmmf, fetcher, 'mutation', 'upsertOneUploadFile', 'uploadFiles.upsert', args, []) : new UploadFileClient(dmmf, fetcher, 'mutation', 'upsertOneUploadFile', 'uploadFiles.upsert', args, []);
    return UploadFile; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class UploadFileClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFile');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFile');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFile');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function UploadFileMorphDelegate(dmmf, fetcher) {
    const UploadFileMorph = (args) => new UploadFileMorphClient(dmmf, fetcher, 'query', 'findManyUploadFileMorph', 'uploadFileMorphs', args, []);
    UploadFileMorph.findOne = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'query', 'findOneUploadFileMorph', 'uploadFileMorphs.findOne', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'query', 'findOneUploadFileMorph', 'uploadFileMorphs.findOne', args, []);
    UploadFileMorph.findMany = (args) => new UploadFileMorphClient(dmmf, fetcher, 'query', 'findManyUploadFileMorph', 'uploadFileMorphs.findMany', args, []);
    UploadFileMorph.create = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'createOneUploadFileMorph', 'uploadFileMorphs.create', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'createOneUploadFileMorph', 'uploadFileMorphs.create', args, []);
    UploadFileMorph.delete = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'deleteOneUploadFileMorph', 'uploadFileMorphs.delete', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'deleteOneUploadFileMorph', 'uploadFileMorphs.delete', args, []);
    UploadFileMorph.update = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'updateOneUploadFileMorph', 'uploadFileMorphs.update', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'updateOneUploadFileMorph', 'uploadFileMorphs.update', args, []);
    UploadFileMorph.deleteMany = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'deleteManyUploadFileMorph', 'uploadFileMorphs.deleteMany', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'deleteManyUploadFileMorph', 'uploadFileMorphs.deleteMany', args, []);
    UploadFileMorph.updateMany = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'updateManyUploadFileMorph', 'uploadFileMorphs.updateMany', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'updateManyUploadFileMorph', 'uploadFileMorphs.updateMany', args, []);
    UploadFileMorph.upsert = (args) => args.select ? new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'upsertOneUploadFileMorph', 'uploadFileMorphs.upsert', args, []) : new UploadFileMorphClient(dmmf, fetcher, 'mutation', 'upsertOneUploadFileMorph', 'uploadFileMorphs.upsert', args, []);
    return UploadFileMorph; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class UploadFileMorphClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFileMorph');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFileMorph');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UploadFileMorph');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function UsersPermissionsPermissionDelegate(dmmf, fetcher) {
    const UsersPermissionsPermission = (args) => new UsersPermissionsPermissionClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsPermission', 'usersPermissionsPermissions', args, []);
    UsersPermissionsPermission.findOne = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsPermission', 'usersPermissionsPermissions.findOne', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsPermission', 'usersPermissionsPermissions.findOne', args, []);
    UsersPermissionsPermission.findMany = (args) => new UsersPermissionsPermissionClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsPermission', 'usersPermissionsPermissions.findMany', args, []);
    UsersPermissionsPermission.create = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsPermission', 'usersPermissionsPermissions.create', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsPermission', 'usersPermissionsPermissions.create', args, []);
    UsersPermissionsPermission.delete = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsPermission', 'usersPermissionsPermissions.delete', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsPermission', 'usersPermissionsPermissions.delete', args, []);
    UsersPermissionsPermission.update = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsPermission', 'usersPermissionsPermissions.update', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsPermission', 'usersPermissionsPermissions.update', args, []);
    UsersPermissionsPermission.deleteMany = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsPermission', 'usersPermissionsPermissions.deleteMany', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsPermission', 'usersPermissionsPermissions.deleteMany', args, []);
    UsersPermissionsPermission.updateMany = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsPermission', 'usersPermissionsPermissions.updateMany', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsPermission', 'usersPermissionsPermissions.updateMany', args, []);
    UsersPermissionsPermission.upsert = (args) => args.select ? new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsPermission', 'usersPermissionsPermissions.upsert', args, []) : new UsersPermissionsPermissionClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsPermission', 'usersPermissionsPermissions.upsert', args, []);
    return UsersPermissionsPermission; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class UsersPermissionsPermissionClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsPermission');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsPermission');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsPermission');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function UsersPermissionsRoleDelegate(dmmf, fetcher) {
    const UsersPermissionsRole = (args) => new UsersPermissionsRoleClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsRole', 'usersPermissionsRoles', args, []);
    UsersPermissionsRole.findOne = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsRole', 'usersPermissionsRoles.findOne', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsRole', 'usersPermissionsRoles.findOne', args, []);
    UsersPermissionsRole.findMany = (args) => new UsersPermissionsRoleClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsRole', 'usersPermissionsRoles.findMany', args, []);
    UsersPermissionsRole.create = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsRole', 'usersPermissionsRoles.create', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsRole', 'usersPermissionsRoles.create', args, []);
    UsersPermissionsRole.delete = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsRole', 'usersPermissionsRoles.delete', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsRole', 'usersPermissionsRoles.delete', args, []);
    UsersPermissionsRole.update = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsRole', 'usersPermissionsRoles.update', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsRole', 'usersPermissionsRoles.update', args, []);
    UsersPermissionsRole.deleteMany = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsRole', 'usersPermissionsRoles.deleteMany', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsRole', 'usersPermissionsRoles.deleteMany', args, []);
    UsersPermissionsRole.updateMany = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsRole', 'usersPermissionsRoles.updateMany', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsRole', 'usersPermissionsRoles.updateMany', args, []);
    UsersPermissionsRole.upsert = (args) => args.select ? new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsRole', 'usersPermissionsRoles.upsert', args, []) : new UsersPermissionsRoleClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsRole', 'usersPermissionsRoles.upsert', args, []);
    return UsersPermissionsRole; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class UsersPermissionsRoleClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsRole');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsRole');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsRole');
        }
        return this.requestPromise.finally(onfinally);
    }
}
function UsersPermissionsUserDelegate(dmmf, fetcher) {
    const UsersPermissionsUser = (args) => new UsersPermissionsUserClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsUser', 'usersPermissionsUsers', args, []);
    UsersPermissionsUser.findOne = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsUser', 'usersPermissionsUsers.findOne', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'query', 'findOneUsersPermissionsUser', 'usersPermissionsUsers.findOne', args, []);
    UsersPermissionsUser.findMany = (args) => new UsersPermissionsUserClient(dmmf, fetcher, 'query', 'findManyUsersPermissionsUser', 'usersPermissionsUsers.findMany', args, []);
    UsersPermissionsUser.create = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsUser', 'usersPermissionsUsers.create', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'createOneUsersPermissionsUser', 'usersPermissionsUsers.create', args, []);
    UsersPermissionsUser.delete = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsUser', 'usersPermissionsUsers.delete', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'deleteOneUsersPermissionsUser', 'usersPermissionsUsers.delete', args, []);
    UsersPermissionsUser.update = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsUser', 'usersPermissionsUsers.update', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'updateOneUsersPermissionsUser', 'usersPermissionsUsers.update', args, []);
    UsersPermissionsUser.deleteMany = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsUser', 'usersPermissionsUsers.deleteMany', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'deleteManyUsersPermissionsUser', 'usersPermissionsUsers.deleteMany', args, []);
    UsersPermissionsUser.updateMany = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsUser', 'usersPermissionsUsers.updateMany', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'updateManyUsersPermissionsUser', 'usersPermissionsUsers.updateMany', args, []);
    UsersPermissionsUser.upsert = (args) => args.select ? new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsUser', 'usersPermissionsUsers.upsert', args, []) : new UsersPermissionsUserClient(dmmf, fetcher, 'mutation', 'upsertOneUsersPermissionsUser', 'usersPermissionsUsers.upsert', args, []);
    return UsersPermissionsUser; // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}
class UsersPermissionsUserClient {
    constructor(dmmf, fetcher, queryType, rootField, clientMethod, args, path) {
        this.dmmf = dmmf;
        this.fetcher = fetcher;
        this.queryType = queryType;
        this.rootField = rootField;
        this.clientMethod = clientMethod;
        this.args = args;
        this.path = path;
        // @ts-ignore
        if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
            const error = new Error();
            if (error && error.stack) {
                const stack = error.stack;
                this.callsite = stack;
            }
        }
    }
    get document() {
        const { rootField } = this;
        const document = runtime_1.makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: this.queryType,
            select: this.args
        });
        try {
            document.validate(this.args, false, this.clientMethod);
        }
        catch (e) {
            const x = e;
            if (x.render) {
                if (this.callsite) {
                    e.message = x.render(this.callsite);
                }
            }
            throw e;
        }
        debug(String(document));
        return runtime_1.transformDocument(document);
    }
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then(onfulfilled, onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsUser');
        }
        return this.requestPromise.then(onfulfilled, onrejected);
    }
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch(onrejected) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsUser');
        }
        return this.requestPromise.catch(onrejected);
    }
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally) {
        if (!this.requestPromise) {
            this.requestPromise = this.fetcher.request(this.document, this.path, this.rootField, 'UsersPermissionsUser');
        }
        return this.requestPromise.finally(onfinally);
    }
}
/**
 * DMMF
 */
exports.dmmf = { "datamodel": { "enums": [], "models": [{ "name": "CoreStore", "isEmbedded": false, "dbName": "core_store", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "environment", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "key", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "tag", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "type", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "value", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "Migration", "isEmbedded": false, "dbName": "_Migration", "fields": [{ "name": "revision", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "applied", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "databaseMigration", "kind": "scalar", "dbName": "database_migration", "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "datamodel", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "datamodelSteps", "kind": "scalar", "dbName": "datamodel_steps", "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "errors", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "finishedAt", "kind": "scalar", "dbName": "finished_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "name", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "rolledBack", "kind": "scalar", "dbName": "rolled_back", "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "startedAt", "kind": "scalar", "dbName": "started_at", "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "status", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "Post", "isEmbedded": false, "dbName": "posts", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "content", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "createdAt", "kind": "scalar", "dbName": "created_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "reads", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "title", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "updatedAt", "kind": "scalar", "dbName": "updated_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "StrapiAdministrator", "isEmbedded": false, "dbName": "strapi_administrator", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "blocked", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Boolean", "isGenerated": false, "isUpdatedAt": false }, { "name": "email", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "password", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "resetPasswordToken", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "username", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "UploadFile", "isEmbedded": false, "dbName": "upload_file", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "createdAt", "kind": "scalar", "dbName": "created_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "ext", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "hash", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "mime", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "name", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "provider", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "publicId", "kind": "scalar", "dbName": "public_id", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "sha256", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "size", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "updatedAt", "kind": "scalar", "dbName": "updated_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "url", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "UploadFileMorph", "isEmbedded": false, "dbName": "upload_file_morph", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "field", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "relatedId", "kind": "scalar", "dbName": "related_id", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "relatedType", "kind": "scalar", "dbName": "related_type", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "uploadFileId", "kind": "scalar", "dbName": "upload_file_id", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "UsersPermissionsPermission", "isEmbedded": false, "dbName": "users-permissions_permission", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "action", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "controller", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "enabled", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "Boolean", "isGenerated": false, "isUpdatedAt": false }, { "name": "policy", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "role", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "type", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "UsersPermissionsRole", "isEmbedded": false, "dbName": "users-permissions_role", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "description", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "name", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "type", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }, { "name": "UsersPermissionsUser", "isEmbedded": false, "dbName": "users-permissions_user", "fields": [{ "name": "id", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": true, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "blocked", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Boolean", "isGenerated": false, "isUpdatedAt": false }, { "name": "confirmed", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Boolean", "isGenerated": false, "isUpdatedAt": false }, { "name": "createdAt", "kind": "scalar", "dbName": "created_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "email", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "password", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "provider", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "resetPasswordToken", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }, { "name": "role", "kind": "scalar", "dbName": null, "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "Int", "isGenerated": false, "isUpdatedAt": false }, { "name": "updatedAt", "kind": "scalar", "dbName": "updated_at", "isList": false, "isRequired": false, "isUnique": false, "isId": false, "type": "DateTime", "isGenerated": false, "isUpdatedAt": false }, { "name": "username", "kind": "scalar", "dbName": null, "isList": false, "isRequired": true, "isUnique": false, "isId": false, "type": "String", "isGenerated": false, "isUpdatedAt": false }], "isGenerated": false }] }, "mappings": [{ "model": "CoreStore", "plural": "coreStores", "findOne": "findOneCoreStore", "findMany": "findManyCoreStore", "create": "createOneCoreStore", "delete": "deleteOneCoreStore", "update": "updateOneCoreStore", "deleteMany": "deleteManyCoreStore", "updateMany": "updateManyCoreStore", "upsert": "upsertOneCoreStore" }, { "model": "Migration", "plural": "migrations", "findMany": "findManyMigration", "create": "createOneMigration", "deleteMany": "deleteManyMigration", "updateMany": "updateManyMigration" }, { "model": "Post", "plural": "posts", "findOne": "findOnePost", "findMany": "findManyPost", "create": "createOnePost", "delete": "deleteOnePost", "update": "updateOnePost", "deleteMany": "deleteManyPost", "updateMany": "updateManyPost", "upsert": "upsertOnePost" }, { "model": "StrapiAdministrator", "plural": "strapiAdministrators", "findOne": "findOneStrapiAdministrator", "findMany": "findManyStrapiAdministrator", "create": "createOneStrapiAdministrator", "delete": "deleteOneStrapiAdministrator", "update": "updateOneStrapiAdministrator", "deleteMany": "deleteManyStrapiAdministrator", "updateMany": "updateManyStrapiAdministrator", "upsert": "upsertOneStrapiAdministrator" }, { "model": "UploadFile", "plural": "uploadFiles", "findOne": "findOneUploadFile", "findMany": "findManyUploadFile", "create": "createOneUploadFile", "delete": "deleteOneUploadFile", "update": "updateOneUploadFile", "deleteMany": "deleteManyUploadFile", "updateMany": "updateManyUploadFile", "upsert": "upsertOneUploadFile" }, { "model": "UploadFileMorph", "plural": "uploadFileMorphs", "findOne": "findOneUploadFileMorph", "findMany": "findManyUploadFileMorph", "create": "createOneUploadFileMorph", "delete": "deleteOneUploadFileMorph", "update": "updateOneUploadFileMorph", "deleteMany": "deleteManyUploadFileMorph", "updateMany": "updateManyUploadFileMorph", "upsert": "upsertOneUploadFileMorph" }, { "model": "UsersPermissionsPermission", "plural": "usersPermissionsPermissions", "findOne": "findOneUsersPermissionsPermission", "findMany": "findManyUsersPermissionsPermission", "create": "createOneUsersPermissionsPermission", "delete": "deleteOneUsersPermissionsPermission", "update": "updateOneUsersPermissionsPermission", "deleteMany": "deleteManyUsersPermissionsPermission", "updateMany": "updateManyUsersPermissionsPermission", "upsert": "upsertOneUsersPermissionsPermission" }, { "model": "UsersPermissionsRole", "plural": "usersPermissionsRoles", "findOne": "findOneUsersPermissionsRole", "findMany": "findManyUsersPermissionsRole", "create": "createOneUsersPermissionsRole", "delete": "deleteOneUsersPermissionsRole", "update": "updateOneUsersPermissionsRole", "deleteMany": "deleteManyUsersPermissionsRole", "updateMany": "updateManyUsersPermissionsRole", "upsert": "upsertOneUsersPermissionsRole" }, { "model": "UsersPermissionsUser", "plural": "usersPermissionsUsers", "findOne": "findOneUsersPermissionsUser", "findMany": "findManyUsersPermissionsUser", "create": "createOneUsersPermissionsUser", "delete": "deleteOneUsersPermissionsUser", "update": "updateOneUsersPermissionsUser", "deleteMany": "deleteManyUsersPermissionsUser", "updateMany": "updateManyUsersPermissionsUser", "upsert": "upsertOneUsersPermissionsUser" }], "schema": { "enums": [{ "name": "OrderByArg", "values": ["asc", "desc"] }], "outputTypes": [{ "name": "CoreStore", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "environment", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "key", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "tag", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "type", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "value", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }] }, { "name": "Migration", "fields": [{ "name": "revision", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "applied", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "databaseMigration", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "datamodel", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "datamodelSteps", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "errors", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "finishedAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "name", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "rolledBack", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "startedAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "status", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "Post", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "content", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "createdAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "reads", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "title", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "updatedAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }] }, { "name": "StrapiAdministrator", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "blocked", "args": [], "outputType": { "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "email", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "password", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "resetPasswordToken", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "username", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "UploadFile", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "createdAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "ext", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "hash", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "mime", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "name", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "provider", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "publicId", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "sha256", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "size", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "updatedAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "url", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "UploadFileMorph", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "field", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "relatedId", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "relatedType", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "uploadFileId", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": false, "isList": false } }] }, { "name": "UsersPermissionsPermission", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "action", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "controller", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "enabled", "args": [], "outputType": { "type": "Boolean", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "policy", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "role", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "type", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "UsersPermissionsRole", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "description", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "name", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "type", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }] }, { "name": "UsersPermissionsUser", "fields": [{ "name": "id", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "blocked", "args": [], "outputType": { "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "confirmed", "args": [], "outputType": { "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "createdAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "email", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }, { "name": "password", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "provider", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "resetPasswordToken", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "role", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "updatedAt", "args": [], "outputType": { "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false } }, { "name": "username", "args": [], "outputType": { "type": "String", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "Query", "fields": [{ "name": "findManyCoreStore", "args": [{ "name": "where", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "CoreStoreOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneCoreStore", "args": [{ "name": "where", "inputType": [{ "type": "CoreStoreWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyMigration", "args": [{ "name": "where", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "MigrationOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "Migration", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findManyPost", "args": [{ "name": "where", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "PostOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOnePost", "args": [{ "name": "where", "inputType": [{ "type": "PostWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyStrapiAdministrator", "args": [{ "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "StrapiAdministratorOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneStrapiAdministrator", "args": [{ "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyUploadFile", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "UploadFileOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneUploadFile", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyUploadFileMorph", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "UploadFileMorphOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneUploadFileMorph", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileMorphWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyUsersPermissionsPermission", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "UsersPermissionsPermissionOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneUsersPermissionsPermission", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyUsersPermissionsRole", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "UsersPermissionsRoleOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneUsersPermissionsRole", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": false, "isList": false } }, { "name": "findManyUsersPermissionsUser", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": false }] }, { "name": "orderBy", "inputType": [{ "isList": false, "isRequired": false, "type": "UsersPermissionsUserOrderByInput", "kind": "object" }] }, { "name": "skip", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "after", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "before", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "first", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "last", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": false, "isList": true } }, { "name": "findOneUsersPermissionsUser", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": false, "isList": false } }] }, { "name": "BatchPayload", "fields": [{ "name": "count", "args": [], "outputType": { "type": "Int", "kind": "scalar", "isRequired": true, "isList": false } }] }, { "name": "Mutation", "fields": [{ "name": "createOneCoreStore", "args": [{ "name": "data", "inputType": [{ "type": "CoreStoreCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneCoreStore", "args": [{ "name": "where", "inputType": [{ "type": "CoreStoreWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneCoreStore", "args": [{ "name": "data", "inputType": [{ "type": "CoreStoreUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "CoreStoreWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneCoreStore", "args": [{ "name": "where", "inputType": [{ "type": "CoreStoreWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "CoreStoreCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "CoreStoreUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "CoreStore", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyCoreStore", "args": [{ "name": "data", "inputType": [{ "type": "CoreStoreUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyCoreStore", "args": [{ "name": "where", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneMigration", "args": [{ "name": "data", "inputType": [{ "type": "MigrationCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Migration", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyMigration", "args": [{ "name": "data", "inputType": [{ "type": "MigrationUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyMigration", "args": [{ "name": "where", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOnePost", "args": [{ "name": "data", "inputType": [{ "type": "PostCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOnePost", "args": [{ "name": "where", "inputType": [{ "type": "PostWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOnePost", "args": [{ "name": "data", "inputType": [{ "type": "PostUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "PostWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOnePost", "args": [{ "name": "where", "inputType": [{ "type": "PostWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "PostCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "PostUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "Post", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyPost", "args": [{ "name": "data", "inputType": [{ "type": "PostUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyPost", "args": [{ "name": "where", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneStrapiAdministrator", "args": [{ "name": "data", "inputType": [{ "type": "StrapiAdministratorCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneStrapiAdministrator", "args": [{ "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneStrapiAdministrator", "args": [{ "name": "data", "inputType": [{ "type": "StrapiAdministratorUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneStrapiAdministrator", "args": [{ "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "StrapiAdministratorCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "StrapiAdministratorUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "StrapiAdministrator", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyStrapiAdministrator", "args": [{ "name": "data", "inputType": [{ "type": "StrapiAdministratorUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyStrapiAdministrator", "args": [{ "name": "where", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneUploadFile", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneUploadFile", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneUploadFile", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UploadFileWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneUploadFile", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "UploadFileCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "UploadFileUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFile", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyUploadFile", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyUploadFile", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneUploadFileMorph", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileMorphCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneUploadFileMorph", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileMorphWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneUploadFileMorph", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileMorphUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UploadFileMorphWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneUploadFileMorph", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileMorphWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "UploadFileMorphCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "UploadFileMorphUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UploadFileMorph", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyUploadFileMorph", "args": [{ "name": "data", "inputType": [{ "type": "UploadFileMorphUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyUploadFileMorph", "args": [{ "name": "where", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneUsersPermissionsPermission", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsPermissionCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneUsersPermissionsPermission", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneUsersPermissionsPermission", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsPermissionUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneUsersPermissionsPermission", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "UsersPermissionsPermissionCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "UsersPermissionsPermissionUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsPermission", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyUsersPermissionsPermission", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsPermissionUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyUsersPermissionsPermission", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneUsersPermissionsRole", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsRoleCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneUsersPermissionsRole", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneUsersPermissionsRole", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsRoleUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneUsersPermissionsRole", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "UsersPermissionsRoleCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "UsersPermissionsRoleUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsRole", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyUsersPermissionsRole", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsRoleUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyUsersPermissionsRole", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "createOneUsersPermissionsUser", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsUserCreateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteOneUsersPermissionsUser", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": false, "isList": false } }, { "name": "updateOneUsersPermissionsUser", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsUserUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": false, "isList": false } }, { "name": "upsertOneUsersPermissionsUser", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereUniqueInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "create", "inputType": [{ "type": "UsersPermissionsUserCreateInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "update", "inputType": [{ "type": "UsersPermissionsUserUpdateInput", "kind": "object", "isRequired": true, "isList": false }] }], "outputType": { "type": "UsersPermissionsUser", "kind": "object", "isRequired": true, "isList": false } }, { "name": "updateManyUsersPermissionsUser", "args": [{ "name": "data", "inputType": [{ "type": "UsersPermissionsUserUpdateManyMutationInput", "kind": "object", "isRequired": true, "isList": false }] }, { "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }, { "name": "deleteManyUsersPermissionsUser", "args": [{ "name": "where", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": false }] }], "outputType": { "type": "BatchPayload", "kind": "object", "isRequired": true, "isList": false } }] }], "inputTypes": [{ "name": "CoreStoreWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "environment", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "key", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "tag", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "value", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "CoreStoreWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "CoreStoreWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "MigrationWhereInput", "fields": [{ "name": "revision", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "applied", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "databaseMigration", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "datamodel", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "datamodelSteps", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "errors", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "finishedAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "rolledBack", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "startedAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "DateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "status", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "MigrationWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "PostWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "content", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "reads", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "title", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "PostWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "PostWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "StrapiAdministratorWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "blocked", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "type": "NullableBooleanFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "email", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "password", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "resetPasswordToken", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "username", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "StrapiAdministratorWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "StrapiAdministratorWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "ext", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "hash", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "mime", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "provider", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "publicId", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "sha256", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "size", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "url", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "UploadFileWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "UploadFileWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileMorphWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "field", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "relatedId", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "NullableIntFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "relatedType", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "uploadFileId", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "NullableIntFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "UploadFileMorphWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "UploadFileMorphWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsPermissionWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "action", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "controller", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "enabled", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "type": "BooleanFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "policy", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "role", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "NullableIntFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "UsersPermissionsPermissionWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "UsersPermissionsPermissionWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsRoleWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "description", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "UsersPermissionsRoleWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "UsersPermissionsRoleWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsUserWhereInput", "fields": [{ "name": "id", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "IntFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "blocked", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "type": "NullableBooleanFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "confirmed", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "type": "NullableBooleanFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "email", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "password", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "provider", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "resetPasswordToken", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "NullableStringFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "role", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "type": "NullableIntFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "type": "NullableDateTimeFilter", "isList": false, "isRequired": false, "kind": "object" }, { "type": "null", "isList": false, "isRequired": false, "kind": "scalar" }], "isRelationFilter": false }, { "name": "username", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "type": "StringFilter", "isList": false, "isRequired": false, "kind": "object" }], "isRelationFilter": false }, { "name": "AND", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "OR", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }, { "name": "NOT", "inputType": [{ "type": "UsersPermissionsUserWhereInput", "kind": "object", "isRequired": false, "isList": true }], "isRelationFilter": true }], "isWhereType": true, "atLeastOne": true }, { "name": "UsersPermissionsUserWhereUniqueInput", "fields": [{ "name": "id", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "CoreStoreCreateInput", "fields": [{ "name": "environment", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "key", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "tag", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "value", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "CoreStoreUpdateInput", "fields": [{ "name": "environment", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "key", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "tag", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "value", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "CoreStoreUpdateManyMutationInput", "fields": [{ "name": "environment", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "key", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "tag", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "value", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "MigrationCreateInput", "fields": [{ "name": "revision", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "applied", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "databaseMigration", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "datamodel", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "datamodelSteps", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "errors", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "finishedAt", "inputType": [{ "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "rolledBack", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "startedAt", "inputType": [{ "type": "DateTime", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "status", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "MigrationUpdateManyMutationInput", "fields": [{ "name": "revision", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "applied", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "databaseMigration", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "datamodel", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "datamodelSteps", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "errors", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "finishedAt", "inputType": [{ "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "rolledBack", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "startedAt", "inputType": [{ "type": "DateTime", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "status", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "PostCreateInput", "fields": [{ "name": "content", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "reads", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "title", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "PostUpdateInput", "fields": [{ "name": "content", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "reads", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "title", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "PostUpdateManyMutationInput", "fields": [{ "name": "content", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "reads", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "title", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "StrapiAdministratorCreateInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "StrapiAdministratorUpdateInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "StrapiAdministratorUpdateManyMutationInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileCreateInput", "fields": [{ "name": "ext", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "hash", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "mime", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "publicId", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "sha256", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "size", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "url", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "UploadFileUpdateInput", "fields": [{ "name": "ext", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "hash", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "mime", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "publicId", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "sha256", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "size", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "url", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileUpdateManyMutationInput", "fields": [{ "name": "ext", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "hash", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "mime", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "publicId", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "sha256", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "size", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "url", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileMorphCreateInput", "fields": [{ "name": "field", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedType", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "uploadFileId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileMorphUpdateInput", "fields": [{ "name": "field", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedType", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "uploadFileId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UploadFileMorphUpdateManyMutationInput", "fields": [{ "name": "field", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "relatedType", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "uploadFileId", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsPermissionCreateInput", "fields": [{ "name": "action", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "controller", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "enabled", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "policy", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "UsersPermissionsPermissionUpdateInput", "fields": [{ "name": "action", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "controller", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "enabled", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "policy", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsPermissionUpdateManyMutationInput", "fields": [{ "name": "action", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "controller", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "enabled", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "policy", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsRoleCreateInput", "fields": [{ "name": "description", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsRoleUpdateInput", "fields": [{ "name": "description", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsRoleUpdateManyMutationInput", "fields": [{ "name": "description", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "name", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "type", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsUserCreateInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "confirmed", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": true, "isList": false }] }] }, { "name": "UsersPermissionsUserUpdateInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "confirmed", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "UsersPermissionsUserUpdateManyMutationInput", "fields": [{ "name": "blocked", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "confirmed", "inputType": [{ "type": "Boolean", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "email", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "password", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "provider", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "resetPasswordToken", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "role", "inputType": [{ "type": "Int", "kind": "scalar", "isRequired": false, "isList": false }] }, { "name": "username", "inputType": [{ "type": "String", "kind": "scalar", "isRequired": false, "isList": false }] }] }, { "name": "IntFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "IntFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }], "atLeastOne": true }, { "name": "NullableStringFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "NullableStringFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "contains", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "startsWith", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "endsWith", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }], "atLeastOne": true }, { "name": "StringFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "StringFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "contains", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "startsWith", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }, { "name": "endsWith", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "String" }] }], "atLeastOne": true }, { "name": "NullableDateTimeFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "NullableDateTimeFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }], "atLeastOne": true }, { "name": "DateTimeFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTimeFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "DateTime" }] }], "atLeastOne": true }, { "name": "NullableBooleanFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "NullableBooleanFilter" }] }], "atLeastOne": true }, { "name": "NullableIntFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "null" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "NullableIntFilter" }] }, { "name": "in", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "notIn", "inputType": [{ "isList": true, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "lt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "lte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "gt", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }, { "name": "gte", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Int" }] }], "atLeastOne": true }, { "name": "BooleanFilter", "fields": [{ "name": "equals", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }] }, { "name": "not", "inputType": [{ "isList": false, "isRequired": false, "kind": "scalar", "type": "Boolean" }, { "isList": false, "isRequired": false, "kind": "scalar", "type": "BooleanFilter" }] }], "atLeastOne": true }, { "name": "CoreStoreOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "environment", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "key", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "tag", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "value", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "MigrationOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "revision", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "applied", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "databaseMigration", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "datamodel", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "datamodelSteps", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "errors", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "finishedAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "rolledBack", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "startedAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "status", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "PostOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "content", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "reads", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "title", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "StrapiAdministratorOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "blocked", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "email", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "password", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "resetPasswordToken", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "username", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "UploadFileOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "ext", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "hash", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "mime", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "provider", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "publicId", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "sha256", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "size", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "url", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "UploadFileMorphOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "field", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "relatedId", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "relatedType", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "uploadFileId", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "UsersPermissionsPermissionOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "action", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "controller", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "enabled", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "policy", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "role", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "UsersPermissionsRoleOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "description", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "name", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "type", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }, { "name": "UsersPermissionsUserOrderByInput", "atLeastOne": true, "atMostOne": true, "isOrderType": true, "fields": [{ "name": "id", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "blocked", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "confirmed", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "createdAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "email", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "password", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "provider", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "resetPasswordToken", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "role", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "updatedAt", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }, { "name": "username", "inputType": [{ "type": "OrderByArg", "isList": false, "isRequired": false, "kind": "enum" }], "isRelationFilter": false }] }] } };

module.exports = Photon; // needed to support const Photon = require('...') in js
Object.defineProperty(module.exports, "__esModule", { value: true });
for (let key in exports) {
  if (exports.hasOwnProperty(key)) {
    module.exports[key] = exports[key];
  }
}