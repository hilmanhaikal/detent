import { curve, type Curve, type Timing } from './ease.js'
import { clock } from './clock.js'
import { reduced, type Motion } from './motion.js'

/** What animate moves on an element. x, y, scale and rotate (in px and degrees) make one transform. */
export type ElementValues = { x?: number; y?: number; scale?: number; rotate?: number; opacity?: number; [custom: `--${string}`]: number | undefined }

/** The numbers a plain object has, each one optional. */
export type ObjectValues<T> = { [K in keyof T as T[K] extends number ? K : never]?: number }

export type AnimateOptions<V = ElementValues> = Timing & {
  /** Where it goes. */
  to: V
  /** Where it starts. Default: where it is now. */
  from?: V
  /** Wait this long in ms before it starts. */
  delay?: number
  /** Every frame, and once at the end, with the values it has now. */
  onUpdate?: (value: V) => void
  /** Once, when it lands. Never when it is stopped or another animation takes over. */
  onDone?: () => void
  /** Default 'auto': with reduced motion it lands at once, and onUpdate and onDone still run. */
  motion?: Motion
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
}

export type Animate = {
  /** Resolves true when it lands, or false when it is stopped, destroyed or taken over. It never rejects. */
  readonly finished: Promise<boolean>
  /** From 0 to 1. */
  readonly progress: number
  /** Stops where it is. Values stay as they are, and onDone does not run. */
  stop(): void
  /** Holds where it is, until play(). */
  pause(): void
  /** Goes on after pause(), or plays again from the start once it has landed. */
  play(): void
  /** Shows the motion at `ms`, delay not counted. It keeps playing or stays paused. */
  seek(ms: number): void
  /** The same as stop(), bound, so it can be passed on as is. Values stay, so a new animation starts from them. */
  destroy: () => void
}

type Values = Record<string, number>
type Target = HTMLElement | Values

const parts: Values = { x: 0, y: 0, rotate: 0, scale: 1 }
const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const states = new WeakMap<Element, Values>()
const isEl = (t: unknown): t is HTMLElement => (t as Element).nodeType === 1

/** Where `key` is now. Transform parts are kept by detent, since a computed transform cannot be split back up. */
export function read(target: Target, key: string) {
  if (!isEl(target)) return target[key]
  if (has(parts, key)) return states.get(target)?.[key] ?? parts[key]
  return parseFloat(getComputedStyle(target).getPropertyValue(key)) || 0
}

export function write(target: Target, values: Values) {
  if (!isEl(target)) return void Object.assign(target, values)
  let s: Values | undefined
  for (const k in values) {
    if (has(parts, k)) (s ??= states.get(target) ?? {})[k] = values[k]
    else target.style.setProperty(k, String(values[k]))
  }
  if (s) {
    const v = (k: string) => s![k] ?? parts[k]
    states.set(target, s)
    target.style.transform = `translate(${v('x')}px, ${v('y')}px) rotate(${v('rotate')}deg) scale(${v('scale')})`
  }
}

/** The keys it may move. On an element that is transform, opacity and custom properties: never layout, so the page never jumps. */
export function keysOf(target: unknown, to: object) {
  return Object.keys(to).filter((k) => {
    const ok = !isEl(target) || has(parts, k) || k === 'opacity' || k.startsWith('--')
    if (!ok) console.warn(`detent: animate moves x, y, scale, rotate, opacity and --custom properties, not ${k}, which would make the layout jump.`)
    return ok
  })
}

type Run = { speed: (key: string) => number; drop: (key: string) => void }
const runs = new WeakMap<object, Map<string, Run>>()

/** Moves an element, an object's numbers or one number, with a spring that never bounces or on an ease. */
export function animate(target: number, options: AnimateOptions<number>): Animate
export function animate(target: Element, options: AnimateOptions<ElementValues>): Animate
export function animate<T extends object>(target: T, options: AnimateOptions<ObjectValues<T>>): Animate
export function animate(target: any, options: AnimateOptions<any>): Animate {
  const o = options
  const one = typeof target === 'number'
  const to: Values = one ? { v: o.to } : o.to
  const from: Values = one ? { v: o.from ?? target } : (o.from ?? {})
  const own = one ? null : (runs.get(target) ?? runs.set(target, new Map()).get(target)!)
  let tracks: Map<string, Curve> | undefined
  let dur = 0

  const me: Run = {
    speed: (k) => (c.on ? tracks!.get(k)!.at(c.t)[1] : 0),
    drop: (k) => {
      tracks!.delete(k)
      if (!tracks!.size) c.stop()
    },
  }
  // Values are read when it starts, not when it is made, so a delayed one picks up where things are then.
  const build = () => {
    if (tracks) return
    tracks = new Map()
    for (const k of keysOf(target, to)) {
      const before = own?.get(k)
      const start = has(from, k) ? from[k] : read(target as Target, k)
      const v = before && !has(from, k) ? before.speed(k) : 0
      before?.drop(k)
      own?.set(k, me)
      const t = curve(start, to[k], o, v)
      dur = Math.max(dur, t.duration)
      tracks.set(k, t)
    }
  }
  const draw = (t: number) => {
    if (t < 0 && !tracks) return
    build()
    const now: Values = {}
    tracks!.forEach((track, k) => (now[k] = track.at(t)[0]))
    if (!one) write(target as Target, now)
    o.onUpdate?.(one ? now.v : now)
  }
  const c = clock(
    () => (tracks ? dur : Infinity),
    draw,
    (landed) => {
      tracks?.forEach((_, k) => own?.get(k) === me && own.delete(k))
      o.signal?.removeEventListener('abort', destroy)
      if (landed) o.onDone?.()
    },
    () => reduced(o.motion),
    -(o.delay ?? 0),
  )
  const play = () => {
    if (reduced(o.motion)) build()
    c.play()
  }
  const destroy = () => c.stop()
  if (o.signal?.aborted) c.stop()
  else {
    o.signal?.addEventListener('abort', destroy, { once: true })
    play()
  }

  return {
    get finished() {
      return c.finished
    },
    get progress() {
      return tracks ? (dur ? Math.min(1, Math.max(0, c.t / dur)) : +(c.t >= 0)) : 0
    },
    stop: c.stop,
    pause: c.pause,
    play,
    seek: (ms) => c.seek(Math.max(0, ms)),
    destroy,
  }
}
