'use strict'

import HttpProxyAgent from 'http-proxy-agent'
import HttpsProxyAgent from 'https-proxy-agent'
import Url from 'url'

// code from https://raw.githubusercontent.com/request/request/5ba8eb44da7cd639ca21070ea9be20d611b85f66/lib/getProxyFromURI.js

function formatHostname(hostname: string): string {
  // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
  return hostname.replace(/^\.*/, '.').toLowerCase()
}

function parseNoProxyZone(zone: string): {
  hostname: string
  port: string
  hasPort: boolean
} {
  zone = zone.trim().toLowerCase()

  const zoneParts = zone.split(':', 2)
  const zoneHost = formatHostname(zoneParts[0])
  const zonePort = zoneParts[1]
  const hasPort = zone.includes(':')

  return { hostname: zoneHost, port: zonePort, hasPort: hasPort }
}

function uriInNoProxy(uri, noProxy): boolean {
  const port = uri.port || (uri.protocol === 'https:' ? '443' : '80')
  const hostname = formatHostname(uri.hostname)
  const noProxyList = noProxy.split(',')

  // iterate through the noProxyList until it finds a match.
  return noProxyList.map(parseNoProxyZone).some(function (noProxyZone) {
    const isMatchedAt = hostname.indexOf(noProxyZone.hostname)
    const hostnameMatched = isMatchedAt > -1 && isMatchedAt === hostname.length - noProxyZone.hostname.length

    if (noProxyZone.hasPort) {
      return port === noProxyZone.port && hostnameMatched
    }

    return hostnameMatched
  })
}

function getProxyFromURI(uri): string | null {
  // Decide the proper request proxy to use based on the request URI object and the
  // environmental variables (NO_PROXY, HTTP_PROXY, etc.)
  // respect NO_PROXY environment variables (see: http://lynx.isc.org/current/breakout/lynx_help/keystrokes/environments.html)

  const noProxy = process.env.NO_PROXY || process.env.no_proxy || ''

  // if the noProxy is a wildcard then return null

  if (noProxy === '*') {
    return null
  }

  // if the noProxy is not empty and the uri is found return null

  if (noProxy !== '' && uriInNoProxy(uri, noProxy)) {
    return null
  }

  // Check for HTTP or HTTPS Proxy in environment Else default to null

  if (uri.protocol === 'http:') {
    return process.env.HTTP_PROXY || process.env.http_proxy || null
  }

  if (uri.protocol === 'https:') {
    return (
      process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null
    )
  }

  // if none of that works, return null
  // (What uri protocol are you using then?)

  return null
}

export function getProxyAgent(
  url: string,
): HttpProxyAgent.HttpProxyAgent | HttpsProxyAgent.HttpsProxyAgent | undefined {
  const uri = Url.parse(url)
  const proxy = getProxyFromURI(uri)
  if (!proxy) {
    return undefined
  }

  if (uri.protocol === 'http:') {
    return HttpProxyAgent(proxy)
  }

  if (uri.protocol === 'https:') {
    return HttpsProxyAgent(proxy)
  }

  return undefined
}
