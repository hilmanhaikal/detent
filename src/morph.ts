import { curve, type Curve, type Timing } from './ease.js'
import { clock } from './clock.js'
import { reduced, type Motion } from './motion.js'

export type MorphOptions = Timing & {
  /** Another element it grows out of, such as a thumbnail that opens into a full view. Default: the element itself. */
  from?: Element
  /** Default 'auto': with reduced motion the change shows at once, and onDone still runs. */
  motion?: Motion
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Once, when every element has landed in its new place. */
  onDone?: () => void
}

export type Morph = {
  /** Resolves true when it lands, or false when it is stopped or another morph takes over. It never rejects. */
  readonly finished: Promise<boolean>
  /** Puts every element in its new place at once. */
  stop(): void
  /** The same as stop(), bound, so it can be passed on as is. */
  destroy: () => void
}

type Box = [left: number, top: number, width: number, height: number]
type Run = { speeds: (el: HTMLElement) => Box | undefined; drop: (el: HTMLElement) => void }

const runs = new WeakMap<HTMLElement, Run>()
const box = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return [r.left, r.top, r.width, r.height]
}

/**
 * Moves and resizes elements into the place `change` gives them, with no jump. It measures them,
 * makes the change, and then plays the difference back with a transform (FLIP), so the page lays out
 * once and never again while it moves.
 */
export function morph(target: HTMLElement | HTMLElement[], change: () => void, options: MorphOptions = {}): Morph {
  const o = options
  const els = Array.isArray(target) ? target : [target]
  const first = new Map(els.map((el) => [el, box(o.from ?? el)]))
  const speed = new Map<Element, Box>()
  const origin = new Map<HTMLElement, string>()
  for (const el of els) {
    // Mid-flight, it starts from where it is drawn and at the speed it has, so a new change never jumps.
    const before = runs.get(el)
    const v = !o.from && before?.speeds(el)
    if (v) speed.set(el, v)
    before?.drop(el)
    origin.set(el, el.style.transformOrigin)
    el.style.transform = ''
  }
  change()
  const tracks = new Map<HTMLElement, { last: Box; curves: Curve[] }>()
  let dur = 0
  for (const el of els) {
    const last = box(el)
    const curves = last.map((to, i) => curve(first.get(el)![i], to, o, speed.get(el)?.[i]))
    tracks.set(el, { last, curves })
    for (const c of curves) dur = Math.max(dur, c.duration)
  }

  const put = (el: HTMLElement, t: number) => {
    const { last, curves } = tracks.get(el)!
    const [l, tp, w, h] = curves.map((k) => k.at(t)[0])
    const [L, T, W, H] = last
    el.style.transformOrigin = '0 0'
    el.style.transform = `translate(${l - L}px, ${tp - T}px) scale(${W ? w / W : 1}, ${H ? h / H : 1})`
  }
  const clear = (el: HTMLElement) => {
    el.style.transform = ''
    el.style.transformOrigin = origin.get(el)!
  }
  const me: Run = {
    speeds: (el) => tracks.get(el)?.curves.map((k) => (c.on ? k.at(c.t)[1] : 0)) as Box,
    drop: (el) => {
      tracks.delete(el)
      clear(el)
      if (!tracks.size) c.stop()
    },
  }
  const c = clock(
    () => dur,
    (t) => tracks.forEach((_, el) => (t < dur ? put(el, t) : clear(el))),
    (landed) => {
      tracks.forEach((_, el) => {
        clear(el)
        if (runs.get(el) === me) runs.delete(el)
      })
      o.signal?.removeEventListener('abort', c.stop)
      if (landed) o.onDone?.()
    },
    () => reduced(o.motion),
  )
  for (const el of els) runs.set(el, me)
  // Drawn at its old place before the browser paints, so the change never flashes.
  if (!reduced(o.motion)) tracks.forEach((_, el) => put(el, 0))
  if (o.signal?.aborted) c.stop()
  else {
    o.signal?.addEventListener('abort', c.stop, { once: true })
    c.play()
  }
  return {
    get finished() {
      return c.finished
    },
    stop: c.stop,
    destroy: c.stop,
  }
}
