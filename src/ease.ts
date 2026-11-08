// Timing as pure maths: an ease curve, or a spring solved in closed form. Both answer "where and how
// fast at this time", so any motion can be paused, sought and run backwards.

/** A named curve, a cubic-bezier as [x1, y1, x2, y2], or your own function from 0 to 1. */
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | [number, number, number, number] | ((p: number) => number)

export type Timing = {
  /** One spring swing in ms, when there is no duration. Default 400. */
  period?: number
  /** 1 settles as fast as it can with no bounce. Higher is slower and softer. Below 1 counts as 1. Default 1. */
  damping?: number
  /** A fixed time in ms, which turns the spring off and uses `ease`. */
  duration?: number
  /** The curve for `duration`. Default 'out'. */
  ease?: Ease
}

/** Where a motion is at a time in ms, and how long it runs. */
export type Curve = {
  /** In ms. A spring ends when it is within 0.5 of where it goes (or 0.5% of the way, if that is less). */
  duration: number
  /** The value and its speed in units per second, at `ms`. */
  at: (ms: number) => [value: number, speed: number]
}

/** A CSS-style cubic-bezier curve, from progress 0 to 1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const b = (p1: number, p2: number, t: number) => ((1 - 3 * p2 + 3 * p1) * t + 3 * p2 - 6 * p1) * t * t + 3 * p1 * t
  return (p: number) => {
    if (p <= 0 || p >= 1) return p <= 0 ? 0 : 1
    let lo = 0
    let hi = 1
    let t = p
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2
      if (b(x1, x2, t) < p) lo = t
      else hi = t
    }
    return b(y1, y2, t)
  }
}

const named = { in: [0.7, 0, 0.84, 0], out: [0.16, 1, 0.3, 1], inOut: [0.65, 0, 0.35, 1] } as const

/** The ease as a function from progress 0 to 1. */
export function easing(ease: Ease = 'out'): (p: number) => number {
  if (typeof ease === 'function') return ease
  if (ease === 'linear') return (p) => Math.min(1, Math.max(0, p))
  const [a, b, c, d] = typeof ease === 'string' ? named[ease] : ease
  return cubicBezier(a, b, c, d)
}

/** From `from` to `to`: a spring with no bounce, or `duration` on `ease`. `velocity` carries a motion on, in units per second. */
export function curve(from: number, to: number, { period = 400, damping = 1, duration, ease }: Timing = {}, velocity = 0): Curve {
  if (duration !== undefined) {
    const e = easing(ease)
    const d = Math.max(0, duration)
    return {
      duration: d,
      at: (ms) => {
        const p = d ? Math.min(1, Math.max(0, ms / d)) : 1
        const h = 1e-3
        return [from + (to - from) * e(p), d && p < 1 ? (((to - from) * (e(p + h) - e(p))) / h / d) * 1000 : 0]
      },
    }
  }
  // Solved, not stepped: x is the distance left. At 1 the two roots meet, so that case has its own form.
  const w = (2 * Math.PI) / (Math.max(1, period) / 1000)
  const z = Math.max(1, damping)
  const x0 = from - to
  let f: (s: number) => [number, number]
  if (z === 1) {
    const b = velocity + w * x0
    f = (s) => [(x0 + b * s) * Math.exp(-w * s), (b - w * (x0 + b * s)) * Math.exp(-w * s)]
  } else {
    const q = w * Math.sqrt(z * z - 1)
    const r1 = -w * z + q
    const r2 = -w * z - q
    const c2 = (velocity - r1 * x0) / (r2 - r1)
    const c1 = x0 - c2
    f = (s) => [c1 * Math.exp(r1 * s) + c2 * Math.exp(r2 * s), r1 * c1 * Math.exp(r1 * s) + r2 * c2 * Math.exp(r2 * s)]
  }
  const rest = Math.min(0.5, Math.max(1e-3, Math.abs(x0) / 200))
  let d = 0
  for (let x = f(0); d < 6e4 && (Math.abs(x[0]) >= rest || Math.abs(x[1]) >= rest * w); x = f(++d / 1000));
  return { duration: d, at: (ms) => (ms >= d ? [to, 0] : (([x, v]) => [to + x, v] as [number, number])(f(Math.max(0, ms) / 1000))) }
}
