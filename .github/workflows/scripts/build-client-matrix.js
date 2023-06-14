#!/usr/bin/env node
'use strict'
const fs = require('fs')

// TODO: maybe we can just use workflow_dispatch now?
const testAll = process.argv[2] === 'true'
console.log({ testAll })

const queryEngine = ['library']

if (testAll) {
  queryEngine.push('binary')
}

const outputRaw = { queryEngine }

const outputsStr = Object.entries(outputRaw)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
  .join('\n')

console.log(outputsStr)

fs.appendFileSync(process.env.GITHUB_OUTPUT, outputsStr, 'utf8')
