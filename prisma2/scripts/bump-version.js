#!/usr/bin/env node

const currentVersion = process.argv[2]

const lastDot = currentVersion.lastIndexOf('.')
const alphaNumber = currentVersion.slice(lastDot + 1)
const newVersion = currentVersion.slice(0, lastDot + 1) + (Number(alphaNumber) + 1)

console.log(newVersion)
