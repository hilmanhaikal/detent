import { curve, type Curve } from './ease.js'
import { clock } from './clock.js'
import { reduced, type Motion } from './motion.js'
import { keysOf, read, write, type AnimateOptions, type ElementValues, type ObjectValues } from './animate.js'
import type { Mark } from './core.js'

/** Where a step starts: ms from the start, '+=ms' or '-=ms' from the end so far, '<' with the step before, or a label. */
export type Position = number | string

/** A step's options: the same as animate(), but the timeline owns motion and signal. */
export type StepOptions<V = ElementValues> = Omit<AnimateOptions<V>, 'motion' | 'signal'>

export type TimelineOptions = {
  /** Wait for play() or seek(). Default false: it plays once your steps are added. */
  paused?: boolean
  /** Default 'auto': with reduced motion, play() lands on the end at once. seek() still works, for scrubbing. */
  motion?: Motion
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame, with the time in ms. */
  onUpdate?: (ms: number) => void
  /** Once, when it reaches the end (or the start, played in reverse). */
  onDone?: () => void
}

export type Timeline = {
  /** Adds a step and gives back the timeline. A spring step lasts until it settles. */
  add(target: number, options: StepOptions<number>, at?: Position): Timeline
  add(target: Element, options: StepOptions<ElementValues>, at?: Position): Timeline
  add<T extends object>(target: T, options: StepOptions<ObjectValues<T>>, at?: Position): Timeline
  /** Names a time, by default the end so far. Labels are places to seek to, and marks for a detent. */
  label(name: string, at?: Position): Timeline
  /** Every label as a detent mark, in order, so a control can settle on them. */
  marks(): Mark[]
  /** Plays forward, from the start again once it has ended. */
  play(): void
  /** Holds where it is. */
  pause(): void
  /** Plays backward from where it is, from the end once it is at the start. */
  reverse(): void
  /** Shows the timeline at ms or at a label. It keeps playing or stays paused. */
  seek(at: number | string): void
  /** Resolves true when it reaches its end, or false when it is destroyed. It never rejects. */
  readonly finished: Promise<boolean>
  /** The whole length in ms. */
  readonly duration: number
  /** From 0 to 1. */
  readonly progress: number
  /** Stops it. Values stay where they are. Bound, so it can be passed on as is. */
  destroy: () => void
}

type Step = { at: number; length: number; target: object | number; tracks: [string, Curve][]; o: StepOptions<any>; last: number }

/** Many animations on one clock: each step starts at its position, and the whole can play, reverse and seek. */
export function timeline(options: TimelineOptions = {}): Timeline {
  const o = options
  const steps: Step[] = []
  const labels = new Map<string, number>()
  const plans = new Map<object | number, Record<string, number>>()
  let end = 0
  let previous = 0
  let untouched = true

  const time = (at: Position | undefined) => {
    if (at === undefined) return end
    if (typeof at === 'number') return at
    if (at === '<') return previous
    const rel = /^([+-])=(.+)$/.exec(at)
    if (rel) return end + Number(rel[2]) * (rel[1] === '-' ? -1 : 1)
    // An unknown label is made at the end, as other timeline engines do.
    if (!labels.has(at)) labels.set(at, end)
    return labels.get(at)!
  }

  const draw = (t: number) => {
    // Steps not reached yet show their start, the latest first; then the ones reached, in order, so the latest wins.
    const waiting = steps.filter((s) => s.at > t).reverse()
    for (const s of [...waiting, ...steps.filter((s) => s.at <= t)]) {
      const local = Math.min(s.length, Math.max(0, t - s.at))
      if (local === s.last) continue
      const now: Record<string, number> = {}
      for (const [k, c] of s.tracks) now[k] = c.at(local)[0]
      const one = typeof s.target === 'number'
      if (!one) write(s.target as Record<string, number>, now)
      s.o.onUpdate?.(one ? now.v : now)
      if (local === s.length && !(s.last >= s.length)) s.o.onDone?.()
      s.last = local
    }
    o.onUpdate?.(t)
  }
  const length = () => Math.max(0, ...steps.map((s) => s.at + s.length))
  const c = clock(length, draw, (landed) => landed && o.onDone?.(), () => reduced(o.motion))
  const touch = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
    untouched = false
    fn(...a)
  }
  const destroy = () => {
    untouched = false
    c.stop()
  }

  const tl: Timeline = {
    add(target: any, so: StepOptions<any>, at?: Position) {
      const one = typeof target === 'number'
      const to = one ? { v: so.to } : so.to
      const from = one ? { v: so.from ?? target } : (so.from ?? {})
      // A step starts where the step before it on the same property ends, so seeking anywhere is exact.
      const plan = plans.get(target) ?? plans.set(target, {}).get(target)!
      const start = Math.max(0, time(at)) + (so.delay ?? 0)
      const tracks = keysOf(target, to).map((k): [string, Curve] => {
        const c = curve(k in from ? from[k] : (plan[k] ?? read(target, k)), to[k], so)
        plan[k] = to[k]
        return [k, c]
      })
      const step = { at: start, length: Math.max(0, ...tracks.map(([, c]) => c.duration)), target, tracks, o: so, last: NaN }
      steps.push(step)
      steps.sort((a, b) => a.at - b.at)
      previous = start
      end = Math.max(end, start + step.length)
      return tl
    },
    label(name, at) {
      labels.set(name, Math.max(0, time(at)))
      return tl
    },
    marks: () => [...new Set(labels.values())].sort((a, b) => a - b).map((at) => ({ at })),
    play: touch(c.play),
    pause: touch(c.pause),
    reverse: touch(c.reverse),
    seek: touch((at: number | string) => c.seek(typeof at === 'string' ? (labels.get(at) ?? 0) : at)),
    get finished() {
      return c.finished
    },
    get duration() {
      return length()
    },
    get progress() {
      return length() ? c.t / length() : 1
    },
    destroy,
  }

  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true })
  queueMicrotask(() => untouched && (o.paused ? tl.seek(0) : tl.play()))
  return tl
}
