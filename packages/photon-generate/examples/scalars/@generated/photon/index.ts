import { DMMF, DMMFClass, deepGet, deepSet, makeDocument, Engine, debugLib } from '../../../../src/runtime'

const debug = debugLib('photon')

/**
 * Utility Types
 */

export type MergeTruthyValues<R extends object, S extends object> = {
  [key in keyof S | keyof R]: key extends false
    ? never
    : key extends keyof S
    ? S[key] extends false
      ? never
      : S[key]
    : key extends keyof R
    ? R[key]
    : never
}

export type CleanupNever<T> = { [key in keyof T]: T[key] extends never ? never : key }[keyof T]

/**
 * Subset
 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
 */
export type Subset<T, U> = { [key in keyof T]: key extends keyof U ? T[key] : never }

class PhotonFetcher {
  private url?: string
  constructor(private readonly engine: Engine, private readonly debug = false) {}
  async request<T>(query: string, path: string[] = [], rootField?: string): Promise<T> {
    debug(query)
    const result = await this.engine.request(query)
    debug(result)
    return this.unpack(result, path, rootField)
  }
  protected unpack(result: any, path: string[], rootField?: string) {
    const getPath: string[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter(p => p !== 'select'))
    return deepGet(result, getPath)
  }
}


/**
 * Client
**/


interface PhotonOptions {
  debugEngine?: boolean
  debug?: boolean
}

export class Photon {
  private fetcher: PhotonFetcher
  private readonly dmmf: DMMFClass
  private readonly engine: Engine
  constructor(options: PhotonOptions = {}) {
    const useDebug = options.debug || false
    if (useDebug) {
      debugLib.enable('photon')
    }
    const debugEngine = options.debugEngine || false
    this.engine = new Engine({
      prismaYmlPath: "/Users/tim/code/photon-js/packages/photon-generate/examples/scalars/prisma.yml",
      debug: debugEngine,
      datamodel: "\n  # type User {\n  #   id: Int! @id\n  #   name: String\n  # }\n\n  type House {\n    id: ID! @id\n    string: String\n    bool: Boolean\n    stringList: [String] @scalarList(strategy: RELATION)\n    int: Int\n    float: Float\n    intList: [Int] @scalarList(strategy: RELATION)\n    floatList: [Float] @scalarList(strategy: RELATION)\n    date: DateTime\n\n    stringReq: String!\n    boolReq: Boolean!\n    intReq: Int!\n    floatReq: Float!\n    dateReq: DateTime!\n  }\n",
      prismaConfig: "prototype: true\ndatabases:\n  default:\n    connector: sqlite-native\n    databaseFile: ./db/Chinook.db\n    migrations: true\n    active: true\n    rawAccess: true\n",
      datamodelJson: "eyJtb2RlbHMiOltdLCJyZWxhdGlvbnMiOltdLCJlbnVtcyI6W10sInZlcnNpb24iOiJ2MiJ9"
    })
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PhotonFetcher(this.engine)
  }
  async connect() {
    // TODO: Provide autoConnect: false option so that this is even needed
    await this.engine.startPromise
  }
  async close() {
    this.engine.stop()
  }
  private _query?: QueryDelegate
  get query(): QueryDelegate {
    return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
  private _houses?: HouseDelegate
  get houses(): HouseDelegate {
    this.connect()
    return this._houses? this._houses : (this._houses = HouseDelegate(this.dmmf, this.fetcher))
  }
}


/**
 * Query
 */

export type QueryArgs = {
  house?: FindOneHouseArgs
  houses?: FindManyHouseArgs
}

type QueryGetPayload<S extends QueryArgs> = S extends QueryArgs
  ? {
      [P in keyof S] 
        : P extends 'house'
        ? HouseGetPayload<ExtractFindOneHouseArgsSelect<S[P]>>
        : P extends 'houses'
        ? Array<HouseGetPayload<ExtractFindManyHouseArgsSelect<S[P]>>>
        : never
    } : never
  

interface QueryDelegate {
  <T extends QueryArgs>(args: Subset<T,QueryArgs>): PromiseLike<QueryGetPayload<T>>
}
function QueryDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): QueryDelegate {
  const Query = <T extends QueryArgs>(args: QueryArgs) => new QueryClient<T>(dmmf, fetcher, args, [])
  return Query
}

