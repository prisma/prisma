import { and, not, or, all as trueExpression } from '@internal/sql-orm-client';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

async function seedExtendedRelationFilters(
  db: Parameters<Parameters<typeof withPostgresPort<Contract>>[1]>[0]['db'],
) {
  await db.public.Genre.createAll([
    { id: 'genre-1', GenreId: 1, Name: 'Genre1' },
    { id: 'genre-2', GenreId: 2, Name: 'Genre2' },
    { id: 'genre-3', GenreId: 3, Name: 'Genre3' },
    { id: 'genre-4', GenreId: 4, Name: 'GenreThatIsNotUsed' },
  ]);
  await db.public.MediaType.createAll([
    { id: 'media-1', MediaTypeId: 1, Name: 'MediaType1' },
    { id: 'media-2', MediaTypeId: 2, Name: 'MediaType2' },
    { id: 'media-3', MediaTypeId: 3, Name: 'MediaType3' },
    { id: 'media-4', MediaTypeId: 4, Name: 'MediaTypeThatIsNotUsed' },
  ]);
  await db.public.Artist.createAll([
    { id: 'artist-1', ArtistId: 1, Name: 'CompleteArtist' },
    { id: 'artist-2', ArtistId: 2, Name: 'ArtistWithoutAlbums' },
    { id: 'artist-3', ArtistId: 3, Name: 'ArtistWithOneAlbumWithoutTracks' },
    { id: 'artist-4', ArtistId: 4, Name: 'CompleteArtist2' },
    { id: 'artist-5', ArtistId: 5, Name: 'CompleteArtistWith2Albums' },
  ]);
  await db.public.Album.createAll([
    { id: 'album-1', AlbumId: 1, Title: 'Album1', ArtistId: 'artist-1' },
    { id: 'album-2', AlbumId: 2, Title: 'TheAlbumWithoutTracks', ArtistId: 'artist-3' },
    { id: 'album-3', AlbumId: 3, Title: 'Album3', ArtistId: 'artist-4' },
    { id: 'album-4', AlbumId: 4, Title: 'Album4', ArtistId: 'artist-5' },
    { id: 'album-5', AlbumId: 5, Title: 'Album5', ArtistId: 'artist-5' },
  ]);
  await db.public.Track.createAll([
    {
      id: 'track-1',
      TrackId: 1,
      Name: 'Track1',
      Composer: 'Composer1',
      Milliseconds: 10000,
      Bytes: 512,
      UnitPrice: 1.51,
      AlbumId: 'album-1',
      GenreId: 'genre-1',
      MediaTypeId: 'media-1',
    },
    {
      id: 'track-2',
      TrackId: 2,
      Name: 'Track2',
      Composer: 'Composer1',
      Milliseconds: 11000,
      Bytes: 1024,
      UnitPrice: 2.51,
      AlbumId: 'album-3',
      GenreId: 'genre-2',
      MediaTypeId: 'media-2',
    },
    {
      id: 'track-3',
      TrackId: 3,
      Name: 'Track3',
      Composer: 'Composer2',
      Milliseconds: 9000,
      Bytes: 24,
      UnitPrice: 5.51,
      AlbumId: 'album-3',
      GenreId: 'genre-3',
      MediaTypeId: 'media-3',
    },
    {
      id: 'track-4',
      TrackId: 4,
      Name: 'Track4',
      Composer: 'Composer1',
      Milliseconds: 15000,
      Bytes: 10024,
      UnitPrice: 12.51,
      AlbumId: 'album-4',
      GenreId: 'genre-1',
      MediaTypeId: 'media-1',
    },
    {
      id: 'track-5',
      TrackId: 5,
      Name: 'Track5',
      Composer: 'Composer2',
      Milliseconds: 19000,
      Bytes: 240,
      UnitPrice: 0.51,
      AlbumId: 'album-4',
      GenreId: 'genre-1',
      MediaTypeId: 'media-1',
    },
    {
      id: 'track-6',
      TrackId: 6,
      Name: 'Track6',
      Composer: 'Composer1',
      Milliseconds: 100,
      Bytes: 724,
      UnitPrice: 31.51,
      AlbumId: 'album-5',
      GenreId: 'genre-2',
      MediaTypeId: 'media-3',
    },
    {
      id: 'track-7',
      TrackId: 7,
      Name: 'Track7',
      Composer: 'Composer3',
      Milliseconds: 100,
      Bytes: 2400,
      UnitPrice: 5.51,
      AlbumId: 'album-5',
      GenreId: 'genre-1',
      MediaTypeId: 'media-1',
    },
  ]);
}

