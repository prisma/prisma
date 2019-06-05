# Lift User Flows

We all have these user flows in mind, but I'd like to explicitly spell them out
and align on them. This will make it easier to design the Lift CLI.

If there are cases that I'm missing or you do things differently, then we can
add them to this document

## I. New Project, in development, no migrations yet

### 🐴 Existing Tools

1. `migrate new setup`, generating `migrate/001_setup.up.sql` &
   `migrate/001_setup.down.sql`
2. Write 1 large SQL schema with all the tables you initially need
3. Run `DATABASE_URL="postgres://localhost:5421/db" migrate up` to migrate the
   local database on your machine
4. Develop a new feature, go to **III**.

### 🚀 Lift

1. Run `prisma dev` will start watching `*.prisma` files locally, when there are
   changes, we automatically migrate. `migrations/` has not been created yet,
   it's doing these migrations all in memory. Under the hood it sees that you've
   added a connector to the datamodel and it will run
   `lift up --skip-migrations`, & `photon generate` automatically for you. No
   migration files will get written to the filesystem at this time.
2. Develop a new feature, go to **III**.

## II. Onboarded Developer, in development, existing migrations

### 🐴 Existing Tools

1. Pull the project & install dependencies `git pull http://github.com/app/app`
2. Run `DATABASE_URL="postgres://localhost:5421/db" migrate up` to migrate your
   local database to the current project's state
3. Develop a new feature, go to **III**.

### 🚀 Lift

1. Start `prisma dev` if you haven't already. This command will watch `*.prisma`
   files locally.
2. Since there are existing migrations, we'll first load those into memory, then
   run `lift up` & `photon generate`. Now that we're synced, subsequent changes
   to the datamodel will run `lift up --skip-migrations`, & `photon generate`
   automatically for you.
3. Develop a new feature, go to **III**.

## III. New Feature, in development, existing migrations

### 🐴 Existing Tools

1. As you're developing, you realize you need to adjust or change fields, so you
   run `migrate new change field`, generating `migrate/xxx_change_field.up.sql`
   & `migrate/xxx_change_field.down.sql`
2. You write the `alter column name ...`
3. Run `DATABASE_URL="postgres://localhost:5421/db" migrate up` to commit that
   change to your local database
4. Ready to push to production? go to IV. or V. depending on your team's setup.

### 🚀 Lift

1. Start `prisma dev` if you haven't already. This command will watch `*.prisma`
   files locally, when there are changes, we automatically migrate.
2. Since there are existing migrations, we'll first load those into memory, then
   run `lift up` & `photon generate`. Now that we're synced, subsequent changes
   to the datamodel will run `lift up --skip-migrations`, & `photon generate`
   automatically for you. No further migration files will get written to the
   filesystem at this time.

## IV. Migrate production directly

### 🐴 Existing Tools

1. Run `DATABASE_URL="postgres://user:pass@rds.amazon.com:5421/db" migrate up`
   to migrate the production database up to the current state of your local
   `migrations/` folder.

This is the same workflow for CI/CD below.

### 🚀 Lift

1. Run `prisma lift create "feature x"` to write out the migration to the
   filesystem. We can show the diff between the current local state and previous
   local state, but personally I'm worried people will think that's the diff
   between local and remote which it's not. Diff between 2 local states is not
   backed in reality, it's just a plan.
2. Run `prisma lift up` to migrate the production databases to this point. If
   there are changes, this will show a diff between the local and the remote
   state and ask you to accept.

## V. Push to Github, CI/CD migrates production

### 🐴 Existing Tools

1. Run `git push origin master`
2. CI/CD runs
   `DATABASE_URL="postgres://user:pass@rds.amazon.com:5421/db" migrate up` to
   migrate the production database up to the current state of your `migrations/`
   folder. For CI/CD `migrations/` lives in the build container.

### 🚀 Lift

1. Run `prisma lift create "feature x"` to write out the migration to the
   filesystem.
   - If a user forgets this step, `prisma lift up` will not migrate anything,
     meaning the pushed datamodel.prisma will be out of sync with the production
     database. This is the current status quo though, so I think it's okay.
2. Run `prisma lift up --preview` to see a diff of how the current local state
   differs from the current remote state
3. Run `git push origin master`
4. CI/CD runs `prisma lift up --auto-accept` to migrate the production databases
   to this point in time auto-accepting the migration confirmation.
   - In the future, we can build this out further to provide online diffs and
     UI-based confirmations.