class QueryClient<T extends QueryArgs, U = QueryGetPayload<T>> implements PromiseLike<U> {
  constructor(private readonly dmmf: DMMFClass, private readonly fetcher: PhotonFetcher, private readonly args: QueryArgs, private readonly path: []) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      // @ts-ignore
      select: this.args[rootField]
    })
    // @ts-ignore
    document.validate(this.args[rootField], true)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = U, TResult2 = never>(
    onfulfilled?: ((value: U) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<U>(this.query, this.path).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<U | TResult> {
    return this.fetcher.request<U>(this.query, this.path).catch(onrejected)
  }
}
    


/**
 * Enums
 */

export enum HouseOrderByInput {
  id_ASC = 'id_ASC',
  id_DESC = 'id_DESC',
  string_ASC = 'string_ASC',
  string_DESC = 'string_DESC',
  bool_ASC = 'bool_ASC',
  bool_DESC = 'bool_DESC',
  int_ASC = 'int_ASC',
  int_DESC = 'int_DESC',
  float_ASC = 'float_ASC',
  float_DESC = 'float_DESC',
  date_ASC = 'date_ASC',
  date_DESC = 'date_DESC',
  stringReq_ASC = 'stringReq_ASC',
  stringReq_DESC = 'stringReq_DESC',
  boolReq_ASC = 'boolReq_ASC',
  boolReq_DESC = 'boolReq_DESC',
  intReq_ASC = 'intReq_ASC',
  intReq_DESC = 'intReq_DESC',
  floatReq_ASC = 'floatReq_ASC',
  floatReq_DESC = 'floatReq_DESC',
  dateReq_ASC = 'dateReq_ASC',
  dateReq_DESC = 'dateReq_DESC'
}

export enum MutationType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED'
}


/**
 * Model House
 */

export type House = {
  id: string
  string: string | null
  bool: boolean | null
  stringList: string[]
  int: number | null
  float: number | null
  intList: number[]
  floatList: number[]
  date: string | null
  stringReq: string
  boolReq: boolean
  intReq: number
  floatReq: number
  dateReq: string
}

export type HouseScalars = 'id' | 'string' | 'bool' | 'stringList' | 'int' | 'float' | 'intList' | 'floatList' | 'date' | 'stringReq' | 'boolReq' | 'intReq' | 'floatReq' | 'dateReq'
  

export type HouseSelect = {
  id?: boolean
  string?: boolean
  bool?: boolean
  stringList?: boolean
  int?: boolean
  float?: boolean
  intList?: boolean
  floatList?: boolean
  date?: boolean
  stringReq?: boolean
  boolReq?: boolean
  intReq?: boolean
  floatReq?: boolean
  dateReq?: boolean
}

type HouseDefault = {
  id: true
  string: true
  bool: true
  stringList: true
  int: true
  float: true
  intList: true
  floatList: true
  date: true
  stringReq: true
  boolReq: true
  intReq: true
  floatReq: true
  dateReq: true
}


type HouseGetPayload<S extends boolean | HouseSelect> = S extends true
  ? House
  : S extends HouseSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<HouseDefault, S>>]: P extends HouseScalars
        ? House[P]
        : never
    }
   : never

