'use strict'

import Debug from '@prisma/debug'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import Url from 'node:url'

const debug = Debug('prisma:fetch-engine:getProxyAgent')

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
  return noProxyList.map(parseNoProxyZone).some((noProxyZone) => {
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
  if (noProxy) debug(`noProxy is set to "${noProxy}"`)

  // if the noProxy is a wildcard then return null
  if (noProxy === '*') {
    return null
  }

  // if the noProxy is not empty and the uri is found return null
  if (noProxy !== '' && uriInNoProxy(uri, noProxy)) {
    return null
  }

  // Check for HTTP or HTTPS Proxy in environment
  // default to null
  if (uri.protocol === 'http:') {
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || null
    if (httpProxy) debug(`uri.protocol is HTTP and the URL for the proxy is "${httpProxy}"`)
    return httpProxy
  }

  if (uri.protocol === 'https:') {
    const httpsProxy =
      process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null
    if (httpsProxy) debug(`uri.protocol is HTTPS and the URL for the proxy is "${httpsProxy}"`)
    return httpsProxy
  }

  // if none of that works, return null
  // (What uri protocol are you using then?)
  return null
}

export function getProxyAgent(url: string): HttpProxyAgent<string> | HttpsProxyAgent<string> | undefined {
  try {
    const uri = Url.parse(url)
    const proxy = getProxyFromURI(uri)

    if (!proxy) {
      return undefined
    }
    if (uri.protocol === 'http:') {
      try {
        return new HttpProxyAgent(proxy)
      } catch (agentError) {
        throw new Error(
          `Error while instantiating HttpProxyAgent with URL: "${proxy}"\n${agentError}\nCheck the following env vars "http_proxy" or "HTTP_PROXY". The value should be a valid URL starting with "http://"`,
        )
      }
    } else if (uri.protocol === 'https:') {
      try {
        return new HttpsProxyAgent(proxy)
      } catch (agentError) {
        throw new Error(
          `Error while instantiating HttpsProxyAgent with URL: "${proxy}"\n${agentError}\nCheck the following env vars "https_proxy" or "HTTPS_PROXY". The value should be a valid URL starting with "https://"`,
        )
      }
    }
  } catch (e) {
    console.warn('An error occurred in getProxyAgent(), no proxy agent will be used.', e)
  }

  return undefined
}
