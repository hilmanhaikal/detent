import { detent } from '@hlmnhkl/detent'
import { deg, f, at, coil, place, glue, shaft } from './mech.js'

// A spring-loaded ball on a notched index wheel. Each notch is a circle of radius r whose centre
// sits c outside the rim, so its depth is r - c. Every fourth notch is the deep, strong one.
const R = 70
const n = 16
const pitch = 360 / n
const plain = { c: 4, r: 8 }
const strong = { c: 1, r: 9 }
const rb = 6
const cap = R + 46
const notch = (k) => (k % 4 ? plain : strong)
const half = ({ c, r }) => Math.acos((R * R + (R + c) ** 2 - r * r) / (2 * R * (R + c)))
const centre = (k) => (k * pitch - 90) * deg

function wheelPath() {
  let d = ''
  for (let k = 0; k < n; k++) {
    const t = centre(k)
    const b = half(notch(k))
    const { r } = notch(k)
    d += `${k ? 'A' + ` ${R} ${R} 0 0 1` : 'M'} ${at(R, t - b)} A ${r} ${r} 0 0 0 ${at(R, t + b)} `
  }
  return d + `A ${R} ${R} 0 0 1 ${at(R, centre(0) - half(strong))} Z`
}

// The rim as a dense list of (angle, radius), so the ball can be seated on it exactly.
const rim = []
for (let i = 0; i < 1440; i++) {
  const a = (i / 4) * deg
  let r = R
  for (let k = 0; k < n; k++) {
    const { c, r: rn } = notch(k)
    const d = Math.atan2(Math.sin(a - centre(k)), Math.cos(a - centre(k)))
    const q = (R + c) * Math.sin(d)
    if (Math.abs(d) < 0.5 && Math.abs(q) < rn) r = Math.min(r, (R + c) * Math.cos(d) - Math.sqrt(rn * rn - q * q))
  }
  rim.push([a, r])
}

// The ball slides on the vertical axis. It sits as low as it can without entering the wheel.
function seat(w) {
  let h = 0
  for (const [a, r] of rim) {
    const d = Math.atan2(Math.sin(a + w * deg + 90 * deg), Math.cos(a + w * deg + 90 * deg))
    const s = r * Math.sin(d)
    if (Math.abs(d) < 0.3 && Math.abs(s) < rb) h = Math.max(h, r * Math.cos(d) + Math.sqrt(rb * rb - s * s))
  }
  return h
}

const svg = document.querySelector('.m-ball')
svg.querySelector('.mb-edge').setAttribute('d', wheelPath())
const wheel = svg.querySelector('.mb-wheel')
const ball = svg.querySelector('.mb-ball')
const spring = svg.querySelector('.mb-spring')
const seatLine = svg.querySelector('.mb-seat')

function pose(w) {
  const h = seat(w)
  wheel.setAttribute('transform', `rotate(${f(w)})`)
  shaft('ball', w)
  ball.setAttribute('cy', f(-h))
  spring.setAttribute('d', coil([0, -h - rb - 1], [0, -cap], 7, 4.5))
  seatLine.setAttribute('transform', `translate(0 ${f(-h - rb - 1)})`)
}

const hand = document.querySelector('#ball-hand')
place(svg, hand, [-72, -72, 144, 144])
let now = 0
const draw = (v) => pose((now = v) * pitch)
const hold = glue(([v]) => draw(v), n)
// show
const wheelCtl = detent(hand, {
  loop: true,
  count: n,
  path: 'turn',
  sweep: 360,
  marks: Array.from({ length: n }, (_, at) => ({ at, strong: at % 4 === 0 })),
  text: (v) => `Notch ${v + 1} of ${n}${v % 4 ? '' : ', a deep one'}`,
  onInput: (v) => hold.input(v),
})
// end

// The machine drives the wheel from scroll; before the hand turns it, the control is put where the drawing is.
export const ballRig = {
  hand,
  set: (v) => hold.input(v),
  ease: () => hold.soften(),
  take() {
    const v = ((now % n) + n) % n
    wheelCtl.scrub.place(v)
    hold.soften(v)
  },
}
