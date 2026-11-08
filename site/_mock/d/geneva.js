import { shaft } from './mech.js'
import { springTo } from '@hlmnhkl/detent'
import { still } from './ring.js'

// A Geneva drive: the part inside film projectors that turns a steady spin into clean steps.
// Every curve comes from its real geometry: n slots, centre distance C, crank radius a, wheel radius b.
const n = 6
const C = 100
const a = C * Math.sin(Math.PI / n)
const b = C * Math.cos(Math.PI / n)
const pinR = 6
const half = pinR + 1.5
const lock = 40
const deg = Math.PI / 180
const f = (v) => +v.toFixed(2)
const at = (r, t, cx = 0, cy = 0) => `${f(cx + r * Math.cos(t))} ${f(cy + r * Math.sin(t))}`

function wheelPath() {
  const edge = Math.asin(half / b)
  const tip = Math.acos((b * b + C * C - (lock + 1) ** 2) / (2 * b * C))
  const depth = C - a
  let d = ''
  for (let k = 0; k < n; k++) {
    const s = (30 + 60 * k) * deg
    const e = [Math.cos(s), Math.sin(s)]
    const nn = [-Math.sin(s), Math.cos(s)]
    const out = Math.sqrt(b * b - half * half)
    const p = (t, side) => `${f(t * e[0] + side * half * nn[0])} ${f(t * e[1] + side * half * nn[1])}`
    d += k === 0 ? `M ${p(out, -1)} ` : `A ${f(b)} ${f(b)} 0 0 1 ${p(out, -1)} `
    d += `L ${p(depth, -1)} A ${half} ${half} 0 0 0 ${p(depth, 1)} L ${p(out, 1)} `
    const m = s + 30 * deg
    d += `A ${f(b)} ${f(b)} 0 0 1 ${at(b, m - tip)} `
    d += `A ${lock + 1} ${lock + 1} 0 0 0 ${at(b, m + tip)} `
  }
  const first = 30 * deg
  return d + `A ${f(b)} ${f(b)} 0 0 1 ${at(b, first - edge)} Z`
}

function discPath() {
  const R = b + 2
  const t = Math.acos((lock * lock + C * C - R * R) / (2 * lock * C))
  const from = at(lock, Math.PI - t, C)
  const to = at(lock, Math.PI + t, C)
  return `M ${from} A ${lock} ${lock} 0 1 0 ${to} A ${f(R)} ${f(R)} 0 0 1 ${from} Z`
}

const svg = document.querySelector('.geneva')
svg.querySelector('.g-wheel-edge').setAttribute('d', wheelPath())
svg.querySelector('.g-disc-edge').setAttribute('d', discPath())
svg.querySelector('.g-boss').setAttribute('cx', f(C - a))
svg.querySelector('.g-pin').setAttribute('cx', f(C - a))
svg.querySelector('.g-orbit').setAttribute('r', f(a))
svg.querySelector('.g-wheel-ring').setAttribute('r', f(b))

const wheel = svg.querySelector('.g-wheel')
const driver = svg.querySelector('.g-driver')

// The wheel only moves while the pin is in a slot; the rest of the turn it is held still.
function pose(total) {
  const cycle = Math.floor((total + 180) / 360)
  const local = total - cycle * 360
  let w = -60 * cycle
  if (local > 60) w -= 60
  else if (local > -60) {
    const t = local * deg
    w += Math.atan2(-a * Math.sin(t), C - a * Math.cos(t)) / deg - 30
  }
  driver.setAttribute('transform', `rotate(${f(total)} ${C} 0)`)
  shaft('geneva', total)
  wheel.setAttribute('transform', `rotate(${f(w)})`)
}

let turn = 180
pose(turn)

let timer = 0
let stop = null
let seen = false
const next = () => {
  if (!seen || document.hidden || still.matches) return
  stop = springTo({
    from: turn,
    to: turn + 360,
    period: 1500,
    onFrame: (v) => pose(v),
    onDone: () => {
      turn += 360
      stop = null
      timer = setTimeout(next, 1400)
    },
  })
}
const pause = () => {
  clearTimeout(timer)
  stop?.()
  stop = null
  turn = 180 + Math.round((turn - 180) / 360) * 360
  pose(turn)
}
new IntersectionObserver(([e]) => {
  seen = e.isIntersecting
  if (seen && !stop) timer = setTimeout(next, 900)
  else if (!seen) pause()
}).observe(svg)
document.addEventListener('visibilitychange', () => (document.hidden ? pause() : seen && !stop && (timer = setTimeout(next, 900))))
still.addEventListener('change', () => (still.matches ? pause() : seen && next()))
