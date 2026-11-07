import { clamp, magnetTo, rubber, speedTracker, springTo } from './core.js'
import { hand, type Pt } from './hand.js'
import { haptics, type Haptics } from './haptics.js'
import { reduced, type Motion } from './motion.js'

export type ThrowDirection = 'left' | 'right' | 'up' | 'down'

export type ThrowEventMap = {
  /** Every frame while it moves: where it is in px, its tilt in degrees, and how near the line it is, 0 to 1. */
  'detentthrow:input': CustomEvent<{ x: number; y: number; tilt: number; progress: number }>
  /** Once per throw, when it has flown off. */
  'detentthrow:throw': CustomEvent<{ direction: ThrowDirection }>
}

declare global {
  interface HTMLElementEventMap extends ThrowEventMap {}
}

export type ThrowOptions = {
  /** The ways it can go. 'x' is left and right, 'y' is up and down, 'both' is all four, or list them. Default 'x'. */
  directions?: 'x' | 'y' | 'both' | ThrowDirection[]
  /** Let go past this share of its width (or its height, up and down) and it is thrown. Default 0.35. */
  line?: number
  /** A flick faster than this, in px per second, throws it too. Default 600. */
  flick?: number
  /** A flick throws only once it has moved this far, in px, so a quick short swipe stays. Default 40. */
  flickMin?: number
  /** Degrees of tilt for each px it moves sideways, up to 14 degrees. 0 turns tilt off. Default 0.06. */
  tilt?: number
  /** One spring swing in ms. Default 280. */
  period?: number
  /** Default 'auto': follows prefers-reduced-motion, live. Under reduce it is thrown or put back at once. */
  motion?: Motion
  /** CSS custom properties that get x and y in px, and the tilt in degrees if you name a third. Off unless you name them. */
  cssVar?: [`--${string}`, `--${string}`] | [`--${string}`, `--${string}`, `--${string}`]
  /** A short tick on phones that vibrate, when the hand takes it past the line. Default false. */
  haptics?: Haptics
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it moves, and once at the start: x and y in px, and how near the line it is, 0 to 1. */
  onInput?: (x: number, y: number, progress: number) => void
  /** Once per throw, when it has flown off. */
  onThrow?: (direction: ThrowDirection) => void
}