function withExtendedRelationFilters(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, async (ctx) => {
    await seedExtendedRelationFilters(ctx.db);
    await fn(ctx);
  });
}

describe('ports/engines/queries/filters/extended_relation_filters', () => {
  it(
    'basic_scalar_filter',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Artist.where((artist) => artist.ArtistId.eq(1))
          .select('Name')
          .all();
        expect(result).toEqual([{ Name: 'CompleteArtist' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l1_depth1',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Album.where((album) =>
          album.Artist.some((artist) => artist.Name.eq('CompleteArtist')),
        )
          .select('AlbumId')
          .all();
        expect(result).toEqual([{ AlbumId: 1 }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_some_some',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const milliseconds = await db.public.Artist.where((artist) =>
          artist.Albums.some((album) => album.Tracks.some((track) => track.Milliseconds.lte(9000))),
        )
          .orderBy((artist) => artist.Name.asc())
          .select('Name')
          .all();
        expect(milliseconds).toEqual([
          { Name: 'CompleteArtist2' },
          { Name: 'CompleteArtistWith2Albums' },
        ]);

        const bytes = await db.public.Artist.where((artist) =>
          artist.Albums.some((album) => album.Tracks.some((track) => track.Bytes.eq(512))),
        )
          .select('Name')
          .all();
        expect(bytes).toEqual([{ Name: 'CompleteArtist' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_implicit_and_some',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            and(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre1')),
            ),
          ),
        )
          .orderBy((album) => album.id.asc())
          .select('Title')
          .all();
        expect(result).toEqual([{ Title: 'Album1' }, { Title: 'Album4' }, { Title: 'Album5' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_implicit_and_every',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            and(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre1')),
            ),
          ),
        )
          .orderBy((album) => album.Title.asc())
          .select('Title')
          .all();
        expect(result).toEqual([
          { Title: 'Album1' },
          { Title: 'Album4' },
          { Title: 'TheAlbumWithoutTracks' },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_explicit_and_some',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const both = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            and(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre1')),
            ),
          ),
        )
          .orderBy((album) => album.id.asc())
          .select('Title')
          .all();
        expect(both).toEqual([{ Title: 'Album1' }, { Title: 'Album4' }, { Title: 'Album5' }]);

        const mediaType2 = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            and(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .select('Title')
          .all();
        expect(mediaType2).toEqual([{ Title: 'Album3' }]);

        const anyTrack = await db.public.Album.where((album) =>
          album.Tracks.some(() => trueExpression()),
        )
          .select('Title')
          .all();
        expect(anyTrack).toEqual([
          { Title: 'Album1' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_explicit_and_every',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const both = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            and(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre1')),
            ),
          ),
        )
          .orderBy((album) => album.Title.asc())
          .select('Title')
          .all();
        expect(both).toEqual([
          { Title: 'Album1' },
          { Title: 'Album4' },
          { Title: 'TheAlbumWithoutTracks' },
        ]);

        const mediaType2 = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            and(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .select('Title')
          .all();
        expect(mediaType2).toEqual([{ Title: 'TheAlbumWithoutTracks' }]);

        const allTracks = await db.public.Album.where((album) =>
          album.Tracks.every(() => trueExpression()),
        )
          .select('Title')
          .all();
        expect(allTracks).toEqual([
          { Title: 'Album1' },
          { Title: 'TheAlbumWithoutTracks' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_explicit_or_all',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const media1OrGenre2Some = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            or(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre2')),
            ),
          ),
        )
          .orderBy((album) => album.Title.asc())
          .select('Title')
          .all();
        expect(media1OrGenre2Some).toEqual([
          { Title: 'Album1' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);

        const media1OrGenre2Every = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            or(
              track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1')),
              track.Genre.some((genre) => genre.Name.eq('Genre2')),
            ),
          ),
        )
          .orderBy((album) => album.Title.asc())
          .select('Title')
          .all();
        expect(media1OrGenre2Every).toEqual([
          { Title: 'Album1' },
          { Title: 'Album4' },
          { Title: 'Album5' },
          { Title: 'TheAlbumWithoutTracks' },
        ]);

        const media2Some = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            or(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .select('Title')
          .all();
        expect(media2Some).toEqual([{ Title: 'Album3' }]);

        const media2Every = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            or(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .select('Title')
          .all();
        expect(media2Every).toEqual([{ Title: 'TheAlbumWithoutTracks' }]);

        const emptySome = await db.public.Album.where((album) => album.Tracks.some(() => or()))
          .select('Title')
          .all();
        expect(emptySome).toEqual([]);

        const emptyEvery = await db.public.Album.where((album) => album.Tracks.every(() => or()))
          .select('Title')
          .all();
        expect(emptyEvery).toEqual([{ Title: 'TheAlbumWithoutTracks' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l2_explicit_not_all',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const notMedia1AndNotGenre1Some = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            and(
              not(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1'))),
              not(track.Genre.some((genre) => genre.Name.eq('Genre1'))),
            ),
          ),
        )
          .orderBy((album) => album.Title.asc())
          .select('Title')
          .all();
        expect(notMedia1AndNotGenre1Some).toEqual([{ Title: 'Album3' }, { Title: 'Album5' }]);

        const notMedia1AndNotGenre1Every = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            and(
              not(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType1'))),
              not(track.Genre.some((genre) => genre.Name.eq('Genre1'))),
            ),
          ),
        )
          .orderBy((album) => album.AlbumId.asc())
          .select('Title')
          .all();
        expect(notMedia1AndNotGenre1Every).toEqual([
          { Title: 'TheAlbumWithoutTracks' },
          { Title: 'Album3' },
        ]);

        const notMedia2Some = await db.public.Album.where((album) =>
          album.Tracks.some((track) =>
            not(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .orderBy((album) => album.AlbumId.asc())
          .select('Title')
          .all();
        expect(notMedia2Some).toEqual([
          { Title: 'Album1' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);

        const notMedia2Every = await db.public.Album.where((album) =>
          album.Tracks.every((track) =>
            not(track.MediaType.some((mediaType) => mediaType.Name.eq('MediaType2'))),
          ),
        )
          .orderBy((album) => album.AlbumId.asc())
          .select('Title')
          .all();
        expect(notMedia2Every).toEqual([
          { Title: 'Album1' },
          { Title: 'TheAlbumWithoutTracks' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);

        const notEmptySome = await db.public.Album.where((album) =>
          album.Tracks.some(() => trueExpression()),
        )
          .orderBy((album) => album.AlbumId.asc())
          .select('Title')
          .all();
        expect(notEmptySome).toEqual([
          { Title: 'Album1' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);

        const notEmptyEvery = await db.public.Album.where((album) =>
          album.Tracks.every(() => trueExpression()),
        )
          .orderBy((album) => album.AlbumId.asc())
          .select('Title')
          .all();
        expect(notEmptyEvery).toEqual([
          { Title: 'Album1' },
          { Title: 'TheAlbumWithoutTracks' },
          { Title: 'Album3' },
          { Title: 'Album4' },
          { Title: 'Album5' },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_filter_l3',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Genre.where((genre) =>
          genre.Tracks.some((track) =>
            track.Album.some((album) => album.Artist.some((artist) => artist.ArtistId.eq(1))),
          ),
        )
          .select('GenreId')
          .all();
        expect(result).toEqual([{ GenreId: 1 }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'rel_scalar_filter',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Artist.where((artist) =>
          artist.Albums.some((album) =>
            album.Tracks.some((track) =>
              and(
                track.Genre.some((genre) => genre.Name.eq('Genre1')),
                track.TrackId.eq(1),
              ),
            ),
          ),
        )
          .select('ArtistId')
          .all();
        expect(result).toEqual([{ ArtistId: 1 }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'empty_none',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Genre.where((genre) => genre.Tracks.none())
          .select('Name')
          .all();
        expect(result).toEqual([{ Name: 'GenreThatIsNotUsed' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'empty_some',
    () =>
      withExtendedRelationFilters(async ({ db }) => {
        const result = await db.public.Genre.where((genre) => genre.Tracks.some())
          .orderBy((genre) => genre.Name.asc())
          .select('Name')
          .all();
        expect(result).toEqual([{ Name: 'Genre1' }, { Name: 'Genre2' }, { Name: 'Genre3' }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
