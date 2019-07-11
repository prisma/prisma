# 2.0.0-preview-1

Since the initial [Prisma 2 announcement](https://www.prisma.io/blog/announcing-prisma-2-zq1s745db8i5/), we've ironed out a number of bugs and added lots of improvements. Today, we are issuing the first official [Preview release](./README.md#preview) `2.0.0-preview-1` (short: `preview-1`).

## Install

To install `preview-1`, you can just install the Prisma 2 CLI via npm:

```
npm install -g prisma2
```

## Major changes

- Renamed `project.prisma` to `schema.prisma` ([learn more](https://github.com/prisma/prisma2/issues/36))
- Renamed `postgres` data source provider to `postgresql` ([learn more](https://github.com/prisma/prisma2/issues/1))

## Fixes and improvements per repo

### `prisma2`

- [Rename `postgres` provider to `postgresql` #1](https://github.com/prisma/prisma2/issues/1)
- [`prisma dev` errors for postgres #12](https://github.com/prisma/prisma2/issues/12)
- [`prisma dev` can't recover from certain rust errors #20](https://github.com/prisma/prisma2/issues/20)
- [PhotonJS Generator: Rename to `photonjs` and other improvements #27](https://github.com/prisma/prisma2/issues/27)
- [Rename `project.prisma` to `schema.prisma` #36](https://github.com/prisma/prisma2/issues/36)
- [Back from SQLite in init workflow does not work #44](https://github.com/prisma/prisma2/issues/44)
- [working type definition example #52](https://github.com/prisma/prisma2/issues/5252)
- [Having a case in model name breaks query engine #61](https://github.com/prisma/prisma2/issues/61)
- [Issue with "now dev" command #65](https://github.com/prisma/prisma2/issues/65)

### `photonjs`

- [Generated code has an absolute path #95](https://github.com/prisma/photonjs/issues/95)
- [Dynamic dependency encoding #115](https://github.com/prisma/photonjs/issues/115)
- [Adjust filter operands API #9](https://github.com/prisma/photonjs/issues/9)
- [TypeError: cb.apply is not a function #20](https://github.com/prisma/photonjs/issues/20)
- [createdAt with default doesn't work #29](https://github.com/prisma/photonjs/issues/29)
- [Enum from MySQL are undefined #63](https://github.com/prisma/photonjs/issues/63)
- [Support for selecting relations of relations (and more sophisticated queries in general) #70](https://github.com/prisma/photonjs/issues/70)
- [Where to put generated code #77](https://github.com/prisma/photonjs/issues/77)
- [Update model args are always required for required fields #80](https://github.com/prisma/photonjs/issues/80)

### `lift`

- [Create README.md in migration folders #1](https://github.com/prisma/lift/issues/1)
- [prisma2 init error in lift engine #14](https://github.com/prisma/lift/issues/14)
