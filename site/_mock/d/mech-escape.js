import { detentHold } from '@hlmnhkl/detent'
import { deg, f, at, ease, chain, place, demo, shaft } from './mech.js'

// An anchor escapement. The wheel is always pushed clockwise, and turns only as far as the
// pallets let it. The pallets sit 3.5 teeth apart, so each swing frees half a tooth: 12°.
const N = 15
const pitch = 360 / N
const Ro = 60
const Rr = 48
const Q = [0, -92]
const spread = 42.5
const tipR = 59
const topR = 76
const half = 2
const swing = 3

const A = [Rr, 0]
const B = [Ro * Math.cos(pitch * deg), Ro * Math.sin(pitch * deg)]
const cross = (a, b) => a[0] * b[1] - a[1] * b[0]
function flank(u) {
  const d = [Math.cos(u), Math.sin(u)]
  const s = -cross(A, d) / cross([B[0] - A[0], B[1] - A[1]], d)
  return Math.hypot(A[0] + s * (B[0] - A[0]), A[1] + s * (B[1] - A[1]))
}
let teeth = ''
for (let k = 0; k < N; k++) {
  const t = (k * pitch - 90) * deg
  teeth += `${k ? 'L' : 'M'} ${at(Rr, t)} L ${at(Ro, t + pitch * deg)} `
}

const sides = []
let anchor = `M ${f(Q[0] - 7)} ${f(Q[1])} `
const probe = []
for (const s of [-1, 1]) {
  const t = (-90 + s * spread) * deg
  const e = [Math.cos(t), Math.sin(t)]
  const n = [-e[1], e[0]]
  const p = (r, o) => [r * e[0] + o * n[0], r * e[1] + o * n[1]]
  for (let i = 0; i <= 20; i++) probe.push(p(tipR + ((topR - tipR) * i) / 20, half), p(tipR + ((topR - tipR) * i) / 20, -half))
  for (let i = 0; i <= 8; i++) probe.push(p(tipR, -half + (half * i) / 4))
  sides.push(p)
}
const pt = (q) => `${f(q[0])} ${f(q[1])}`
const [pl, pr] = sides
anchor = `M ${pt(pl(topR + 4, -half))} L ${pt(pl(tipR, -half))} L ${pt(pl(tipR, half))} L ${pt(pl(topR, half))} L ${f(Q[0] - 5)} ${f(Q[1] + 9)} L ${f(Q[0] + 5)} ${f(Q[1] + 9)} L ${pt(pr(topR, -half))} L ${pt(pr(tipR, -half))} L ${pt(pr(tipR, half))} L ${pt(pr(topR + 4, half))} L ${f(Q[0] + 8)} ${f(Q[1] + 3)} L ${f(Q[0] + 8)} ${f(Q[1] - 40)} L ${f(Q[0] - 8)} ${f(Q[1] - 40)} L ${f(Q[0] - 8)} ${f(Q[1] + 3)} Z`

const turn = (p, a) => {
  const c = Math.cos(a * deg)
  const s = Math.sin(a * deg)
  const x = p[0] - Q[0]
  const y = p[1] - Q[1]
  return [Q[0] + x * c - y * s, Q[1] + x * s + y * c]
}
const inWheel = ([x, y], w) => {
  const r = Math.hypot(x, y)
  if (r >= Ro) return false
  const u = ((((Math.atan2(y, x) / deg + 90 - w) % pitch) + pitch) % pitch) * deg
  return r < flank(u) - 0.05
}
const free = (a, w) => !probe.some((p) => inWheel(turn(p, a), w))

const svg = document.querySelector('.m-escape')
const wheel = svg.querySelector('.me-wheel')
const anchorEl = svg.querySelector('.me-anchor')
wheel.querySelector('.me-edge').setAttribute('d', teeth + 'Z')
anchorEl.querySelector('path').setAttribute('d', anchor)

// Once the other pallet is clear, the wheel springs on until a tooth face meets the pallet that came in.
let w = 15.85
let a = swing
// The wheel stops 0.8° short of the pallet it meets. That small lock gap means a pallet can lift
// out without touching the tooth, so the wheel never has to turn back.
const gap = 0.8
function lock() {
  let t = w
  while (t - w < 30 && free(a, t + 0.05 + gap)) t += 0.05
  return t
}
function draw() {
  anchorEl.setAttribute('transform', `rotate(${f(a)} ${Q[0]} ${Q[1]})`)
  wheel.setAttribute('transform', `rotate(${f(w)})`)
  shaft('escape', w)
}
w = lock()

const beat = (swingTime, runTime) => (done) =>
  chain(
    [
      ease(a, a > 0 ? -swing : swing, swingTime, (v) => {
        a = v
        draw()
      }),
      (next) => ease(w, lock(), runTime, (v) => ((w = v), draw()))(next),
    ],
    () => {
      w %= 360
      done()
    },
  )

// A hold of 1.5 s is six beats. The clock only ticks on; an early let-go just stops it.
const beats = 6
const hand = document.querySelector('#escape-hand')
const out = document.querySelector('#hold-out')
place(svg, hand, [-66, -142, 132, 206])
let ticks = 0
let from = 0
let want = 0
let running = null
const pump = () => {
  if (running || ticks >= want) return
  running = beat(100, 150)(() => {
    running = null
    ticks++
    pump()
  })
}
const tick = (p) => {
  if (p === 0) from = ticks
  want = Math.max(want, from + Math.floor(p * beats + 1e-6))
  pump()
}
const say = (t) => (out.textContent = t)
const confirmed = () => {
  say('Held for 1.5 s: confirmed.')
  setTimeout(() => {
    hold.reset()
    say('')
  }, 1800)
}
// show
const hold = detentHold(hand, {
  time: 1500,
  onInput: tick,
  onTap: () => say('A tap: an app would ask you to confirm.'),
  onCancel: () => say('Let go early, so nothing happened.'),
  onConfirm: confirmed,
})
// end

// Before the first touch: a slow tick, ten beats, then a rest.
let rest = { a, w }
let shown = 0
demo(
  hand,
  svg,
  (done) =>
    beat(420, 220)(() => {
      rest = { a, w }
      shown++
      done()
    }),
  () => {
    ;({ a, w } = rest)
    draw()
  },
  () => (shown % 10 ? 220 : 1800),
  () => {},
)
