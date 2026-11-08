import { clamp, detent, detentScroll, follow, pull, springTo, steps, type Mark } from '@hlmnhkl/detent'
import { copyButtons } from '../shared/controls'

// Mockup only: the same engine and the same docs demo files, in two new looks.

// Hero ruler: 0 to 100, a numeral every 10, strong every 50.
const ruler = document.querySelector<HTMLElement>('.m-ruler')!
const track = ruler.querySelector<HTMLElement>('.m-track')!
const marks: Mark[] = steps(0, 100, 10).map((at) => ({ at, strong: at % 50 === 0 }))
track.innerHTML =
  steps(0, 100, 1)
    .map((i) => `<i class="${i % 10 ? '' : i % 50 ? 'ten' : 'ten strong'}" style="--x:${i}"></i>`)
    .join('') + marks.map((m) => `<span style="--x:${m.at}">${m.at}</span>`).join('')
const nums = [...track.querySelectorAll<HTMLElement>('span')]
const readout = document.querySelector<HTMLElement>('.m-readout')
detent(ruler, {
  value: 50,
  min: 0,
  max: 100,
  step: 1,
  marks,
  reach: { reach: 0.3, strong: 0.6 },
  invert: true,
  coast: 0.25,
  size: () => parseFloat(getComputedStyle(ruler).getPropertyValue('--unit')) || 12,
  cssVar: '--v',
  onInput: (v) => {
    nums.forEach((n, i) => n.style.setProperty('--p', pull(v - marks[i].at, 6).toFixed(3)))
    if (readout) readout.textContent = v.toFixed(1)
  },
})

// The real docs demos and their files.
const run = import.meta.glob('../docs/demos/*.js')
const text = import.meta.glob('../docs/demos/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
document.querySelectorAll<HTMLElement>('[data-src]').forEach((pre) => {
  const code = document.createElement('code')
  code.textContent = text[`../docs/${pre.dataset.src}`].trim()
  pre.replaceChildren(code)
})
document.querySelectorAll<HTMLElement>('[data-run]').forEach((el) => run[`../docs/${el.dataset.run}`]())

document.querySelectorAll<HTMLElement>('[role="tablist"]').forEach((list) => {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')]
  const show = (tab: HTMLElement, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on
    })
    if (focus) tab.focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t))
    t.addEventListener('keydown', (e) => {
      const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null
      if (to === null) return
      e.preventDefault()
      show(tabs[(to + tabs.length) % tabs.length], true)
    })
  })
  show(tabs[0])
})

const reduced = matchMedia('(prefers-reduced-motion: reduce)')

// Everything clicks: a marker slides under the chosen tab or segment with a short spring that never
// passes its place. With reduced motion it simply jumps.
document.querySelectorAll<HTMLElement>('[data-slide]').forEach((group) => {
  const mark = document.createElement('i')
  mark.className = 'm-slide'
  mark.setAttribute('aria-hidden', 'true')
  group.append(mark)
  let x = 0
  let w = 0
  let stop = () => {}
  const to = (el: HTMLElement) => {
    const nx = el.offsetLeft
    const nw = el.offsetWidth
    stop()
    if (reduced.matches || !w) {
      x = nx
      w = nw
      mark.style.translate = `${x}px 0`
      mark.style.width = `${w}px`
      return
    }
    const x0 = x
    const w0 = w
    stop = springTo({
      from: 0,
      to: 1,
      period: 220,
      damping: 1,
      rest: 0.002,
      onFrame: (t) => {
        x = x0 + (nx - x0) * t
        w = w0 + (nw - w0) * t
        mark.style.translate = `${x}px 0`
        mark.style.width = `${w}px`
      },
    })
  }
  const items = [...group.querySelectorAll<HTMLElement>('[role="tab"], [aria-pressed]')]
  const current = () => items.find((t) => t.getAttribute('aria-selected') === 'true' || t.getAttribute('aria-pressed') === 'true')
  new MutationObserver(() => current() && to(current()!)).observe(group, { attributes: true, subtree: true, attributeFilter: ['aria-selected', 'aria-pressed'] })
  addEventListener('resize', () => current() && ((w = 0), to(current()!)))
  requestAnimationFrame(() => current() && to(current()!))
})

// Preview or code: a two-way switch on each demo.
document.querySelectorAll<HTMLElement>('[data-view]').forEach((sw) => {
  const panel = sw.closest<HTMLElement>('[role="tabpanel"], .m-demo')!
  const buttons = [...sw.querySelectorAll<HTMLButtonElement>('button')]
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      buttons.forEach((o) => o.setAttribute('aria-pressed', String(o === b)))
      panel.toggleAttribute('data-code', b.dataset.v === 'code')
    }),
  )
})

// The page ruler: a scale down the left edge. The index line moves with the page, and the number of
// the section under it is pulled in. The page itself settles onto sections, and links snap to them.
const page = document.querySelector<HTMLElement>('.m-page-ruler')
const sections = [...document.querySelectorAll<HTMLElement>('[data-mark]')]
const head = document.querySelector<HTMLElement>('.m-top') ?? undefined
detentScroll({ marks: sections, offset: head })
if (page) {
  const scale = page.querySelector<HTMLElement>('.m-scale')!
  scale.innerHTML =
    Array.from({ length: 41 }, (_, i) => `<i class="${i % 5 ? '' : 'five'}" style="--t:${i / 40}"></i>`).join('') +
    sections.map((s, i) => `<a href="#${s.id}" style="--t:0" aria-label="${s.dataset.name}"><span>${i + 1}</span></a>`).join('')
  const links = [...scale.querySelectorAll<HTMLElement>('a')]
  const max = () => Math.max(1, document.documentElement.scrollHeight - innerHeight)
  const place = () => links.forEach((a, i) => a.style.setProperty('--t', String(clamp((sections[i].offsetTop - (head?.offsetHeight ?? 0)) / max(), 0, 1))))
  const index = follow({ value: 0, time: () => (reduced.matches ? 0 : 160), onFrame: (t) => page.style.setProperty('--at', t.toFixed(4)) })
  let raf = 0
  const paint = () => {
    raf = 0
    const t = clamp(scrollY / max(), 0, 1)
    index.set(t)
    links.forEach((a, i) => {
      const at = parseFloat(a.style.getPropertyValue('--t'))
      a.style.setProperty('--p', pull(t - at, 0.08).toFixed(3))
      a.toggleAttribute('aria-current', Math.abs(t - at) < 0.04)
    })
  }
  place()
  addEventListener('load', () => (place(), paint()))
  addEventListener('resize', () => (place(), paint()))
  addEventListener('scroll', () => (raf ||= requestAnimationFrame(paint)), { passive: true })
  paint()
}

copyButtons()
