import * as miniProxy from '@prisma/mini-proxy'
import { existsSync } from 'fs'

/**
 * Generates a certificate for the Mini Proxy and prints its CA path to stdout.
 * This is used to configure Node.js so it trusts the Mini proxy certificate.
 */
export async function printMiniProxyCaCert() {
  if (existsSync(miniProxy.defaultCertificatesConfig.caCert) === false) {
    await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
  }

  console.log(miniProxy.defaultCertificatesConfig.caCert)
}

void printMiniProxyCaCert()
