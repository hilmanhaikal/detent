import { attract, clamp, createScrub, lastStep, nearestMark, roundTo, stepKey, wrap, type Mark, type Reach, type Scrub } from './core.js'
import { attrs, needsName } from './aria.js'
import { hand, turned, type Pt } from './hand.js'
import { reduced, type Motion } from './motion.js'
import { haptics, type Haptics } from './haptics.js'

/** A number is a plain mark. */
export type MarkInput = number | Mark

export type DetentEventMap = {
  /** Every frame while it moves: `at` is where it is drawn, `value` where it would rest. */
  'detent:input': CustomEvent<{ at: number; value: number }>
  /** Once, when it comes to rest on a new value. */
  'detent:change': CustomEvent<{ value: number }>
  /** A new resting value came under the hand while it moves. */
  'detent:mark': CustomEvent<{ value: number }>
}

declare global {
  interface HTMLElementEventMap extends DetentEventMap {}
}

type Base = {
  /** Where it starts. Default: min, or 0 in a loop. */
  value?: number
  /** Every resting place is a multiple of this, counted from min. Default 1. */
  step?: number
  /** Places the value is pulled onto. Strong ones pull from further away. */
  marks?: MarkInput[]
  /** How far marks reach, as a share of the smallest gap between two marks. Default { reach: 0.35, strong: 1.5 }. */
  reach?: Reach
  /** 'step' rests on any step, drawn toward marks. 'marks' rests only on a mark. Default 'step'. */
  snap?: 'step' | 'marks'
  /** How far a flick carries, in seconds of its speed. Default 0.2. 0 lands under the hand. */
  coast?: number
  /** The fastest a flick may go, in units per second. */
  maxSpeed?: number
  /** One spring swing in ms. Default 280. */
  period?: number
  /** Default 'auto': follows prefers-reduced-motion, live. */
  motion?: Motion
  /** The words a screen reader says for a value, written to aria-valuetext. Default String(value). */
  text?: (value: number) => string
  /** Your own key map. Return the value to go to, or null to let the key through. */
  keys?: (key: string, value: number) => number | null
  /** A CSS custom property that gets the live value on each frame. Off unless you name one. */
  cssVar?: `--${string}`
  /** Set only when the element has no role. Default 'slider', or 'spinbutton' in a loop. */
  role?: 'slider' | 'spinbutton'
  /** The drag moves the content, not a thumb: a drag to the right lowers the value. */
  invert?: boolean
  /** A short tick on phones that vibrate, only while the person moves it. true: strong marks only. 'all': every value. Default false. */
  haptics?: Haptics
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it moves, and once at the start so you can draw it. */
  onInput?: (at: number) => void
  /** A new resting value came under the hand. */
  onMark?: (value: number) => void
  /** It came to rest on a new value. */
  onChange?: (value: number) => void
  /** A press that barely moved. Without this, a tap lands where it is. */
  onTap?: (value: number) => void
}

type Line = {
  /** Default 'x'. On 'y', up is more. */
  path?: 'x' | 'y'
  /** Pixels per unit. Default: the element's length along the path divided by the range. */
  size?: number | (() => number)
}
type Turn = {
  /** A dial: the hand turns round the element's centre. */
  path: 'turn'
  /** Degrees of turn from min to max. Default 270. */
  sweep?: number
}
type Range = {
  /** The lowest value. */
  min: number
  /** The highest value. */
  max: number
  /** Leave out, or false, for a range with two ends. */
  loop?: false
  /** How far a drag stretches past an end, in units. Default step * 0.6. */
  edge?: number
}
type Loop = {
  /** It wraps round, like a picker wheel: past the last value comes the first. */
  loop: true
  /** How many places the loop has. Values run from 0 to count - 1. */
  count: number
}

export type DetentOptions = Base & (Line | Turn) & (Range | Loop)

