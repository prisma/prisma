import chalk from 'chalk'
import net from 'net'
import pMap from 'p-map'

const ports = Array.from({ length: 20 }, (v, k) => k + 8430)
const portList = [
  10405, // Prenzlauer Berg
  10119, // Mitte
  10785, // Kreuzberg
  8419, // Reverse Orwell
  8420,
  8421,
  8422,
  8423,
  8424,
  8425,
  8426,
  8427,
  8428,
  8429,
  ...ports,
]

const isPortFree = (port: number) =>
  new Promise(resolve => {
    const server = net.createServer()
    server.on('error', () => resolve(false))
    server.listen(port, () => {
      server.close(() => {
        resolve(true)
      })
    })
  })

const fetchPath = (port: number): Promise<string | null> =>
  new Promise(resolve => {
    let resolved = false
    const client = new net.Socket()

    client.connect(port)

    client.on('error', () => {
      resolve(null)
    })

    client.on('data', data => {
      try {
        const result = JSON.parse(data.toString())
        if (result && result.prismaProjectPath) {
          resolved = true
          resolve(result.prismaProjectPath)
        }
      } catch (e) {
        resolved = true
        resolve(null)
      } finally {
        client.destroy()
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolve(null)
      }
    }, 3000)
  })

function startServer(projectPath: string, port: number): () => void {
  const server = net.createServer(socket => {
    socket.write(JSON.stringify({ prismaProjectPath: projectPath }))
    socket.pipe(socket)
  })

  server.listen(port)

  return () => {
    server.close()
  }
}

// checks if dev command is running in projectPath
// and returns next free port if not the case
export async function getNextFreePort(projectPath: string): Promise<number | undefined> {
  const portOccupancy = await pMap(portList, async port => ({ port, free: await isPortFree(port) }), {
    concurrency: 15,
  })
  const usedPorts = portOccupancy.filter(o => !o.free)
  const nextFreePort = portOccupancy.find(p => p.free)

  if (usedPorts.length === portList.length || !nextFreePort) {
    throw new Error(
      `prisma lift could not start, as all port of ${portList.join(', ')} are used. Please free one of them.`,
    )
  }

  // of the used ports, check if they are running prisma dev and if they can tell us what path they're running on
  const potentialPaths = await Promise.all(usedPorts.map(usedPort => fetchPath(usedPort.port)))
  const paths = potentialPaths.filter(p => p)
  if (paths.includes(projectPath)) {
    return undefined
  }

  return nextFreePort.port
}

// occupy a path so that the user doesn't run prisma dev multiple times in the same path
export async function occupyPath(projectPath: string): Promise<() => void> {
  const nextFreePort = await getNextFreePort(projectPath)
  if (typeof nextFreePort !== 'number') {
    throw new Error(
      `There is already another ${chalk.bold('prisma dev')} command running in ${chalk.underline(projectPath)}`,
    )
  }

  return startServer(projectPath, nextFreePort)
}
