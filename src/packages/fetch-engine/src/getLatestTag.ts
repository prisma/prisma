import fetch from 'node-fetch'
import { getProxyAgent } from './getProxyAgent'
import { getDownloadUrl } from './util'
import { platforms } from '@prisma/get-platform'
import PQueue from 'p-queue'
import execa from 'execa'
import pMap from 'p-map'
import chalk from 'chalk'

export async function getLatestTag(): Promise<any> {
  if (process.env.RELEASE_PROMOTE_DEV) {
    const versions = await getVersionHashes(process.env.RELEASE_PROMOTE_DEV)
    console.log(
      `getLatestTag: taking ${versions.engines} as RELEASE_PROMOTE_DEV has been provided`,
    )
    return versions.engines
  }

  let branch = await getBranch()
  // remove the "integration/" part
  branch = branch.replace(/^integration\//, '')

  // first try to get the branch as it is
  // if it doesn't have an equivalent in the engines repo
  // default back to master
  let commits = await getCommits(branch)
  if (!commits && branch !== 'master' && !isPatchBranch(branch)) {
    console.log(
      `Overwriting branch "${branch}" with "master" as it's not a branch we have binaries for`,
    )
    branch = 'master'
    commits = await getCommits(branch)
  }

  if (process.env.CI) {
    return getCommitAndWaitIfNotDone(commits)
  }

  return getFirstFinishedCommit(commits)
}

function getAllUrls(commit: string): string[] {
  const urls = []
  const excludedPlatforms = [
    'freebsd',
    'arm',
    'linux-nixos',
    'openbsd',
    'netbsd',
    'freebsd11',
    'freebsd12',
  ]
  const relevantPlatforms = platforms.filter(
    (p) => !excludedPlatforms.includes(p),
  )
  for (const platform of relevantPlatforms) {
    for (const engine of [
      'query-engine',
      'introspection-engine',
      'migration-engine',
      'prisma-fmt',
    ]) {
      for (const extension of [
        '.gz',
        '.gz.sha256',
        '.gz.sig',
        '.sig',
        '.sha256',
      ]) {
        const downloadUrl = getDownloadUrl(
          'all_commits',
          commit,
          platform,
          engine,
          extension,
        )
        urls.push(downloadUrl)
      }
    }
  }

  return urls
}

async function getFirstFinishedCommit(commits: string[]): Promise<string> {
  for (const commit of commits) {
    const urls = getAllUrls(commit)
    const exist = await pMap(urls, urlExists, { concurrency: 10 })
    const hasMissing = exist.some(e => !e)

    if (!hasMissing) {
      return commit
    } else {
      const missing = urls.filter((_, i) => exist[i])
      // if all are missing, we don't have to talk about it
      // it might just be a broken commit or just still building
      if (missing.length !== urls.length) {
        console.log(`${chalk.blueBright('info')} The engine commit ${commit} is not yet done. We're skipping it as we're in dev. The following urls are missing:\n\n${missing.join('\n')}`)
      }
    }
  }
}

async function getCommitAndWaitIfNotDone(commits: string[]): Promise<string> {
  for (const commit of commits) {
    const urls = getAllUrls(commit)
    let exist = await pMap(urls, urlExists, { concurrency: 10 })
    let hasMissing = exist.some(e => !e)

    if (!hasMissing) {
      return commit
    } else {
      let missing = urls.filter((_, i) => exist[i])
      // if all are missing, we don't have to talk about it
      // it might just be a broken commit or just still building
      if (missing.length !== urls.length) {
        const started = Date.now()
        while (hasMissing) {
          if ((Date.now() - started) > 1000 * 60 * 20) {
            throw new Error(`No new engine for commit ${commit} ready after waiting for 20 mintues.`)
          }
          console.log(`The engine commit ${commit} is not yet done. ${missing.length} urls are missing. Trying again in 5 seconds`)
          exist = await pMap(urls, urlExists, { concurrency: 10 })
          missing = urls.filter((_, i) => exist[i])
          hasMissing = exist.some(e => !e)
          if (!hasMissing) {
            return commit
          }
          await new Promise(r => setTimeout(r, 5000))
        }
      }
    }
  }
}

async function urlExists(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      agent: getProxyAgent(url),
    })

    const headers = fromEntries(res.headers.entries())
    if (res.status > 200) {
      // console.error(res, headers)
    }
    if (parseInt(headers['content-length']) > 0) {
      return res.status < 300
    }
  } catch (e) {
    //
    // console.error(e)
  }
  return false
}

function fromEntries<T>(
  entries: IterableIterator<[string, T]>,
): Record<string, T> {
  const result = {}
  for (const [key, value] of entries) {
    result[key] = value
  }
  return result
}

async function getBranch() {
  if (process.env.PATCH_BRANCH) {
    return process.env.PATCH_BRANCH
  }
  if (process.env.BUILDKITE_BRANCH) {
    return process.env.BUILDKITE_BRANCH
  }
  if (process.env.GITHUB_CONTEXT) {
    const context = JSON.parse(process.env.GITHUB_CONTEXT)
    const split = context.ref.split('/')
    return split[split.length - 1]
  }

  // Need to be handled
  // for example it's used in https://github.com/prisma/binary-tester and the environment
  // is not a git repository so it fails
  try {
    const result = await execa.command('git rev-parse --abbrev-ref HEAD', {
      shell: true,
      stdio: 'pipe',
    })
    return result.stdout
  } catch (e) {
    console.error(e)
  }

  return
}

// TODO: Adjust this for stable release
function isPatchBranch(version: string): boolean {
  return /^2\.(\d+)\.x/.test(version)
}

async function getVersionHashes(
  npmVersion: string,
): Promise<{ engines: string; prisma: string }> {
  return fetch(`https://unpkg.com/@prisma/cli@${npmVersion}/package.json`, {
    headers: {
      accept: 'application/json',
    },
  })
    .then((res) => res.json())
    .then((pkg) => ({
      engines: pkg.prisma.version,
      prisma: pkg.prisma.prismaCommit,
    }))
}

async function getCommits(branch: string): Promise<string[] | null> {
  const url = `https://api.github.com/repos/prisma/prisma-engines/commits?sha=${branch}`
  const result = await fetch(url, {
    agent: getProxyAgent(url),
  } as any).then((res) => res.json())

  if (!Array.isArray(result)) {
    return null
  }

  const commits = result.map((r) => r.sha)
  return commits
}
