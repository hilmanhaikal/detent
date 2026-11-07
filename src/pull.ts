import { springTo } from './core.js'
import { attrs } from './aria.js'
import { hand } from './hand.js'
import { haptics, type Haptics } from './haptics.js'
import { reduced, type Motion } from './motion.js'

export type PullEventMap = {
  /** Every frame while it moves: how far it is drawn in px, and how near the line it is, 0 to 1. */
  'detentpull:input': CustomEvent<{ distance: number; progress: number }>
  /** When it reaches the line (armed is true) or goes back above it (false) under the hand. */
  'detentpull:arm': CustomEvent<{ armed: boolean }>
  /** Once per pull: let go while armed, or trigger() was called. */
  'detentpull:pull': CustomEvent<Record<string, never>>
}

declare global {
  interface HTMLElementEventMap extends PullEventMap {}
}

export type PullOptions = {
  /** How far it must be drawn down, in px, to arm. Default 64. */
  line?: number
  /** Where it holds while your work runs, in px, until you call done(). Default: the line. */
  rest?: number
  /** The furthest it can be drawn, in px. The pull gets heavier as it nears this. Default line * 2. */
  max?: number
  /** One spring swing in ms. Default 320. */
  period?: number
  /** Default 'auto': follows prefers-reduced-motion, live. Under reduce it jumps to rest or back. */
  motion?: Motion
  /** A CSS custom property that gets the distance in px on each frame. Off unless you name one. */
  cssVar?: `--${string}`
  /** A short tick on phones that vibrate, when the pull arms. Default false. */
  haptics?: Haptics
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it moves, and once at the start: the distance in px, and how near the line it is, 0 to 1. */
  onInput?: (distance: number, progress: number) => void
  /** It reached the line (true) or went back above it (false) under the hand. */
  onArm?: (armed: boolean) => void
  /** Once per pull: let go while armed, or trigger() was called. Call done() when your work ends. */
  onPull?: () => void
}

export type Pull = {
  /** How far it is drawn now, in px. */
  readonly distance: number
  /** True while the hand holds it past the line. */
  readonly armed: boolean
  /** True from a pull until done(). */
  readonly busy: boolean
  /** True while a spring moves it. */
  readonly moving: boolean
  /** Pulls without a hand, for a button or a key: it goes to rest and fires onPull. */
  trigger(): void
  /** Your work ended: it springs back up. */
  done(): void
  /** Swaps options, such as fresh callbacks after a render. */
  set(next: Partial<PullOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

/** A pull drawn with weight: it follows the hand at first, then gets heavier, and never passes `max`. */
export const resist = (raw: number, max: number) => (raw <= 0 || max <= 0 ? 0 : max * (1 - Math.exp(-raw / max)))

/**
 * Pull `el` down past a line and let go to trigger, as in pull to refresh. On a scroll container it
 * only pulls when the container is at its top, so it never fights the native scroll.
 */
export function detentPull(el: HTMLElement, options: PullOptions = {}): Pull {
  let o = options
  const ac = new AbortController()
  const signal = ac.signal
  const a = attrs(el)
  const buzz = haptics(() => o.haptics)

  const line = () => o.line ?? 64
  const max = () => o.max ?? line() * 2
  let distance = 0
  let armed = false
  let busy = false
  let moving = false
  let stop = () => {}

  const fire = <K extends keyof PullEventMap>(type: K, detail: PullEventMap[K]['detail']) => el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))
  const paint = (d: number) => {
    distance = d
    const progress = Math.min(1, d / line())
    if (o.cssVar) el.style.setProperty(o.cssVar, d.toFixed(2))
    o.onInput?.(d, progress)
    fire('detentpull:input', { distance: d, progress })
  }
  const arm = (on: boolean) => {
    if (armed === on) return
    armed = on
    el.toggleAttribute('data-armed', on)
    if (on) buzz.tick(true)
    o.onArm?.(on)
    fire('detentpull:arm', { armed: on })
  }
  const glide = (to: number) => {
    stop()
    const move = (m: boolean) => {
      moving = m
      el.toggleAttribute('data-moving', m)
    }
    move(true)
    stop = springTo({ from: distance, to, period: reduced(o.motion) ? 0 : (o.period ?? 320), damping: 1, rest: 0.5, onFrame: paint, onDone: () => move(false) })
  }
  const pulled = () => {
    busy = true
    el.toggleAttribute('data-busy', true)
    a.set('aria-busy', 'true')
    glide(o.rest ?? line())
    o.onPull?.()
    fire('detentpull:pull', {})
  }

  // A pull starts only at the top and only downward. Anything else is left to the native scroll.
  let state: 'none' | 'maybe' | 'pull' = 'none'
  let raw = 0
  const begin = () => {
    state = !busy && el.scrollTop <= 0 ? 'maybe' : 'none'
    raw = 0
  }
  const step = (dx: number, dy: number) => {
    if (state === 'maybe') {
      if (el.scrollTop > 0 || dy <= 0 || Math.abs(dx) > dy) state = 'none'
      else {
        state = 'pull'
        stop()
        moving = false
        el.removeAttribute('data-moving')
      }
    }
    if (state !== 'pull') return false
    raw += dy
    if (raw <= 0) {
      // Pushed back past where it started: the list scrolls again from here.
      state = 'none'
      paint(0)
      arm(false)
      return false
    }
    paint(resist(raw, max()))
    arm(distance >= line())
    return true
  }
  const end = (cancel: boolean) => {
    const was = state
    state = 'none'
    if (was !== 'pull') return
    const go = armed && !cancel
    arm(false)
    if (go) pulled()
    else glide(0)
  }

  // Touch goes through touch events: only they can stop the page's own overscroll once a pull has begun.
  let id = -1
  let last = { x: 0, y: 0 }
  el.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length > 1) return end(true)
      const t = e.changedTouches[0]
      id = t.identifier
      last = { x: t.clientX, y: t.clientY }
      begin()
    },
    { signal, passive: true },
  )
  el.addEventListener(
    'touchmove',
    (e) => {
      const t = [...e.changedTouches].find((t) => t.identifier === id)
      if (!t || state === 'none') return
      const moved = step(t.clientX - last.x, t.clientY - last.y)
      last = { x: t.clientX, y: t.clientY }
      if (moved && e.cancelable) e.preventDefault()
    },
    { signal, passive: false },
  )
  el.addEventListener('touchend', (e) => [...e.changedTouches].some((t) => t.identifier === id) && end(false), { signal })
  el.addEventListener('touchcancel', () => end(true), { signal })
  hand(
    el,
    {
      grab: begin,
      move: (p, q) => void step(q.x - p.x, q.y - p.y),
      end: (how) => end(how === 'cancel'),
    },
    signal,
    '',
    { only: (e) => e.pointerType === 'mouse', late: true },
  )

  paint(0)

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    buzz.off()
    stop()
    a.restore()
    for (const n of ['data-moving', 'data-armed', 'data-busy']) el.removeAttribute(n)
    if (o.cssVar) el.style.removeProperty(o.cssVar)
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get distance() {
      return distance
    },
    get armed() {
      return armed
    },
    get busy() {
      return busy
    },
    get moving() {
      return moving
    },
    trigger() {
      if (busy || signal.aborted) return
      state = 'none'
      arm(false)
      pulled()
    },
    done() {
      if (!busy || signal.aborted) return
      busy = false
      el.removeAttribute('data-busy')
      a.restore()
      glide(0)
    },
    set(next) {
      o = { ...o, ...next }
    },
    destroy,
  }
}
