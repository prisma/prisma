import { parseDistro, parseOpenSSLVersion } from '../getPlatform'

const tests = [{
  name: '1.1',
  content: `OpenSSL 1.1.0d  1 Feb 2014`,
  expect: '1.1.x',
}, {
  name: '1.2',
  content: `OpenSSL 1.0.2g  1 Mar 2016`,
  expect: '1.0.x',
}]

let fail = false

for (const t of tests) {
  const actual = parseOpenSSLVersion(t.content)
  if (actual !== t.expect) {
    console.log('openssl', t.name, 'expected', t.expect, 'but is', actual)
    fail = true
  } else {
    console.log('openssl', t.name, 'success')
  }
}

if (fail) {
  console.log('openssl', 'failed')
  process.exit(1)
} else {
  console.log('openssl', 'success')
}
