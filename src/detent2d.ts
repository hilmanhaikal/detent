import { clamp, rubber, speedTracker, springTo } from './core.js'
import { attrs, needsName, voice } from './aria.js'
import { hand } from './hand.js'
import { reduced, type Motion } from './motion.js'

export type Point = {
  /** Where the element's top-left corner rests, in px from the bounds' top-left. */
  x: number
  /** Where the element's top-left corner rests, in px from the bounds' top. */
  y: number
  /** Pulls from further away. */
  strong?: boolean
  /** Said by screen readers when it lands here. */
  name: string
}

export type Detent2dEventMap = {
  /** Every frame while it moves, with where it is drawn. */
  'detent2d:input': CustomEvent<{ x: number; y: number }>
  /** Once, when it comes to rest on a new point. */
  'detent2d:change': CustomEvent<{ index: number; point: Point }>
}

declare global {
  interface HTMLElementEventMap extends Detent2dEventMap {}
}

export type Detent2dOptions = {
  /** The points it rests on, or the four corners of the bounds. */
  points: Point[] | 'corners'
  /** Space between the corners and the bounds' edges, in px. Default 16. */
  inset?: number
  /** What it moves inside. Default: the viewport. */
  bounds?: HTMLElement | 'viewport'
  /** The point it starts on. Default 0. */
  value?: number
  /** How far a flick carries, in seconds of its speed. Default 0.25. */
  coast?: number
  /** One spring swing in ms. Default 320. */
  period?: number
  /** Default 'auto': follows prefers-reduced-motion, live. */
  motion?: Motion
  /** Says the point's name in a polite live region when it lands. Default true. */
  announce?: boolean
  /** CSS custom properties that get the live x and y in px on each frame. Off unless you name them. */
  cssVar?: [`--${string}`, `--${string}`]
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it moves, and once at the start so you can draw it. */
  onInput?: (x: number, y: number) => void
  /** It came to rest on a new point. */
  onChange?: (index: number, point: Point) => void
}

