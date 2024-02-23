import { $ } from 'zx'

void (async () => {
  const postgresProjects = ['da-workers-neon', 'da-workers-pg', 'da-workers-pg-worker']
  const sqliteProjects = ['da-workers-libsql', 'da-workers-d1']
  const mysqlProjects = ['da-workers-planetscale']

  const projects = [...postgresProjects, ...sqliteProjects, ...mysqlProjects]

  const getSchemaFile = (project: string) => {
    if (postgresProjects.includes(project)) {
      return `${__dirname}/schema.postgres.prisma`
    }
    if (mysqlProjects.includes(project)) {
      return `${__dirname}/schema.mysql.prisma`
    }
    return `${__dirname}/schema.sqlite.prisma`
  }

  await $`pnpm install` // needs this for `pnpm prisma`

  for (const project of projects) {
    // `nodejs_compat` is only needed when using `pg`
    const compatFlags = project === 'da-workers-pg-worker' ? 'nodejs_compat' : ''
    const nodeCompat = project === 'da-workers-pg' ? '--node-compat' : ''
    const projectDir = `${__dirname}/${project}`

    // Install deps & copy schema & generate Prisma Client
    await $`cp ${getSchemaFile(project)} ${projectDir}/schema.prisma`
    await $`pnpm prisma generate --schema=${projectDir}/schema.prisma`

    // this is because we can not override peerDependencies in a symlinked workspace
    // basically emulates adding `"pg": "npm:@prisma/pg-worker"` to your package.json
    if (project === 'da-workers-pg-worker') {
      // 1. copy the adapter, 2. swap pg with pg-worker (see test file for more info)
      await $`cp -rL ${__dirname}/../adapter-pg ${__dirname}/node_modules/@prisma/adapter-pg-worker`
      await $`rm -fr ${__dirname}/node_modules/@prisma/adapter-pg-worker/node_modules/pg`
      await $`ln -s ${__dirname}/../pg-worker ${__dirname}/node_modules/@prisma/adapter-pg-worker/node_modules/pg`
    }

    // Delete existing output (if it exists)
    await $`rm -rf ${projectDir}/output`
    await $`rm -rf ${projectDir}/output.tgz`

    // Use wrangler to generate the function output
    await $`pnpm wrangler deploy ${projectDir}/index.js --dry-run --outdir=${projectDir}/output --compatibility-date 2024-01-26 --compatibility-flags [${compatFlags}] ${nodeCompat} --name ${project}`

    // Delete *.js.map & Markdown files
    await $`rm ${projectDir}/output/*.js.map`
    await $`rm ${projectDir}/output/*.md`

    // Create the archive based on wrangler's output
    await $`gzip -cr ${projectDir}/output > ${projectDir}/output.tgz`

    // Print size
    await $`echo "Size of ${project}:"`
    await $`echo "$(echo "$(cat ${projectDir}/output.tgz | wc -c) / 1000" | bc)KB"`
    await $`echo "$(echo "$(cat ${projectDir}/output.tgz | wc -c) * 0.976562 / 1000" | bc)KiB"`
  }
})()
