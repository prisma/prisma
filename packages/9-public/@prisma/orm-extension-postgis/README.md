# @prisma/orm-extension-postgis

Geospatial columns, operators, and indexes for Prisma Next on PostgreSQL, powered by [PostGIS](https://postgis.net).

```bash
pnpm add @prisma/orm-extension-postgis
```

Model points, lines, and polygons as first-class columns, query them with a type-safe DSL, and let the framework handle the wire format, SRID metadata, and `CREATE EXTENSION postgis`.

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/pack` | the extension pack an application composes into `extensions: [...]` — pure, no runtime imports |
| `/column-types` | the `Geometry(srid?)` column author |
| `/codec-types`, `/operation-types` | types emitted contracts reference |
| `/geojson` | GeoJSON value shapes for runtime reads and writes |
| `/runtime` | the runtime extension that registers codecs and operations |
| `/control` | the control descriptor that installs the PostGIS server extension |

## Responsibilities

Geometry storage and query semantics: the `geometry` column type and its SRID parameter, GeoJSON-shaped runtime values, seven query operations (`distance`, `distanceSphere`, `dwithin`, `contains`, `within`, `intersects`, `intersectsBbox`), and the database-dependency declaration that makes `prisma orm db init` enable PostGIS before the first migration runs. Works with both PSL and TypeScript contract authoring.

The PostGIS server extension must be installable on your PostgreSQL server. Most managed providers include it; locally, the `postgis/postgis` Docker image is the shortest route.

## Dependencies

`@prisma/orm-framework`, `@prisma/orm-family-sql`, and `@prisma/orm-toolchain` at exact lockstep versions, plus `arktype` and `@standard-schema/spec`.

`@prisma/orm-target-postgres` is an exact-pinned **peer** dependency: the application supplies it, directly or through a facade, and everyone shares that one copy. A hard dependency would let an application upgrade the facade without upgrading this pack and end up with two target copies whose codec and operation registries have quietly diverged; as a peer that combination fails to install instead.