export type Detent = {
  /** The settled value, or where it is going. */
  readonly value: number
  /** Where it is drawn now, between values while it moves. */
  readonly at: number
  /** True while a hand or a glide moves it. */
  readonly moving: boolean
  /** Glides to a value. With { instant: true } it jumps. */
  go(value: number, opts?: { instant?: boolean }): void
  /** Swaps options: marks, range, callbacks. A new range keeps the value inside it; new marks land it again. */
  set(next: Partial<DetentOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
  /** The low-level scrub under it, for anything the options do not cover. */
  readonly scrub: Scrub
}

type Loose = Base & { path?: 'x' | 'y' | 'turn'; size?: number | (() => number); sweep?: number; min?: number; max?: number; loop?: boolean; count?: number; edge?: number }

/** One value under a hand, with pointer, keys and screen reader wired to `el`. */
export function detent(el: HTMLElement, options: DetentOptions): Detent {
  let o = options as Loose
  const ac = new AbortController()
  const signal = ac.signal
  const a = attrs(el)

  const step = () => o.step ?? 1
  const lo = () => (o.loop ? 0 : o.min!)
  const hi = () => (o.loop ? o.count! - 1 : lastStep(o.min!, o.max!, step()))
  const span = () => (o.loop ? o.count! : hi() - lo())
  const out = (v: number) => (o.loop ? wrap(roundTo(v, step()), o.count!) : v)
  const live = (v: number) => (o.loop ? wrap(v, o.count!) : v)

  let marks: Mark[] = []
  let ring: Mark[] = []
  let gap = 1
  const readMarks = () => {
    marks = (o.marks ?? []).map((m) => (typeof m === 'number' ? { at: m } : m)).sort((p, q) => p.at - q.at)
    gap = Infinity
    for (let i = 1; i < marks.length; i++) gap = Math.min(gap, marks[i].at - marks[i - 1].at)
    if (!isFinite(gap) || gap <= 0) gap = step()
    const n = o.count ?? 0
    ring = o.loop ? marks.flatMap((m) => [{ ...m, at: m.at - n }, m, { ...m, at: m.at + n }]) : marks
  }
  readMarks()

  // In a loop the position keeps counting past the ends, so marks are matched within the current lap.
  const lap = (v: number) => (o.loop ? Math.floor(v / o.count!) * o.count! : 0)
  const pulled = (v: number) => (marks.length ? lap(v) + attract(v - lap(v), ring, gap, o.reach) : v)
  const land = (v: number) => {
    const p = pulled(v)
    if (o.snap === 'marks' && marks.length) return lap(v) + nearestMark(p - lap(v), ring.map((m) => m.at))!
    return o.loop ? roundTo(p, step()) : clamp(roundTo(p, step(), lo()), lo(), hi())
  }

  const fire = <K extends keyof DetentEventMap>(type: K, detail: DetentEventMap[K]['detail']) => el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }))

  let quiet = true
  let last = NaN
  // Ticks belong to the person's own moves: while the hand drags, and once where their move lands.
  const buzz = haptics(() => o.haptics)
  let held = false
  let person = false
  let from = NaN
  let ticked = NaN
  const feel = (v: number) => {
    const strong = marks.some((m) => m.strong && Math.abs(m.at - v) < 1e-9)
    if (v !== ticked && buzz.tick(strong)) ticked = v
  }
  const byPerson = () => {
    person = true
    from = out(scrub.target)
    ticked = NaN
  }
  const range = () => ({ min: o.loop ? undefined : lo(), max: o.loop ? undefined : hi(), edge: o.edge ?? step() * 0.6, coast: o.coast, maxSpeed: o.maxSpeed })
  const scrub = createScrub({
    value: 0,
    ...range(),
    attract: (r) => (o.snap === 'marks' ? r : pulled(r)),
    land,
    period: () => (reduced(o.motion) ? 0 : (o.period ?? 280)),
    onFrame: (at) => {
      const v = live(at)
      if (o.cssVar) el.style.setProperty(o.cssVar, v.toFixed(4))
      o.onInput?.(v)
      fire('detent:input', { at: v, value: out(scrub.target) })
    },
    onMoving: (m) => el.toggleAttribute('data-moving', m),
    onMark: (v) => {
      if (held) feel(out(v))
      o.onMark?.(out(v))
      fire('detent:mark', { value: out(v) })
    },
    onSettle: (to) => {
      const v = out(to)
      if (person && v !== from) feel(v)
      person = false
      a.set('aria-valuenow', String(v))
      a.set('aria-valuetext', o.text ? o.text(v) : String(v))
      if (quiet || v === last) return
      last = v
      o.onChange?.(v)
      fire('detent:change', { value: v })
    },
  })

  const writeRange = () => {
    a.fill('role', o.role ?? (o.loop ? 'spinbutton' : 'slider'))
    a.fill('tabindex', '0')
    a.set('aria-valuemin', o.loop ? null : String(lo()))
    a.set('aria-valuemax', o.loop ? null : String(hi()))
    if (el.getAttribute('role') === 'slider' && o.path !== 'turn') a.set('aria-orientation', o.path === 'y' ? 'vertical' : 'horizontal')
  }
  writeRange()
  needsName(el)

  const start = o.value ?? lo()
  last = o.loop ? out(start) : clamp(start, lo(), hi())
  scrub.place(last)
  quiet = false

  // In a loop, a value is reached the short way round from where it is now.
  const near = (v: number) => (o.loop ? v + Math.round((scrub.at - v) / o.count!) * o.count! : clamp(v, lo(), hi()))
  const go = (v: number, opts?: { instant?: boolean }) => (opts?.instant ? scrub.place(near(v)) : scrub.go(near(v)))
  const goBy = (v: number, opts?: { instant?: boolean }) => {
    person = false
    go(v, opts)
  }

  const toward = (key: string, v: number) => {
    const ats = marks.map((m) => m.at)
    const up = key === 'ArrowUp' || key === 'ArrowRight' || key === 'PageUp'
    const down = key === 'ArrowDown' || key === 'ArrowLeft' || key === 'PageDown'
    if (up) return ats.find((m) => m > v + 1e-9) ?? (o.loop ? ats[0] : v)
    if (down) return [...ats].reverse().find((m) => m < v - 1e-9) ?? (o.loop ? ats[ats.length - 1] : v)
    if (key === 'Home') return ats[0]
    if (key === 'End') return ats[ats.length - 1]
    return null
  }
  const keyFor = (key: string, v: number) => {
    if (o.keys) return o.keys(key, v)
    if (o.snap === 'marks' && marks.length) return toward(key, v)
    const strong = marks.filter((m) => m.strong).map((m) => m.at)
    return stepKey(key, v, { min: lo(), max: hi(), step: step(), marks: marks.map((m) => m.at), strong, loop: !!o.loop })
  }
  el.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const v = keyFor(e.key, out(scrub.target))
      if (v === null) return
      e.preventDefault()
      byPerson()
      go(v)
    },
    { signal },
  )

  const units = (p: Pt, q: Pt) => {
    if (o.path === 'turn') return (turned(el, p, q) * span()) / (o.sweep ?? 270)
    const px = o.path === 'y' ? p.y - q.y : q.x - p.x
    const size = typeof o.size === 'function' ? o.size() : (o.size ?? (o.path === 'y' ? el.clientHeight : el.clientWidth) / span())
    return (o.invert ? -px : px) / size
  }
  hand(
    el,
    {
      grab: () => {
        scrub.grab()
        byPerson()
        held = true
      },
      move: (p, q) => {
        const d = units(p, q)
        if (d) scrub.drag(d)
      },
      end: (how) => {
        held = false
        if (how === 'cancel') return scrub.cancel()
        if (how === 'tap' && o.onTap) {
          scrub.cancel()
          return o.onTap(out(scrub.target))
        }
        scrub.release()
      },
    },
    signal,
    o.path === 'turn' ? 'none' : o.path === 'y' ? 'pan-x' : 'pan-y',
  )

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    buzz.off()
    scrub.stop()
    a.restore()
    el.removeAttribute('data-moving')
    if (o.cssVar) el.style.removeProperty(o.cssVar)
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get value() {
      return out(scrub.target)
    },
    get at() {
      return live(scrub.at)
    },
    get moving() {
      return scrub.moving
    },
    go: goBy,
    set(next) {
      person = false
      o = { ...o, ...next } as Loose
      readMarks()
      writeRange()
      scrub.update(range())
      if (scrub.moving) return
      const t = scrub.target
      const relands = 'marks' in next || 'step' in next || 'snap' in next || 'count' in next
      const v = relands ? land(o.loop ? t : clamp(t, lo(), hi())) : o.loop ? t : clamp(t, lo(), hi())
      if (v !== t) scrub.place(v)
    },
    destroy,
    scrub,
  }
}
