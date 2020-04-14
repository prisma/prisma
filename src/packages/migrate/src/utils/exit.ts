import psTree from 'ps-tree'

export async function exit() {
  const children = await getChildProcesses()
  children.forEach(child => {
    process.kill(Number(child.PID))
  })
  process.exit()
}

interface ChildProcessInfo {
  PPID: string
  PID: string
  STAT: string
  COMM: string
}

function getChildProcesses(): Promise<ChildProcessInfo[]> {
  return new Promise((resolve, reject) => {
    psTree(process.pid, (err, children) => {
      if (err) {
        reject(err)
      } else {
        resolve(children)
      }
    })
  })
}
