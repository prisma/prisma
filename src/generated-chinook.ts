import { DMMF, DMMFClass, fetch, deepGet, deepSet, makeDocument } from './runtime'

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

class PrismaFetcher {
  constructor(private readonly url: string) {}
  request<T>(query: string, path: string[] = [], rootField?: string): Promise<T> {
    console.log(query)
    console.log(path)
    // return Promise.resolve({data: {som: 'thing'}} as any)
    return Promise.resolve(this.unpack({
      data: {
        createPost: {
          id: '1',
          title: 'Title',
          content: 'Content',
          author: {
            id: '2',
            name: 'A name',
            strings: null,
            posts: [
              {
                id: '1',
                title: 'Title',
                content: 'Content',
              }
            ]
          }
        }
      }},
      path,
      rootField
    ) as any)
    // return fetch(this.url, {
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ query }),
    //   // TODO: More error handling
    // }).then(res => res.json()).then(res => path.length > 0 ? deepGet(res.data, path) : res.data)
  }
  protected unpack(result: any, path: string[], rootField?: string) {
    const getPath: string[] = ['data']
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


// could be a class if we want to require new Prisma(...)
// export default function Prisma() {
//   return new PrismaClient(null as any)
// } 

export class Prisma {
  private fetcher?: PrismaFetcher
  private readonly dmmf: DMMFClass
  constructor() {
    this.dmmf = new DMMFClass(dmmf)
    this.fetcher = new PrismaFetcher('http://localhost:8000')
  }
  async connect() {
    // TODO: Spawn Rust
  }
  async close() {
    // TODO: Kill Rust
  }
  private _query?: QueryDelegate
  get query(): QueryDelegate {
    return this._query ? this._query: (this._query = QueryDelegate(this.dmmf, this.fetcher))
  }
  private _artists?: ArtistDelegate
  get artists(): ArtistDelegate {
    return this._artists? this._artists : (this._artists = ArtistDelegate(this.dmmf, this.fetcher))
  }
  private _albums?: AlbumDelegate
  get albums(): AlbumDelegate {
    return this._albums? this._albums : (this._albums = AlbumDelegate(this.dmmf, this.fetcher))
  }
  private _tracks?: TrackDelegate
  get tracks(): TrackDelegate {
    return this._tracks? this._tracks : (this._tracks = TrackDelegate(this.dmmf, this.fetcher))
  }
  private _genres?: GenreDelegate
  get genres(): GenreDelegate {
    return this._genres? this._genres : (this._genres = GenreDelegate(this.dmmf, this.fetcher))
  }
  private _mediaTypes?: MediaTypeDelegate
  get mediaTypes(): MediaTypeDelegate {
    return this._mediaTypes? this._mediaTypes : (this._mediaTypes = MediaTypeDelegate(this.dmmf, this.fetcher))
  }
}

/**
 * Query
 */

export type QueryArgs = {
  artist?: FindOneArtistArgs
  artists?: FindManyArtistArgs
  album?: FindOneAlbumArgs
  albums?: FindManyAlbumArgs
  track?: FindOneTrackArgs
  tracks?: FindManyTrackArgs
  genre?: FindOneGenreArgs
  genres?: FindManyGenreArgs
  mediaType?: FindOneMediaTypeArgs
  mediaTypes?: FindManyMediaTypeArgs
}

type QueryGetPayload<S extends QueryArgs> = S extends QueryArgs
  ? {
      [P in keyof S] 
        : P extends 'album'
        ? AlbumGetPayload<ExtractFindOneAlbumArgsSelect<S[P]>>
        : P extends 'albums'
        ? Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<S[P]>>>
        : P extends 'artist'
        ? ArtistGetPayload<ExtractFindOneArtistArgsSelect<S[P]>>
        : P extends 'artists'
        ? Array<ArtistGetPayload<ExtractFindManyArtistArgsSelect<S[P]>>>
        : P extends 'genre'
        ? GenreGetPayload<ExtractFindOneGenreArgsSelect<S[P]>>
        : P extends 'genres'
        ? Array<GenreGetPayload<ExtractFindManyGenreArgsSelect<S[P]>>>
        : P extends 'mediaType'
        ? MediaTypeGetPayload<ExtractFindOneMediaTypeArgsSelect<S[P]>>
        : P extends 'mediaTypes'
        ? Array<MediaTypeGetPayload<ExtractFindManyMediaTypeArgsSelect<S[P]>>>
        : P extends 'track'
        ? TrackGetPayload<ExtractFindOneTrackArgsSelect<S[P]>>
        : P extends 'tracks'
        ? Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<S[P]>>>
        : never
    } : never
  

interface QueryDelegate {
  <T extends QueryArgs>(args: Subset<T,QueryArgs>): PromiseLike<QueryGetPayload<T>>
}
function QueryDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): QueryDelegate {
  const Query = <T extends QueryArgs>(args: QueryArgs) => new QueryClient<T>(dmmf, fetcher, args, [])
  return Query
}

class QueryClient<T extends QueryArgs, U = QueryGetPayload<T>> implements PromiseLike<U> {
  constructor(private readonly dmmf: DMMFClass,private readonly fetcher: PrismaFetcher, private readonly args: QueryArgs, private readonly path: []) {}
  readonly [Symbol.toStringTag]: 'Promise'

  protected get query() {
    const rootField = Object.keys(this.args)[0]
    const document = makeDocument({
      dmmf: this.dmmf,
      rootField,
      rootTypeName: 'query',
      select: this.args[rootField]
    })
    // console.dir(document, {depth: 8})
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
 * Model Artist
 */

export type Artist = {
  id: string
  ArtistId: number
  Name: string
  someDate: string
  someOptionalDate?: string
}

export type ArtistScalars = 'id' | 'ArtistId' | 'Name' | 'someDate' | 'someOptionalDate'
  

export type ArtistSelect= {
  id?: boolean
  ArtistId?: boolean
  Name?: boolean
  Albums?: boolean | FindManyAlbumArgs
  someDate?: boolean
  someOptionalDate?: boolean
}

type ArtistDefault = {
  id: true
  ArtistId: true
  Name: true
  someDate: true
  someOptionalDate: true
}


type ArtistGetPayload<S extends boolean | ArtistSelect> = S extends true
  ? Artist
  : S extends ArtistSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<ArtistDefault, S>>]: P extends ArtistScalars
        ? Artist[P]
        : P extends 'Albums'
        ? Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<S[P]>>>
        : never
    }
   : never

