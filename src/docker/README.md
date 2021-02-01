# Using docker-compose for databases

This is only intended to be run in a development environment where ports 3306 / default for MySQL - 5432 / default for PostgreSQL and 4306 custom port - MariaDB are free and not used.

If they are already used make sure to change the ports like this

```yaml
ports:
  - '3307:3306 # only change the first number
```

## Usage

### Start

In detached mode

```
docker-compose up -d
docker-compose logs -f mysql
```

In attached mode:

```
docker-compose up
```

Or start only one service:

```
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
