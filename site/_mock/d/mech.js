import { springTo } from '@hlmnhkl/detent'
import { still } from './ring.js'

export const deg = Math.PI / 180
export const f = (v) => +v.toFixed(2)
export const at = (r, t, cx = 0, cy = 0) => `${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`

export const ease = (from, to, period, draw) => (done) => springTo({ from, to, period, onFrame: draw, onDone: done })

// Runs steps one after another and gives back one stop for whichever is running.
export function chain(steps, done) {
  let stop = () => {}
  let i = 0
  const go = () => (i < steps.length ? (stop = steps[i++](go)) : done())
  go()
  return () => stop()
}

// A coil spring from a to b: straight ends, then even zigzags, so it squeezes like a real one.
export function coil([x1, y1], [x2, y2], turns = 6, amp = 4, lead = 2) {
  const L = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / L
  const uy = (y2 - y1) / L
  const p = (s, o) => `${f(x1 + ux * s - uy * o)} ${f(y1 + uy * s + ux * o)}`
  const body = L - 2 * lead
  let d = `M ${p(0, 0)} L ${p(lead, 0)}`
  for (let k = 0; k < turns; k++) {
    d += ` L ${p(lead + (body * (k + 0.25)) / turns, amp)} L ${p(lead + (body * (k + 0.75)) / turns, -amp)}`
  }
  return d + ` L ${p(L - lead, 0)} L ${p(L, 0)}`
}

// Puts an HTML control exactly over a part of the drawing, given as a box in the drawing's units.
export function place(svg, el, [x, y, w, h]) {
  const fit = () => {
    const m = svg.getScreenCTM()
    const holder = svg.parentElement
    const r = holder.getBoundingClientRect()
    if (!m || !holder.offsetWidth) return
    // The holder may be zoomed by the machine's camera, so screen px are turned back into its own px.
    const k = r.width / holder.offsetWidth
    Object.assign(el.style, { left: `${(m.e + m.a * x - r.left) / k}px`, top: `${(m.f + m.d * y - r.top) / k}px`, width: `${(m.a * w) / k}px`, height: `${(m.d * h) / k}px` })
  }
  new ResizeObserver(fit).observe(svg)
  addEventListener('sheetfit', fit)
  fit()
  return () => svg.getScreenCTM()?.a ?? 1
}

// The demo plays until the first press or key on the control, then the hand has it for good.
export function demo(el, svg, step, rest, wait, sync) {
  const quit = play(svg, step, rest, wait)
  const take = () => {
    el.removeEventListener('pointerdown', take, true)
    el.removeEventListener('keydown', take, true)
    quit()
    sync()
  }
  el.addEventListener('pointerdown', take, true)
  el.addEventListener('keydown', take, true)
}

// One step at a time, only while the drawing is on screen and the tab is shown. Reduced motion keeps it at rest.
export function play(svg, step, rest, wait = 1400) {
  let timer = 0
  let stop = null
  let seen = false
  let over = false
  const next = () => {
    if (over || !seen || document.hidden || still.matches) return
    stop = step(() => {
      stop = null
      timer = setTimeout(next, typeof wait === 'function' ? wait() : wait)
    })
  }
  const start = () => {
    if (over || !seen || stop || document.hidden || still.matches) return
    clearTimeout(timer)
    timer = setTimeout(next, 900)
  }
  const pause = () => {
    if (over) return
    clearTimeout(timer)
    stop?.()
    stop = null
    rest()
  }
  rest()
  new IntersectionObserver(([e]) => ((seen = e.isIntersecting) ? start() : pause())).observe(svg)
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : start()))
  still.addEventListener('change', () => (still.matches ? pause() : start()))
  // Stops for good where it is: no rest pose, so the drawing does not snap back.
  return () => {
    clearTimeout(timer)
    stop?.()
    stop = null
    over = true
  }
}

// When the hand takes over mid-demo, the control already follows the hand from its own pose, and
// the drawing's leftover offset springs to zero on top of it, so no frame jumps.
export function glue(render, span = 0) {
  let base = [0]
  let off = [0]
  let k = 0
  let stop = () => {}
  let soft = false
  let last = [0]
  const draw = () => render((last = base.map((b, i) => b + (off[i] ?? 0) * k)))
  return {
    input(v) {
      if (soft) {
        soft = false
        return this.from(last, v)
      }
      base = [].concat(v)
      draw()
    },
    // The next input springs in from the current pose instead of jumping, as when a magnet takes it.
    soften(from = last) {
      last = [].concat(from)
      soft = true
    },
    get now() {
      return last
    },
    from(drawn, now) {
      base = [].concat(now)
      const short = (d) => (span ? ((((d % span) + span * 1.5) % span) - span / 2) : d)
      off = [].concat(drawn).map((d, i) => short(d - base[i]))
      stop()
      k = 1
      stop = springTo({ from: 1, to: 0, period: 260, damping: 1, rest: 0.002, onFrame: (t) => ((k = t), draw()), onDone: () => ((k = 0), draw()) })
    },
  }
}

// Each mechanism reports its shaft angle here, so the drive can turn the belt beside it.
const shafts = new Map()
let onTurn = null
export function shaft(name, angle) {
  shafts.set(name, angle)
  onTurn?.(name, angle)
}
export function watchShafts(fn) {
  onTurn = fn
  shafts.forEach((angle, name) => fn(name, angle))
}
