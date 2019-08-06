# Prisma 2 `now` example

In order to run Prisma 2 with `now`, you need to use `@now/node@canary` and set the `maxLambdaSize` to `25mb`:

```json
{
  "src": "index.js",
  "use": "@now/node@canary",
  "config": {
    "maxLambdaSize": "25mb"
  }
}
```

## Deployment

```bash
npm install -g now
now
```

## [Demo](https://now-test.timsuchanek.now.sh)
