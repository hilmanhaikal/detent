// One frame loop for the whole page: every instrument queues its paint here.
const jobs = new Set()
let raf = 0
const run = () => {
  raf = 0
  const list = [...jobs]
  jobs.clear()
  for (const job of list) job()
}
export const frame = (job) => {
  jobs.add(job)
  raf ||= requestAnimationFrame(run)
}

export const still = matchMedia('(prefers-reduced-motion: reduce)')

// Writes a style only when it changed, so hundreds of parts cost nothing at rest.
export function writer() {
  const last = new WeakMap()
  return (el, prop, value) => {
    let m = last.get(el)
    if (!m) last.set(el, (m = {}))
    if (m[prop] === value) return
    m[prop] = value
    el.style[prop] = value
  }
}

// The code a demo runs, cut from its own file between the show markers.
export function shown(text) {
  const m = /\/\/ show\n([\s\S]*?)\n\s*\/\/ end/.exec(text)
  const body = m ? m[1] : text
  const pad = Math.min(...body.split('\n').filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length))
  return body
    .split('\n')
    .map((l) => l.slice(pad))
    .join('\n')
}

