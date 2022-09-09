import { parseOpenSSLVersion } from '../getPlatform'

const tests = [
  {
    name: '1.1',
    content: `OpenSSL 1.1.0d  1 Feb 2014`,
    expect: '1.1.x',
  },
  {
    name: '1.2',
    content: `OpenSSL 1.0.2g  1 Mar 2016`,
    expect: '1.0.x',
  },
  {
    name: '3.0',
    content: `OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2 15 Mar 2022)`,
    expect: '3.0.x',
  },
]

describe('parseOpenSSLVersion', () => {
  for (const t of tests) {
    test(t.name, () => {
      const actual = parseOpenSSLVersion(t.content)
      expect(actual).toBe(t.expect)
    })
  }
})
