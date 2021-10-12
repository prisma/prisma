# Docker

You will need to change directory before executing the commands below with:

```sh
cd docker
```

See [./docker-compose.yml](the Docker Compose configurations for our tests databases locally and also used by GitHub Actions in CI)

## Using docker-compose for databases

This is only intended to be run in a development environment where ports 3306 / default for MySQL - 5432 / default for PostgreSQL and 4306 custom port - MariaDB are free and not used.

If they are already used make sure to change the ports like this

```yaml
ports:
  - '3307:3306 # only change the first number
```

## Usage

### Start

In detached/background mode using `-d` (recommended)

```
docker-compose up -d
# Or start only one service
docker-compose up -d mysql
# To see logs
docker-compose logs -f mysql
```

In attached mode, the logs will be streamed in the terminal:

```
docker-compose up
# Or start only one service
docker-compose up mysql
```

### Stop

```
docker-compose down
```

### Delete all

```
docker-compose down -v --rmi all --remove-orphans
```
