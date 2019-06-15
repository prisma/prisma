import { DMMF } from '../runtime/dmmf-types'

const dmmf: DMMF.Document = {
  datamodel: {
    enums: [],
    models: [
      {
        name: 'Album',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'AlbumId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Title',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Artist',
            kind: 'object',
            dbName: 'ArtistId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Artist',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Tracks',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Track',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Track',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'TrackId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Name',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Album',
            kind: 'object',
            dbName: 'AlbumId',
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Album',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'AlbumId',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Mediamodel',
            kind: 'object',
            dbName: 'MediamodelId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Mediamodel',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Genre',
            kind: 'object',
            dbName: 'GenreId',
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Genre',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Composer',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Milliseconds',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'UnitPrice',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Float',
            isGenerated: false,
          },
          {
            name: 'Playlists',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'PlaylistTrack',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'InvoiceLines',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'InvoiceLine',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Mediamodel',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'MediamodelId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Name',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'track',
            kind: 'object',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Track',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: true,
          },
        ],
      },
      {
        name: 'Genre',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'GenreId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Name',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Tracks',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Track',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Artist',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'ArtistId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Name',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Albums',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Album',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Customer',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'CustomerId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'FirstName',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'LastName',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Company',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Address',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'City',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'State',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Country',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'PostalCode',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Phone',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Fax',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Email',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'SupportRep',
            kind: 'object',
            dbName: 'SupportRepId',
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Employee',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Invoices',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Invoice',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Employee',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'EmployeeId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'FirstName',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'LastName',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Title',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'BirthDate',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'DateTime',
            isGenerated: false,
          },
          {
            name: 'HireDate',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'DateTime',
            isGenerated: false,
          },
          {
            name: 'Address',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'City',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'State',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Country',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'PostalCode',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Phone',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Fax',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Email',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Customers',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'Customer',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Invoice',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'InvoiceId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Customer',
            kind: 'object',
            dbName: 'CustomerId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Customer',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'InvoiceDate',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'DateTime',
            isGenerated: false,
          },
          {
            name: 'BillingAddress',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'BillingCity',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'BillingState',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'BillingCountry',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'BillingPostalCode',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Total',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Float',
            isGenerated: false,
          },
          {
            name: 'Lines',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'InvoiceLine',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'InvoiceLine',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'InvoiceLineId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Invoice',
            kind: 'object',
            dbName: 'InvoiceId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Invoice',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Track',
            kind: 'object',
            dbName: 'TrackId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Track',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'UnitPrice',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Float',
            isGenerated: false,
          },
          {
            name: 'Quantity',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Int',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'Playlist',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: 'PlaylistId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Name',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'String',
            isGenerated: false,
          },
          {
            name: 'Tracks',
            kind: 'object',
            dbName: null,
            isList: true,
            isRequired: false,
            isUnique: false,
            isId: false,
            type: 'PlaylistTrack',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
      {
        name: 'PlaylistTrack',
        isEmbedded: false,
        dbName: null,
        fields: [
          {
            name: 'id',
            kind: 'scalar',
            dbName: null,
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: true,
            type: 'Int',
            isGenerated: false,
          },
          {
            name: 'Playlist',
            kind: 'object',
            dbName: 'PlaylistId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Playlist',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
          {
            name: 'Track',
            kind: 'object',
            dbName: 'TrackId',
            isList: false,
            isRequired: true,
            isUnique: false,
            isId: false,
            type: 'Track',
            relationToFields: [],
            relationOnDelete: 'NONE',
            isGenerated: false,
          },
        ],
      },
    ],
  },
  mappings: [
    {
      model: 'Album',
      findOne: 'album',
      findMany: 'albums',
      plural: 'albums',
      create: 'createAlbum',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Track',
      findOne: 'track',
      findMany: 'tracks',
      plural: 'tracks',
      create: 'createTrack',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Mediamodel',
      findOne: 'mediamodel',
      findMany: 'mediamodels',
      plural: 'mediamodels',
      create: 'createMediamodel',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Genre',
      findOne: 'genre',
      findMany: 'genres',
      plural: 'genres',
      create: 'createGenre',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Artist',
      findOne: 'artist',
      findMany: 'artists',
      plural: 'artists',
      create: 'createArtist',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Customer',
      findOne: 'customer',
      findMany: 'customers',
      plural: 'customers',
      create: 'createCustomer',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Employee',
      findOne: 'employee',
      findMany: 'employees',
      plural: 'employees',
      create: 'createEmployee',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Invoice',
      findOne: 'invoice',
      findMany: 'invoices',
      plural: 'invoices',
      create: 'createInvoice',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'InvoiceLine',
      findOne: 'invoiceLine',
      findMany: 'invoiceLines',
      plural: 'invoiceLines',
      create: 'createInvoiceLine',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'Playlist',
      findOne: 'playlist',
      findMany: 'playlists',
      plural: 'playlists',
      create: 'createPlaylist',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
    {
      model: 'PlaylistTrack',
      findOne: 'playlistTrack',
      findMany: 'playlistTracks',
      plural: 'playlistTracks',
      create: 'createPlaylistTrack',
      update: null,
      updateMany: null,
      upsert: null,
      delete: null,
      deleteMany: null,
    },
  ],
  schema: {
    enums: [{ name: 'OrderByArg', values: ['asc', 'desc'] }],
    outputTypes: [
      {
        name: 'Artist',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Name', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Albums',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'ArtistOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Album', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Mediamodel',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Name', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'track', args: [], outputType: { type: 'Track', kind: 'object', isRequired: false, isList: false } },
        ],
      },
      {
        name: 'Genre',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Name', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Tracks',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'GenreOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Track', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Playlist',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Name', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Tracks',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'PlaylistOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'PlaylistTrack', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'PlaylistTrack',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'Playlist',
            args: [],
            outputType: { type: 'Playlist', kind: 'object', isRequired: true, isList: false },
          },
          { name: 'Track', args: [], outputType: { type: 'Track', kind: 'object', isRequired: true, isList: false } },
        ],
      },
      {
        name: 'Employee',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'FirstName',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'LastName',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false },
          },
          { name: 'Title', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'BirthDate',
            args: [],
            outputType: { type: 'DateTime', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'HireDate',
            args: [],
            outputType: { type: 'DateTime', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'Address',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          { name: 'City', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'State', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Country',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'PostalCode',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          { name: 'Phone', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'Fax', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'Email', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Customers',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'EmployeeOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Customer', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Customer',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'FirstName',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'LastName',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'Company',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'Address',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          { name: 'City', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'State', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Country',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'PostalCode',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          { name: 'Phone', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'Fax', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false } },
          { name: 'Email', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'SupportRep',
            args: [],
            outputType: { type: 'Employee', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'Invoices',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'CustomerOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Invoice', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Invoice',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'Customer',
            args: [],
            outputType: { type: 'Customer', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'InvoiceDate',
            args: [],
            outputType: { type: 'DateTime', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'BillingAddress',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'BillingCity',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'BillingState',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'BillingCountry',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'BillingPostalCode',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          { name: 'Total', args: [], outputType: { type: 'Float', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'Lines',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'InvoiceOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'InvoiceLine', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'InvoiceLine',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          {
            name: 'Invoice',
            args: [],
            outputType: { type: 'Invoice', kind: 'object', isRequired: true, isList: false },
          },
          { name: 'Track', args: [], outputType: { type: 'Track', kind: 'object', isRequired: true, isList: false } },
          {
            name: 'UnitPrice',
            args: [],
            outputType: { type: 'Float', kind: 'scalar', isRequired: true, isList: false },
          },
          { name: 'Quantity', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
        ],
      },
      {
        name: 'Track',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Name', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Album', args: [], outputType: { type: 'Album', kind: 'object', isRequired: false, isList: false } },
          { name: 'AlbumId', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: false, isList: false } },
          {
            name: 'Mediamodel',
            args: [],
            outputType: { type: 'Mediamodel', kind: 'object', isRequired: true, isList: false },
          },
          { name: 'Genre', args: [], outputType: { type: 'Genre', kind: 'object', isRequired: false, isList: false } },
          {
            name: 'Composer',
            args: [],
            outputType: { type: 'String', kind: 'scalar', isRequired: false, isList: false },
          },
          {
            name: 'Milliseconds',
            args: [],
            outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'UnitPrice',
            args: [],
            outputType: { type: 'Float', kind: 'scalar', isRequired: true, isList: false },
          },
          {
            name: 'Playlists',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'TrackOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'PlaylistTrack', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'InvoiceLines',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'TrackOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'InvoiceLine', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Album',
        fields: [
          { name: 'id', args: [], outputType: { type: 'Int', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Title', args: [], outputType: { type: 'String', kind: 'scalar', isRequired: true, isList: false } },
          { name: 'Artist', args: [], outputType: { type: 'Artist', kind: 'object', isRequired: true, isList: false } },
          {
            name: 'Tracks',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'AlbumOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Track', kind: 'object', isRequired: false, isList: true },
          },
        ],
      },
      {
        name: 'Query',
        fields: [
          {
            name: 'albums',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'AlbumOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Album', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'album',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'AlbumWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Album', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'tracks',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'TrackOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Track', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'track',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'TrackWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Track', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'mediamodels',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'MediamodelWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'MediamodelOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Mediamodel', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'mediamodel',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'MediamodelWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Mediamodel', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'genres',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'GenreOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Genre', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'genre',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'GenreWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Genre', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'artists',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'ArtistOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Artist', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'artist',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'ArtistWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Artist', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'customers',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'CustomerOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Customer', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'customer',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'CustomerWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Customer', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'employees',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'EmployeeOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Employee', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'employee',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'EmployeeWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Employee', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'invoices',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'InvoiceOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Invoice', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'invoice',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'InvoiceWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Invoice', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'invoiceLines',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'InvoiceLineWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'InvoiceLineOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'InvoiceLine', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'invoiceLine',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'InvoiceLineWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'InvoiceLine', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'playlists',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'PlaylistOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'Playlist', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'playlist',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'PlaylistWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Playlist', kind: 'object', isRequired: false, isList: false },
          },
          {
            name: 'playlistTracks',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'PlaylistTrackWhereInput', kind: 'object', isRequired: false, isList: false }],
              },
              {
                name: 'orderBy',
                inputType: [{ type: 'PlaylistTrackOrderByInput', kind: 'enum', isRequired: false, isList: false }],
              },
              { name: 'skip', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'after', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'before', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'first', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
              { name: 'last', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
            ],
            outputType: { type: 'PlaylistTrack', kind: 'object', isRequired: false, isList: true },
          },
          {
            name: 'playlistTrack',
            args: [
              {
                name: 'where',
                inputType: [{ type: 'PlaylistTrackWhereUniqueInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'PlaylistTrack', kind: 'object', isRequired: false, isList: false },
          },
        ],
      },
      {
        name: 'Mutation',
        fields: [
          {
            name: 'createAlbum',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'AlbumCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Album', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createTrack',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'TrackCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Track', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createMediamodel',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'MediamodelCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Mediamodel', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createGenre',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'GenreCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Genre', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createArtist',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'ArtistCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Artist', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createCustomer',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'CustomerCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Customer', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createEmployee',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'EmployeeCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Employee', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createInvoice',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'InvoiceCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Invoice', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createInvoiceLine',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'InvoiceLineCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'InvoiceLine', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createPlaylist',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'PlaylistCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'Playlist', kind: 'object', isRequired: true, isList: false },
          },
          {
            name: 'createPlaylistTrack',
            args: [
              {
                name: 'data',
                inputType: [{ type: 'PlaylistTrackCreateInput', kind: 'object', isRequired: true, isList: false }],
              },
            ],
            outputType: { type: 'PlaylistTrack', kind: 'object', isRequired: true, isList: false },
          },
        ],
      },
    ],
    inputTypes: [
      {
        name: 'ArtistWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Albums',
            inputType: [{ type: 'AlbumFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'MediamodelWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'MediamodelWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'MediamodelWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'MediamodelWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'track',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'GenreWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Tracks',
            inputType: [{ type: 'TrackFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'PlaylistWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Tracks',
            inputType: [{ type: 'PlaylistTrackFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'PlaylistTrackWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'PlaylistTrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'PlaylistTrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'PlaylistTrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'Playlist',
            inputType: [{ type: 'PlaylistWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
          {
            name: 'Track',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'EmployeeWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'FirstName',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'LastName',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Title',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BirthDate',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { type: 'NullableDateTimeFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'HireDate',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { type: 'NullableDateTimeFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Address',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'City',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'State',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Country',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'PostalCode',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Phone',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Fax',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Email',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Customers',
            inputType: [{ type: 'CustomerFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'CustomerWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'FirstName',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'LastName',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Company',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Address',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'City',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'State',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Country',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'PostalCode',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Phone',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Fax',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Email',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Invoices',
            inputType: [{ type: 'InvoiceFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'SupportRep',
            inputType: [{ type: 'EmployeeWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'InvoiceWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'InvoiceDate',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { type: 'DateTimeFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BillingAddress',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BillingCity',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BillingState',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BillingCountry',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'BillingPostalCode',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Total',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Float' },
              { type: 'FloatFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Lines',
            inputType: [{ type: 'InvoiceLineFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'Customer',
            inputType: [{ type: 'CustomerWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'InvoiceLineWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'UnitPrice',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Float' },
              { type: 'FloatFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Quantity',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'InvoiceLineWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'InvoiceLineWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'InvoiceLineWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'Invoice',
            inputType: [{ type: 'InvoiceWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
          {
            name: 'Track',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'TrackWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'AlbumId',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'NullableIntFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Composer',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'NullableStringFilter', isList: false, isRequired: false, kind: 'object' },
              { type: 'null', isList: false, isRequired: false, kind: 'scalar' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Milliseconds',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'UnitPrice',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Float' },
              { type: 'FloatFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Playlists',
            inputType: [{ type: 'PlaylistTrackFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'InvoiceLines',
            inputType: [{ type: 'InvoiceLineFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'TrackWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'Album',
            inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
          {
            name: 'Mediamodel',
            inputType: [{ type: 'MediamodelWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
          {
            name: 'Genre',
            inputType: [{ type: 'GenreWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'AlbumWhereInput',
        fields: [
          {
            name: 'id',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { type: 'IntFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Title',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { type: 'StringFilter', isList: false, isRequired: false, kind: 'object' },
            ],
            isRelationFilter: false,
          },
          {
            name: 'Tracks',
            inputType: [{ type: 'TrackFilter', isList: false, isRequired: false, kind: 'object' }],
            isRelationFilter: false,
          },
          {
            name: 'AND',
            inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'OR',
            inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'NOT',
            inputType: [{ type: 'AlbumWhereInput', kind: 'object', isRequired: false, isList: true }],
            isRelationFilter: true,
          },
          {
            name: 'Artist',
            inputType: [{ type: 'ArtistWhereInput', kind: 'object', isRequired: false, isList: false }],
            isRelationFilter: true,
          },
        ],
        isWhereType: true,
        atLeastOne: true,
      },
      {
        name: 'AlbumWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'TrackWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'MediamodelWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'GenreWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'ArtistWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'CustomerWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'EmployeeWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'InvoiceWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'InvoiceLineWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'PlaylistWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'PlaylistTrackWhereUniqueInput',
        fields: [{ name: 'id', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'ArtistCreateWithoutAlbumsInput',
        fields: [{ name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'ArtistCreateOneWithoutArtistInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'ArtistCreateWithoutAlbumsInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'ArtistWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'MediamodelCreateWithoutTrackInput',
        fields: [{ name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'MediamodelCreateOneWithoutMediamodelInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'MediamodelCreateWithoutTrackInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'MediamodelWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'GenreCreateWithoutTracksInput',
        fields: [{ name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'GenreCreateOneWithoutGenreInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'GenreCreateWithoutTracksInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'GenreWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'PlaylistCreateWithoutTracksInput',
        fields: [{ name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] }],
      },
      {
        name: 'PlaylistCreateOneWithoutPlaylistInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'PlaylistCreateWithoutTracksInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'PlaylistWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'PlaylistTrackCreateWithoutTrackInput',
        fields: [
          {
            name: 'Playlist',
            inputType: [
              { type: 'PlaylistCreateOneWithoutPlaylistInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
        ],
      },
      {
        name: 'PlaylistTrackCreateManyWithoutPlaylistsInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'PlaylistTrackCreateWithoutTrackInput', kind: 'object', isRequired: false, isList: true },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'PlaylistTrackWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'EmployeeCreateWithoutCustomersInput',
        fields: [
          { name: 'FirstName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'LastName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Title', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BirthDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'HireDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Address', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'City', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'State', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Country', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'PostalCode', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Phone', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Fax', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Email', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
        ],
      },
      {
        name: 'EmployeeCreateOneWithoutSupportRepInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'EmployeeCreateWithoutCustomersInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'EmployeeWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'CustomerCreateWithoutInvoicesInput',
        fields: [
          { name: 'FirstName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'LastName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Company', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Address', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'City', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'State', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Country', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'PostalCode', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Phone', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Fax', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Email', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'SupportRep',
            inputType: [
              { type: 'EmployeeCreateOneWithoutSupportRepInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'CustomerCreateOneWithoutCustomerInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'CustomerCreateWithoutInvoicesInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'CustomerWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'InvoiceCreateWithoutLinesInput',
        fields: [
          { name: 'InvoiceDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'BillingAddress', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCity', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingState', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCountry', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'BillingPostalCode',
            inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }],
          },
          { name: 'Total', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Customer',
            inputType: [
              { type: 'CustomerCreateOneWithoutCustomerInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceCreateOneWithoutInvoiceInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'InvoiceCreateWithoutLinesInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'InvoiceWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'InvoiceLineCreateWithoutTrackInput',
        fields: [
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Quantity', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Invoice',
            inputType: [
              { type: 'InvoiceCreateOneWithoutInvoiceInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceLineCreateManyWithoutInvoiceLinesInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'InvoiceLineCreateWithoutTrackInput', kind: 'object', isRequired: false, isList: true },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'InvoiceLineWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'TrackCreateWithoutAlbumInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'AlbumId', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Composer', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Milliseconds', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Mediamodel',
            inputType: [
              { type: 'MediamodelCreateOneWithoutMediamodelInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
          {
            name: 'Genre',
            inputType: [{ type: 'GenreCreateOneWithoutGenreInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'Playlists',
            inputType: [
              {
                type: 'PlaylistTrackCreateManyWithoutPlaylistsInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
          {
            name: 'InvoiceLines',
            inputType: [
              {
                type: 'InvoiceLineCreateManyWithoutInvoiceLinesInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
        ],
      },
      {
        name: 'TrackCreateManyWithoutTracksInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'TrackCreateWithoutAlbumInput', kind: 'object', isRequired: false, isList: true }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'TrackWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'AlbumCreateInput',
        fields: [
          { name: 'Title', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Artist',
            inputType: [{ type: 'ArtistCreateOneWithoutArtistInput', kind: 'object', isRequired: true, isList: false }],
          },
          {
            name: 'Tracks',
            inputType: [
              { type: 'TrackCreateManyWithoutTracksInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'AlbumCreateWithoutTracksInput',
        fields: [
          { name: 'Title', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Artist',
            inputType: [{ type: 'ArtistCreateOneWithoutArtistInput', kind: 'object', isRequired: true, isList: false }],
          },
        ],
      },
      {
        name: 'AlbumCreateOneWithoutAlbumInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'AlbumCreateWithoutTracksInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'AlbumWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'TrackCreateInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'AlbumId', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Composer', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Milliseconds', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Album',
            inputType: [{ type: 'AlbumCreateOneWithoutAlbumInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'Mediamodel',
            inputType: [
              { type: 'MediamodelCreateOneWithoutMediamodelInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
          {
            name: 'Genre',
            inputType: [{ type: 'GenreCreateOneWithoutGenreInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'Playlists',
            inputType: [
              {
                type: 'PlaylistTrackCreateManyWithoutPlaylistsInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
          {
            name: 'InvoiceLines',
            inputType: [
              {
                type: 'InvoiceLineCreateManyWithoutInvoiceLinesInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
        ],
      },
      {
        name: 'TrackCreateWithoutMediamodelInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'AlbumId', inputType: [{ type: 'Int', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Composer', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Milliseconds', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Album',
            inputType: [{ type: 'AlbumCreateOneWithoutAlbumInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'Genre',
            inputType: [{ type: 'GenreCreateOneWithoutGenreInput', kind: 'object', isRequired: false, isList: false }],
          },
          {
            name: 'Playlists',
            inputType: [
              {
                type: 'PlaylistTrackCreateManyWithoutPlaylistsInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
          {
            name: 'InvoiceLines',
            inputType: [
              {
                type: 'InvoiceLineCreateManyWithoutInvoiceLinesInput',
                kind: 'object',
                isRequired: false,
                isList: false,
              },
            ],
          },
        ],
      },
      {
        name: 'TrackCreateOneWithoutTrackInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'TrackCreateWithoutMediamodelInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'TrackWhereUniqueInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'MediamodelCreateInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'track',
            inputType: [{ type: 'TrackCreateOneWithoutTrackInput', kind: 'object', isRequired: false, isList: false }],
          },
        ],
      },
      {
        name: 'GenreCreateInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'Tracks',
            inputType: [
              { type: 'TrackCreateManyWithoutTracksInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'AlbumCreateWithoutArtistInput',
        fields: [
          { name: 'Title', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Tracks',
            inputType: [
              { type: 'TrackCreateManyWithoutTracksInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'AlbumCreateManyWithoutAlbumsInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'AlbumCreateWithoutArtistInput', kind: 'object', isRequired: false, isList: true }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'AlbumWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'ArtistCreateInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'Albums',
            inputType: [
              { type: 'AlbumCreateManyWithoutAlbumsInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceLineCreateWithoutInvoiceInput',
        fields: [
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Quantity', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Track',
            inputType: [{ type: 'TrackCreateOneWithoutTrackInput', kind: 'object', isRequired: true, isList: false }],
          },
        ],
      },
      {
        name: 'InvoiceLineCreateManyWithoutLinesInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'InvoiceLineCreateWithoutInvoiceInput', kind: 'object', isRequired: false, isList: true },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'InvoiceLineWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'InvoiceCreateWithoutCustomerInput',
        fields: [
          { name: 'InvoiceDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'BillingAddress', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCity', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingState', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCountry', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'BillingPostalCode',
            inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }],
          },
          { name: 'Total', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Lines',
            inputType: [
              { type: 'InvoiceLineCreateManyWithoutLinesInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceCreateManyWithoutInvoicesInput',
        fields: [
          {
            name: 'create',
            inputType: [{ type: 'InvoiceCreateWithoutCustomerInput', kind: 'object', isRequired: false, isList: true }],
          },
          {
            name: 'connect',
            inputType: [{ type: 'InvoiceWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'CustomerCreateInput',
        fields: [
          { name: 'FirstName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'LastName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Company', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Address', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'City', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'State', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Country', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'PostalCode', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Phone', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Fax', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Email', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'SupportRep',
            inputType: [
              { type: 'EmployeeCreateOneWithoutSupportRepInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
          {
            name: 'Invoices',
            inputType: [
              { type: 'InvoiceCreateManyWithoutInvoicesInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'CustomerCreateWithoutSupportRepInput',
        fields: [
          { name: 'FirstName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'LastName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Company', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Address', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'City', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'State', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Country', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'PostalCode', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Phone', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Fax', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Email', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Invoices',
            inputType: [
              { type: 'InvoiceCreateManyWithoutInvoicesInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'CustomerCreateManyWithoutCustomersInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'CustomerCreateWithoutSupportRepInput', kind: 'object', isRequired: false, isList: true },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'CustomerWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'EmployeeCreateInput',
        fields: [
          { name: 'FirstName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'LastName', inputType: [{ type: 'String', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Title', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BirthDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'HireDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Address', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'City', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'State', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Country', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'PostalCode', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Phone', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Fax', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'Email', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'Customers',
            inputType: [
              { type: 'CustomerCreateManyWithoutCustomersInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceCreateInput',
        fields: [
          { name: 'InvoiceDate', inputType: [{ type: 'DateTime', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'BillingAddress', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCity', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingState', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          { name: 'BillingCountry', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'BillingPostalCode',
            inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }],
          },
          { name: 'Total', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Customer',
            inputType: [
              { type: 'CustomerCreateOneWithoutCustomerInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
          {
            name: 'Lines',
            inputType: [
              { type: 'InvoiceLineCreateManyWithoutLinesInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'InvoiceLineCreateInput',
        fields: [
          { name: 'UnitPrice', inputType: [{ type: 'Float', kind: 'scalar', isRequired: true, isList: false }] },
          { name: 'Quantity', inputType: [{ type: 'Int', kind: 'scalar', isRequired: true, isList: false }] },
          {
            name: 'Invoice',
            inputType: [
              { type: 'InvoiceCreateOneWithoutInvoiceInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
          {
            name: 'Track',
            inputType: [{ type: 'TrackCreateOneWithoutTrackInput', kind: 'object', isRequired: true, isList: false }],
          },
        ],
      },
      {
        name: 'PlaylistTrackCreateWithoutPlaylistInput',
        fields: [
          {
            name: 'Track',
            inputType: [{ type: 'TrackCreateOneWithoutTrackInput', kind: 'object', isRequired: true, isList: false }],
          },
        ],
      },
      {
        name: 'PlaylistTrackCreateManyWithoutTracksInput',
        fields: [
          {
            name: 'create',
            inputType: [
              { type: 'PlaylistTrackCreateWithoutPlaylistInput', kind: 'object', isRequired: false, isList: true },
            ],
          },
          {
            name: 'connect',
            inputType: [{ type: 'PlaylistTrackWhereUniqueInput', kind: 'object', isRequired: false, isList: true }],
          },
        ],
      },
      {
        name: 'PlaylistCreateInput',
        fields: [
          { name: 'Name', inputType: [{ type: 'String', kind: 'scalar', isRequired: false, isList: false }] },
          {
            name: 'Tracks',
            inputType: [
              { type: 'PlaylistTrackCreateManyWithoutTracksInput', kind: 'object', isRequired: false, isList: false },
            ],
          },
        ],
      },
      {
        name: 'PlaylistTrackCreateInput',
        fields: [
          {
            name: 'Playlist',
            inputType: [
              { type: 'PlaylistCreateOneWithoutPlaylistInput', kind: 'object', isRequired: true, isList: false },
            ],
          },
          {
            name: 'Track',
            inputType: [{ type: 'TrackCreateOneWithoutTrackInput', kind: 'object', isRequired: true, isList: false }],
          },
        ],
      },
      {
        name: 'IntFilter',
        fields: [
          { name: 'equals', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'IntFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'NullableStringFilter',
        fields: [
          {
            name: 'equals',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
            ],
          },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'NullableStringFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'contains', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'startsWith', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'endsWith', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'AlbumFilter',
        fields: [
          { name: 'every', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'AlbumWhereInput' }] },
          { name: 'some', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'AlbumWhereInput' }] },
          { name: 'none', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'AlbumWhereInput' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'TrackFilter',
        fields: [
          { name: 'every', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'TrackWhereInput' }] },
          { name: 'some', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'TrackWhereInput' }] },
          { name: 'none', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'TrackWhereInput' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'PlaylistTrackFilter',
        fields: [
          {
            name: 'every',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'PlaylistTrackWhereInput' }],
          },
          {
            name: 'some',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'PlaylistTrackWhereInput' }],
          },
          {
            name: 'none',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'PlaylistTrackWhereInput' }],
          },
        ],
        atLeastOne: true,
      },
      {
        name: 'StringFilter',
        fields: [
          { name: 'equals', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'String' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'StringFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'contains', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'startsWith', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
          { name: 'endsWith', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'String' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'NullableDateTimeFilter',
        fields: [
          {
            name: 'equals',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
            ],
          },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'NullableDateTimeFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'CustomerFilter',
        fields: [
          {
            name: 'every',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'CustomerWhereInput' }],
          },
          {
            name: 'some',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'CustomerWhereInput' }],
          },
          {
            name: 'none',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'CustomerWhereInput' }],
          },
        ],
        atLeastOne: true,
      },
      {
        name: 'InvoiceFilter',
        fields: [
          {
            name: 'every',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceWhereInput' }],
          },
          {
            name: 'some',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceWhereInput' }],
          },
          {
            name: 'none',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceWhereInput' }],
          },
        ],
        atLeastOne: true,
      },
      {
        name: 'DateTimeFilter',
        fields: [
          { name: 'equals', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'DateTimeFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'DateTime' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'FloatFilter',
        fields: [
          { name: 'equals', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Float' }] },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Float' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'FloatFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Float' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Float' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Float' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Float' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Float' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Float' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'InvoiceLineFilter',
        fields: [
          {
            name: 'every',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceLineWhereInput' }],
          },
          {
            name: 'some',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceLineWhereInput' }],
          },
          {
            name: 'none',
            inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'InvoiceLineWhereInput' }],
          },
        ],
        atLeastOne: true,
      },
      {
        name: 'NullableIntFilter',
        fields: [
          {
            name: 'equals',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
            ],
          },
          {
            name: 'not',
            inputType: [
              { isList: false, isRequired: false, kind: 'scalar', type: 'Int' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'null' },
              { isList: false, isRequired: false, kind: 'scalar', type: 'NullableIntFilter' },
            ],
          },
          { name: 'in', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'notIn', inputType: [{ isList: true, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'lt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'lte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'gt', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
          { name: 'gte', inputType: [{ isList: false, isRequired: false, kind: 'scalar', type: 'Int' }] },
        ],
        atLeastOne: true,
      },
      {
        name: 'AlbumOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Title',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'ArtistOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'GenreOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'TrackOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'AlbumId',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Composer',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Milliseconds',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'UnitPrice',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'PlaylistOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'EmployeeOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'FirstName',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'LastName',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Title',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BirthDate',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'HireDate',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Address',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'City',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'State',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Country',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'PostalCode',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Phone',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Fax',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Email',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'CustomerOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'FirstName',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'LastName',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Company',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Address',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'City',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'State',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Country',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'PostalCode',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Phone',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Fax',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Email',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'InvoiceOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'InvoiceDate',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BillingAddress',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BillingCity',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BillingState',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BillingCountry',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'BillingPostalCode',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Total',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'MediamodelOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Name',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'InvoiceLineOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'UnitPrice',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
          {
            name: 'Quantity',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
      {
        name: 'PlaylistTrackOrderByInput',
        atLeastOne: true,
        atMostOne: true,
        isOrderType: true,
        fields: [
          {
            name: 'id',
            inputType: [{ type: 'OrderByArg', isList: false, isRequired: false, kind: 'scalar' }],
            isRelationFilter: false,
          },
        ],
      },
    ],
  },
}
