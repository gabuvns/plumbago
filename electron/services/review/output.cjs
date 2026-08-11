const fs = require('node:fs/promises')
const path = require('node:path')
const { run, runtimeFor } = require('../../core/runtime.cjs')
const { finding } = require('./content.cjs')

async function findNamed(directory, names, output = []) {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await findNamed(absolute, names, output)
    if (entry.isFile() && names.has(entry.name.toLowerCase())) output.push(absolute)
  }
  return output
}

function canonicalFromHtml(raw) {
  const tag = raw.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0] || ''
  return tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || ''
}

async function inspectOutput(root, baseURL) {
  const output = path.join(root, '.plumbago', 'review-output')
  const cache = path.join(root, '.plumbago', 'review-cache')
  const findings = []
  await fs.rm(output, { recursive: true, force: true })
  await fs.mkdir(path.dirname(output), { recursive: true })
  try {
    const runtime = runtimeFor(root)
    const cacheArgument = runtime.kind === 'wsl' && process.platform === 'win32' ? `${runtime.workingDirectory}/.plumbago/review-cache` : cache
    const args = ['--minify', '--cleanDestinationDir', '--cacheDir', cacheArgument, '--destination', '.plumbago/review-output']
    if (baseURL) args.push('--baseURL', baseURL)
    await run(root, 'hugo', args)
  } catch (error) {
    findings.push(finding('hugo-build-failed', 'error', { scope: 'output', detail: error.message }))
    await fs.rm(output, { recursive: true, force: true })
    await fs.rm(cache, { recursive: true, force: true })
    return findings
  }

  try {
    const named = await findNamed(output, new Set(['sitemap.xml', 'index.xml', 'robots.txt']))
    const sitemap = named.find((file) => path.basename(file).toLowerCase() === 'sitemap.xml')
    const rss = named.find((file) => path.basename(file).toLowerCase() === 'index.xml')
    const robots = named.find((file) => path.basename(file).toLowerCase() === 'robots.txt')
    if (!sitemap) findings.push(finding('output-sitemap-missing', 'warning', { scope: 'output' }))
    else if (!/<(?:urlset|sitemapindex)\b/i.test(await fs.readFile(sitemap, 'utf8'))) findings.push(finding('output-sitemap-invalid', 'error', { scope: 'output', path: path.relative(output, sitemap).replaceAll(path.sep, '/') }))
    if (!rss) findings.push(finding('output-rss-missing', 'recommendation', { scope: 'output' }))
    else if (!/<(?:rss|feed)\b/i.test(await fs.readFile(rss, 'utf8'))) findings.push(finding('output-rss-invalid', 'warning', { scope: 'output', path: path.relative(output, rss).replaceAll(path.sep, '/') }))
    if (!robots) findings.push(finding('output-robots-missing', 'recommendation', { scope: 'output' }))
    else if (/^\s*disallow\s*:\s*\/\s*$/im.test(await fs.readFile(robots, 'utf8'))) findings.push(finding('output-robots-blocks-all', 'warning', { scope: 'output' }))

    const home = await fs.readFile(path.join(output, 'index.html'), 'utf8').catch(() => '')
    const canonical = canonicalFromHtml(home)
    if (!canonical) findings.push(finding('output-canonical-missing', 'recommendation', { scope: 'output' }))
    else if (baseURL && !canonical.startsWith(baseURL)) findings.push(finding('output-canonical-mismatch', 'warning', { scope: 'output', values: { canonical, baseURL } }))
  } finally {
    await fs.rm(output, { recursive: true, force: true })
    await fs.rm(cache, { recursive: true, force: true })
  }
  return findings
}

module.exports = { inspectOutput }