export interface HouseDelegate {
  <T extends FindManyHouseArgs>(args: Subset<T, FindManyHouseArgs>): PromiseLike<Array<HouseGetPayload<ExtractFindManyHouseArgsSelect<T>>>>
  findOne<T extends FindOneHouseArgs>(
    args: Subset<T, FindOneHouseArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractFindOneHouseArgsSelect<T>>> : HouseClient<House>
  findMany<T extends FindManyHouseArgs>(
    args: Subset<T, FindManyHouseArgs>
  ): PromiseLike<Array<HouseGetPayload<ExtractFindManyHouseArgsSelect<T>>>>
  create<T extends HouseCreateArgs>(
    args: Subset<T, HouseCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseCreateArgsSelect<T>>> : HouseClient<House>
  update<T extends HouseUpdateArgs>(
    args: Subset<T, HouseUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseUpdateArgsSelect<T>>> : HouseClient<House>
  updateMany<T extends HouseUpdateManyArgs>(
    args: Subset<T, HouseUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseUpdateManyArgsSelect<T>>> : HouseClient<House>
  upsert<T extends HouseUpsertArgs>(
    args: Subset<T, HouseUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseUpsertArgsSelect<T>>> : HouseClient<House>
  delete<T extends HouseDeleteArgs>(
    args: Subset<T, HouseDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseDeleteArgsSelect<T>>> : HouseClient<House>
  deleteMany<T extends HouseDeleteManyArgs>(
    args: Subset<T, HouseDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseDeleteManyArgsSelect<T>>> : HouseClient<House>
}
function HouseDelegate(dmmf: DMMFClass, fetcher: PhotonFetcher): HouseDelegate {
  const House = <T extends FindManyHouseArgs>(args: Subset<T, FindManyHouseArgs>) => new HouseClient<PromiseLike<Array<HouseGetPayload<ExtractFindManyHouseArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'houses', 'houses', args, [])
  House.findOne = <T extends FindOneHouseArgs>(args: Subset<T, FindOneHouseArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'query',
    'house',
    'houses.findOne',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'query',
    'house',
    'houses.findOne',
    args,
    []
  )
  House.findMany = <T extends FindManyHouseArgs>(args: Subset<T, FindManyHouseArgs>) => new HouseClient<PromiseLike<Array<HouseGetPayload<ExtractFindManyHouseArgsSelect<T>>>>>(
    dmmf,
    fetcher,
    'query',
    'houses',
    'houses.findMany',
    args,
    []
  )
  House.create = <T extends HouseCreateArgs>(args: Subset<T, HouseCreateArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'createHouse',
    'houses.create',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'createHouse',
    'houses.create',
    args,
    []
  )
  House.update = <T extends HouseUpdateArgs>(args: Subset<T, HouseUpdateArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'updateHouse',
    'houses.update',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'updateHouse',
    'houses.update',
    args,
    []
  )
  House.updateMany = <T extends HouseUpdateManyArgs>(args: Subset<T, HouseUpdateManyArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyHouses',
    'houses.updateMany',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyHouses',
    'houses.updateMany',
    args,
    []
  )
  House.upsert = <T extends HouseUpsertArgs>(args: Subset<T, HouseUpsertArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertHouse',
    'houses.upsert',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'upsertHouse',
    'houses.upsert',
    args,
    []
  )
  House.delete = <T extends HouseDeleteArgs>(args: Subset<T, HouseDeleteArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteHouse',
    'houses.delete',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'deleteHouse',
    'houses.delete',
    args,
    []
  )
  House.deleteMany = <T extends HouseDeleteManyArgs>(args: Subset<T, HouseDeleteManyArgs>) => args.select ? new HouseClient<'select' extends keyof T ? PromiseLike<HouseGetPayload<ExtractHouseArgsSelect<T>>> : HouseClient<House>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyHouses',
    'houses.deleteMany',
    args,
    []
  ) : new HouseClient<House>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyHouses',
    'houses.deleteMany',
    args,
    []
  )
  return House as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class HouseClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PhotonFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: HouseArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PhotonPromise'



  protected get query() {
    const { rootField } = this
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: this.queryType,
      select: this.args
    })
    document.validate(this.args, false, this.clientMethod)
    return String(document)
  }

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of which ever callback is executed.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField).then(onfulfilled, onrejected)
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @returns A Promise for the completion of the callback.
   */
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): Promise<T | TResult> {
    return this.fetcher.request<T>(this.query, this.path, this.rootField).catch(onrejected)
  }
}
    

