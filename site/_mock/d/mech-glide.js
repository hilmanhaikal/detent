import { detent } from '@hlmnhkl/detent'
import { deg, f, at, coil, place, glue, shaft } from './mech.js'

// A flywheel under a brake shoe. The shoe's pad is an arc of the rim's own radius, 10 thick, and the
// lever pivots straight below the pad's middle, so a small turn of the lever lifts the pad straight off.
const R = 65
const marks = 10
const P = [70, 70]
const L = 70
const pad = 20 * deg
const fix = [100, 40]
const bar = 4

const svg = document.querySelector('.m-glide')
const wheel = svg.querySelector('.mg-wheel')
const lever = svg.querySelector('.mg-lever')
const spring = svg.querySelector('.mg-spring')

const inner = P[0] - bar
const outer = P[0] + bar
const top = -Math.sqrt((R + 10) ** 2 - outer ** 2)
lever.querySelector('path').setAttribute(
  'd',
  `M ${at(R, -pad)} L ${at(R + 10, -pad)} A ${R + 10} ${R + 10} 0 0 1 ${outer} ${f(top)} L ${outer} ${P[1]} A ${bar} ${bar} 0 0 1 ${inner} ${P[1]} L ${inner} ${f(inner * Math.tan(pad))} L ${at(R, pad)} A ${R} ${R} 0 0 0 ${at(R, -pad)} Z`,
)
let spokes = ''
for (let k = 0; k < 5; k++) {
  const t = (k * 72 - 90) * deg
  const side = (o) => [Math.cos(t) * 0 - Math.sin(t) * o, Math.sin(t) * 0 + Math.cos(t) * o]
  for (const o of [-3, 3]) {
    const [x, y] = side(o)
    spokes += `M ${f(x + 12.5 * Math.cos(t))} ${f(y + 12.5 * Math.sin(t))} L ${f(x + (R - 10) * Math.cos(t))} ${f(y + (R - 10) * Math.sin(t))} `
  }
}
wheel.querySelector('.mg-spokes').setAttribute('d', spokes)
let ticks = ''
for (let k = 0; k < marks; k++) ticks += `M ${at(84, (k * 36 - 90) * deg)} L ${at(91, (k * 36 - 90) * deg)} `
svg.querySelector('.mg-ticks').setAttribute('d', ticks)

// The gap is the lever's turn times its length; at rest the pad sits on the rim.
function pose(w, gap) {
  const b = gap / L
  wheel.setAttribute('transform', `rotate(${f(w)})`)
  shaft('glide', w)
  lever.setAttribute('transform', `rotate(${f(b / deg)} ${P[0]} ${P[1]})`)
  const x = outer - P[0]
  const y = 40 - P[1]
  spring.setAttribute('d', coil([P[0] + x * Math.cos(b) - y * Math.sin(b), P[1] + x * Math.sin(b) + y * Math.cos(b)], fix, 6, 4))
}

// The shoe lifts with speed, up to 3, and sits on the rim at rest.
let last = 0
let lastT = 0
let drawn = 0
function spin(w) {
  drawn = w
  const now = performance.now()
  const speed = (Math.abs(((w - last + 540) % 360) - 180) / Math.max(1, now - lastT)) * 1000
  last = w
  lastT = now
  pose(w, Math.min(3, speed / 350))
}

const hold = glue(([w]) => spin(w), 360)
const hand = document.querySelector('#glide-hand')
place(svg, hand, [-66, -66, 132, 132])
const step = 360 / marks
// show
const flywheel = detent(hand, {
  loop: true,
  count: marks,
  path: 'turn',
  sweep: 360,
  coast: 0.35,
  text: (v) => `Mark ${v + 1} of ${marks}`,
  onInput: (v) => hold.input(v * step),
})
// end

export const glideRig = {
  hand,
  set: (w) => hold.input(w),
  ease: () => hold.soften(),
  take() {
    flywheel.scrub.place((((drawn % 360) + 360) % 360) / step)
    hold.soften(drawn)
  },
}