export interface ArtistDelegate {
  <T extends ArtistArgs>(args: Subset<T,ArtistArgs>): PromiseLike<Array<ArtistGetPayload<ExtractFindManyArtistArgsSelect<T>>>>
  findOne<T extends FindOneArtistArgs>(
    args: Subset<T, FindOneArtistArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractFindOneArtistArgsSelect<T>>> : ArtistClient<Artist>
  findMany<T extends FindManyArtistArgs>(
    args: Subset<T, FindManyArtistArgs>
  ): PromiseLike<Array<ArtistGetPayload<ExtractFindManyArtistArgsSelect<T>>>>
  create<T extends ArtistCreateArgs>(
    args: Subset<T, ArtistCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistCreateArgsSelect<T>>> : ArtistClient<Artist>
  update<T extends ArtistUpdateArgs>(
    args: Subset<T, ArtistUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistUpdateArgsSelect<T>>> : ArtistClient<Artist>
  updateMany<T extends ArtistUpdateManyArgs>(
    args: Subset<T, ArtistUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistUpdateManyArgsSelect<T>>> : ArtistClient<Artist>
  upsert<T extends ArtistUpsertArgs>(
    args: Subset<T, ArtistUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistUpsertArgsSelect<T>>> : ArtistClient<Artist>
  delete<T extends ArtistDeleteArgs>(
    args: Subset<T, ArtistDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistDeleteArgsSelect<T>>> : ArtistClient<Artist>
  deleteMany<T extends ArtistDeleteManyArgs>(
    args: Subset<T, ArtistDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistDeleteManyArgsSelect<T>>> : ArtistClient<Artist>
}
function ArtistDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): ArtistDelegate {
  const Artist = <T extends ArtistArgs>(args: Subset<T, ArtistArgs>) => new ArtistClient<PromiseLike<Array<ArtistGetPayload<ExtractFindManyArtistArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'artists', 'artists', args, [])
  Artist.findOne = <T extends FindOneArtistArgs>(args: Subset<T, FindOneArtistArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractFindOneArtistArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'artist',
    'artists.findOne',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'query',
    'artist',
    'artists.findOne',
    args,
    []
  )
  Artist.findMany = <T extends FindManyArtistArgs>(args: Subset<T, FindManyArtistArgs>) => new ArtistClient<Array<ArtistGetPayload<ExtractFindManyArtistArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'artists',
    'artists.findMany',
    args,
    []
  )
  Artist.create = <T extends ArtistCreateArgs>(args: Subset<T, ArtistCreateArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistCreateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'createArtist',
    'artists.create',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'createArtist',
    'artists.create',
    args,
    []
  )
  Artist.update = <T extends ArtistUpdateArgs>(args: Subset<T, ArtistUpdateArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistUpdateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateArtist',
    'artists.update',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'updateArtist',
    'artists.update',
    args,
    []
  )
  Artist.updateMany = <T extends ArtistUpdateManyArgs>(args: Subset<T, ArtistUpdateManyArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistUpdateManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyArtists',
    'artists.updateMany',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyArtists',
    'artists.updateMany',
    args,
    []
  )
  Artist.upsert = <T extends ArtistUpsertArgs>(args: Subset<T, ArtistUpsertArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistUpsertArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertArtist',
    'artists.upsert',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'upsertArtist',
    'artists.upsert',
    args,
    []
  )
  Artist.delete = <T extends ArtistDeleteArgs>(args: Subset<T, ArtistDeleteArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistDeleteArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteArtist',
    'artists.delete',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'deleteArtist',
    'artists.delete',
    args,
    []
  )
  Artist.deleteMany = <T extends ArtistDeleteManyArgs>(args: Subset<T, ArtistDeleteManyArgs>) => args.select ? new ArtistClient<Array<ArtistGetPayload<ExtractArtistDeleteManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyArtists',
    'artists.deleteMany',
    args,
    []
  ) : new ArtistClient<Artist>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyArtists',
    'artists.deleteMany',
    args,
    []
  )
  return Artist as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class ArtistClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: ArtistArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

  private _Albums?: AlbumClient<any>
  Albums<T extends FindManyAlbumArgs = {}>(args?: Subset<T, FindManyAlbumArgs>): PromiseLike<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'Albums']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Albums
      ? this._Albums
      : (this._Albums = new AlbumClient<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const {rootField} = this
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

export type FindOneArtistArgs = {
  select?: ArtistSelect
  where: ArtistWhereUniqueInput
}

export type FindOneArtistArgsWithSelect = {
  select: ArtistSelect
  where: ArtistWhereUniqueInput
}

type ExtractFindOneArtistArgsSelect<S extends boolean | FindOneArtistArgs> = S extends boolean
  ? S
  : S extends FindOneArtistArgsWithSelect
  ? S['select']
  : true


export type FindManyArtistArgs = {
  select?: ArtistSelect
  where?: ArtistWhereInput
  orderBy?: ArtistOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyArtistArgsWithSelect = {
  select: ArtistSelect
  where?: ArtistWhereInput
  orderBy?: ArtistOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyArtistArgsSelect<S extends boolean | FindManyArtistArgs> = S extends boolean
  ? S
  : S extends FindManyArtistArgsWithSelect
  ? S['select']
  : true


export type ArtistCreateArgs = {
  select?: ArtistSelect
  data: ArtistCreateInput
}

export type ArtistCreateArgsWithSelect = {
  select: ArtistSelect
  data: ArtistCreateInput
}

type ExtractArtistCreateArgsSelect<S extends boolean | ArtistCreateArgs> = S extends boolean
  ? S
  : S extends ArtistCreateArgsWithSelect
  ? S['select']
  : true


export type ArtistUpdateArgs = {
  select?: ArtistSelect
  data: ArtistUpdateInput
  where: ArtistWhereUniqueInput
}

export type ArtistUpdateArgsWithSelect = {
  select: ArtistSelect
  data: ArtistUpdateInput
  where: ArtistWhereUniqueInput
}

type ExtractArtistUpdateArgsSelect<S extends boolean | ArtistUpdateArgs> = S extends boolean
  ? S
  : S extends ArtistUpdateArgsWithSelect
  ? S['select']
  : true


export type ArtistUpdateManyArgs = {
  select?: ArtistSelect
  data: ArtistUpdateManyMutationInput
  where?: ArtistWhereInput
}

export type ArtistUpdateManyArgsWithSelect = {
  select: ArtistSelect
  data: ArtistUpdateManyMutationInput
  where?: ArtistWhereInput
}

type ExtractArtistUpdateManyArgsSelect<S extends boolean | ArtistUpdateManyArgs> = S extends boolean
  ? S
  : S extends ArtistUpdateManyArgsWithSelect
  ? S['select']
  : true


export type ArtistUpsertArgs = {
  select?: ArtistSelect
  where: ArtistWhereUniqueInput
  create: ArtistCreateInput
  update: ArtistUpdateInput
}

export type ArtistUpsertArgsWithSelect = {
  select: ArtistSelect
  where: ArtistWhereUniqueInput
  create: ArtistCreateInput
  update: ArtistUpdateInput
}

type ExtractArtistUpsertArgsSelect<S extends boolean | ArtistUpsertArgs> = S extends boolean
  ? S
  : S extends ArtistUpsertArgsWithSelect
  ? S['select']
  : true


export type ArtistDeleteArgs = {
  select?: ArtistSelect
  where: ArtistWhereUniqueInput
}

export type ArtistDeleteArgsWithSelect = {
  select: ArtistSelect
  where: ArtistWhereUniqueInput
}

type ExtractArtistDeleteArgsSelect<S extends boolean | ArtistDeleteArgs> = S extends boolean
  ? S
  : S extends ArtistDeleteArgsWithSelect
  ? S['select']
  : true


export type ArtistDeleteManyArgs = {
  select?: ArtistSelect
  where?: ArtistWhereInput
}

export type ArtistDeleteManyArgsWithSelect = {
  select: ArtistSelect
  where?: ArtistWhereInput
}

type ExtractArtistDeleteManyArgsSelect<S extends boolean | ArtistDeleteManyArgs> = S extends boolean
  ? S
  : S extends ArtistDeleteManyArgsWithSelect
  ? S['select']
  : true


export type ArtistArgs = {
  select?: ArtistSelect
}

export type ArtistArgsWithSelect = {
  select: ArtistSelect
}

type ExtractArtistArgsSelect<S extends boolean | ArtistArgs> = S extends boolean
  ? S
  : S extends ArtistArgsWithSelect
  ? S['select']
  : true



/**
 * Model Album
 */

export type Album = {
  id: string
  AlbumId: number
  Title: string
}

export type AlbumScalars = 'id' | 'AlbumId' | 'Title'
  

export type AlbumSelect= {
  id?: boolean
  AlbumId?: boolean
  Title?: boolean
  Artist?: boolean | ArtistArgs
  Tracks?: boolean | FindManyTrackArgs
}

type AlbumDefault = {
  id: true
  AlbumId: true
  Title: true
}


type AlbumGetPayload<S extends boolean | AlbumSelect> = S extends true
  ? Album
  : S extends AlbumSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<AlbumDefault, S>>]: P extends AlbumScalars
        ? Album[P]
        : P extends 'Artist'
        ? ArtistGetPayload<ExtractArtistArgsSelect<S[P]>>
        : P extends 'Tracks'
        ? Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<S[P]>>>
        : never
    }
   : never

export interface AlbumDelegate {
  <T extends AlbumArgs>(args: Subset<T,AlbumArgs>): PromiseLike<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>>
  findOne<T extends FindOneAlbumArgs>(
    args: Subset<T, FindOneAlbumArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractFindOneAlbumArgsSelect<T>>> : AlbumClient<Album>
  findMany<T extends FindManyAlbumArgs>(
    args: Subset<T, FindManyAlbumArgs>
  ): PromiseLike<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>>
  create<T extends AlbumCreateArgs>(
    args: Subset<T, AlbumCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumCreateArgsSelect<T>>> : AlbumClient<Album>
  update<T extends AlbumUpdateArgs>(
    args: Subset<T, AlbumUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumUpdateArgsSelect<T>>> : AlbumClient<Album>
  updateMany<T extends AlbumUpdateManyArgs>(
    args: Subset<T, AlbumUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumUpdateManyArgsSelect<T>>> : AlbumClient<Album>
  upsert<T extends AlbumUpsertArgs>(
    args: Subset<T, AlbumUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumUpsertArgsSelect<T>>> : AlbumClient<Album>
  delete<T extends AlbumDeleteArgs>(
    args: Subset<T, AlbumDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumDeleteArgsSelect<T>>> : AlbumClient<Album>
  deleteMany<T extends AlbumDeleteManyArgs>(
    args: Subset<T, AlbumDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumDeleteManyArgsSelect<T>>> : AlbumClient<Album>
}
function AlbumDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): AlbumDelegate {
  const Album = <T extends AlbumArgs>(args: Subset<T, AlbumArgs>) => new AlbumClient<PromiseLike<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'albums', 'albums', args, [])
  Album.findOne = <T extends FindOneAlbumArgs>(args: Subset<T, FindOneAlbumArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractFindOneAlbumArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'album',
    'albums.findOne',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'query',
    'album',
    'albums.findOne',
    args,
    []
  )
  Album.findMany = <T extends FindManyAlbumArgs>(args: Subset<T, FindManyAlbumArgs>) => new AlbumClient<Array<AlbumGetPayload<ExtractFindManyAlbumArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'albums',
    'albums.findMany',
    args,
    []
  )
  Album.create = <T extends AlbumCreateArgs>(args: Subset<T, AlbumCreateArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumCreateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'createAlbum',
    'albums.create',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'createAlbum',
    'albums.create',
    args,
    []
  )
  Album.update = <T extends AlbumUpdateArgs>(args: Subset<T, AlbumUpdateArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumUpdateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateAlbum',
    'albums.update',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'updateAlbum',
    'albums.update',
    args,
    []
  )
  Album.updateMany = <T extends AlbumUpdateManyArgs>(args: Subset<T, AlbumUpdateManyArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumUpdateManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyAlbums',
    'albums.updateMany',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyAlbums',
    'albums.updateMany',
    args,
    []
  )
  Album.upsert = <T extends AlbumUpsertArgs>(args: Subset<T, AlbumUpsertArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumUpsertArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertAlbum',
    'albums.upsert',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'upsertAlbum',
    'albums.upsert',
    args,
    []
  )
  Album.delete = <T extends AlbumDeleteArgs>(args: Subset<T, AlbumDeleteArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumDeleteArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteAlbum',
    'albums.delete',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'deleteAlbum',
    'albums.delete',
    args,
    []
  )
  Album.deleteMany = <T extends AlbumDeleteManyArgs>(args: Subset<T, AlbumDeleteManyArgs>) => args.select ? new AlbumClient<Array<AlbumGetPayload<ExtractAlbumDeleteManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyAlbums',
    'albums.deleteMany',
    args,
    []
  ) : new AlbumClient<Album>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyAlbums',
    'albums.deleteMany',
    args,
    []
  )
  return Album as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class AlbumClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: AlbumArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

  private _Artist?: ArtistClient<any>
  Artist<T extends ArtistArgs = {}>(args?: Subset<T, ArtistArgs>): 'select' extends keyof T ? PromiseLike<ArtistGetPayload<ExtractArtistArgsSelect<T>>> : ArtistClient<Artist> {
    const path = [...this.path, 'select', 'Artist']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Artist
      ? this._Artist
      : (this._Artist = new ArtistClient<'select' extends keyof T ? ArtistGetPayload<ExtractArtistArgsSelect<T>> : ArtistClient<Artist>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _Tracks?: TrackClient<any>
  Tracks<T extends FindManyTrackArgs = {}>(args?: Subset<T, FindManyTrackArgs>): PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'Tracks']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Tracks
      ? this._Tracks
      : (this._Tracks = new TrackClient<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const {rootField} = this
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

export type FindOneAlbumArgs = {
  select?: AlbumSelect
  where: AlbumWhereUniqueInput
}

export type FindOneAlbumArgsWithSelect = {
  select: AlbumSelect
  where: AlbumWhereUniqueInput
}

type ExtractFindOneAlbumArgsSelect<S extends boolean | FindOneAlbumArgs> = S extends boolean
  ? S
  : S extends FindOneAlbumArgsWithSelect
  ? S['select']
  : true


export type FindManyAlbumArgs = {
  select?: AlbumSelect
  where?: AlbumWhereInput
  orderBy?: AlbumOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyAlbumArgsWithSelect = {
  select: AlbumSelect
  where?: AlbumWhereInput
  orderBy?: AlbumOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyAlbumArgsSelect<S extends boolean | FindManyAlbumArgs> = S extends boolean
  ? S
  : S extends FindManyAlbumArgsWithSelect
  ? S['select']
  : true


export type AlbumCreateArgs = {
  select?: AlbumSelect
  data: AlbumCreateInput
}

export type AlbumCreateArgsWithSelect = {
  select: AlbumSelect
  data: AlbumCreateInput
}

type ExtractAlbumCreateArgsSelect<S extends boolean | AlbumCreateArgs> = S extends boolean
  ? S
  : S extends AlbumCreateArgsWithSelect
  ? S['select']
  : true


export type AlbumUpdateArgs = {
  select?: AlbumSelect
  data: AlbumUpdateInput
  where: AlbumWhereUniqueInput
}

export type AlbumUpdateArgsWithSelect = {
  select: AlbumSelect
  data: AlbumUpdateInput
  where: AlbumWhereUniqueInput
}

type ExtractAlbumUpdateArgsSelect<S extends boolean | AlbumUpdateArgs> = S extends boolean
  ? S
  : S extends AlbumUpdateArgsWithSelect
  ? S['select']
  : true


export type AlbumUpdateManyArgs = {
  select?: AlbumSelect
  data: AlbumUpdateManyMutationInput
  where?: AlbumWhereInput
}

export type AlbumUpdateManyArgsWithSelect = {
  select: AlbumSelect
  data: AlbumUpdateManyMutationInput
  where?: AlbumWhereInput
}

type ExtractAlbumUpdateManyArgsSelect<S extends boolean | AlbumUpdateManyArgs> = S extends boolean
  ? S
  : S extends AlbumUpdateManyArgsWithSelect
  ? S['select']
  : true


export type AlbumUpsertArgs = {
  select?: AlbumSelect
  where: AlbumWhereUniqueInput
  create: AlbumCreateInput
  update: AlbumUpdateInput
}

export type AlbumUpsertArgsWithSelect = {
  select: AlbumSelect
  where: AlbumWhereUniqueInput
  create: AlbumCreateInput
  update: AlbumUpdateInput
}

type ExtractAlbumUpsertArgsSelect<S extends boolean | AlbumUpsertArgs> = S extends boolean
  ? S
  : S extends AlbumUpsertArgsWithSelect
  ? S['select']
  : true


export type AlbumDeleteArgs = {
  select?: AlbumSelect
  where: AlbumWhereUniqueInput
}

export type AlbumDeleteArgsWithSelect = {
  select: AlbumSelect
  where: AlbumWhereUniqueInput
}

type ExtractAlbumDeleteArgsSelect<S extends boolean | AlbumDeleteArgs> = S extends boolean
  ? S
  : S extends AlbumDeleteArgsWithSelect
  ? S['select']
  : true


export type AlbumDeleteManyArgs = {
  select?: AlbumSelect
  where?: AlbumWhereInput
}

export type AlbumDeleteManyArgsWithSelect = {
  select: AlbumSelect
  where?: AlbumWhereInput
}

type ExtractAlbumDeleteManyArgsSelect<S extends boolean | AlbumDeleteManyArgs> = S extends boolean
  ? S
  : S extends AlbumDeleteManyArgsWithSelect
  ? S['select']
  : true


export type AlbumArgs = {
  select?: AlbumSelect
}

export type AlbumArgsWithSelect = {
  select: AlbumSelect
}

type ExtractAlbumArgsSelect<S extends boolean | AlbumArgs> = S extends boolean
  ? S
  : S extends AlbumArgsWithSelect
  ? S['select']
  : true



/**
 * Model Track
 */

export type Track = {
  id: string
  TrackId: number
  Name: string
  Composer?: string
  Milliseconds: number
  Bytes: number
  UnitPrice: number
}

export type TrackScalars = 'id' | 'TrackId' | 'Name' | 'Composer' | 'Milliseconds' | 'Bytes' | 'UnitPrice'
  

export type TrackSelect= {
  id?: boolean
  TrackId?: boolean
  Name?: boolean
  Album?: boolean | AlbumArgs
  MediaType?: boolean | MediaTypeArgs
  Genre?: boolean | GenreArgs
  Composer?: boolean
  Milliseconds?: boolean
  Bytes?: boolean
  UnitPrice?: boolean
}

type TrackDefault = {
  id: true
  TrackId: true
  Name: true
  Composer: true
  Milliseconds: true
  Bytes: true
  UnitPrice: true
}


type TrackGetPayload<S extends boolean | TrackSelect> = S extends true
  ? Track
  : S extends TrackSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<TrackDefault, S>>]: P extends TrackScalars
        ? Track[P]
        : P extends 'Album'
        ? AlbumGetPayload<ExtractAlbumArgsSelect<S[P]>>
        : P extends 'MediaType'
        ? MediaTypeGetPayload<ExtractMediaTypeArgsSelect<S[P]>>
        : P extends 'Genre'
        ? GenreGetPayload<ExtractGenreArgsSelect<S[P]>>
        : never
    }
   : never

export interface TrackDelegate {
  <T extends TrackArgs>(args: Subset<T,TrackArgs>): PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>
  findOne<T extends FindOneTrackArgs>(
    args: Subset<T, FindOneTrackArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractFindOneTrackArgsSelect<T>>> : TrackClient<Track>
  findMany<T extends FindManyTrackArgs>(
    args: Subset<T, FindManyTrackArgs>
  ): PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>
  create<T extends TrackCreateArgs>(
    args: Subset<T, TrackCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackCreateArgsSelect<T>>> : TrackClient<Track>
  update<T extends TrackUpdateArgs>(
    args: Subset<T, TrackUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackUpdateArgsSelect<T>>> : TrackClient<Track>
  updateMany<T extends TrackUpdateManyArgs>(
    args: Subset<T, TrackUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackUpdateManyArgsSelect<T>>> : TrackClient<Track>
  upsert<T extends TrackUpsertArgs>(
    args: Subset<T, TrackUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackUpsertArgsSelect<T>>> : TrackClient<Track>
  delete<T extends TrackDeleteArgs>(
    args: Subset<T, TrackDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackDeleteArgsSelect<T>>> : TrackClient<Track>
  deleteMany<T extends TrackDeleteManyArgs>(
    args: Subset<T, TrackDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<TrackGetPayload<ExtractTrackDeleteManyArgsSelect<T>>> : TrackClient<Track>
}
function TrackDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): TrackDelegate {
  const Track = <T extends TrackArgs>(args: Subset<T, TrackArgs>) => new TrackClient<PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'tracks', 'tracks', args, [])
  Track.findOne = <T extends FindOneTrackArgs>(args: Subset<T, FindOneTrackArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractFindOneTrackArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'track',
    'tracks.findOne',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'query',
    'track',
    'tracks.findOne',
    args,
    []
  )
  Track.findMany = <T extends FindManyTrackArgs>(args: Subset<T, FindManyTrackArgs>) => new TrackClient<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'tracks',
    'tracks.findMany',
    args,
    []
  )
  Track.create = <T extends TrackCreateArgs>(args: Subset<T, TrackCreateArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackCreateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'createTrack',
    'tracks.create',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'createTrack',
    'tracks.create',
    args,
    []
  )
  Track.update = <T extends TrackUpdateArgs>(args: Subset<T, TrackUpdateArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackUpdateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateTrack',
    'tracks.update',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'updateTrack',
    'tracks.update',
    args,
    []
  )
  Track.updateMany = <T extends TrackUpdateManyArgs>(args: Subset<T, TrackUpdateManyArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackUpdateManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyTracks',
    'tracks.updateMany',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyTracks',
    'tracks.updateMany',
    args,
    []
  )
  Track.upsert = <T extends TrackUpsertArgs>(args: Subset<T, TrackUpsertArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackUpsertArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertTrack',
    'tracks.upsert',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'upsertTrack',
    'tracks.upsert',
    args,
    []
  )
  Track.delete = <T extends TrackDeleteArgs>(args: Subset<T, TrackDeleteArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackDeleteArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteTrack',
    'tracks.delete',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'deleteTrack',
    'tracks.delete',
    args,
    []
  )
  Track.deleteMany = <T extends TrackDeleteManyArgs>(args: Subset<T, TrackDeleteManyArgs>) => args.select ? new TrackClient<Array<TrackGetPayload<ExtractTrackDeleteManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyTracks',
    'tracks.deleteMany',
    args,
    []
  ) : new TrackClient<Track>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyTracks',
    'tracks.deleteMany',
    args,
    []
  )
  return Track as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class TrackClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: TrackArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

  private _Album?: AlbumClient<any>
  Album<T extends AlbumArgs = {}>(args?: Subset<T, AlbumArgs>): 'select' extends keyof T ? PromiseLike<AlbumGetPayload<ExtractAlbumArgsSelect<T>>> : AlbumClient<Album> {
    const path = [...this.path, 'select', 'Album']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Album
      ? this._Album
      : (this._Album = new AlbumClient<'select' extends keyof T ? AlbumGetPayload<ExtractAlbumArgsSelect<T>> : AlbumClient<Album>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _MediaType?: MediaTypeClient<any>
  MediaType<T extends MediaTypeArgs = {}>(args?: Subset<T, MediaTypeArgs>): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeArgsSelect<T>>> : MediaTypeClient<MediaType> {
    const path = [...this.path, 'select', 'MediaType']
    const newArgs = deepSet(this.args, path, args || true)
    return this._MediaType
      ? this._MediaType
      : (this._MediaType = new MediaTypeClient<'select' extends keyof T ? MediaTypeGetPayload<ExtractMediaTypeArgsSelect<T>> : MediaTypeClient<MediaType>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }
  private _Genre?: GenreClient<any>
  Genre<T extends GenreArgs = {}>(args?: Subset<T, GenreArgs>): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreArgsSelect<T>>> : GenreClient<Genre> {
    const path = [...this.path, 'select', 'Genre']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Genre
      ? this._Genre
      : (this._Genre = new GenreClient<'select' extends keyof T ? GenreGetPayload<ExtractGenreArgsSelect<T>> : GenreClient<Genre>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const {rootField} = this
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

export type FindOneTrackArgs = {
  select?: TrackSelect
  where: TrackWhereUniqueInput
}

export type FindOneTrackArgsWithSelect = {
  select: TrackSelect
  where: TrackWhereUniqueInput
}

type ExtractFindOneTrackArgsSelect<S extends boolean | FindOneTrackArgs> = S extends boolean
  ? S
  : S extends FindOneTrackArgsWithSelect
  ? S['select']
  : true


export type FindManyTrackArgs = {
  select?: TrackSelect
  where?: TrackWhereInput
  orderBy?: TrackOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyTrackArgsWithSelect = {
  select: TrackSelect
  where?: TrackWhereInput
  orderBy?: TrackOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyTrackArgsSelect<S extends boolean | FindManyTrackArgs> = S extends boolean
  ? S
  : S extends FindManyTrackArgsWithSelect
  ? S['select']
  : true


export type TrackCreateArgs = {
  select?: TrackSelect
  data: TrackCreateInput
}

export type TrackCreateArgsWithSelect = {
  select: TrackSelect
  data: TrackCreateInput
}

type ExtractTrackCreateArgsSelect<S extends boolean | TrackCreateArgs> = S extends boolean
  ? S
  : S extends TrackCreateArgsWithSelect
  ? S['select']
  : true


export type TrackUpdateArgs = {
  select?: TrackSelect
  data: TrackUpdateInput
  where: TrackWhereUniqueInput
}

export type TrackUpdateArgsWithSelect = {
  select: TrackSelect
  data: TrackUpdateInput
  where: TrackWhereUniqueInput
}

type ExtractTrackUpdateArgsSelect<S extends boolean | TrackUpdateArgs> = S extends boolean
  ? S
  : S extends TrackUpdateArgsWithSelect
  ? S['select']
  : true


export type TrackUpdateManyArgs = {
  select?: TrackSelect
  data: TrackUpdateManyMutationInput
  where?: TrackWhereInput
}

export type TrackUpdateManyArgsWithSelect = {
  select: TrackSelect
  data: TrackUpdateManyMutationInput
  where?: TrackWhereInput
}

type ExtractTrackUpdateManyArgsSelect<S extends boolean | TrackUpdateManyArgs> = S extends boolean
  ? S
  : S extends TrackUpdateManyArgsWithSelect
  ? S['select']
  : true


export type TrackUpsertArgs = {
  select?: TrackSelect
  where: TrackWhereUniqueInput
  create: TrackCreateInput
  update: TrackUpdateInput
}

export type TrackUpsertArgsWithSelect = {
  select: TrackSelect
  where: TrackWhereUniqueInput
  create: TrackCreateInput
  update: TrackUpdateInput
}

type ExtractTrackUpsertArgsSelect<S extends boolean | TrackUpsertArgs> = S extends boolean
  ? S
  : S extends TrackUpsertArgsWithSelect
  ? S['select']
  : true


export type TrackDeleteArgs = {
  select?: TrackSelect
  where: TrackWhereUniqueInput
}

export type TrackDeleteArgsWithSelect = {
  select: TrackSelect
  where: TrackWhereUniqueInput
}

type ExtractTrackDeleteArgsSelect<S extends boolean | TrackDeleteArgs> = S extends boolean
  ? S
  : S extends TrackDeleteArgsWithSelect
  ? S['select']
  : true


export type TrackDeleteManyArgs = {
  select?: TrackSelect
  where?: TrackWhereInput
}

export type TrackDeleteManyArgsWithSelect = {
  select: TrackSelect
  where?: TrackWhereInput
}

type ExtractTrackDeleteManyArgsSelect<S extends boolean | TrackDeleteManyArgs> = S extends boolean
  ? S
  : S extends TrackDeleteManyArgsWithSelect
  ? S['select']
  : true


export type TrackArgs = {
  select?: TrackSelect
}

export type TrackArgsWithSelect = {
  select: TrackSelect
}

type ExtractTrackArgsSelect<S extends boolean | TrackArgs> = S extends boolean
  ? S
  : S extends TrackArgsWithSelect
  ? S['select']
  : true



/**
 * Model Genre
 */

export type Genre = {
  id: string
  GenreId: number
  Name: string
}

export type GenreScalars = 'id' | 'GenreId' | 'Name'
  

export type GenreSelect= {
  id?: boolean
  GenreId?: boolean
  Name?: boolean
  Tracks?: boolean | FindManyTrackArgs
}

type GenreDefault = {
  id: true
  GenreId: true
  Name: true
}


type GenreGetPayload<S extends boolean | GenreSelect> = S extends true
  ? Genre
  : S extends GenreSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<GenreDefault, S>>]: P extends GenreScalars
        ? Genre[P]
        : P extends 'Tracks'
        ? Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<S[P]>>>
        : never
    }
   : never

export interface GenreDelegate {
  <T extends GenreArgs>(args: Subset<T,GenreArgs>): PromiseLike<Array<GenreGetPayload<ExtractFindManyGenreArgsSelect<T>>>>
  findOne<T extends FindOneGenreArgs>(
    args: Subset<T, FindOneGenreArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractFindOneGenreArgsSelect<T>>> : GenreClient<Genre>
  findMany<T extends FindManyGenreArgs>(
    args: Subset<T, FindManyGenreArgs>
  ): PromiseLike<Array<GenreGetPayload<ExtractFindManyGenreArgsSelect<T>>>>
  create<T extends GenreCreateArgs>(
    args: Subset<T, GenreCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreCreateArgsSelect<T>>> : GenreClient<Genre>
  update<T extends GenreUpdateArgs>(
    args: Subset<T, GenreUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreUpdateArgsSelect<T>>> : GenreClient<Genre>
  updateMany<T extends GenreUpdateManyArgs>(
    args: Subset<T, GenreUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreUpdateManyArgsSelect<T>>> : GenreClient<Genre>
  upsert<T extends GenreUpsertArgs>(
    args: Subset<T, GenreUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreUpsertArgsSelect<T>>> : GenreClient<Genre>
  delete<T extends GenreDeleteArgs>(
    args: Subset<T, GenreDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreDeleteArgsSelect<T>>> : GenreClient<Genre>
  deleteMany<T extends GenreDeleteManyArgs>(
    args: Subset<T, GenreDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<GenreGetPayload<ExtractGenreDeleteManyArgsSelect<T>>> : GenreClient<Genre>
}
function GenreDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): GenreDelegate {
  const Genre = <T extends GenreArgs>(args: Subset<T, GenreArgs>) => new GenreClient<PromiseLike<Array<GenreGetPayload<ExtractFindManyGenreArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'genres', 'genres', args, [])
  Genre.findOne = <T extends FindOneGenreArgs>(args: Subset<T, FindOneGenreArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractFindOneGenreArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'genre',
    'genres.findOne',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'query',
    'genre',
    'genres.findOne',
    args,
    []
  )
  Genre.findMany = <T extends FindManyGenreArgs>(args: Subset<T, FindManyGenreArgs>) => new GenreClient<Array<GenreGetPayload<ExtractFindManyGenreArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'genres',
    'genres.findMany',
    args,
    []
  )
  Genre.create = <T extends GenreCreateArgs>(args: Subset<T, GenreCreateArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreCreateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'createGenre',
    'genres.create',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'createGenre',
    'genres.create',
    args,
    []
  )
  Genre.update = <T extends GenreUpdateArgs>(args: Subset<T, GenreUpdateArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreUpdateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateGenre',
    'genres.update',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'updateGenre',
    'genres.update',
    args,
    []
  )
  Genre.updateMany = <T extends GenreUpdateManyArgs>(args: Subset<T, GenreUpdateManyArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreUpdateManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyGenres',
    'genres.updateMany',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyGenres',
    'genres.updateMany',
    args,
    []
  )
  Genre.upsert = <T extends GenreUpsertArgs>(args: Subset<T, GenreUpsertArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreUpsertArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertGenre',
    'genres.upsert',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'upsertGenre',
    'genres.upsert',
    args,
    []
  )
  Genre.delete = <T extends GenreDeleteArgs>(args: Subset<T, GenreDeleteArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreDeleteArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteGenre',
    'genres.delete',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'deleteGenre',
    'genres.delete',
    args,
    []
  )
  Genre.deleteMany = <T extends GenreDeleteManyArgs>(args: Subset<T, GenreDeleteManyArgs>) => args.select ? new GenreClient<Array<GenreGetPayload<ExtractGenreDeleteManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyGenres',
    'genres.deleteMany',
    args,
    []
  ) : new GenreClient<Genre>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyGenres',
    'genres.deleteMany',
    args,
    []
  )
  return Genre as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class GenreClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: GenreArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

  private _Tracks?: TrackClient<any>
  Tracks<T extends FindManyTrackArgs = {}>(args?: Subset<T, FindManyTrackArgs>): PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'Tracks']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Tracks
      ? this._Tracks
      : (this._Tracks = new TrackClient<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const {rootField} = this
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

export type FindOneGenreArgs = {
  select?: GenreSelect
  where: GenreWhereUniqueInput
}

export type FindOneGenreArgsWithSelect = {
  select: GenreSelect
  where: GenreWhereUniqueInput
}

type ExtractFindOneGenreArgsSelect<S extends boolean | FindOneGenreArgs> = S extends boolean
  ? S
  : S extends FindOneGenreArgsWithSelect
  ? S['select']
  : true


export type FindManyGenreArgs = {
  select?: GenreSelect
  where?: GenreWhereInput
  orderBy?: GenreOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyGenreArgsWithSelect = {
  select: GenreSelect
  where?: GenreWhereInput
  orderBy?: GenreOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyGenreArgsSelect<S extends boolean | FindManyGenreArgs> = S extends boolean
  ? S
  : S extends FindManyGenreArgsWithSelect
  ? S['select']
  : true


export type GenreCreateArgs = {
  select?: GenreSelect
  data: GenreCreateInput
}

export type GenreCreateArgsWithSelect = {
  select: GenreSelect
  data: GenreCreateInput
}

type ExtractGenreCreateArgsSelect<S extends boolean | GenreCreateArgs> = S extends boolean
  ? S
  : S extends GenreCreateArgsWithSelect
  ? S['select']
  : true


export type GenreUpdateArgs = {
  select?: GenreSelect
  data: GenreUpdateInput
  where: GenreWhereUniqueInput
}

export type GenreUpdateArgsWithSelect = {
  select: GenreSelect
  data: GenreUpdateInput
  where: GenreWhereUniqueInput
}

type ExtractGenreUpdateArgsSelect<S extends boolean | GenreUpdateArgs> = S extends boolean
  ? S
  : S extends GenreUpdateArgsWithSelect
  ? S['select']
  : true


export type GenreUpdateManyArgs = {
  select?: GenreSelect
  data: GenreUpdateManyMutationInput
  where?: GenreWhereInput
}

export type GenreUpdateManyArgsWithSelect = {
  select: GenreSelect
  data: GenreUpdateManyMutationInput
  where?: GenreWhereInput
}

type ExtractGenreUpdateManyArgsSelect<S extends boolean | GenreUpdateManyArgs> = S extends boolean
  ? S
  : S extends GenreUpdateManyArgsWithSelect
  ? S['select']
  : true


export type GenreUpsertArgs = {
  select?: GenreSelect
  where: GenreWhereUniqueInput
  create: GenreCreateInput
  update: GenreUpdateInput
}

export type GenreUpsertArgsWithSelect = {
  select: GenreSelect
  where: GenreWhereUniqueInput
  create: GenreCreateInput
  update: GenreUpdateInput
}

type ExtractGenreUpsertArgsSelect<S extends boolean | GenreUpsertArgs> = S extends boolean
  ? S
  : S extends GenreUpsertArgsWithSelect
  ? S['select']
  : true


export type GenreDeleteArgs = {
  select?: GenreSelect
  where: GenreWhereUniqueInput
}

export type GenreDeleteArgsWithSelect = {
  select: GenreSelect
  where: GenreWhereUniqueInput
}

type ExtractGenreDeleteArgsSelect<S extends boolean | GenreDeleteArgs> = S extends boolean
  ? S
  : S extends GenreDeleteArgsWithSelect
  ? S['select']
  : true


export type GenreDeleteManyArgs = {
  select?: GenreSelect
  where?: GenreWhereInput
}

export type GenreDeleteManyArgsWithSelect = {
  select: GenreSelect
  where?: GenreWhereInput
}

type ExtractGenreDeleteManyArgsSelect<S extends boolean | GenreDeleteManyArgs> = S extends boolean
  ? S
  : S extends GenreDeleteManyArgsWithSelect
  ? S['select']
  : true


export type GenreArgs = {
  select?: GenreSelect
}

export type GenreArgsWithSelect = {
  select: GenreSelect
}

type ExtractGenreArgsSelect<S extends boolean | GenreArgs> = S extends boolean
  ? S
  : S extends GenreArgsWithSelect
  ? S['select']
  : true



/**
 * Model MediaType
 */

export type MediaType = {
  id: string
  MediaTypeId: number
  Name: string
}

export type MediaTypeScalars = 'id' | 'MediaTypeId' | 'Name'
  

export type MediaTypeSelect= {
  id?: boolean
  MediaTypeId?: boolean
  Name?: boolean
  Tracks?: boolean | FindManyTrackArgs
}

type MediaTypeDefault = {
  id: true
  MediaTypeId: true
  Name: true
}


type MediaTypeGetPayload<S extends boolean | MediaTypeSelect> = S extends true
  ? MediaType
  : S extends MediaTypeSelect
  ? {
      [P in CleanupNever<MergeTruthyValues<MediaTypeDefault, S>>]: P extends MediaTypeScalars
        ? MediaType[P]
        : P extends 'Tracks'
        ? Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<S[P]>>>
        : never
    }
   : never

export interface MediaTypeDelegate {
  <T extends MediaTypeArgs>(args: Subset<T,MediaTypeArgs>): PromiseLike<Array<MediaTypeGetPayload<ExtractFindManyMediaTypeArgsSelect<T>>>>
  findOne<T extends FindOneMediaTypeArgs>(
    args: Subset<T, FindOneMediaTypeArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractFindOneMediaTypeArgsSelect<T>>> : MediaTypeClient<MediaType>
  findMany<T extends FindManyMediaTypeArgs>(
    args: Subset<T, FindManyMediaTypeArgs>
  ): PromiseLike<Array<MediaTypeGetPayload<ExtractFindManyMediaTypeArgsSelect<T>>>>
  create<T extends MediaTypeCreateArgs>(
    args: Subset<T, MediaTypeCreateArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeCreateArgsSelect<T>>> : MediaTypeClient<MediaType>
  update<T extends MediaTypeUpdateArgs>(
    args: Subset<T, MediaTypeUpdateArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeUpdateArgsSelect<T>>> : MediaTypeClient<MediaType>
  updateMany<T extends MediaTypeUpdateManyArgs>(
    args: Subset<T, MediaTypeUpdateManyArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeUpdateManyArgsSelect<T>>> : MediaTypeClient<MediaType>
  upsert<T extends MediaTypeUpsertArgs>(
    args: Subset<T, MediaTypeUpsertArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeUpsertArgsSelect<T>>> : MediaTypeClient<MediaType>
  delete<T extends MediaTypeDeleteArgs>(
    args: Subset<T, MediaTypeDeleteArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeDeleteArgsSelect<T>>> : MediaTypeClient<MediaType>
  deleteMany<T extends MediaTypeDeleteManyArgs>(
    args: Subset<T, MediaTypeDeleteManyArgs>
  ): 'select' extends keyof T ? PromiseLike<MediaTypeGetPayload<ExtractMediaTypeDeleteManyArgsSelect<T>>> : MediaTypeClient<MediaType>
}
function MediaTypeDelegate(dmmf: DMMFClass, fetcher: PrismaFetcher): MediaTypeDelegate {
  const MediaType = <T extends MediaTypeArgs>(args: Subset<T, MediaTypeArgs>) => new MediaTypeClient<PromiseLike<Array<MediaTypeGetPayload<ExtractFindManyMediaTypeArgsSelect<T>>>>>(dmmf, fetcher, 'query', 'mediaTypes', 'mediaTypes', args, [])
  MediaType.findOne = <T extends FindOneMediaTypeArgs>(args: Subset<T, FindOneMediaTypeArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractFindOneMediaTypeArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'mediaType',
    'mediaTypes.findOne',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'query',
    'mediaType',
    'mediaTypes.findOne',
    args,
    []
  )
  MediaType.findMany = <T extends FindManyMediaTypeArgs>(args: Subset<T, FindManyMediaTypeArgs>) => new MediaTypeClient<Array<MediaTypeGetPayload<ExtractFindManyMediaTypeArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'query',
    'mediaTypes',
    'mediaTypes.findMany',
    args,
    []
  )
  MediaType.create = <T extends MediaTypeCreateArgs>(args: Subset<T, MediaTypeCreateArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeCreateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'createMediaType',
    'mediaTypes.create',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'createMediaType',
    'mediaTypes.create',
    args,
    []
  )
  MediaType.update = <T extends MediaTypeUpdateArgs>(args: Subset<T, MediaTypeUpdateArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeUpdateArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateMediaType',
    'mediaTypes.update',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'updateMediaType',
    'mediaTypes.update',
    args,
    []
  )
  MediaType.updateMany = <T extends MediaTypeUpdateManyArgs>(args: Subset<T, MediaTypeUpdateManyArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeUpdateManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyMediaTypes',
    'mediaTypes.updateMany',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'updateManyMediaTypes',
    'mediaTypes.updateMany',
    args,
    []
  )
  MediaType.upsert = <T extends MediaTypeUpsertArgs>(args: Subset<T, MediaTypeUpsertArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeUpsertArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'upsertMediaType',
    'mediaTypes.upsert',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'upsertMediaType',
    'mediaTypes.upsert',
    args,
    []
  )
  MediaType.delete = <T extends MediaTypeDeleteArgs>(args: Subset<T, MediaTypeDeleteArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeDeleteArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteMediaType',
    'mediaTypes.delete',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'deleteMediaType',
    'mediaTypes.delete',
    args,
    []
  )
  MediaType.deleteMany = <T extends MediaTypeDeleteManyArgs>(args: Subset<T, MediaTypeDeleteManyArgs>) => args.select ? new MediaTypeClient<Array<MediaTypeGetPayload<ExtractMediaTypeDeleteManyArgsSelect<T>>>>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyMediaTypes',
    'mediaTypes.deleteMany',
    args,
    []
  ) : new MediaTypeClient<MediaType>(
    dmmf,
    fetcher,
    'mutation',
    'deleteManyMediaTypes',
    'mediaTypes.deleteMany',
    args,
    []
  )
  return MediaType as any // any needed until https://github.com/microsoft/TypeScript/issues/31335 is resolved
}

class MediaTypeClient<T> implements PromiseLike<T> {
  constructor(
    private readonly dmmf: DMMFClass,
    private readonly fetcher: PrismaFetcher,
    private readonly queryType: 'query' | 'mutation',
    private readonly rootField: string,
    private readonly clientMethod: string,
    private readonly args: MediaTypeArgs,
    private readonly path: string[]
  ) {}
  readonly [Symbol.toStringTag]: 'PrismaPromise'

  private _Tracks?: TrackClient<any>
  Tracks<T extends FindManyTrackArgs = {}>(args?: Subset<T, FindManyTrackArgs>): PromiseLike<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>> {
    const path = [...this.path, 'select', 'Tracks']
    const newArgs = deepSet(this.args, path, args || true)
    return this._Tracks
      ? this._Tracks
      : (this._Tracks = new TrackClient<Array<TrackGetPayload<ExtractFindManyTrackArgsSelect<T>>>>(this.dmmf, this.fetcher, this.queryType, this.rootField, this.clientMethod, newArgs, path)) as any
  }

  protected get query() {
    const {rootField} = this
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

export type FindOneMediaTypeArgs = {
  select?: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
}

export type FindOneMediaTypeArgsWithSelect = {
  select: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
}

type ExtractFindOneMediaTypeArgsSelect<S extends boolean | FindOneMediaTypeArgs> = S extends boolean
  ? S
  : S extends FindOneMediaTypeArgsWithSelect
  ? S['select']
  : true


export type FindManyMediaTypeArgs = {
  select?: MediaTypeSelect
  where?: MediaTypeWhereInput
  orderBy?: MediaTypeOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

export type FindManyMediaTypeArgsWithSelect = {
  select: MediaTypeSelect
  where?: MediaTypeWhereInput
  orderBy?: MediaTypeOrderByInput
  skip?: number
  after?: string
  before?: string
  first?: number
  last?: number
}

type ExtractFindManyMediaTypeArgsSelect<S extends boolean | FindManyMediaTypeArgs> = S extends boolean
  ? S
  : S extends FindManyMediaTypeArgsWithSelect
  ? S['select']
  : true


export type MediaTypeCreateArgs = {
  select?: MediaTypeSelect
  data: MediaTypeCreateInput
}

export type MediaTypeCreateArgsWithSelect = {
  select: MediaTypeSelect
  data: MediaTypeCreateInput
}

type ExtractMediaTypeCreateArgsSelect<S extends boolean | MediaTypeCreateArgs> = S extends boolean
  ? S
  : S extends MediaTypeCreateArgsWithSelect
  ? S['select']
  : true


export type MediaTypeUpdateArgs = {
  select?: MediaTypeSelect
  data: MediaTypeUpdateInput
  where: MediaTypeWhereUniqueInput
}

export type MediaTypeUpdateArgsWithSelect = {
  select: MediaTypeSelect
  data: MediaTypeUpdateInput
  where: MediaTypeWhereUniqueInput
}

type ExtractMediaTypeUpdateArgsSelect<S extends boolean | MediaTypeUpdateArgs> = S extends boolean
  ? S
  : S extends MediaTypeUpdateArgsWithSelect
  ? S['select']
  : true


export type MediaTypeUpdateManyArgs = {
  select?: MediaTypeSelect
  data: MediaTypeUpdateManyMutationInput
  where?: MediaTypeWhereInput
}

export type MediaTypeUpdateManyArgsWithSelect = {
  select: MediaTypeSelect
  data: MediaTypeUpdateManyMutationInput
  where?: MediaTypeWhereInput
}

type ExtractMediaTypeUpdateManyArgsSelect<S extends boolean | MediaTypeUpdateManyArgs> = S extends boolean
  ? S
  : S extends MediaTypeUpdateManyArgsWithSelect
  ? S['select']
  : true


export type MediaTypeUpsertArgs = {
  select?: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
  create: MediaTypeCreateInput
  update: MediaTypeUpdateInput
}

export type MediaTypeUpsertArgsWithSelect = {
  select: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
  create: MediaTypeCreateInput
  update: MediaTypeUpdateInput
}

type ExtractMediaTypeUpsertArgsSelect<S extends boolean | MediaTypeUpsertArgs> = S extends boolean
  ? S
  : S extends MediaTypeUpsertArgsWithSelect
  ? S['select']
  : true


export type MediaTypeDeleteArgs = {
  select?: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
}

export type MediaTypeDeleteArgsWithSelect = {
  select: MediaTypeSelect
  where: MediaTypeWhereUniqueInput
}

type ExtractMediaTypeDeleteArgsSelect<S extends boolean | MediaTypeDeleteArgs> = S extends boolean
  ? S
  : S extends MediaTypeDeleteArgsWithSelect
  ? S['select']
  : true


export type MediaTypeDeleteManyArgs = {
  select?: MediaTypeSelect
  where?: MediaTypeWhereInput
}

export type MediaTypeDeleteManyArgsWithSelect = {
  select: MediaTypeSelect
  where?: MediaTypeWhereInput
}

type ExtractMediaTypeDeleteManyArgsSelect<S extends boolean | MediaTypeDeleteManyArgs> = S extends boolean
  ? S
  : S extends MediaTypeDeleteManyArgsWithSelect
  ? S['select']
  : true


export type MediaTypeArgs = {
  select?: MediaTypeSelect
}

export type MediaTypeArgsWithSelect = {
  select: MediaTypeSelect
}

type ExtractMediaTypeArgsSelect<S extends boolean | MediaTypeArgs> = S extends boolean
  ? S
  : S extends MediaTypeArgsWithSelect
  ? S['select']
  : true



/**
 * Deep Input Types
 */


export type AlbumWhereUniqueInput = {
  id?: string
  AlbumId?: number
}


export type AlbumWhereInput = {
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
  AlbumId?: number
  AlbumId_not?: number
  AlbumId_in?: number[]
  AlbumId_not_in?: number[]
  AlbumId_lt?: number
  AlbumId_lte?: number
  AlbumId_gt?: number
  AlbumId_gte?: number
  Title?: string
  Title_not?: string
  Title_in?: string[]
  Title_not_in?: string[]
  Title_lt?: string
  Title_lte?: string
  Title_gt?: string
  Title_gte?: string
  Title_contains?: string
  Title_not_contains?: string
  Title_starts_with?: string
  Title_not_starts_with?: string
  Title_ends_with?: string
  Title_not_ends_with?: string
  Artist?: ArtistWhereInput
  Tracks_every?: TrackWhereInput
  Tracks_some?: TrackWhereInput
  Tracks_none?: TrackWhereInput
  AND?: AlbumWhereInput[]
  OR?: AlbumWhereInput[]
  NOT?: AlbumWhereInput[]
}


export type ArtistWhereInput = {
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
  ArtistId?: number
  ArtistId_not?: number
  ArtistId_in?: number[]
  ArtistId_not_in?: number[]
  ArtistId_lt?: number
  ArtistId_lte?: number
  ArtistId_gt?: number
  ArtistId_gte?: number
  Name?: string
  Name_not?: string
  Name_in?: string[]
  Name_not_in?: string[]
  Name_lt?: string
  Name_lte?: string
  Name_gt?: string
  Name_gte?: string
  Name_contains?: string
  Name_not_contains?: string
  Name_starts_with?: string
  Name_not_starts_with?: string
  Name_ends_with?: string
  Name_not_ends_with?: string
  Albums_every?: AlbumWhereInput
  Albums_some?: AlbumWhereInput
  Albums_none?: AlbumWhereInput
  someDate?: string
  someDate_not?: string
  someDate_in?: string[]
  someDate_not_in?: string[]
  someDate_lt?: string
  someDate_lte?: string
  someDate_gt?: string
  someDate_gte?: string
  someOptionalDate?: string
  someOptionalDate_not?: string
  someOptionalDate_in?: string[]
  someOptionalDate_not_in?: string[]
  someOptionalDate_lt?: string
  someOptionalDate_lte?: string
  someOptionalDate_gt?: string
  someOptionalDate_gte?: string
  AND?: ArtistWhereInput[]
  OR?: ArtistWhereInput[]
  NOT?: ArtistWhereInput[]
}


export type TrackWhereInput = {
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
  TrackId?: number
  TrackId_not?: number
  TrackId_in?: number[]
  TrackId_not_in?: number[]
  TrackId_lt?: number
  TrackId_lte?: number
  TrackId_gt?: number
  TrackId_gte?: number
  Name?: string
  Name_not?: string
  Name_in?: string[]
  Name_not_in?: string[]
  Name_lt?: string
  Name_lte?: string
  Name_gt?: string
  Name_gte?: string
  Name_contains?: string
  Name_not_contains?: string
  Name_starts_with?: string
  Name_not_starts_with?: string
  Name_ends_with?: string
  Name_not_ends_with?: string
  Album?: AlbumWhereInput
  MediaType?: MediaTypeWhereInput
  Genre?: GenreWhereInput
  Composer?: string
  Composer_not?: string
  Composer_in?: string[]
  Composer_not_in?: string[]
  Composer_lt?: string
  Composer_lte?: string
  Composer_gt?: string
  Composer_gte?: string
  Composer_contains?: string
  Composer_not_contains?: string
  Composer_starts_with?: string
  Composer_not_starts_with?: string
  Composer_ends_with?: string
  Composer_not_ends_with?: string
  Milliseconds?: number
  Milliseconds_not?: number
  Milliseconds_in?: number[]
  Milliseconds_not_in?: number[]
  Milliseconds_lt?: number
  Milliseconds_lte?: number
  Milliseconds_gt?: number
  Milliseconds_gte?: number
  Bytes?: number
  Bytes_not?: number
  Bytes_in?: number[]
  Bytes_not_in?: number[]
  Bytes_lt?: number
  Bytes_lte?: number
  Bytes_gt?: number
  Bytes_gte?: number
  UnitPrice?: number
  UnitPrice_not?: number
  UnitPrice_in?: number[]
  UnitPrice_not_in?: number[]
  UnitPrice_lt?: number
  UnitPrice_lte?: number
  UnitPrice_gt?: number
  UnitPrice_gte?: number
  AND?: TrackWhereInput[]
  OR?: TrackWhereInput[]
  NOT?: TrackWhereInput[]
}


export type MediaTypeWhereInput = {
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
  MediaTypeId?: number
  MediaTypeId_not?: number
  MediaTypeId_in?: number[]
  MediaTypeId_not_in?: number[]
  MediaTypeId_lt?: number
  MediaTypeId_lte?: number
  MediaTypeId_gt?: number
  MediaTypeId_gte?: number
  Name?: string
  Name_not?: string
  Name_in?: string[]
  Name_not_in?: string[]
  Name_lt?: string
  Name_lte?: string
  Name_gt?: string
  Name_gte?: string
  Name_contains?: string
  Name_not_contains?: string
  Name_starts_with?: string
  Name_not_starts_with?: string
  Name_ends_with?: string
  Name_not_ends_with?: string
  Tracks_every?: TrackWhereInput
  Tracks_some?: TrackWhereInput
  Tracks_none?: TrackWhereInput
  AND?: MediaTypeWhereInput[]
  OR?: MediaTypeWhereInput[]
  NOT?: MediaTypeWhereInput[]
}


export type GenreWhereInput = {
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
  GenreId?: number
  GenreId_not?: number
  GenreId_in?: number[]
  GenreId_not_in?: number[]
  GenreId_lt?: number
  GenreId_lte?: number
  GenreId_gt?: number
  GenreId_gte?: number
  Name?: string
  Name_not?: string
  Name_in?: string[]
  Name_not_in?: string[]
  Name_lt?: string
  Name_lte?: string
  Name_gt?: string
  Name_gte?: string
  Name_contains?: string
  Name_not_contains?: string
  Name_starts_with?: string
  Name_not_starts_with?: string
  Name_ends_with?: string
  Name_not_ends_with?: string
  Tracks_every?: TrackWhereInput
  Tracks_some?: TrackWhereInput
  Tracks_none?: TrackWhereInput
  AND?: GenreWhereInput[]
  OR?: GenreWhereInput[]
  NOT?: GenreWhereInput[]
}


export type AlbumOrderByInput = {
  id_ASC?: AlbumOrderByInput
  id_DESC?: AlbumOrderByInput
  AlbumId_ASC?: AlbumOrderByInput
  AlbumId_DESC?: AlbumOrderByInput
  Title_ASC?: AlbumOrderByInput
  Title_DESC?: AlbumOrderByInput
}


export type TrackOrderByInput = {
  id_ASC?: TrackOrderByInput
  id_DESC?: TrackOrderByInput
  TrackId_ASC?: TrackOrderByInput
  TrackId_DESC?: TrackOrderByInput
  Name_ASC?: TrackOrderByInput
  Name_DESC?: TrackOrderByInput
  Composer_ASC?: TrackOrderByInput
  Composer_DESC?: TrackOrderByInput
  Milliseconds_ASC?: TrackOrderByInput
  Milliseconds_DESC?: TrackOrderByInput
  Bytes_ASC?: TrackOrderByInput
  Bytes_DESC?: TrackOrderByInput
  UnitPrice_ASC?: TrackOrderByInput
  UnitPrice_DESC?: TrackOrderByInput
}


export type ArtistWhereUniqueInput = {
  id?: string
  ArtistId?: number
}


export type ArtistOrderByInput = {
  id_ASC?: ArtistOrderByInput
  id_DESC?: ArtistOrderByInput
  ArtistId_ASC?: ArtistOrderByInput
  ArtistId_DESC?: ArtistOrderByInput
  Name_ASC?: ArtistOrderByInput
  Name_DESC?: ArtistOrderByInput
  someDate_ASC?: ArtistOrderByInput
  someDate_DESC?: ArtistOrderByInput
  someOptionalDate_ASC?: ArtistOrderByInput
  someOptionalDate_DESC?: ArtistOrderByInput
}


export type GenreWhereUniqueInput = {
  id?: string
  GenreId?: number
}


export type GenreOrderByInput = {
  id_ASC?: GenreOrderByInput
  id_DESC?: GenreOrderByInput
  GenreId_ASC?: GenreOrderByInput
  GenreId_DESC?: GenreOrderByInput
  Name_ASC?: GenreOrderByInput
  Name_DESC?: GenreOrderByInput
}


export type MediaTypeWhereUniqueInput = {
  id?: string
  MediaTypeId?: number
}


export type MediaTypeOrderByInput = {
  id_ASC?: MediaTypeOrderByInput
  id_DESC?: MediaTypeOrderByInput
  MediaTypeId_ASC?: MediaTypeOrderByInput
  MediaTypeId_DESC?: MediaTypeOrderByInput
  Name_ASC?: MediaTypeOrderByInput
  Name_DESC?: MediaTypeOrderByInput
}


export type TrackWhereUniqueInput = {
  id?: string
  TrackId?: number
}


export type AlbumCreateInput = {
  id?: string
  AlbumId: number
  Title: string
  Artist: ArtistCreateOneWithoutAlbumsInput
  Tracks?: TrackCreateManyWithoutAlbumInput
}


export type ArtistCreateOneWithoutAlbumsInput = {
  create?: ArtistCreateWithoutAlbumsInput
  connect?: ArtistWhereUniqueInput
}


export type ArtistCreateWithoutAlbumsInput = {
  id?: string
  ArtistId: number
  Name: string
  someDate: string
  someOptionalDate?: string
}


export type TrackCreateManyWithoutAlbumInput = {
  create?: TrackCreateWithoutAlbumInput[]
  connect?: TrackWhereUniqueInput[]
}


export type TrackCreateWithoutAlbumInput = {
  id?: string
  TrackId: number
  Name: string
  MediaType: MediaTypeCreateOneWithoutTracksInput
  Genre: GenreCreateOneWithoutTracksInput
  Composer?: string
  Milliseconds: number
  Bytes: number
  UnitPrice: number
}


export type MediaTypeCreateOneWithoutTracksInput = {
  create?: MediaTypeCreateWithoutTracksInput
  connect?: MediaTypeWhereUniqueInput
}


export type MediaTypeCreateWithoutTracksInput = {
  id?: string
  MediaTypeId: number
  Name: string
}


export type GenreCreateOneWithoutTracksInput = {
  create?: GenreCreateWithoutTracksInput
  connect?: GenreWhereUniqueInput
}


export type GenreCreateWithoutTracksInput = {
  id?: string
  GenreId: number
  Name: string
}


export type AlbumUpdateInput = {
  AlbumId?: number
  Title?: string
  Artist?: ArtistUpdateOneRequiredWithoutAlbumsInput
  Tracks?: TrackUpdateManyWithoutAlbumInput
}


export type ArtistUpdateOneRequiredWithoutAlbumsInput = {
  create?: ArtistCreateWithoutAlbumsInput
  update?: ArtistUpdateWithoutAlbumsDataInput
  upsert?: ArtistUpsertWithoutAlbumsInput
  connect?: ArtistWhereUniqueInput
}


export type ArtistUpdateWithoutAlbumsDataInput = {
  ArtistId?: number
  Name?: string
  someDate?: string
  someOptionalDate?: string
}


export type ArtistUpsertWithoutAlbumsInput = {
  update: ArtistUpdateWithoutAlbumsDataInput
  create: ArtistCreateWithoutAlbumsInput
}


export type TrackUpdateManyWithoutAlbumInput = {
  create?: TrackCreateWithoutAlbumInput[]
  delete?: TrackWhereUniqueInput[]
  connect?: TrackWhereUniqueInput[]
  set?: TrackWhereUniqueInput[]
  disconnect?: TrackWhereUniqueInput[]
  update?: TrackUpdateWithWhereUniqueWithoutAlbumInput[]
  upsert?: TrackUpsertWithWhereUniqueWithoutAlbumInput[]
  deleteMany?: TrackScalarWhereInput[]
  updateMany?: TrackUpdateManyWithWhereNestedInput[]
}


export type TrackUpdateWithWhereUniqueWithoutAlbumInput = {
  where: TrackWhereUniqueInput
  data: TrackUpdateWithoutAlbumDataInput
}


export type TrackUpdateWithoutAlbumDataInput = {
  TrackId?: number
  Name?: string
  MediaType?: MediaTypeUpdateOneRequiredWithoutTracksInput
  Genre?: GenreUpdateOneRequiredWithoutTracksInput
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


export type MediaTypeUpdateOneRequiredWithoutTracksInput = {
  create?: MediaTypeCreateWithoutTracksInput
  update?: MediaTypeUpdateWithoutTracksDataInput
  upsert?: MediaTypeUpsertWithoutTracksInput
  connect?: MediaTypeWhereUniqueInput
}


export type MediaTypeUpdateWithoutTracksDataInput = {
  MediaTypeId?: number
  Name?: string
}


export type MediaTypeUpsertWithoutTracksInput = {
  update: MediaTypeUpdateWithoutTracksDataInput
  create: MediaTypeCreateWithoutTracksInput
}


export type GenreUpdateOneRequiredWithoutTracksInput = {
  create?: GenreCreateWithoutTracksInput
  update?: GenreUpdateWithoutTracksDataInput
  upsert?: GenreUpsertWithoutTracksInput
  connect?: GenreWhereUniqueInput
}


export type GenreUpdateWithoutTracksDataInput = {
  GenreId?: number
  Name?: string
}


export type GenreUpsertWithoutTracksInput = {
  update: GenreUpdateWithoutTracksDataInput
  create: GenreCreateWithoutTracksInput
}


export type TrackUpsertWithWhereUniqueWithoutAlbumInput = {
  where: TrackWhereUniqueInput
  update: TrackUpdateWithoutAlbumDataInput
  create: TrackCreateWithoutAlbumInput
}


export type TrackScalarWhereInput = {
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
  TrackId?: number
  TrackId_not?: number
  TrackId_in?: number[]
  TrackId_not_in?: number[]
  TrackId_lt?: number
  TrackId_lte?: number
  TrackId_gt?: number
  TrackId_gte?: number
  Name?: string
  Name_not?: string
  Name_in?: string[]
  Name_not_in?: string[]
  Name_lt?: string
  Name_lte?: string
  Name_gt?: string
  Name_gte?: string
  Name_contains?: string
  Name_not_contains?: string
  Name_starts_with?: string
  Name_not_starts_with?: string
  Name_ends_with?: string
  Name_not_ends_with?: string
  Composer?: string
  Composer_not?: string
  Composer_in?: string[]
  Composer_not_in?: string[]
  Composer_lt?: string
  Composer_lte?: string
  Composer_gt?: string
  Composer_gte?: string
  Composer_contains?: string
  Composer_not_contains?: string
  Composer_starts_with?: string
  Composer_not_starts_with?: string
  Composer_ends_with?: string
  Composer_not_ends_with?: string
  Milliseconds?: number
  Milliseconds_not?: number
  Milliseconds_in?: number[]
  Milliseconds_not_in?: number[]
  Milliseconds_lt?: number
  Milliseconds_lte?: number
  Milliseconds_gt?: number
  Milliseconds_gte?: number
  Bytes?: number
  Bytes_not?: number
  Bytes_in?: number[]
  Bytes_not_in?: number[]
  Bytes_lt?: number
  Bytes_lte?: number
  Bytes_gt?: number
  Bytes_gte?: number
  UnitPrice?: number
  UnitPrice_not?: number
  UnitPrice_in?: number[]
  UnitPrice_not_in?: number[]
  UnitPrice_lt?: number
  UnitPrice_lte?: number
  UnitPrice_gt?: number
  UnitPrice_gte?: number
  AND?: TrackScalarWhereInput[]
  OR?: TrackScalarWhereInput[]
  NOT?: TrackScalarWhereInput[]
}


export type TrackUpdateManyWithWhereNestedInput = {
  where: TrackScalarWhereInput
  data: TrackUpdateManyDataInput
}


export type TrackUpdateManyDataInput = {
  TrackId?: number
  Name?: string
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


export type AlbumUpdateManyMutationInput = {
  AlbumId?: number
  Title?: string
}


export type ArtistCreateInput = {
  id?: string
  ArtistId: number
  Name: string
  Albums?: AlbumCreateManyWithoutArtistInput
  someDate: string
  someOptionalDate?: string
}


export type AlbumCreateManyWithoutArtistInput = {
  create?: AlbumCreateWithoutArtistInput[]
  connect?: AlbumWhereUniqueInput[]
}


export type AlbumCreateWithoutArtistInput = {
  id?: string
  AlbumId: number
  Title: string
  Tracks?: TrackCreateManyWithoutAlbumInput
}


export type ArtistUpdateInput = {
  ArtistId?: number
  Name?: string
  Albums?: AlbumUpdateManyWithoutArtistInput
  someDate?: string
  someOptionalDate?: string
}


export type AlbumUpdateManyWithoutArtistInput = {
  create?: AlbumCreateWithoutArtistInput[]
  delete?: AlbumWhereUniqueInput[]
  connect?: AlbumWhereUniqueInput[]
  set?: AlbumWhereUniqueInput[]
  disconnect?: AlbumWhereUniqueInput[]
  update?: AlbumUpdateWithWhereUniqueWithoutArtistInput[]
  upsert?: AlbumUpsertWithWhereUniqueWithoutArtistInput[]
  deleteMany?: AlbumScalarWhereInput[]
  updateMany?: AlbumUpdateManyWithWhereNestedInput[]
}


export type AlbumUpdateWithWhereUniqueWithoutArtistInput = {
  where: AlbumWhereUniqueInput
  data: AlbumUpdateWithoutArtistDataInput
}


export type AlbumUpdateWithoutArtistDataInput = {
  AlbumId?: number
  Title?: string
  Tracks?: TrackUpdateManyWithoutAlbumInput
}


export type AlbumUpsertWithWhereUniqueWithoutArtistInput = {
  where: AlbumWhereUniqueInput
  update: AlbumUpdateWithoutArtistDataInput
  create: AlbumCreateWithoutArtistInput
}


export type AlbumScalarWhereInput = {
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
  AlbumId?: number
  AlbumId_not?: number
  AlbumId_in?: number[]
  AlbumId_not_in?: number[]
  AlbumId_lt?: number
  AlbumId_lte?: number
  AlbumId_gt?: number
  AlbumId_gte?: number
  Title?: string
  Title_not?: string
  Title_in?: string[]
  Title_not_in?: string[]
  Title_lt?: string
  Title_lte?: string
  Title_gt?: string
  Title_gte?: string
  Title_contains?: string
  Title_not_contains?: string
  Title_starts_with?: string
  Title_not_starts_with?: string
  Title_ends_with?: string
  Title_not_ends_with?: string
  AND?: AlbumScalarWhereInput[]
  OR?: AlbumScalarWhereInput[]
  NOT?: AlbumScalarWhereInput[]
}


export type AlbumUpdateManyWithWhereNestedInput = {
  where: AlbumScalarWhereInput
  data: AlbumUpdateManyDataInput
}


export type AlbumUpdateManyDataInput = {
  AlbumId?: number
  Title?: string
}


export type ArtistUpdateManyMutationInput = {
  ArtistId?: number
  Name?: string
  someDate?: string
  someOptionalDate?: string
}


export type GenreCreateInput = {
  id?: string
  GenreId: number
  Name: string
  Tracks?: TrackCreateManyWithoutGenreInput
}


export type TrackCreateManyWithoutGenreInput = {
  create?: TrackCreateWithoutGenreInput[]
  connect?: TrackWhereUniqueInput[]
}


export type TrackCreateWithoutGenreInput = {
  id?: string
  TrackId: number
  Name: string
  Album: AlbumCreateOneWithoutTracksInput
  MediaType: MediaTypeCreateOneWithoutTracksInput
  Composer?: string
  Milliseconds: number
  Bytes: number
  UnitPrice: number
}


export type AlbumCreateOneWithoutTracksInput = {
  create?: AlbumCreateWithoutTracksInput
  connect?: AlbumWhereUniqueInput
}


export type AlbumCreateWithoutTracksInput = {
  id?: string
  AlbumId: number
  Title: string
  Artist: ArtistCreateOneWithoutAlbumsInput
}


export type GenreUpdateInput = {
  GenreId?: number
  Name?: string
  Tracks?: TrackUpdateManyWithoutGenreInput
}


export type TrackUpdateManyWithoutGenreInput = {
  create?: TrackCreateWithoutGenreInput[]
  delete?: TrackWhereUniqueInput[]
  connect?: TrackWhereUniqueInput[]
  set?: TrackWhereUniqueInput[]
  disconnect?: TrackWhereUniqueInput[]
  update?: TrackUpdateWithWhereUniqueWithoutGenreInput[]
  upsert?: TrackUpsertWithWhereUniqueWithoutGenreInput[]
  deleteMany?: TrackScalarWhereInput[]
  updateMany?: TrackUpdateManyWithWhereNestedInput[]
}


export type TrackUpdateWithWhereUniqueWithoutGenreInput = {
  where: TrackWhereUniqueInput
  data: TrackUpdateWithoutGenreDataInput
}


export type TrackUpdateWithoutGenreDataInput = {
  TrackId?: number
  Name?: string
  Album?: AlbumUpdateOneRequiredWithoutTracksInput
  MediaType?: MediaTypeUpdateOneRequiredWithoutTracksInput
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


export type AlbumUpdateOneRequiredWithoutTracksInput = {
  create?: AlbumCreateWithoutTracksInput
  update?: AlbumUpdateWithoutTracksDataInput
  upsert?: AlbumUpsertWithoutTracksInput
  connect?: AlbumWhereUniqueInput
}


export type AlbumUpdateWithoutTracksDataInput = {
  AlbumId?: number
  Title?: string
  Artist?: ArtistUpdateOneRequiredWithoutAlbumsInput
}


export type AlbumUpsertWithoutTracksInput = {
  update: AlbumUpdateWithoutTracksDataInput
  create: AlbumCreateWithoutTracksInput
}


export type TrackUpsertWithWhereUniqueWithoutGenreInput = {
  where: TrackWhereUniqueInput
  update: TrackUpdateWithoutGenreDataInput
  create: TrackCreateWithoutGenreInput
}


export type GenreUpdateManyMutationInput = {
  GenreId?: number
  Name?: string
}


export type MediaTypeCreateInput = {
  id?: string
  MediaTypeId: number
  Name: string
  Tracks?: TrackCreateManyWithoutMediaTypeInput
}


export type TrackCreateManyWithoutMediaTypeInput = {
  create?: TrackCreateWithoutMediaTypeInput[]
  connect?: TrackWhereUniqueInput[]
}


export type TrackCreateWithoutMediaTypeInput = {
  id?: string
  TrackId: number
  Name: string
  Album: AlbumCreateOneWithoutTracksInput
  Genre: GenreCreateOneWithoutTracksInput
  Composer?: string
  Milliseconds: number
  Bytes: number
  UnitPrice: number
}


export type MediaTypeUpdateInput = {
  MediaTypeId?: number
  Name?: string
  Tracks?: TrackUpdateManyWithoutMediaTypeInput
}


export type TrackUpdateManyWithoutMediaTypeInput = {
  create?: TrackCreateWithoutMediaTypeInput[]
  delete?: TrackWhereUniqueInput[]
  connect?: TrackWhereUniqueInput[]
  set?: TrackWhereUniqueInput[]
  disconnect?: TrackWhereUniqueInput[]
  update?: TrackUpdateWithWhereUniqueWithoutMediaTypeInput[]
  upsert?: TrackUpsertWithWhereUniqueWithoutMediaTypeInput[]
  deleteMany?: TrackScalarWhereInput[]
  updateMany?: TrackUpdateManyWithWhereNestedInput[]
}


export type TrackUpdateWithWhereUniqueWithoutMediaTypeInput = {
  where: TrackWhereUniqueInput
  data: TrackUpdateWithoutMediaTypeDataInput
}


export type TrackUpdateWithoutMediaTypeDataInput = {
  TrackId?: number
  Name?: string
  Album?: AlbumUpdateOneRequiredWithoutTracksInput
  Genre?: GenreUpdateOneRequiredWithoutTracksInput
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


export type TrackUpsertWithWhereUniqueWithoutMediaTypeInput = {
  where: TrackWhereUniqueInput
  update: TrackUpdateWithoutMediaTypeDataInput
  create: TrackCreateWithoutMediaTypeInput
}


export type MediaTypeUpdateManyMutationInput = {
  MediaTypeId?: number
  Name?: string
}


export type TrackCreateInput = {
  id?: string
  TrackId: number
  Name: string
  Album: AlbumCreateOneWithoutTracksInput
  MediaType: MediaTypeCreateOneWithoutTracksInput
  Genre: GenreCreateOneWithoutTracksInput
  Composer?: string
  Milliseconds: number
  Bytes: number
  UnitPrice: number
}


export type TrackUpdateInput = {
  TrackId?: number
  Name?: string
  Album?: AlbumUpdateOneRequiredWithoutTracksInput
  MediaType?: MediaTypeUpdateOneRequiredWithoutTracksInput
  Genre?: GenreUpdateOneRequiredWithoutTracksInput
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


export type TrackUpdateManyMutationInput = {
  TrackId?: number
  Name?: string
  Composer?: string
  Milliseconds?: number
  Bytes?: number
  UnitPrice?: number
}


/**
 * DMMF
 */

const dmmf: DMMF.Document = {
  "datamodel": {
    "models": [
      {
        "name": "Artist",
        "isEmbedded": false,
        "isEnum": false,
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
            "name": "ArtistId",
            "isUnique": true,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Name",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Albums",
            "isUnique": false,
            "isId": false,
            "type": "Album",
            "isList": true,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "someDate",
            "isUnique": false,
            "isId": false,
            "type": "DateTime",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "someOptionalDate",
            "isUnique": false,
            "isId": false,
            "type": "DateTime",
            "isList": false,
            "isRequired": false
          }
        ]
      },
      {
        "name": "Album",
        "isEmbedded": false,
        "isEnum": false,
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
            "name": "AlbumId",
            "isUnique": true,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Title",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Artist",
            "isUnique": false,
            "isId": false,
            "type": "Artist",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Tracks",
            "isUnique": false,
            "isId": false,
            "type": "Track",
            "isList": true,
            "isRequired": false
          }
        ]
      },
      {
        "name": "Track",
        "isEmbedded": false,
        "isEnum": false,
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
            "name": "TrackId",
            "isUnique": true,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Name",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Album",
            "isUnique": false,
            "isId": false,
            "type": "Album",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "MediaType",
            "isUnique": false,
            "isId": false,
            "type": "MediaType",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Genre",
            "isUnique": false,
            "isId": false,
            "type": "Genre",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Composer",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": false
          },
          {
            "kind": "scalar",
            "name": "Milliseconds",
            "isUnique": false,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Bytes",
            "isUnique": false,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "UnitPrice",
            "isUnique": false,
            "isId": false,
            "type": "Float",
            "isList": false,
            "isRequired": true
          }
        ]
      },
      {
        "name": "Genre",
        "isEmbedded": false,
        "isEnum": false,
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
            "name": "GenreId",
            "isUnique": true,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Name",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Tracks",
            "isUnique": false,
            "isId": false,
            "type": "Track",
            "isList": true,
            "isRequired": false
          }
        ]
      },
      {
        "name": "MediaType",
        "isEmbedded": false,
        "isEnum": false,
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
            "name": "MediaTypeId",
            "isUnique": true,
            "isId": false,
            "type": "Int",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "scalar",
            "name": "Name",
            "isUnique": false,
            "isId": false,
            "type": "String",
            "isList": false,
            "isRequired": true
          },
          {
            "kind": "relation",
            "name": "Tracks",
            "isUnique": false,
            "isId": false,
            "type": "Track",
            "isList": true,
            "isRequired": false
          }
        ]
      }
    ]
  },
  "schema": {
    "queries": [
      {
        "name": "album",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "albums",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "albumsConnection",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "AlbumConnection",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "artist",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "artists",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "artistsConnection",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "ArtistConnection",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "genre",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "genres",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "genresConnection",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "GenreConnection",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "mediaType",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "mediaTypes",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "mediaTypesConnection",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaTypeConnection",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "track",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "tracks",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": true,
          "isRequired": true
        }
      },
      {
        "name": "tracksConnection",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "orderBy",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "skip",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "after",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "before",
            "type": "String",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "first",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          },
          {
            "name": "last",
            "type": "Int",
            "isRequired": false,
            "isScalar": true,
            "isList": false
          }
        ],
        "output": {
          "name": "TrackConnection",
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
            "isList": false
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
        "name": "createAlbum",
        "args": [
          {
            "name": "data",
            "type": "AlbumCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateAlbum",
        "args": [
          {
            "name": "data",
            "type": "AlbumUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyAlbums",
        "args": [
          {
            "name": "data",
            "type": "AlbumUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "AlbumWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertAlbum",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "create",
            "type": "AlbumCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "update",
            "type": "AlbumUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteAlbum",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Album",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyAlbums",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "createArtist",
        "args": [
          {
            "name": "data",
            "type": "ArtistCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateArtist",
        "args": [
          {
            "name": "data",
            "type": "ArtistUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "ArtistWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyArtists",
        "args": [
          {
            "name": "data",
            "type": "ArtistUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "ArtistWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertArtist",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "create",
            "type": "ArtistCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "update",
            "type": "ArtistUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteArtist",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Artist",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyArtists",
        "args": [
          {
            "name": "where",
            "type": "ArtistWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "createGenre",
        "args": [
          {
            "name": "data",
            "type": "GenreCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateGenre",
        "args": [
          {
            "name": "data",
            "type": "GenreUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "GenreWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyGenres",
        "args": [
          {
            "name": "data",
            "type": "GenreUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "GenreWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertGenre",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "create",
            "type": "GenreCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "update",
            "type": "GenreUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteGenre",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Genre",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyGenres",
        "args": [
          {
            "name": "where",
            "type": "GenreWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "createMediaType",
        "args": [
          {
            "name": "data",
            "type": "MediaTypeCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateMediaType",
        "args": [
          {
            "name": "data",
            "type": "MediaTypeUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "MediaTypeWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyMediaTypes",
        "args": [
          {
            "name": "data",
            "type": "MediaTypeUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "MediaTypeWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertMediaType",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "create",
            "type": "MediaTypeCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "update",
            "type": "MediaTypeUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteMediaType",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "MediaType",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyMediaTypes",
        "args": [
          {
            "name": "where",
            "type": "MediaTypeWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "createTrack",
        "args": [
          {
            "name": "data",
            "type": "TrackCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "updateTrack",
        "args": [
          {
            "name": "data",
            "type": "TrackUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "updateManyTracks",
        "args": [
          {
            "name": "data",
            "type": "TrackUpdateManyMutationInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "where",
            "type": "TrackWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "BatchPayload",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "upsertTrack",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "create",
            "type": "TrackCreateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          },
          {
            "name": "update",
            "type": "TrackUpdateInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": false,
          "isRequired": true
        }
      },
      {
        "name": "deleteTrack",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isRequired": true,
            "isScalar": false,
            "isList": false
          }
        ],
        "output": {
          "name": "Track",
          "isList": false,
          "isRequired": false
        }
      },
      {
        "name": "deleteManyTracks",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereInput",
            "isRequired": false,
            "isScalar": false,
            "isList": false
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
        "name": "AlbumWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Artist",
            "type": "ArtistWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_every",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_some",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_none",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "AlbumWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "AlbumWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "AlbumWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Albums_every",
            "type": "AlbumWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Albums_some",
            "type": "AlbumWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Albums_none",
            "type": "AlbumWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_not",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_not_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_lt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_lte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_gt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate_gte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_not",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_not_in",
            "type": "DateTime",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_lt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_lte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_gt",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_gte",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AND",
            "type": "ArtistWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "ArtistWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "ArtistWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "MediaType",
            "type": "MediaTypeWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_not",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_not_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_lt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_lte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_gt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_gte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AND",
            "type": "TrackWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "TrackWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "TrackWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MediaTypeWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Tracks_every",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_some",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_none",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "MediaTypeWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "MediaTypeWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "MediaTypeWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Tracks_every",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_some",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks_none",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "GenreWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "GenreWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "GenreWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumOrderByInput",
        "args": [
          {
            "name": "id_ASC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "id_DESC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_ASC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_DESC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Title_ASC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Title_DESC",
            "type": "AlbumOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackOrderByInput",
        "args": [
          {
            "name": "id_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "id_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "TrackId_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "TrackId_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Composer_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Composer_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Bytes_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Bytes_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_ASC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_DESC",
            "type": "TrackOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistOrderByInput",
        "args": [
          {
            "name": "id_ASC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "id_DESC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_ASC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "ArtistId_DESC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_ASC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_DESC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "someDate_ASC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "someDate_DESC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_ASC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate_DESC",
            "type": "ArtistOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "GenreWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "GenreOrderByInput",
        "args": [
          {
            "name": "id_ASC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "id_DESC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "GenreId_ASC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "GenreId_DESC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_ASC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_DESC",
            "type": "GenreOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeOrderByInput",
        "args": [
          {
            "name": "id_ASC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "id_DESC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_ASC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId_DESC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_ASC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "Name_DESC",
            "type": "MediaTypeOrderByInput",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackWhereUniqueInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Artist",
            "type": "ArtistCreateOneWithoutAlbumsInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Tracks",
            "type": "TrackCreateManyWithoutAlbumInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistCreateOneWithoutAlbumsInput",
        "args": [
          {
            "name": "create",
            "type": "ArtistCreateWithoutAlbumsInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "ArtistWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistCreateWithoutAlbumsInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackCreateManyWithoutAlbumInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutAlbumInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackCreateWithoutAlbumInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "MediaType",
            "type": "MediaTypeCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeCreateOneWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "MediaTypeCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "MediaTypeWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MediaTypeCreateWithoutTracksInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "GenreCreateOneWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "GenreCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "GenreWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreCreateWithoutTracksInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumUpdateInput",
        "args": [
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Artist",
            "type": "ArtistUpdateOneRequiredWithoutAlbumsInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Tracks",
            "type": "TrackUpdateManyWithoutAlbumInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistUpdateOneRequiredWithoutAlbumsInput",
        "args": [
          {
            "name": "create",
            "type": "ArtistCreateWithoutAlbumsInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "ArtistUpdateWithoutAlbumsDataInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "ArtistUpsertWithoutAlbumsInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "ArtistWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistUpdateWithoutAlbumsDataInput",
        "args": [
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistUpsertWithoutAlbumsInput",
        "args": [
          {
            "name": "update",
            "type": "ArtistUpdateWithoutAlbumsDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "ArtistCreateWithoutAlbumsInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateManyWithoutAlbumInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutAlbumInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "delete",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "set",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "disconnect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithWhereUniqueWithoutAlbumInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "TrackUpsertWithWhereUniqueWithoutAlbumInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "deleteMany",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updateMany",
            "type": "TrackUpdateManyWithWhereNestedInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithWhereUniqueWithoutAlbumInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "TrackUpdateWithoutAlbumDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithoutAlbumDataInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaType",
            "type": "MediaTypeUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeUpdateOneRequiredWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "MediaTypeCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "MediaTypeUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "MediaTypeUpsertWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "MediaTypeWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MediaTypeUpdateWithoutTracksDataInput",
        "args": [
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeUpsertWithoutTracksInput",
        "args": [
          {
            "name": "update",
            "type": "MediaTypeUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "MediaTypeCreateWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreUpdateOneRequiredWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "GenreCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "GenreUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "GenreUpsertWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "GenreWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreUpdateWithoutTracksDataInput",
        "args": [
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "GenreUpsertWithoutTracksInput",
        "args": [
          {
            "name": "update",
            "type": "GenreUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "GenreCreateWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpsertWithWhereUniqueWithoutAlbumInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithoutAlbumDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "TrackCreateWithoutAlbumInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackScalarWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_not",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_not_in",
            "type": "Float",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_lt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_lte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_gt",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice_gte",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AND",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateManyWithWhereNestedInput",
        "args": [
          {
            "name": "where",
            "type": "TrackScalarWhereInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "TrackUpdateManyDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateManyDataInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumUpdateManyMutationInput",
        "args": [
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Albums",
            "type": "AlbumCreateManyWithoutArtistInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumCreateManyWithoutArtistInput",
        "args": [
          {
            "name": "create",
            "type": "AlbumCreateWithoutArtistInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "AlbumWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumCreateWithoutArtistInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackCreateManyWithoutAlbumInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "ArtistUpdateInput",
        "args": [
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Albums",
            "type": "AlbumUpdateManyWithoutArtistInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumUpdateManyWithoutArtistInput",
        "args": [
          {
            "name": "create",
            "type": "AlbumCreateWithoutArtistInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "delete",
            "type": "AlbumWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "AlbumWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "set",
            "type": "AlbumWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "disconnect",
            "type": "AlbumWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "AlbumUpdateWithWhereUniqueWithoutArtistInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "AlbumUpsertWithWhereUniqueWithoutArtistInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "deleteMany",
            "type": "AlbumScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updateMany",
            "type": "AlbumUpdateManyWithWhereNestedInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpdateWithWhereUniqueWithoutArtistInput",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "AlbumUpdateWithoutArtistDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpdateWithoutArtistDataInput",
        "args": [
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackUpdateManyWithoutAlbumInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpsertWithWhereUniqueWithoutArtistInput",
        "args": [
          {
            "name": "where",
            "type": "AlbumWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "AlbumUpdateWithoutArtistDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "AlbumCreateWithoutArtistInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumScalarWhereInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_in",
            "type": "ID",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_lte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gt",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_gte",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_contains",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_starts_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "id_not_ends_with",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_not",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_not_in",
            "type": "Int",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_lt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_lte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_gt",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId_gte",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_in",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_lt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_lte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_gt",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_gte",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_starts_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title_not_ends_with",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AND",
            "type": "AlbumScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "AlbumScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "AlbumScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpdateManyWithWhereNestedInput",
        "args": [
          {
            "name": "where",
            "type": "AlbumScalarWhereInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "AlbumUpdateManyDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpdateManyDataInput",
        "args": [
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistUpdateManyMutationInput",
        "args": [
          {
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "GenreCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackCreateManyWithoutGenreInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackCreateManyWithoutGenreInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutGenreInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackCreateWithoutGenreInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "MediaType",
            "type": "MediaTypeCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumCreateOneWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "AlbumCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "AlbumWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumCreateWithoutTracksInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Artist",
            "type": "ArtistCreateOneWithoutAlbumsInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreUpdateInput",
        "args": [
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackUpdateManyWithoutGenreInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateManyWithoutGenreInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutGenreInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "delete",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "set",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "disconnect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithWhereUniqueWithoutGenreInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "TrackUpsertWithWhereUniqueWithoutGenreInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "deleteMany",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updateMany",
            "type": "TrackUpdateManyWithWhereNestedInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithWhereUniqueWithoutGenreInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "TrackUpdateWithoutGenreDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithoutGenreDataInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "MediaType",
            "type": "MediaTypeUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumUpdateOneRequiredWithoutTracksInput",
        "args": [
          {
            "name": "create",
            "type": "AlbumCreateWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "AlbumUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "AlbumUpsertWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "AlbumWhereUniqueInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpdateWithoutTracksDataInput",
        "args": [
          {
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Artist",
            "type": "ArtistUpdateOneRequiredWithoutAlbumsInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "AlbumUpsertWithoutTracksInput",
        "args": [
          {
            "name": "update",
            "type": "AlbumUpdateWithoutTracksDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "AlbumCreateWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpsertWithWhereUniqueWithoutGenreInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithoutGenreDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "TrackCreateWithoutGenreInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreUpdateManyMutationInput",
        "args": [
          {
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackCreateManyWithoutMediaTypeInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackCreateManyWithoutMediaTypeInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutMediaTypeInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackCreateWithoutMediaTypeInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "MediaTypeUpdateInput",
        "args": [
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Tracks",
            "type": "TrackUpdateManyWithoutMediaTypeInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateManyWithoutMediaTypeInput",
        "args": [
          {
            "name": "create",
            "type": "TrackCreateWithoutMediaTypeInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "delete",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "connect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "set",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "disconnect",
            "type": "TrackWhereUniqueInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithWhereUniqueWithoutMediaTypeInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "upsert",
            "type": "TrackUpsertWithWhereUniqueWithoutMediaTypeInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "deleteMany",
            "type": "TrackScalarWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updateMany",
            "type": "TrackUpdateManyWithWhereNestedInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithWhereUniqueWithoutMediaTypeInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "data",
            "type": "TrackUpdateWithoutMediaTypeDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackUpdateWithoutMediaTypeDataInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackUpsertWithWhereUniqueWithoutMediaTypeInput",
        "args": [
          {
            "name": "where",
            "type": "TrackWhereUniqueInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "update",
            "type": "TrackUpdateWithoutMediaTypeDataInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "create",
            "type": "TrackCreateWithoutMediaTypeInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MediaTypeUpdateManyMutationInput",
        "args": [
          {
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackCreateInput",
        "args": [
          {
            "name": "id",
            "type": "ID",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "MediaType",
            "type": "MediaTypeCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreCreateOneWithoutTracksInput",
            "isList": false,
            "isRequired": true,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackUpdateInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Album",
            "type": "AlbumUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "MediaType",
            "type": "MediaTypeUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Genre",
            "type": "GenreUpdateOneRequiredWithoutTracksInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "TrackUpdateManyMutationInput",
        "args": [
          {
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "AlbumSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "AlbumWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "AlbumSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "AlbumSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "AlbumSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MutationType",
        "args": [
          {
            "name": "CREATED",
            "type": "MutationType",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "UPDATED",
            "type": "MutationType",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          },
          {
            "name": "DELETED",
            "type": "MutationType",
            "isRequired": false,
            "isList": false,
            "isScalar": true
          }
        ]
      },
      {
        "name": "ArtistSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "ArtistWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "ArtistSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "ArtistSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "ArtistSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "GenreSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "GenreWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "GenreSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "GenreSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "GenreSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "MediaTypeSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "MediaTypeWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "MediaTypeSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "MediaTypeSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "MediaTypeSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          }
        ]
      },
      {
        "name": "TrackSubscriptionWhereInput",
        "args": [
          {
            "name": "mutation_in",
            "type": "MutationType",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "updatedFields_contains",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_every",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "updatedFields_contains_some",
            "type": "String",
            "isList": true,
            "isRequired": false,
            "isScalar": true
          },
          {
            "name": "node",
            "type": "TrackWhereInput",
            "isList": false,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "AND",
            "type": "TrackSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "OR",
            "type": "TrackSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
            "isScalar": false
          },
          {
            "name": "NOT",
            "type": "TrackSubscriptionWhereInput",
            "isList": true,
            "isRequired": false,
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
            "name": "album",
            "type": "Album",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "albums",
            "type": "Album",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "AlbumOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "albumsConnection",
            "type": "AlbumConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "AlbumOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "artist",
            "type": "Artist",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "artists",
            "type": "Artist",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "ArtistOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "artistsConnection",
            "type": "ArtistConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "ArtistOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "genre",
            "type": "Genre",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "genres",
            "type": "Genre",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "GenreOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "genresConnection",
            "type": "GenreConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "GenreOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "mediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "mediaTypes",
            "type": "MediaType",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "MediaTypeOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "mediaTypesConnection",
            "type": "MediaTypeConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "MediaTypeOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "track",
            "type": "Track",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "tracks",
            "type": "Track",
            "isList": true,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "TrackOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "tracksConnection",
            "type": "TrackConnection",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "TrackOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
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
                "isList": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "Album",
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
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Artist",
            "type": "Artist",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "Tracks",
            "type": "Track",
            "isList": true,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "TrackOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "Artist",
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
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Albums",
            "type": "Album",
            "isList": true,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "AlbumOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "Track",
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
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Album",
            "type": "Album",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "MediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "Genre",
            "type": "Genre",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "MediaType",
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
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Tracks",
            "type": "Track",
            "isList": true,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "TrackOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "Genre",
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
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Tracks",
            "type": "Track",
            "isList": true,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "orderBy",
                "type": "TrackOrderByInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "skip",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "after",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "before",
                "type": "String",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "first",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              },
              {
                "name": "last",
                "type": "Int",
                "isRequired": false,
                "isScalar": true,
                "isList": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "AlbumConnection",
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
            "type": "AlbumEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateAlbum",
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
        "name": "AlbumEdge",
        "fields": [
          {
            "name": "node",
            "type": "Album",
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
        "name": "AggregateAlbum",
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
        "name": "ArtistConnection",
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
            "type": "ArtistEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateArtist",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "ArtistEdge",
        "fields": [
          {
            "name": "node",
            "type": "Artist",
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
        "name": "AggregateArtist",
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
        "name": "GenreConnection",
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
            "type": "GenreEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateGenre",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "GenreEdge",
        "fields": [
          {
            "name": "node",
            "type": "Genre",
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
        "name": "AggregateGenre",
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
        "name": "MediaTypeConnection",
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
            "type": "MediaTypeEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateMediaType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "MediaTypeEdge",
        "fields": [
          {
            "name": "node",
            "type": "MediaType",
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
        "name": "AggregateMediaType",
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
        "name": "TrackConnection",
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
            "type": "TrackEdge",
            "isList": true,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "aggregate",
            "type": "AggregateTrack",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "TrackEdge",
        "fields": [
          {
            "name": "node",
            "type": "Track",
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
        "name": "AggregateTrack",
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
            "name": "createAlbum",
            "type": "Album",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "AlbumCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateAlbum",
            "type": "Album",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "AlbumUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "AlbumWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyAlbums",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "AlbumUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "AlbumWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertAlbum",
            "type": "Album",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "create",
                "type": "AlbumCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "update",
                "type": "AlbumUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteAlbum",
            "type": "Album",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyAlbums",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "AlbumWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "createArtist",
            "type": "Artist",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "ArtistCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateArtist",
            "type": "Artist",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "ArtistUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "ArtistWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyArtists",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "ArtistUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "ArtistWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertArtist",
            "type": "Artist",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "create",
                "type": "ArtistCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "update",
                "type": "ArtistUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteArtist",
            "type": "Artist",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyArtists",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "ArtistWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "createGenre",
            "type": "Genre",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "GenreCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateGenre",
            "type": "Genre",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "GenreUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "GenreWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyGenres",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "GenreUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "GenreWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertGenre",
            "type": "Genre",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "create",
                "type": "GenreCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "update",
                "type": "GenreUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteGenre",
            "type": "Genre",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyGenres",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "GenreWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "createMediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "MediaTypeCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateMediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "MediaTypeUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "MediaTypeWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyMediaTypes",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "MediaTypeUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "MediaTypeWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertMediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "create",
                "type": "MediaTypeCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "update",
                "type": "MediaTypeUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteMediaType",
            "type": "MediaType",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyMediaTypes",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "createTrack",
            "type": "Track",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "TrackCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateTrack",
            "type": "Track",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "data",
                "type": "TrackUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "TrackWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "updateManyTracks",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "data",
                "type": "TrackUpdateManyMutationInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "upsertTrack",
            "type": "Track",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "create",
                "type": "TrackCreateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              },
              {
                "name": "update",
                "type": "TrackUpdateInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteTrack",
            "type": "Track",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereUniqueInput",
                "isRequired": true,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "deleteManyTracks",
            "type": "BatchPayload",
            "isList": false,
            "isRequired": true,
            "args": [
              {
                "name": "where",
                "type": "TrackWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
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
            "name": "album",
            "type": "AlbumSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "AlbumSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "artist",
            "type": "ArtistSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "ArtistSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "genre",
            "type": "GenreSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "GenreSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "mediaType",
            "type": "MediaTypeSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "MediaTypeSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          },
          {
            "name": "track",
            "type": "TrackSubscriptionPayload",
            "isList": false,
            "isRequired": false,
            "args": [
              {
                "name": "where",
                "type": "TrackSubscriptionWhereInput",
                "isRequired": false,
                "isScalar": false,
                "isList": false
              }
            ],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "AlbumSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "Album",
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
            "type": "AlbumPreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "AlbumPreviousValues",
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
            "name": "AlbumId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Title",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "ArtistSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "Artist",
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
            "type": "ArtistPreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "ArtistPreviousValues",
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
            "name": "ArtistId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "someDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "someOptionalDate",
            "type": "DateTime",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "GenreSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "Genre",
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
            "type": "GenrePreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "GenrePreviousValues",
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
            "name": "GenreId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "MediaTypeSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "MediaType",
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
            "type": "MediaTypePreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "MediaTypePreviousValues",
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
            "name": "MediaTypeId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      },
      {
        "name": "TrackSubscriptionPayload",
        "fields": [
          {
            "name": "mutation",
            "type": "MutationType",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "relation"
          },
          {
            "name": "node",
            "type": "Track",
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
            "type": "TrackPreviousValues",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "relation"
          }
        ]
      },
      {
        "name": "TrackPreviousValues",
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
            "name": "TrackId",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Name",
            "type": "String",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Composer",
            "type": "String",
            "isList": false,
            "isRequired": false,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Milliseconds",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "Bytes",
            "type": "Int",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          },
          {
            "name": "UnitPrice",
            "type": "Float",
            "isList": false,
            "isRequired": true,
            "args": [],
            "kind": "scalar"
          }
        ]
      }
    ]
  },
  "mappings": [
    {
      "model": "Artist",
      "findOne": "artist",
      "findMany": "artists",
      "create": "createArtist",
      "update": "updateArtist",
      "updateMany": "updateManyArtists",
      "upsert": "upsertArtist",
      "delete": "deleteArtist",
      "deleteMany": "deleteManyArtists"
    },
    {
      "model": "Album",
      "findOne": "album",
      "findMany": "albums",
      "create": "createAlbum",
      "update": "updateAlbum",
      "updateMany": "updateManyAlbums",
      "upsert": "upsertAlbum",
      "delete": "deleteAlbum",
      "deleteMany": "deleteManyAlbums"
    },
    {
      "model": "Track",
      "findOne": "track",
      "findMany": "tracks",
      "create": "createTrack",
      "update": "updateTrack",
      "updateMany": "updateManyTracks",
      "upsert": "upsertTrack",
      "delete": "deleteTrack",
      "deleteMany": "deleteManyTracks"
    },
    {
      "model": "Genre",
      "findOne": "genre",
      "findMany": "genres",
      "create": "createGenre",
      "update": "updateGenre",
      "updateMany": "updateManyGenres",
      "upsert": "upsertGenre",
      "delete": "deleteGenre",
      "deleteMany": "deleteManyGenres"
    },
    {
      "model": "MediaType",
      "findOne": "mediaType",
      "findMany": "mediaTypes",
      "create": "createMediaType",
      "update": "updateMediaType",
      "updateMany": "updateManyMediaTypes",
      "upsert": "upsertMediaType",
      "delete": "deleteMediaType",
      "deleteMany": "deleteManyMediaTypes"
    }
  ]
}
    