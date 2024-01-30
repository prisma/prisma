import { $ } from 'zx'

void (async () => {
  const projects = ['da-workers-neon', 'da-workers-planetscale', 'da-workers-pg', 'da-workers-libsql', 'da-workers-d1']

  for (const project of projects) {
    // `--node-compat` is only needed when using `pg`
    const nodeCompat = project.includes('pg') ? '--node-compat' : ''
    const projectDir = `${__dirname}/${project}`

    // Install deps & copy schema & generate Prisma Client
    await $`pnpm install` // needs this otherwise `pnpm prisma` does not work
    await $`cd ${projectDir}`
    await $`cp ${__dirname}/schema.prisma ${projectDir}/schema.prisma`
    await $`pnpm prisma generate --schema=${projectDir}/schema.prisma`
    // Delete existing output (if it exists)
    await $`rm -rf ${projectDir}/output`
    await $`rm -rf ${projectDir}/output.tgz`
    // Use wrangler to generate the function output
    await $`pnpm wrangler deploy ${projectDir}/index.js --dry-run --outdir=${projectDir}/output --compatibility-date 2024-01-26 --name ${project} ${nodeCompat}`
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
