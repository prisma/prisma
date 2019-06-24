# CircleCI Configuration Example

This example shows how to configute a CI setup using [CircleCI](https://circleci.com/) for Prisma.

## Get started

> **Note**: The project setup in this example is minimalistic. You can use it as a reference example for your own project, but you might want to evolve it into a more advanced setup.

### 1. Download the example

Clone the repository:

```
git clone git@github.com:prisma/prisma-examples.git
```

Install Node dependencies:

```
cd prisma-examples/typescript-circleci
```

### 2. Set up repository locally and on GitHub

Next, navigate into the downloaded folder and initiate a new git repository:

```sh
cd typescript-circleci
git init .
git add .
git commit -m "Initial commit"
```

In your GitHub account, create a new repository and copy its git URL, e.g.: `git@github.com:w0wka91/circleci-prisma.git`

Add a new remote to your local git repository:

```sh
git remote add origin git@github.com:w0wka91/circleci-prisma.git
```

Push your project to github:

```sh
git push --set-upstream origin master
```

### 3. Add project in CircleCI

Now, log in your [CircleCI](https://circleci.com/dashboard) account, add your github repository as a new project and click on `Start Building`.

### 4. Verify the build

In your CircleCI account, review the build and confirm that the build went through.

Here is a description of the performed steps that are expected to happen (compare to `.circleci/config.yml` as well):

1.  We spin up a new Prisma server and database using `docker-compose up -d`.
2.  We confirm that the Docker setup is correct with `docker ps`.
3.  We install the `npm` dependencies with `npm install`.
4.  We sleep 20 seconds to allow for the two Docker containers to finish their setup.
5.  We run `prisma deploy` with the locally installed version of Prisma. This will set up a new service `circleci` at stage `test` and seed some data according to `prisma.yml`.
6.  We run a short jest test where we fetch all users from the prisma server using prisma-client
