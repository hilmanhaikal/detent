import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const read = (p: string) => readFileSync(here(p), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pages = [
  { file: 'index.html', title: 'Getting started' },
  { file: 'detent.html', title: 'detent()' },
  { file: 'scroll.html', title: 'detentScroll()' },
  { file: 'detent2d.html', title: 'detent2d()' },
  { file: 'throw.html', title: 'detentThrow()' },
  { file: 'pull.html', title: 'detentPull()' },
  { file: 'hold.html', title: 'detentHold()' },
  { file: '3d.html', title: 'detent3d()' },
  { file: 'low-level.html', title: 'Low level' },
  { file: 'recipes.html', title: 'Recipes' },
  { file: 'accessibility.html', title: 'Accessibility' },
]

// The body of `type Name = ... { ... }` in a source file, by matching braces.
function typeBody(src: string, name: string) {
  const m = new RegExp(`type ${name}\\b[^=]*=[^{]*\\{`).exec(src)
  if (!m) throw new Error(`docs: no type ${name}`)
  let depth = 1
  let i = m.index + m[0].length
  const start = i
  for (; depth && i < src.length; i++) depth += src[i] === '{' ? 1 : src[i] === '}' ? -1 : 0
  return src.slice(start, i - 1)
}

// Each top-level field of a type, with the doc comment above it. This keeps the tables true to the types.
function fields(body: string) {
  const rows: { name: string; type: string; doc: string }[] = []
  let doc = ''
  let inDoc = false
  let depth = 0
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('/**')) {
      inDoc = !line.endsWith('*/')
      doc = line.replace(/^\/\*\*\s?/, '').replace(/\s?\*\/$/, '')
      continue
    }
    if (inDoc) {
      inDoc = !line.endsWith('*/')
      doc += ' ' + line.replace(/^\*\s?/, '').replace(/\s?\*\/$/, '')
      continue
    }
    if (line.startsWith('//')) continue
    if (depth === 0) {
      const method = /^(\w+)\((.*)\):\s*(.+)$/.exec(line)
      const prop = /^(?:readonly\s+)?('[^']+'|\w+)(\?)?:\s*(.+?),?$/.exec(line)
      if (method) rows.push({ name: `${method[1]}(${method[2]})`, type: method[3], doc })
      else if (prop) rows.push({ name: prop[1].replace(/'/g, '') + (prop[2] ?? ''), type: prop[3], doc })
      doc = ''
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
  }
  return rows
}

function table(file: string, names: string[], head: string) {
  const src = read(`../${file}`)
  const rows = names.flatMap((n) => fields(typeBody(src, n)))
  return `<div class="table" tabindex="0" role="region" aria-label="${head}s"><table><thead><tr><th>${head}</th><th>Type</th><th>What it does</th></tr></thead><tbody>${rows
    .map((r) => `<tr><td><code>${esc(r.name)}</code></td><td><code>${esc(r.type)}</code></td><td>${esc(r.doc)}</td></tr>`)
    .join('')}</tbody></table></div>`
}

// Every documented export of a file: its name, its signature and the comment above it.
function exportsTable(file: string) {
  const src = read(`../${file}`)
  const rows: string[] = []
  const re = /\/\*\*([\s\S]*?)\*\/\s*\nexport (function|const|type) (\w+)([^\n]*)/g
  for (let m; (m = re.exec(src)); ) {
    const doc = m[1].replace(/^\s*\*\s?/gm, '').replace(/\s+/g, ' ').trim()
    let sig = m[4]
    if (m[2] === 'function') sig = sig.replace(/\s*\{\s*$/, '')
    if (m[2] === 'const') sig = sig.replace(/^\s*=\s*/, '').replace(/\s*=>.*$/, '')
    if (m[2] === 'type') sig = ' (type)'
    rows.push(`<tr><td><code>${esc(m[3] + sig)}</code></td><td>${esc(doc)}</td></tr>`)
  }
  return `<div class="table" tabindex="0" role="region" aria-label="Exports"><table><thead><tr><th>Export</th><th>What it does</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

// Fills the shared header, footer, docs sidebar, "On this page" and the tables read from src/.
function docsPage(): Plugin {
  return {
    name: 'docs-page',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const inDocs = ctx.filename.includes('/docs/')
        const file = ctx.filename.split('/').pop()!
        const home = inDocs ? '../' : ''
        const link = (p: (typeof pages)[number]) => `${home}docs/${p.file === 'index.html' ? '' : p.file}`
        const docsNav = pages.map((p) => `<a href="${link(p)}"${inDocs && p.file === file ? ' aria-current="page"' : ''}>${p.title}</a>`).join('\n')
        const toc = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>(.*?)<\/h2>/g)].map((m) => `<a href="#${m[1]}">${m[2].replace(/<[^>]+>/g, '')}</a>`).join('\n')
        return html
          .replace('<!-- @header -->', read('partials/header.html'))
          .replace('<!-- @footer -->', read('partials/footer.html'))
          .replace('<!-- @sidebar -->', `<nav class="side" aria-label="Docs pages">${docsNav}</nav>`)
          .replace('<!-- @toc -->', toc ? `<nav class="toc" aria-label="On this page"><p>On this page</p>${toc}</nav>` : '')
          .replace(/<!-- @props (\S+) ([\w ]+?) -->/g, (_, f, names) => table(f, names.split(' '), 'Option'))
          .replace(/<!-- @api (\S+) ([\w ]+?) -->/g, (_, f, names) => table(f, names.split(' '), 'Property'))
          .replace(/<!-- @events (\S+) ([\w ]+?) -->/g, (_, f, names) => table(f, names.split(' '), 'Event'))
          .replace(/<!-- @exports (\S+) -->/g, (_, f) => exportsTable(f))
          .replace('{{menuDocs}}', inDocs ? `        <nav class="menu-docs" aria-label="Docs pages">${docsNav}</nav>\n` : '')
          .replaceAll('{{docsCurrent}}', inDocs ? ' aria-current="page"' : '')
          .replaceAll('{{home}}', home)
          .replaceAll('{{top}}', '#top')
      },
    },
  }
}

// The site imports the package by its real name, served from the source in this repo.
export default defineConfig({
  base: './',
  resolve: { alias: { '@hlmnhkl/detent': here('../src/index.ts') } },
  build: {
    rollupOptions: {
      input: Object.fromEntries([['index', here('index.html')], ...pages.map((p) => [`docs/${p.file.replace('.html', '')}`, here(`docs/${p.file}`)])]),
    },
  },
  plugins: [
    docsPage(),
    {
      // package.json says "sideEffects": false, which would drop the demo files: their whole job is a side effect.
      name: 'keep-demos',
      transform: (code, id) => (/\/site\/(home\/start|docs\/(demos|recipes)\/[\w-]+)\.js$/.test(id) ? { code, moduleSideEffects: true } : null),
    },
  ],
})
