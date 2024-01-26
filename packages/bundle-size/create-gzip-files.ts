import { $ } from 'zx'

void (async () => {
  const projects = ['da-workers-neon', 'da-workers-planetscale', 'da-workers-pg', 'da-workers-libsql']

  for (const project of projects) {
    const nodeCompat = project.includes('pg') ? '--node-compat' : ''

    await $`cd ${__dirname}/${project}`
    await $`cp ${__dirname}/schema.prisma ${__dirname}/${project}/schema.prisma`
    await $`rm -rf ${__dirname}/${project}/output`
    await $`rm -rf ${__dirname}/${project}/output.tgz`
    await $`pnpm wrangler deploy ${__dirname}/${project}/index.js --dry-run --outdir=${__dirname}/${project}/output --compatibility-date 2024-01-26 --name ${project} ${nodeCompat}`
    await $`rm ${__dirname}/${project}/output/*.js.map`
    await $`rm ${__dirname}/${project}/output/*.md`
    await $`gzip -cr ${__dirname}/${project}/output > ${__dirname}/${project}/output.tgz`
    await $`echo "Size of ${project}:"`
    await $`echo "$(echo "$(cat ${__dirname}/${project}/output.tgz | wc -c) / 1000" | bc)KB"`
    await $`echo "$(echo "$(cat ${__dirname}/${project}/output.tgz | wc -c) * 0.976563 / 1000" | bc)KiB"`
  }
})()
