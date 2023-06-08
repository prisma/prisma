#!/usr/bin/env node
'use strict'
const fs = require('fs')

const testAll = process.argv[2] === 'true'
console.log({ testAll })

const excludeClient = []
const excludeDataProxy = []

const queryEngine = ['library']

if (testAll) {
  queryEngine.push('binary')
} else {
  excludeClient.push({ node: 18, engineProtocol: 'json' })
  excludeDataProxy.push({ node: 16, engineProtocol: 'json' }, { node: 18, engineProtocol: 'json' })
}

const outputRaw = { queryEngine, excludeClient, excludeDataProxy }

const outputsStr = Object.entries(outputRaw)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join('\n')

console.log(outputsStr)

fs.appendFileSync(process.env.GITHUB_OUTPUT, outputsStr, 'utf8')
