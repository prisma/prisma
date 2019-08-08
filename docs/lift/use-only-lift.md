# Using Lift (without Photon)

You can use Lift as your migration system without using Photon for database access. This is useful when your application is written in a programming language that's not yet supported by Photon or when it's not possible to swap out the current data access code.

When using Lift without Photon, there are two ways to get started:

- **From scratch**: Write your data model and map it to the database
- **With an existing database**: Introspect your database to obtain your initial data model

## Getting started with Lift

### 1. Install the Prisma CLI

```
npm install -g prisma2
```

### 2. Set up project using `prisma init`

Run the following command to initialize a new project:

```
prisma init hello-world
```

Then follow the interactive prompt:

1. Select your database type
    - **SQLite**
    - **MySQL**
    - **PostgreSQL**
    - MongoDB (coming soon)
2. Provide your database credentials ([more info](#database-credentials))
3. Select the database (MySQL, MongoDB) or schema (PostgreSQL)
4. Select **Only Lift**

Once you're done with the interactive prompt, the CLI generates your initial data model which reflects your current database schema. The data model connects to your database by listing it as a data source.

### 3. Migrate your database with Lift

Every schema migration with Lift is a 3-step-process:

1. **Adjust data model**: Change your [data model definition](../data-modeling.md#data-model-definition) to match your desired database schema.
1. **Save migration**: Run `prisma2 lift save` to create your [migration files](./migration-files.md) on the file system.
1. **Run migration**: Run `prisma2 lift up` to perform the migration against your database.

## Database credentials

<Details><Summary>Database credentials for <strong>SQLite</strong></Summary>
<br />
When using SQLite, you need to provide the _file path_ to your existing SQLite database file.

</Details>

<Details><Summary>Database credentials for <strong>MySQL</strong></Summary>
<br />
When using MySQL, you need to provide the following information to connect your existing MySQL database server:

- **Host**: The IP address/domain of your database server, e.g. `localhost`.
- **Post**: The port on which your database server listens, e.g. `5432` (PostgreSQL) or `3306` (MySQL).
- **User**: The database user, e.g. `admin`.
- **Password**: The password for the database user.
- **SSL**: Whether or not your database server uses SSL.

Once provided, the CLI will prompt you to select one of the existing **databases** on your MySQL server for introspection.

</Details>

<Details><Summary>Database credentials for <strong>PostgreSQL</strong></Summary>
<br />
When using PostgreSQL, you need to provide the following information to connect your existing MySQL database server:

- **Host**: The IP address/domain of your database server, e.g. `localhost`.
- **Port**: The port on which your database server listens, e.g. `5432` (PostgreSQL) or `3306` (MySQL).
- **Database**: The name of the database which contains the schema to introspect. 
- **User**: The database user, e.g. `admin`.
- **Password**: The password for the database user.
- **SSL**: Whether or not your database server uses SSL.

Once provided, the CLI will prompt you to select one of the existing **schemas** on your MySQL server for introspection.

</Details>

<Details><Summary>Database credentials for <strong>MongoDB</strong></Summary>
<br />
When using MongoDB, you need to provide your [MongoDB connection string](https://docs.mongodb.com/manual/reference/connection-string), e.g. `http://user1:myPassword@localhost:27017/admin`. Note that this must include the database credentials as well as the [`authSource`](https://docs.mongodb.com/manual/reference/connection-string/#authentication-options) database that's storing the credentials of your MongoDB `admin` user (by default it is often called `admin`).

</Details>



