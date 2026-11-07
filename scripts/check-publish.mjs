// Runs before every npm publish. It stops the publish if the package could carry something a user
// did not ask for: a runtime dependency, an install script, a file outside dist, or a sudden jump in size.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MAX_PACKED = 48 * 1024
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const problems = []

for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'bundleDependencies', 'bundledDependencies']) {
  const list = pkg[field]
  if (list && Object.keys(list).length) problems.push(`${field} is not empty: ${Object.keys(list).join(', ')}`)
}

for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'preprepare', 'postprepare']) {
  if (pkg.scripts?.[hook]) problems.push(`scripts.${hook} would run on users' machines`)
}

const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }))
const allowed = new Set(['package.json', 'README.md', 'LICENSE'])
for (const { path } of packed.files) {
  if (!allowed.has(path) && !/^dist\/[\w-]+\.(js|d\.ts)$/.test(path)) problems.push(`unexpected file in the package: ${path}`)
}
if (packed.size > MAX_PACKED) problems.push(`the package is ${packed.size} bytes packed, over the ${MAX_PACKED} byte limit`)

if (problems.length) {
  console.error('Publish stopped:\n' + problems.map((p) => `  - ${p}`).join('\n'))
  process.exit(1)
}
console.log(`Publish check passed: no dependencies, no install scripts, ${packed.files.length} files, ${packed.size} bytes packed.`)
