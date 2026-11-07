import { attract, clamp, follow, nearestMark, pull, speedTracker, springTo, type Mark } from '../../src/index'

// Magnetic page scroll, run by detent. Each section top is a mark. When a wheel, trackpad or finger
// stops, the page settles onto a mark with the same no-bounce spring as the controls. It never moves
// while the visitor is moving it, it lets tall sections be read freely, and keys, links, find in page
// and screen readers scroll natively with no settle after them.

export type Glide = { x: number; v: number; to: number; done: boolean; name: string }

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const IDLE_WHEEL = 140
const IDLE_TOUCH = 160

type Stop = { at: number; strong: boolean; name: string }

export function pageSettle(onGlide: (g: Glide) => void = () => {}) {
  const sections = [...document.querySelectorAll<HTMLElement>('[data-mark]')]
  const rail = document.querySelector<HTMLElement>('.rail')!
  rail.innerHTML = sections.map((s, i) => `<a href="#${s.id}" aria-label="${s.dataset.name}"><span>${i + 1}</span></a>`).join('')
  const railNums = [...rail.querySelectorAll<HTMLElement>('span')]
  const railLinks = [...rail.querySelectorAll<HTMLElement>('a')]
  // The rail stays out of the way of the hero ruler, which runs to the screen edge.
  new IntersectionObserver(([e]) => rail.toggleAttribute('data-hidden', e.isIntersecting)).observe(document.querySelector('.ruler')!)
  // Each number reads the surface under it, so it is light on dark sections and dark on light ones.
  const under = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((n) => !rail.contains(n))
    return !!hit?.closest('.dark, .foot')
  }

  let stops: Stop[] = []
  let H = innerHeight
  const max = () => document.documentElement.scrollHeight - innerHeight
  function measure() {
    H = innerHeight
    // The sticky header covers the top 64px, so a section rests just below it.
    const head = document.querySelector<HTMLElement>('.top')?.offsetHeight ?? 0
    stops = sections.map((s, i) => ({ at: Math.min(max(), i ? Math.round(s.getBoundingClientRect().top + scrollY - head) : 0), strong: s.dataset.mark === 'strong', name: s.dataset.name! }))
    stops.push({ at: max(), strong: false, name: 'End' })
  }
  measure()
  addEventListener('resize', measure)
  addEventListener('load', measure)

  // Where the page should rest from y, or null to leave it alone. Between two tops that are close,
  // the page always lands on one of them, and a strong top reaches further. In a section taller than
  // the screen, the middle is free to read; only its edges pull.
  function rest(y: number): Stop | null {
    const i = stops.findIndex((s, k) => k === stops.length - 1 || (y >= s.at && y < stops[k + 1].at))
    const a = stops[i]
    const b = stops[i + 1]
    if (!b || y <= a.at) return Math.abs(y - a.at) < 1 ? null : a
    const len = b.at - a.at
    const pair = (lo: Stop, hi: Stop, gap: number) => {
      const marks: Mark[] = [
        { at: lo.at, strong: lo.strong },
        { at: hi.at, strong: hi.strong },
      ]
      const pulled = attract(y, marks, gap, { reach: 0.5, strong: 0.75 })
      return nearestMark(pulled, [lo.at, hi.at]) === lo.at ? lo : hi
    }
    if (len <= H * 1.05) return pair(a, b, len)
    // A tall section: its top, a mark where its end meets the bottom of the screen, and the next top.
    const end: Stop = { at: b.at - H, strong: false, name: a.name }
    const reach = H * (a.strong ? 0.4 : 0.25)
    if (y < a.at + reach) return a
    if (y < end.at - H * 0.25) return null
    if (y <= end.at) return end
    return pair(end, b, b.at - end.at)
  }

  let source: 'wheel' | 'touch' | null = null
  let touching = false
  let moved = false
  // The position our own last frame asked for, so its scroll event is not taken for the visitor's.
  let expect: number | null = null
  let timer = 0
  let lastScroll = 0
  const speed = speedTracker(120)

  // One spring for every page move, critically damped (damping 1), so even a long jump arrives
  // without passing its mark. Its swing grows gently with distance and is capped.
  let cancel: (() => void) | null = null
  const moving = () => cancel !== null
  function move(from: number, to: number, done: () => void) {
    cancel?.()
    speed.reset()
    const T = clamp(260 + Math.abs(to - from) * 0.08, 320, 520)
    cancel = springTo({
      from,
      to,
      period: T,
      damping: 1,
      rest: 0.5,
      onFrame: (y) => {
        expect = y
        scrollTo({ top: y, behavior: 'instant' })
        speed.add(y)
        onGlide({ x: y, v: speed.speed(), to, done: false, name: target?.name ?? '' })
      },
      onDone: () => {
        cancel = null
        expect = null
        speed.reset()
        if (target) onGlide({ x: to, v: 0, to, done: true, name: target.name })
        target = null
        done()
      },
    })
  }
  let target: Stop | null = null

  const stop = () => {
    clearTimeout(timer)
    cancel?.()
    cancel = null
    target = null
  }
  const arm = (ms: number) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => settle(ms), ms)
  }
  function settle(ms: number) {
    if (reduced.matches || touching || !source || !moved) return
    if (performance.now() - lastScroll < ms - 10) return arm(ms)
    measure()
    const y = scrollY
    const to = rest(y)
    moved = false
    if (!to || Math.abs(to.at - y) < 1) return
    target = to
    move(y, to.at, () => {})
  }

  // In-page links glide with the same spring: its swing grows gently with the distance and is
  // capped, so a long jump takes well under a second. Focus moves to the section's heading when it lands,
  // with no second scroll. Reduced motion jumps at once.
  function glideTo(section: HTMLElement, href: string) {
    measure()
    const stopAt = stops[sections.indexOf(section)]
    const heading = section.querySelector<HTMLElement>('h1, h2') ?? section
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    const land = () => {
      heading.focus({ preventScroll: true })
      history.pushState(null, '', href)
    }
    stop()
    source = null
    if (reduced.matches) {
      scrollTo({ top: stopAt.at, behavior: 'instant' })
      return land()
    }
    target = stopAt
    move(scrollY, stopAt.at, land)
  }

  // The hand. Any of these stops a settle at once.
  addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return
      stop()
      source = 'wheel'
      moved = true
      arm(IDLE_WHEEL)
    },
    { passive: true },
  )
  addEventListener(
    'touchstart',
    () => {
      stop()
      touching = true
      source = 'touch'
    },
    { passive: true },
  )
  const lift = () => {
    touching = false
    arm(IDLE_TOUCH)
  }
  addEventListener('touchend', lift, { passive: true })
  addEventListener('touchcancel', lift, { passive: true })
  // Keys, a mouse on the scrollbar, and links scroll natively and are never followed by a settle.
  addEventListener('keydown', () => {
    stop()
    source = null
  })
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') return
    stop()
    source = null
  })
  addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return
    const section = document.getElementById(a.hash.slice(1))?.closest<HTMLElement>('[data-mark]')
    if (!section) return
    e.preventDefault()
    glideTo(section, a.hash)
  })

  // The side rail pulls the current section's number large, and the type leans with scroll speed.
  const reach = 0.7
  const page = speedTracker(100)
  const lean = follow({ value: 0, time: () => (reduced.matches ? 0 : 260), onFrame: (d) => document.documentElement.style.setProperty('--lean', `${d.toFixed(2)}deg`) })
  let raf = 0
  const paint = () => {
    raf = 0
    const y = scrollY
    railNums.forEach((n, i) => n.style.setProperty('--p', pull((y - stops[i].at) / H, reach).toFixed(3)))
    railLinks.forEach((a) => a.toggleAttribute('data-dark', under(a)))
    page.add(y)
    lean.set(reduced.matches ? 0 : clamp(-page.speed() / 900, -6, 6))
  }
  let calm = 0
  addEventListener(
    'scroll',
    () => {
      const mine = expect !== null && Math.abs(scrollY - expect) < 1.5
      expect = null
      if (!mine) {
        lastScroll = performance.now()
        if (source) moved = true
        if (source === 'touch' && !touching) arm(IDLE_TOUCH)
      }
      if (!raf) raf = requestAnimationFrame(paint)
      clearTimeout(calm)
      calm = window.setTimeout(() => lean.set(0), 120)
    },
    { passive: true },
  )
  paint()
  return { rest, stops: () => stops }
}
