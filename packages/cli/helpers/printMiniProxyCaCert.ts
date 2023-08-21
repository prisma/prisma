import * as miniProxy from '@prisma/mini-proxy'
import { existsSync } from 'fs'

/**
 * Generates a certificate for the Mini Proxy and prints its CA path to stdout.
 */
export async function printMiniProxyCaCert() {
  if (existsSync(miniProxy.defaultCertificatesConfig.caCert) === false) {
    await miniProxy.generateCertificates(miniProxy.defaultCertificatesConfig)
  }

  console.log(miniProxy.defaultCertificatesConfig.caCert)
}

void printMiniProxyCaCert()