export type Detent2d = {
  /** The point it rests on, or is going to. */
  readonly index: number
  /** Where it is drawn now. */
  readonly at: { x: number; y: number }
  /** True while a hand or a glide moves it. */
  readonly moving: boolean
  /** Glides to a point. With { instant: true } it jumps. */
  go(index: number, opts?: { instant?: boolean }): void
  /** Swaps options, such as points or bounds. It lands again on the nearest point. */
  set(next: Partial<Detent2dOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

const keyDir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** Drag `el` anywhere, and it settles onto the nearest point. Arrow keys move it to the next point that way. */
export function detent2d(el: HTMLElement, options: Detent2dOptions): Detent2d {
  let o = options
  const ac = new AbortController()
  const signal = ac.signal
  const a = attrs(el)
  const speak = o.announce === false ? null : voice()

  let points: Point[] = []
  let W = 0
  let H = 0
  const measure = () => {
    const b = o.bounds && o.bounds !== 'viewport' ? o.bounds : null
    W = (b ?? document.documentElement).clientWidth
    H = b ? b.clientHeight : innerHeight
    if (o.points !== 'corners') return (points = o.points)
    const i = o.inset ?? 16
    const r = W - el.offsetWidth - i
    const d = H - el.offsetHeight - i
    points = [
      { x: i, y: i, name: 'Top left' },
      { x: r, y: i, name: 'Top right' },
      { x: i, y: d, name: 'Bottom left' },
      { x: r, y: d, name: 'Bottom right' },
    ]
  }
  measure()

  let at = { x: 0, y: 0 }
  const fitIndex = (i: number) => clamp(i, 0, Math.max(0, points.length - 1))
  let index = fitIndex(o.value ?? 0)
  // The point it last came to rest on. A glide that is grabbed and put back is not a change.
  let rested = index
  let moving = false
  let stops: (() => void)[] = []
  const sx = speedTracker()
  const sy = speedTracker()

  const paint = (x: number, y: number) => {
    at = { x, y }
    if (o.cssVar) {
      el.style.setProperty(o.cssVar[0], x.toFixed(2))
      el.style.setProperty(o.cssVar[1], y.toFixed(2))
    }
    o.onInput?.(x, y)
    el.dispatchEvent(new CustomEvent('detent2d:input', { detail: { x, y }, bubbles: true }))
  }
  const setMoving = (m: boolean) => {
    moving = m
    el.toggleAttribute('data-moving', m)
  }
  const halt = () => {
    stops.forEach((s) => s())
    stops = []
  }

  const land = (i: number) => {
    setMoving(false)
    speak?.say(points[i].name)
    if (i === rested) return
    rested = i
    o.onChange?.(i, points[i])
    el.dispatchEvent(new CustomEvent('detent2d:change', { detail: { index: i, point: points[i] }, bubbles: true }))
  }

  function go(i: number, opts?: { instant?: boolean }, v = { x: 0, y: 0 }) {
    halt()
    if (!points.length) return setMoving(false)
    index = fitIndex(i)
    const p = points[index]
    const period = opts?.instant || reduced(o.motion) ? 0 : (o.period ?? 320)
    setMoving(true)
    let left = 2
    const done = () => --left || land(index)
    const x = { now: at.x }
    const y = { now: at.y }
    // Only speed toward the point carries over, and no more than it can lose without passing it.
    const carry = (s: number, d: number) => (Math.sign(s) === Math.sign(d) ? Math.sign(d) * Math.min(Math.abs(s), Math.abs(d) / 0.06) : 0)
    const axis = (k: typeof x, to: number, s: number) =>
      springTo({
        from: k.now,
        to,
        velocity: carry(s, to - k.now),
        period,
        damping: 1,
        rest: 0.5,
        onFrame: (n) => {
          k.now = n
          paint(x.now, y.now)
        },
        onDone: done,
      })
    stops = [axis(x, p.x, v.x), axis(y, p.y, v.y)]
  }

  const nearest = (x: number, y: number) => {
    let best = 0
    let score = Infinity
    points.forEach((p, i) => {
      const s = Math.hypot(p.x - x, p.y - y) / (p.strong ? 1.5 : 1)
      if (s < score) [best, score] = [i, s]
    })
    return best
  }

  let raw = { x: 0, y: 0 }
  const fit = (v: number, size: number) => (v < 0 ? rubber(v, 40) : v > size ? size + rubber(v - size, 40) : v)
  hand(
    el,
    {
      grab: () => {
        halt()
        raw = { ...at }
        sx.reset()
        sy.reset()
        sx.add(raw.x)
        sy.add(raw.y)
      },
      move: (p, q) => {
        raw = { x: raw.x + q.x - p.x, y: raw.y + q.y - p.y }
        sx.add(raw.x)
        sy.add(raw.y)
        setMoving(true)
        paint(fit(raw.x, W - el.offsetWidth), fit(raw.y, H - el.offsetHeight))
      },
      end: (how) => {
        const v = how === 'release' ? { x: sx.speed(), y: sy.speed() } : { x: 0, y: 0 }
        const coast = o.coast ?? 0.25
        go(nearest(at.x + v.x * coast, at.y + v.y * coast), undefined, v)
      },
    },
    signal,
    'none',
  )

  el.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || !points.length) return
      let to = e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : -1
      const dir = keyDir[e.key]
      if (dir) {
        const here = points[index]
        let score = Infinity
        points.forEach((p, i) => {
          const dx = p.x - here.x
          const dy = p.y - here.y
          const along = dx * dir[0] + dy * dir[1]
          const s = along + 2 * Math.abs(dx * dir[1] - dy * dir[0])
          if (along > 0 && s < score) [to, score] = [i, s]
        })
      }
      if (to < 0) return
      e.preventDefault()
      go(to)
    },
    { signal },
  )

  addEventListener(
    'resize',
    () => {
      measure()
      if (!moving) place()
    },
    { signal },
  )
  const place = () => {
    const p = points[index]
    if (p) paint(p.x, p.y)
  }

  a.fill('tabindex', '0')
  if (!el.hasAttribute('role')) {
    a.set('role', 'group')
    a.fill('aria-roledescription', 'movable')
  }
  needsName(el)
  place()

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    halt()
    speak?.off()
    a.restore()
    el.removeAttribute('data-moving')
    o.cssVar?.forEach((n) => el.style.removeProperty(n))
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get index() {
      return index
    },
    get at() {
      return { ...at }
    },
    get moving() {
      return moving
    },
    go: (i, opts) => go(i, opts),
    set(next) {
      o = { ...o, ...next }
      measure()
      index = rested = fitIndex(index)
      if (!moving) place()
    },
    destroy,
  }
}
