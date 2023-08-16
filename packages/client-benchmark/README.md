# client-benchmark

Internal package for benchmarking of prisma client performance. Allows to measure different lifecycle metrics with different schema sizes, plot the results and compare different prisma versions.

## Requirements

For plotting the graphs, [GNUPlot](http://www.gnuplot.info/) is required.

## Usage

First, ensure that the package is built:

```sh
pnpm build
```

Single measurement can be done this way:

```sh
pnpm measure --models 50 --relations 40 --enums 10
```

This generates a schema with 50 models, 40 relations and 10 enums, generates a client and creates a database, runs test script, gathers and prints out the metrics.

By default, local dev prisma version is used. It is also possible to specify different prisma version or npm tag:

```
pnpm measure --prisma-version=4.8.0 --models 50
```

Models, relations and enums can be specified as ranges. In that case, test script is re-run continuously with
the growing schema and the results are saved into csv file in `results` subdirectory:

```
pnpm measure --prisma-version=4.8.0 --models 1:1000:20
```

This test runs benchmarks with the schemas from 1 to 1000 models, adding 20 models for each iterations. Step part is optional. If it is omitted, increments of 1 will be used.

When ranges are used, collected results can be plotted with:

```
pnpm plot
```

By default, it shows the timing of the whole benchmark script (client constructor, `$connect` and query execution). It is also possible to pass specific metric as an argument:

```
pnpm plot prisma:client:connect
```

Two special metrics, `heap` and `rss`, could be used for plotting test script memory usage.

It is also possible to compare one prisma version with another:

```
pnpm measure --baseline-version=4.8.0 --prisma-version=4.10.1 --models 1:1000:20
```

This will gather results for both `4.8.0` and `4.10.1` versions of prisma. `pnpm plot` command then will show 2 graphs for each metric. As with other commands, `--prisma-version` flag defaults to local dev version and can be omitted.

Lastly, it is possible to compare the effect of different preview-features using `--features` and `--baseline-features` flags:

```
pnpm measure --features=fieldReference --baseline-features='' --models 1:50
```

This will run local prisma version with no extra preview features enabled and compare it with the same
version with `fieldReference` preview feature enabled.
**Note**: `tracing` preview feature is always enabled as the benchmark itself relies on it.

It is also possible to combine `--features` and `--baseline-features` with `--prisma-version` and `--baseline-version` flags.

## Usage with AWS Lambda

Benchmark script can also be used to measure performance on AWS lambda. This requires some additional configurations:

1. Get AWS Credentials as described [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html). The role you are using should
   be allowed to create, delete and invoke lambda functions.
2. Create execution role for Lambda as described [here](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html).
3. Copy `config.example.json` into `config.json` and fill in the values.

After config file is created, add `--target lambda` flag to a script to automatically upload benchmark to lambda, execute it there and get back the results.
