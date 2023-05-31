# Docker

You will need to change directory before executing the commands below with:

```sh
cd docker
```

See [the Docker Compose configurations for our tests databases locally and also used by GitHub Actions in CI](./docker-compose.yml).

## Using docker-compose for databases

This is only intended to be run in a development environment where ports 3306 / default for MySQL - 5432 / default for PostgreSQL and 4306 custom port - MariaDB are free and not used.

If they are already used make sure to change the ports like this

```yaml
ports:
  - '3307:3306' # only change the first number
```

## Apple M1 and other ARM64 CPUs

Docker images for MySQL and Microsoft SQL Server only support x86_64 CPUs.
Copy or link `docker-compose.arm64.yml` to `docker-compose.override.yml` to use ARMv8-compatible drop-in replacements (MariaDB and Azure SQL Edge) instead.

> By default, Compose reads two files, a `docker-compose.yml` and an optional `docker-compose.override.yml` file. By convention, the `docker-compose.yml` contains your base configuration. The override file, as its name implies, can contain configuration overrides for existing services or entirely new services.
>
> (https://docs.docker.com/compose/extends/#understanding-multiple-compose-files)

## Usage

### Start

In detached/background mode using `-d` (recommended)

```sh
docker-compose up -d
# Or start only one service
docker-compose up -d mysql
# To see logs
docker-compose logs -f mysql
```

In attached mode, the logs will be streamed in the terminal:

```sh
docker-compose up
# Or start only one service
docker-compose up mysql
```

### Stop

```sh
docker-compose down
```

### Delete all

```sh
docker-compose down -v --rmi all --remove-orphans
```