export type Throw = {
  /** Where it is drawn now, in px from where it rests. */
  readonly at: { x: number; y: number }
  /** The way it was thrown, or null while it is in play. */
  readonly thrown: ThrowDirection | null
  /** True while a hand or a spring moves it. */
  readonly moving: boolean
  /** Throws it that way, as a button does. Called during an undo, it plays once when the undo ends. */
  throw(direction: ThrowDirection): void
  /** Brings it back in, playing the throw backwards. With { instant: true } it jumps. */
  undo(opts?: { instant?: boolean }): void
  /** Swaps options, such as fresh callbacks after a render. */
  set(next: Partial<ThrowOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

const vec: Record<ThrowDirection, Pt> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }

/** The directions an option allows. */
export function ways(d: ThrowOptions['directions'] = 'x'): ThrowDirection[] {
  if (Array.isArray(d)) return d
  return d === 'y' ? ['up', 'down'] : d === 'both' ? ['left', 'right', 'up', 'down'] : ['left', 'right']
}

export type ThrowRule = { line?: number; flick?: number; flickMin?: number }

const along = (p: Pt, d: ThrowDirection) => p.x * vec[d].x + p.y * vec[d].y
const lineOf = (d: ThrowDirection, size: { w: number; h: number }, line: number) => (vec[d].x ? size.w : size.h) * line

/** How near the line it is, 0 to 1, and the way it is past the line, if any. */
export function reach(at: Pt, size: { w: number; h: number }, allowed: ThrowDirection[], line = 0.35) {
  let progress = 0
  let armed: ThrowDirection | null = null
  for (const d of allowed) {
    const s = along(at, d) / lineOf(d, size, line)
    if (s > progress) progress = s
    if (s >= 1 && (!armed || s > along(at, armed) / lineOf(armed, size, line))) armed = d
  }
  return { progress: Math.min(1, progress), armed }
}

/**
 * Where a let-go goes: past the line it is thrown that way, and a flick over `flick` px/s is thrown
 * too once it has moved `flickMin` px the same way. Null means it springs back.
 */
export function thrownWay(at: Pt, speed: Pt, size: { w: number; h: number }, allowed: ThrowDirection[], { line = 0.35, flick = 600, flickMin = 40 }: ThrowRule = {}) {
  const past = reach(at, size, allowed, line).armed
  if (past) return past
  let best: ThrowDirection | null = null
  let fast = flick
  for (const d of allowed) {
    const v = along(speed, d)
    if (v > fast && along(at, d) >= flickMin) [best, fast] = [d, v]
  }
  return best
}

// The speed it leaves at, or comes back at on undo, when no hand threw it.
const THROW_SPEED = 1800

/** Drag `el` past a line and let go: it flies off that way. Short of the line it springs back. */
export function detentThrow(el: HTMLElement, options: ThrowOptions = {}): Throw {
  let o = options
  const ac = new AbortController()
  const signal = ac.signal
  const buzz = haptics(() => o.haptics)

  let at: Pt = { x: 0, y: 0 }
  let thrown: ThrowDirection | null = null
  let moving = false
  let busy: 'fly' | 'undo' | null = null
  let queued: ThrowDirection | 'undo' | null = null
  let armed: ThrowDirection | null = null
  let held = false
  let ticked = false
  let stops: (() => void)[] = []
  const sx = speedTracker()
  const sy = speedTracker()

  const size = () => ({ w: el.offsetWidth || 1, h: el.offsetHeight || 1 })
  const allowed = () => ways(o.directions)
  const line = () => o.line ?? 0.35
  const period = (instant?: boolean) => (instant || reduced(o.motion) ? 0 : (o.period ?? 280))
  const fire = <K extends keyof ThrowEventMap>(type: K, detail: ThrowEventMap[K]['detail']) => el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
  const setMoving = (m: boolean) => {
    moving = m
    el.toggleAttribute('data-moving', m)
  }
  const halt = () => {
    stops.forEach((s) => s())
    stops = []
  }

  const paint = (x: number, y: number) => {
    at = { x, y }
    const tilt = clamp(x * (o.tilt ?? 0.06), -14, 14)
    const r = reach(at, size(), allowed(), line())
    if (o.cssVar) {
      el.style.setProperty(o.cssVar[0], x.toFixed(2))
      el.style.setProperty(o.cssVar[1], y.toFixed(2))
      if (o.cssVar[2]) el.style.setProperty(o.cssVar[2], tilt.toFixed(2))
    }
    if (r.armed !== armed) {
      armed = r.armed
      if (armed) el.setAttribute('data-armed', armed)
      else el.removeAttribute('data-armed')
      if (armed && held && !ticked) ticked = buzz.tick(true)
    }
    o.onInput?.(x, y, r.progress)
    fire('detentthrow:input', { x, y, tilt, progress: r.progress })
  }

  // Two springs, one per axis, with no bounce. Only speed toward the target carries over.
  const springs = (to: Pt, v: Pt, ms: number, done: () => void) => {
    halt()
    setMoving(true)
    let left = 2
    const now = { ...at }
    const carry = (s: number, d: number) => (Math.sign(s) === Math.sign(d) ? Math.sign(d) * Math.min(Math.abs(s), Math.abs(d) / 0.06) : 0)
    const axis = (k: 'x' | 'y') =>
      springTo({
        from: now[k],
        to: to[k],
        velocity: carry(v[k], to[k] - now[k]),
        period: ms,
        damping: 1,
        rest: 0.5,
        onFrame: (n) => {
          now[k] = n
          paint(now.x, now.y)
        },
        onDone: () => --left || done(),
      })
    // Pushed one by one: with no motion a spring ends at once, and its end may start the next one.
    stops.push(axis('x'))
    stops.push(axis('y'))
  }

  // Far enough that its whole box is off the screen, and never less than 1.2 of its own size.
  const off = (d: ThrowDirection): Pt => {
    const r = el.getBoundingClientRect()
    const { w, h } = size()
    const cx = r.left + r.width / 2 - at.x
    const cy = r.top + r.height / 2 - at.y
    if (d === 'right') return { x: Math.max(w * 1.2, innerWidth - cx + w / 2), y: at.y }
    if (d === 'left') return { x: -Math.max(w * 1.2, cx + w / 2), y: at.y }
    if (d === 'down') return { x: at.x, y: Math.max(h * 1.2, innerHeight - cy + h / 2) }
    return { x: at.x, y: -Math.max(h * 1.2, cy + h / 2) }
  }

  const next = () => {
    const q = queued
    queued = null
    if (q === 'undo') undo()
    else if (q) fly(q, 0)
  }

  function fly(d: ThrowDirection, speed: number) {
    if (busy === 'undo') return void (queued = d)
    if (busy || thrown) return
    busy = 'fly'
    const fast = Math.max(Math.abs(speed), THROW_SPEED)
    const to = off(d)
    springs(to, { x: vec[d].x * fast, y: vec[d].y * fast }, period(), () => {
      busy = null
      thrown = d
      setMoving(false)
      el.setAttribute('data-thrown', d)
      o.onThrow?.(d)
      fire('detentthrow:throw', { direction: d })
      next()
    })
  }

  function undo(opts?: { instant?: boolean }) {
    if (busy === 'fly') return void (queued = 'undo')
    if (busy || !thrown) return
    const d = thrown
    thrown = null
    el.removeAttribute('data-thrown')
    busy = 'undo'
    const from = off(d)
    paint(from.x, from.y)
    springs({ x: 0, y: 0 }, { x: -vec[d].x * THROW_SPEED, y: -vec[d].y * THROW_SPEED }, period(opts?.instant), () => {
      busy = null
      setMoving(false)
      next()
    })
  }

  const back = (v: Pt) => springs({ x: 0, y: 0 }, v, period(), () => setMoving(false))

  // On an axis with one way allowed, the other way stretches a little and no more.
  const shape = (v: number, lo: ThrowDirection, hi: ThrowDirection, T: number) => {
    const w = allowed()
    const a = w.includes(lo)
    const b = w.includes(hi)
    if (!a && !b) return 0
    if ((v < 0 && !a) || (v > 0 && !b)) return rubber(v, 24)
    return magnetTo(v, [-T, T], T * 0.3)
  }

  let raw: Pt = { x: 0, y: 0 }
  let swallow = false
  const axes = allowed()
  const x = axes.some((d) => vec[d].x)
  const y = axes.some((d) => vec[d].y)
  hand(
    el,
    {
      grab: () => {
        swallow = false
        if (busy || thrown) return
        halt()
        held = true
        ticked = false
        raw = { ...at }
        sx.reset()
        sy.reset()
        sx.add(raw.x)
        sy.add(raw.y)
      },
      move: (p, q) => {
        if (!held) return
        raw = { x: raw.x + q.x - p.x, y: raw.y + q.y - p.y }
        sx.add(raw.x)
        sy.add(raw.y)
        setMoving(true)
        const { w, h } = size()
        paint(shape(raw.x, 'left', 'right', w * line()), shape(raw.y, 'up', 'down', h * line()))
      },
      end: (how) => {
        if (!held) return
        held = false
        swallow = how === 'release'
        // A finger drag may send no click at all, so a later key or screen reader click is not eaten.
        setTimeout(() => (swallow = false))
        if (how === 'cancel') return back({ x: 0, y: 0 })
        const v = { x: sx.speed(), y: sy.speed() }
        const d = how === 'release' ? thrownWay(at, v, size(), allowed(), o) : null
        if (!d) return back(v)
        if (!ticked) buzz.tick(true)
        fly(d, along(v, d))
      },
    },
    signal,
    x && y ? 'none' : x ? 'pan-y' : 'pan-x',
    { late: true },
  )
  // A drag that ends on a link or button inside is not a click on it.
  el.addEventListener(
    'click',
    (e) => {
      if (!swallow) return
      swallow = false
      e.preventDefault()
      e.stopPropagation()
    },
    { capture: true, signal },
  )

  paint(0, 0)

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    buzz.off()
    halt()
    for (const n of ['data-moving', 'data-armed', 'data-thrown']) el.removeAttribute(n)
    o.cssVar?.forEach((n) => n && el.style.removeProperty(n))
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get at() {
      return { ...at }
    },
    get thrown() {
      return thrown
    },
    get moving() {
      return moving
    },
    throw: (d) => {
      if (!signal.aborted && allowed().includes(d)) fly(d, 0)
    },
    undo: (opts) => {
      if (!signal.aborted) undo(opts)
    },
    set(next) {
      o = { ...o, ...next }
    },
    destroy,
  }
}
