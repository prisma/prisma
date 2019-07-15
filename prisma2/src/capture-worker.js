#!/usr/bin/env node

const { Sentry, byline } = require('../')

byline(process.stdin).on('data', line => {
  const json = JSON.parse(String(line))
  let e = new Error()
  Object.entries(json).forEach((key, value) => {
    e[key] = value
  })
  // needed to trick sentry https://github.com/getsentry/sentry-javascript/blob/1dda72490572b45ec17ba27aaac835dc8c08140d/packages/raven-node/lib/utils.js#L39
  // https://github.com/getsentry/sentry-javascript/blob/1dda72490572b45ec17ba27aaac835dc8c08140d/packages/raven-node/lib/client.js#L393
  json.__proto__ = e.__proto__
  Sentry.init({ dsn: 'https://a4f3825a54304947b7c23560e4e66399@sentry.io/1502677' })
  Sentry.captureException(json)
})

process.stdin.resume()
