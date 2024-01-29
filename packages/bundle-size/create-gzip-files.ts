import { $ } from 'zx'

void (async () => {
  const projects = ['da-workers-neon', 'da-workers-planetscale', 'da-workers-pg', 'da-workers-libsql']

  for (const project of projects) {
    const nodeCompat = project.includes('pg') ? '--node-compat' : ''

    // Install deps & copy schema & generate Prisma Client
    await $`pnpm install` // needs this otherwise `pnpm prisma` does not work
    await $`cd ${__dirname}/${project}`
    await $`cp ${__dirname}/schema.prisma ${__dirname}/${project}/schema.prisma`
    await $`pnpm prisma generate --schema=${__dirname}/${project}/schema.prisma`
    // Delete existing output (if it exists)
    await $`rm -rf ${__dirname}/${project}/output`
    await $`rm -rf ${__dirname}/${project}/output.tgz`
    // Use wrangler to generate the function output
    await $`pnpm wrangler deploy ${__dirname}/${project}/index.js --dry-run --outdir=${__dirname}/${project}/output --compatibility-date 2024-01-26 --name ${project} ${nodeCompat}`
    // Delete *.js.map & Markdown files
    await $`rm ${__dirname}/${project}/output/*.js.map`
    await $`rm ${__dirname}/${project}/output/*.md`
    // Create the archive based on wrangler's output
    await $`gzip -cr ${__dirname}/${project}/output > ${__dirname}/${project}/output.tgz`
    // Print size
    await $`echo "Size of ${project}:"`
    await $`echo "$(echo "$(cat ${__dirname}/${project}/output.tgz | wc -c) / 1000" | bc)KB"`
    await $`echo "$(echo "$(cat ${__dirname}/${project}/output.tgz | wc -c) * 0.976562 / 1000" | bc)KiB"`
  }
})()
