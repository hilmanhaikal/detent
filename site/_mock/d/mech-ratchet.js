import { detentPull } from '@hlmnhkl/detent'
import { deg, f, at, ease, chain, coil, place, demo, glue, shaft } from './mech.js'

// A ratchet and pawl. Each tooth is a straight flank from the root circle up to the tip circle,
// then a radial face back down. The pawl rides up a flank, drops off the face, and holds it.
const N = 12
const pitch = 360 / N
const Ro = 60
const Rr = 48
const P = [82 * Math.cos(-52 * deg), 82 * Math.sin(-52 * deg)]
// The tip sits 0.6° past the face, the small play every real pawl has, so it never rests on the edge.
const seatAt = -89.4 * deg
const over = 4

const A = [Rr, 0]
const B = [Ro * Math.cos(pitch * deg), Ro * Math.sin(pitch * deg)]
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
function flank(u) {
  const d = [Math.cos(u), Math.sin(u)]
  const s = -cross(A, d) / cross([B[0] - A[0], B[1] - A[1]], d)
  return Math.hypot(A[0] + s * (B[0] - A[0]), A[1] + s * (B[1] - A[1]))
}
function wheelPath() {
  let d = ''
  for (let k = 0; k < N; k++) {
    const t = (k * pitch - 90) * deg
    d += `${k ? 'L' : 'M'} ${at(Rr, t)} L ${at(Ro, t + pitch * deg)} `
  }
  return d + 'Z'
}

const seatR = flank(0.6 * deg) + 0.05
const tip = [seatR * Math.cos(seatAt), seatR * Math.sin(seatAt)]
const len = Math.hypot(P[0] - tip[0], P[1] - tip[1])
const ux = (P[0] - tip[0]) / len
const uy = (P[1] - tip[1]) / len
const under = [P[0] - 4 * uy, P[1] + 4 * ux]
const upper = [P[0] + 4 * uy, P[1] - 4 * ux]
const front = [(seatR + 7) * Math.cos(seatAt), (seatR + 7) * Math.sin(seatAt)]
const mid = [(front[0] + upper[0]) / 2, (front[1] + upper[1]) / 2]
const post = [mid[0], -96]
const probe = []
for (let i = 0; i <= 100; i++) probe.push([tip[0] + ((under[0] - tip[0]) * i) / 100, tip[1] + ((under[1] - tip[1]) * i) / 100])

const svg = document.querySelector('.m-ratchet')
const wheel = svg.querySelector('.mr-wheel')
const pawl = svg.querySelector('.mr-pawl')
const spring = svg.querySelector('.mr-spring')
wheel.querySelector('.mr-edge').setAttribute('d', wheelPath())
pawl.querySelector('path').setAttribute('d', `M ${f(tip[0])} ${f(tip[1])} L ${f(under[0])} ${f(under[1])} A 4 4 0 0 0 ${f(upper[0])} ${f(upper[1])} L ${f(front[0])} ${f(front[1])} Z`)
const dot = [tip[0] + 11 * ux + 2.5 * uy, tip[1] + 11 * uy - 2.5 * ux]
svg.querySelector('.mr-dot').setAttribute('cx', f(dot[0]))
svg.querySelector('.mr-dot').setAttribute('cy', f(dot[1]))
svg.querySelector('.mr-post').setAttribute('x', f(post[0] - 10))
svg.querySelector('.mr-pivot').setAttribute('cx', f(P[0]))
svg.querySelector('.mr-pivot').setAttribute('cy', f(P[1]))

const turn = (p, a) => {
  const c = Math.cos(a * deg)
  const s = Math.sin(a * deg)
  const x = p[0] - P[0]
  const y = p[1] - P[1]
  return [P[0] + x * c - y * s, P[1] + x * s + y * c]
}
const inWheel = ([x, y], w) => {
  const r = Math.hypot(x, y)
  if (r >= Ro) return false
  const u = ((((Math.atan2(y, x) / deg + 90 - w) % pitch) + pitch) % pitch) * deg
  return r < flank(u) - 0.02
}
// The spring holds the pawl as low as it can go without its underside entering a tooth. The scan
// rises from below, because a higher pose can collide again: the tip swings back toward the face.
const hits = (m, w) => probe.some((p) => inWheel(turn(p, m), w))
function lift(w) {
  let lo = -1
  while (lo < 30 && hits(lo + 0.25, w)) lo += 0.25
  let hi = lo + 0.25
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2
    if (hits(m, w)) lo = m
    else hi = m
  }
  return hi
}

function pose(w) {
  const a = lift(w)
  wheel.setAttribute('transform', `rotate(${f(w)})`)
  shaft('ratchet', w)
  pawl.setAttribute('transform', `rotate(${f(a)} ${f(P[0])} ${f(P[1])})`)
  spring.setAttribute('d', coil(turn(mid, a), post, 5, 4))
}

// The line is one tooth of pull: at 64 px the face passes the pawl. After a pull the pawl holds
// the wheel there, so on the way back it stops one tooth on.
const line = 64
const hand = document.querySelector('#ratchet-hand')
place(svg, hand, [-62, -62, 124, 124])
let base = 0
let held = null
let drawn = 0
const show = (w) => pose((drawn = w))
const hold = glue(([w]) => show(w))
function turnTo(d) {
  const w = base - (d * pitch) / line
  hold.input(held === null ? w : Math.min(w, held))
  if (held !== null && d < 0.5) {
    base = held
    held = null
  }
}
function caught() {
  held = base - pitch
  setTimeout(() => ratchet.done(), 160)
}
// show
const ratchet = detentPull(hand, {
  line,
  max: line * 1.4,
  onInput: turnTo,
  onPull: caught,
})
// end
hand.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'ArrowDown') return
  e.preventDefault()
  ratchet.trigger()
})

// Before the first touch: pulled one tooth and a little over, then let go onto the pawl.
let k = 0
demo(
  hand,
  svg,
  (done) => {
    const w = -k * pitch
    return chain([ease(w, w - pitch - over, 900, show), ease(w - pitch - over, w - pitch, 320, show)], () => {
      k = (k + 1) % N
      done()
    })
  },
  () => show(-k * pitch),
  1100,
  () => {
    // Past the face the pawl already holds the next tooth, so that is where the hand starts.
    base = drawn <= -(k + 1) * pitch + 0.01 ? -(k + 1) * pitch : -k * pitch
    hold.from(drawn, base)
  },
)
