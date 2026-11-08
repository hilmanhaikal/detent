import { attract, clamp, nearestMark, springTo, type Mark } from './core.js'
import { reduced, type Motion } from './motion.js'

export type ScrollOptions = {
  /** The sections the page rests on, as a selector or a list. data-mark="strong" pulls harder. Numbers are scroll positions in px, and a function is read again on each measure, as for `scrollScene().marks`. Default '[data-mark]'. */
  marks?: string | Rest[] | (() => Rest[])
  /** Space a sticky header covers at the top, in px, or the header itself. */
  offset?: number | HTMLElement
  /** In-page links glide to their section, then focus its heading. Default true. */
  links?: boolean
  /** Ms of quiet after a wheel or a finger before it settles. Default { wheel: 140, touch: 160 }. */
  idle?: { wheel?: number; touch?: number }
  /** Default 'auto': follows prefers-reduced-motion, live. Under reduce it never settles by itself. */
  motion?: Motion
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame of a settle or a link glide: where the page is, and where it is going. */
  onInput?: (y: number, to: number) => void
  /** It came to rest on a section, or on a scroll position given as a number. */
  onChange?: (index: number, section: Rest) => void
}

export type ScrollDetent = {
  /** The section the page rests on, or null between them. */
  readonly index: number | null
  /** Glides to a section. With { instant: true } it jumps. */
  go(index: number, opts?: { instant?: boolean }): void
  /** Reads the section tops again, for content that changed height. Resize and load are handled. */
  measure(): void
  /** Removes every listener and attribute it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

type Stop = { at: number; strong: boolean; i: number }
/** A section, or a scroll position in px. */
export type Rest = HTMLElement | number

/**
 * Magnetic page scroll. When a wheel, trackpad or finger stops, the page settles onto the nearest
 * section top. It never moves while the hand is moving it, and tall sections are free to read. Keys,
 * the scrollbar, find in page and screen readers scroll natively with no settle after them.
 */
export function detentScroll(options: ScrollOptions = {}): ScrollDetent {
  const o = options
  const ac = new AbortController()
  const signal = ac.signal
  const opts = { signal, passive: true }
  const list = () => (typeof o.marks === 'function' ? o.marks() : typeof o.marks === 'object' ? o.marks : [...document.querySelectorAll<HTMLElement>(o.marks ?? '[data-mark]')])
  let sections = list()
  const idleWheel = o.idle?.wheel ?? 140
  const idleTouch = o.idle?.touch ?? 160
  if (!sections.length && typeof o.marks !== 'function') return { index: null, go: () => {}, measure: () => {}, destroy: () => {} }

  let stops: Stop[] = []
  let H = innerHeight
  const max = () => document.documentElement.scrollHeight - innerHeight
  const offset = () => (typeof o.offset === 'number' ? o.offset : (o.offset?.offsetHeight ?? 0))
  function measure() {
    H = innerHeight
    sections = list()
    const head = offset()
    const top = (s: Rest, i: number) => (typeof s === 'number' ? s : i ? Math.round(s.getBoundingClientRect().top + scrollY - head) : 0)
    stops = sections.map((s, i) => ({ at: Math.min(max(), top(s, i)), strong: typeof s !== 'number' && s.dataset.mark === 'strong', i })).sort((a, b) => a.at - b.at)
    stops.push({ at: max(), strong: false, i: sections.length - 1 })
  }
  measure()
  addEventListener('resize', measure, { signal })
  addEventListener('load', measure, { signal })

  // Between two tops that are close, the page always lands on one of them, and a strong top reaches
  // further. In a section taller than the screen, the middle is free; only its edges pull.
  function rest(y: number): Stop | null {
    // Above a first rest that is not the page top (a scene lower down), the page is free until close to it.
    if (y < stops[0].at) return stops[0].at - y < H * 0.25 ? stops[0] : null
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
      return nearestMark(attract(y, marks, gap, { reach: 0.5, strong: 0.75 }), [lo.at, hi.at]) === lo.at ? lo : hi
    }
    if (len <= H * 1.05) return pair(a, b, len)
    const end: Stop = { at: b.at - H, strong: false, i: a.i }
    if (y < a.at + H * (a.strong ? 0.4 : 0.25)) return a
    if (y < end.at - H * 0.25) return null
    if (y <= end.at) return end
    return pair(end, b, b.at - end.at)
  }

  let source: 'wheel' | 'touch' | null = null
  let touching = false
  let moved = false
  // The position our own last frame asked for, so its scroll event is not taken for the hand's.
  let expect: number | null = null
  let timer = 0
  let lastScroll = 0
  let cancel: (() => void) | null = null

  const landed = (i: number) => o.onChange?.(i, sections[i])

  // One critically damped spring for every page move, so even a long jump arrives without passing its
  // mark. Its swing grows gently with distance and is capped.
  function move(from: number, to: number, done: () => void) {
    cancel?.()
    cancel = springTo({
      from,
      to,
      period: clamp(260 + Math.abs(to - from) * 0.08, 320, 520),
      damping: 1,
      rest: 0.5,
      onFrame: (y) => {
        expect = y
        scrollTo({ top: y, behavior: 'instant' })
        o.onInput?.(y, to)
      },
      onDone: () => {
        cancel = null
        expect = null
        done()
      },
    })
  }

  const stop = () => {
    clearTimeout(timer)
    cancel?.()
    cancel = null
  }
  const arm = (ms: number) => {
    clearTimeout(timer)
    timer = window.setTimeout(() => settle(ms), ms)
  }
  // Forgets the hand, so a later native scroll (find in page, a screen reader, a skipped link) stays put.
  const forget = () => {
    source = null
    moved = false
  }
  function settle(ms: number) {
    if (touching) return
    if (source && performance.now() - lastScroll < ms - 10) return arm(ms)
    const ready = source && moved && !reduced(o.motion)
    forget()
    if (!ready) return
    measure()
    const y = scrollY
    const to = rest(y)
    if (!to || Math.abs(to.at - y) < 1) return
    move(y, to.at, () => landed(to.i))
  }

  function go(i: number, opts?: { instant?: boolean }, done = () => {}) {
    measure()
    const to = stops.find((s) => s.i === clamp(i, 0, sections.length - 1))!
    stop()
    forget()
    const finish = () => {
      done()
      landed(to.i)
    }
    if (opts?.instant || reduced(o.motion)) {
      scrollTo({ top: to.at, behavior: 'instant' })
      return finish()
    }
    move(scrollY, to.at, finish)
  }

  // The hand. Any of these stops a settle at once.
  addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return
      stop()
      source = 'wheel'
      moved = true
      arm(idleWheel)
    },
    opts,
  )
  addEventListener(
    'touchstart',
    () => {
      stop()
      touching = true
      source = 'touch'
    },
    opts,
  )
  let lifted = 0
  const lift = (e: TouchEvent) => {
    touching = e.touches.length > 0
    if (touching) return
    lifted = performance.now()
    arm(idleTouch)
  }
  addEventListener('touchend', lift, opts)
  addEventListener('touchcancel', lift, opts)
  addEventListener(
    'keydown',
    () => {
      stop()
      forget()
    },
    opts,
  )
  addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') return
      stop()
      forget()
    },
    opts,
  )
  const headings: HTMLElement[] = []
  if (o.links ?? true)
    addEventListener(
      'click',
      (e) => {
        const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]')
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return
        const target = document.getElementById(decodeURIComponent(a.hash.slice(1)))
        const i = target ? sections.findIndex((s) => typeof s !== 'number' && s.contains(target)) : -1
        if (i < 0) return
        e.preventDefault()
        const section = sections[i] as HTMLElement
        const heading = section.querySelector<HTMLElement>('h1, h2') ?? section
        if (!heading.hasAttribute('tabindex')) {
          heading.setAttribute('tabindex', '-1')
          headings.push(heading)
        }
        go(i, undefined, () => {
          heading.focus({ preventScroll: true })
          history.pushState(null, '', a.hash)
        })
      },
      { signal },
    )
  addEventListener(
    'scroll',
    () => {
      const mine = expect !== null && Math.abs(scrollY - expect) < 1.5
      expect = null
      if (mine) return
      lastScroll = performance.now()
      if (source) moved = true
      // Momentum after a finger lifts. Long after it, a scroll is someone else's.
      if (source === 'touch' && !touching && performance.now() - lifted < 1000) arm(idleTouch)
    },
    opts,
  )

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    stop()
    headings.forEach((h) => h.removeAttribute('tabindex'))
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get index() {
      const y = scrollY
      return stops.find((s) => Math.abs(s.at - y) < 1)?.i ?? null
    },
    go: (i, opts) => go(i, opts),
    measure,
    destroy,
  }
}