// InputTypes

export type FindOneHouseArgs = {
  select?: HouseSelect
  where: HouseWhereUniqueInput
}

export type FindOneHouseArgsWithSelect = {
  select: HouseSelect
  where: HouseWhereUniqueInput
}

type ExtractFindOneHouseArgsSelect<S extends undefined | boolean | FindOneHouseArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindOneHouseArgsWithSelect
  ? S['select']
  : true


export type FindManyHouseArgs = {
  select?: HouseSelect
  where?: HouseWhereInput
  orderBy?: HouseOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyHouseArgsWithSelect = {
  select: HouseSelect
  where?: HouseWhereInput
  orderBy?: HouseOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyHouseArgsSelect<S extends undefined | boolean | FindManyHouseArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends FindManyHouseArgsWithSelect
  ? S['select']
  : true


export type HouseCreateArgs = {
  select?: HouseSelect
  data: HouseCreateInput
}

export type HouseCreateArgsWithSelect = {
  select: HouseSelect
  data: HouseCreateInput
}

type ExtractHouseCreateArgsSelect<S extends undefined | boolean | HouseCreateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseCreateArgsWithSelect
  ? S['select']
  : true


export type HouseUpdateArgs = {
  select?: HouseSelect
  data: HouseUpdateInput
  where: HouseWhereUniqueInput
}

export type HouseUpdateArgsWithSelect = {
  select: HouseSelect
  data: HouseUpdateInput
  where: HouseWhereUniqueInput
}

type ExtractHouseUpdateArgsSelect<S extends undefined | boolean | HouseUpdateArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseUpdateArgsWithSelect
  ? S['select']
  : true


export type HouseUpdateManyArgs = {
  select?: HouseSelect
  data: HouseUpdateManyMutationInput
  where?: HouseWhereInput
}

export type HouseUpdateManyArgsWithSelect = {
  select: HouseSelect
  data: HouseUpdateManyMutationInput
  where?: HouseWhereInput
}

type ExtractHouseUpdateManyArgsSelect<S extends undefined | boolean | HouseUpdateManyArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseUpdateManyArgsWithSelect
  ? S['select']
  : true


export type HouseUpsertArgs = {
  select?: HouseSelect
  where: HouseWhereUniqueInput
  create: HouseCreateInput
  update: HouseUpdateInput
}

export type HouseUpsertArgsWithSelect = {
  select: HouseSelect
  where: HouseWhereUniqueInput
  create: HouseCreateInput
  update: HouseUpdateInput
}

type ExtractHouseUpsertArgsSelect<S extends undefined | boolean | HouseUpsertArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseUpsertArgsWithSelect
  ? S['select']
  : true


export type HouseDeleteArgs = {
  select?: HouseSelect
  where: HouseWhereUniqueInput
}

export type HouseDeleteArgsWithSelect = {
  select: HouseSelect
  where: HouseWhereUniqueInput
}

type ExtractHouseDeleteArgsSelect<S extends undefined | boolean | HouseDeleteArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseDeleteArgsWithSelect
  ? S['select']
  : true


export type HouseDeleteManyArgs = {
  select?: HouseSelect
  where?: HouseWhereInput
}

export type HouseDeleteManyArgsWithSelect = {
  select: HouseSelect
  where?: HouseWhereInput
}

type ExtractHouseDeleteManyArgsSelect<S extends undefined | boolean | HouseDeleteManyArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseDeleteManyArgsWithSelect
  ? S['select']
  : true


export type HouseArgs = {
  select?: HouseSelect
}

export type HouseArgsWithSelect = {
  select: HouseSelect
}

type ExtractHouseArgsSelect<S extends undefined | boolean | HouseArgs> = S extends undefined
  ? false
  : S extends boolean
  ? S
  : S extends HouseArgsWithSelect
  ? S['select']
  : true



/**
 * Deep Input Types
 */


export type HouseWhereUniqueInput = {
  id?: string
}


export type HouseWhereInput = {
  id?: string
  id_not?: string
  id_in?: string[]
  id_not_in?: string[]
  id_lt?: string
  id_lte?: string
  id_gt?: string
  id_gte?: string
  id_contains?: string
  id_not_contains?: string
  id_starts_with?: string
  id_not_starts_with?: string
  id_ends_with?: string
  id_not_ends_with?: string
  string?: string
  string_not?: string
  string_in?: string[]
  string_not_in?: string[]
  string_lt?: string
  string_lte?: string
  string_gt?: string
  string_gte?: string
  string_contains?: string
  string_not_contains?: string
  string_starts_with?: string
  string_not_starts_with?: string
  string_ends_with?: string
  string_not_ends_with?: string
  bool?: boolean
  bool_not?: boolean
  int?: number
  int_not?: number
  int_in?: number[]
  int_not_in?: number[]
  int_lt?: number
  int_lte?: number
  int_gt?: number
  int_gte?: number
  float?: number
  float_not?: number
  float_in?: number[]
  float_not_in?: number[]
  float_lt?: number
  float_lte?: number
  float_gt?: number
  float_gte?: number
  date?: string
  date_not?: string
  date_in?: string[]
  date_not_in?: string[]
  date_lt?: string
  date_lte?: string
  date_gt?: string
  date_gte?: string
  stringReq?: string
  stringReq_not?: string
  stringReq_in?: string[]
  stringReq_not_in?: string[]
  stringReq_lt?: string
  stringReq_lte?: string
  stringReq_gt?: string
  stringReq_gte?: string
  stringReq_contains?: string
  stringReq_not_contains?: string
  stringReq_starts_with?: string
  stringReq_not_starts_with?: string
  stringReq_ends_with?: string
  stringReq_not_ends_with?: string
  boolReq?: boolean
  boolReq_not?: boolean
  intReq?: number
  intReq_not?: number
  intReq_in?: number[]
  intReq_not_in?: number[]
  intReq_lt?: number
  intReq_lte?: number
  intReq_gt?: number
  intReq_gte?: number
  floatReq?: number
  floatReq_not?: number
  floatReq_in?: number[]
  floatReq_not_in?: number[]
  floatReq_lt?: number
  floatReq_lte?: number
  floatReq_gt?: number
  floatReq_gte?: number
  dateReq?: string
  dateReq_not?: string
  dateReq_in?: string[]
  dateReq_not_in?: string[]
  dateReq_lt?: string
  dateReq_lte?: string
  dateReq_gt?: string
  dateReq_gte?: string
  AND?: HouseWhereInput[]
  OR?: HouseWhereInput[]
  NOT?: HouseWhereInput[]
}


export type HouseCreateInput = {
  id?: string
  string?: string
  bool?: boolean
  stringList?: HouseCreatestringListInput
  int?: number
  float?: number
  intList?: HouseCreateintListInput
  floatList?: HouseCreatefloatListInput
  date?: string
  stringReq: string
  boolReq: boolean
  intReq: number
  floatReq: number
  dateReq: string
}


export type HouseCreatestringListInput = {
  set?: string[]
}


export type HouseCreateintListInput = {
  set?: number[]
}


export type HouseCreatefloatListInput = {
  set?: number[]
}


export type HouseUpdateInput = {
  string?: string
  bool?: boolean
  stringList?: HouseUpdatestringListInput
  int?: number
  float?: number
  intList?: HouseUpdateintListInput
  floatList?: HouseUpdatefloatListInput
  date?: string
  stringReq?: string
  boolReq?: boolean
  intReq?: number
  floatReq?: number
  dateReq?: string
}


export type HouseUpdatestringListInput = {
  set?: string[]
}


export type HouseUpdateintListInput = {
  set?: number[]
}


export type HouseUpdatefloatListInput = {
  set?: number[]
}


export type HouseUpdateManyMutationInput = {
  string?: string
  bool?: boolean
  stringList?: HouseUpdatestringListInput
  int?: number
  float?: number
  intList?: HouseUpdateintListInput
  floatList?: HouseUpdatefloatListInput
  date?: string
  stringReq?: string
  boolReq?: boolean
  intReq?: number
  floatReq?: number
  dateReq?: string
}


export type HouseSubscriptionWhereInput = {
  mutation_in?: MutationType[]
  updatedFields_contains?: string
  updatedFields_contains_every?: string[]
  updatedFields_contains_some?: string[]
  node?: HouseWhereInput
  AND?: HouseSubscriptionWhereInput[]
  OR?: HouseSubscriptionWhereInput[]
  NOT?: HouseSubscriptionWhereInput[]
}


/**
 * DMMF
 */

const dmmf: DMMF.Document = {
  "datamodel": {
    "models": [
      {
        "name": "House",
        "isEmbedded": false,
        "dbName": "",
        "fields": [
          {
            "kind": "scalar",
            "name": "id",
            "isUnique": true,
            "isId": true,
            "type": "ID",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "string",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "bool",
            "isUnique": false,
            "isId": false,
            "type": "Boolean",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "stringList",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": true,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "int",
            "isUnique": false,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "float",
            "isUnique": false,
            "isId": false,
            "type": "Float",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "intList",
            "isUnique": false,
            "isId": false,
            "type": "Int",
            "isList": true,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "floatList",
            "isUnique": false,
            "isId": false,
            "type": "Float",
            "isList": true,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "date",
            "isUnique": false,
            "isId": false,
            "type": "DateTime",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "stringReq",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "boolReq",
            "isUnique": false,
            "isId": false,
            "type": "Boolean",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "intReq",
            "isUnique": false,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "floatReq",
            "isUnique": false,
            "isId": false,
            "type": "Float",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "dateReq",
            "isUnique": false,
            "isId": false,
            "type": "DateTime",
            "isList": false,
            "isRequired": true
          }
        ]
      }
    ],
    "enums": []
  },
  "schema": {
    "queries": [
      {
        "name": "house",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "houses",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "orderBy",
            "type": "HouseOrderByInput",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": true
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "housesConnection",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "orderBy",
            "type": "HouseOrderByInput",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": true
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "HouseConnection",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "node",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isRequired": true,
            "isScalar": true,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "Node",
          "isList": false,
          "isRequired": false
        }
      }
    ],
    "mutations": [
      {
        "name": "createHouse",
        "args": [
          {
            "name": "data",
            "type": "HouseCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateHouse",
        "args": [
          {
            "name": "data",
            "type": "HouseUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "where",
            "type": "HouseWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyHouses",
        "args": [
          {
            "name": "data",
            "type": "HouseUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "where",
            "type": "HouseWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertHouse",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "create",
            "type": "HouseCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          },
          {
            "name": "update",
            "type": "HouseUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteHouse",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "House",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyHouses",
        "args": [
          {
            "name": "where",
            "type": "HouseWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false,
            "isEnum": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      }
    ],
    "inputTypes": [
      {
        "name": "HouseWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "bool_not",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "int_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_not",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_not_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_lt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_lte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_gt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float_gte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_not",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_not_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_lt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_lte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_gt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "date_gte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "boolReq_not",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_not",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_not_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_lt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_lte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_gt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq_gte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_not",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_not_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_lt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_lte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_gt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq_gte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "AND",
            "type": "HouseWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "HouseWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "HouseWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "HouseCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringList",
            "type": "HouseCreatestringListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intList",
            "type": "HouseCreateintListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "floatList",
            "type": "HouseCreatefloatListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": true,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseCreatestringListInput",
        "args": [
          {
            "name": "set",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseCreateintListInput",
        "args": [
          {
            "name": "set",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseCreatefloatListInput",
        "args": [
          {
            "name": "set",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseUpdateInput",
        "args": [
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringList",
            "type": "HouseUpdatestringListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intList",
            "type": "HouseUpdateintListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "floatList",
            "type": "HouseUpdatefloatListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseUpdatestringListInput",
        "args": [
          {
            "name": "set",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseUpdateintListInput",
        "args": [
          {
            "name": "set",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseUpdatefloatListInput",
        "args": [
          {
            "name": "set",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseUpdateManyMutationInput",
        "args": [
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringList",
            "type": "HouseUpdatestringListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intList",
            "type": "HouseUpdateintListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "floatList",
            "type": "HouseUpdatefloatListInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "HouseSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isEnum": true,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "HouseWhereInput",
            "isList": false,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "HouseSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "HouseSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "HouseSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isEnum": false,
            "isScalar": false
          }
        ]
      }
    ],
    "outputTypes": [
      {
        "name": "Query",
        "fields": [
          {
            "name": "house",
            "type": "House",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "houses",
            "type": "House",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "orderBy",
                "type": "HouseOrderByInput",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": true
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "housesConnection",
            "type": "HouseConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "orderBy",
                "type": "HouseOrderByInput",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": true
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "Node",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "id",
                "type": "ID",
                "isRequired": true,
                "isScalar": true,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "House",
        "fields": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "stringList",
            "type": "String",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "intList",
            "type": "Int",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "floatList",
            "type": "Float",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "HouseConnection",
        "fields": [
          {
            "name": "pageInfo",
            "type": "PageInfo",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "edges",
            "type": "HouseEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateHouse",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "PageInfo",
        "fields": [
          {
            "name": "hasNextPage",
            "type": "Boolean",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "hasPreviousPage",
            "type": "Boolean",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "startCursor",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "endCursor",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "HouseEdge",
        "fields": [
          {
            "name": "node",
            "type": "House",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "cursor",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "AggregateHouse",
        "fields": [
          {
            "name": "count",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "Mutation",
        "fields": [
          {
            "name": "createHouse",
            "type": "House",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "HouseCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateHouse",
            "type": "House",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "HouseUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "where",
                "type": "HouseWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyHouses",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "HouseUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "where",
                "type": "HouseWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertHouse",
            "type": "House",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "create",
                "type": "HouseCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              },
              {
                "name": "update",
                "type": "HouseUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteHouse",
            "type": "House",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyHouses",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "HouseWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "BatchPayload",
        "fields": [
          {
            "name": "count",
            "type": "Long",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "Subscription",
        "fields": [
          {
            "name": "house",
            "type": "HouseSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "HouseSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false,
                "isEnum": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "HouseSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "enum"
          },
          {
            "name": "node",
            "type": "House",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "updatedFields",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "previousValues",
            "type": "HousePreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "HousePreviousValues",
        "fields": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "string",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "bool",
            "type": "Boolean",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "stringList",
            "type": "String",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "int",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "float",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "intList",
            "type": "Int",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "floatList",
            "type": "Float",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "date",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "stringReq",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "boolReq",
            "type": "Boolean",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "intReq",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "floatReq",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "dateReq",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      }
    ],
    "enums": [
      {
        "name": "HouseOrderByInput",
        "values": [
          "id_ASC",
          "id_DESC",
          "string_ASC",
          "string_DESC",
          "bool_ASC",
          "bool_DESC",
          "int_ASC",
          "int_DESC",
          "float_ASC",
          "float_DESC",
          "date_ASC",
          "date_DESC",
          "stringReq_ASC",
          "stringReq_DESC",
          "boolReq_ASC",
          "boolReq_DESC",
          "intReq_ASC",
          "intReq_DESC",
          "floatReq_ASC",
          "floatReq_DESC",
          "dateReq_ASC",
          "dateReq_DESC"
        ]
      },
      {
        "name": "MutationType",
        "values": [
          "CREATED",
          "UPDATED",
          "DELETED"
        ]
      }
    ]
  },
  "mappings": [
    {
      "model": "House",
      "findOne": "house",
      "findMany": "houses",
      "create": "createHouse",
      "update": "updateHouse",
      "updateMany": "updateManyHouses",
      "upsert": "upsertHouse",
      "delete": "deleteHouse",
      "deleteMany": "deleteManyHouses"
    }
  ]
}
    