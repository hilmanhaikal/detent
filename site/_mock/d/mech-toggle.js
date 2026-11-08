import { detentThrow } from '@hlmnhkl/detent'
import { deg, f, coil, place, glue, shaft } from './mech.js'

// An over-centre toggle. A compression strut runs from the fixed pin S to the lever's pin T. It is
// shortest when T crosses the line OS, so on either side it pushes the lever on to its stop.
const O = [0, 30]
const L = 60
const S = [0, -80]
const stop = 20
const tube = 30
const rod = 36

const svg = document.querySelector('.m-toggle')
const lever = svg.querySelector('.mt-lever')
const strut = svg.querySelector('.mt-strut')
const tubeEl = strut.querySelector('.mt-tube')
const rodEl = strut.querySelector('.mt-rod')
const spring = svg.querySelector('.mt-spring')
const pin = svg.querySelector('.mt-pin')

const pinAt = (t) => [O[0] + L * Math.sin(t * deg), O[1] - L * Math.cos(t * deg)]
const bar = (len, w) => `M ${-w} 0 A ${w} ${w} 0 0 1 ${w} 0 L ${w} ${len} L ${-w} ${len} Z`

function pose(t) {
  const T = pinAt(t)
  const dx = T[0] - S[0]
  const dy = T[1] - S[1]
  const d = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx) / deg - 90
  lever.setAttribute('transform', `rotate(${f(t)} ${O[0]} ${O[1]})`)
  shaft('toggle', t)
  tubeEl.setAttribute('transform', `translate(${S[0]} ${S[1]}) rotate(${f(a)})`)
  rodEl.setAttribute('transform', `translate(${f(T[0])} ${f(T[1])}) rotate(${f(a + 180)})`)
  const ux = dx / d
  const uy = dy / d
  spring.setAttribute('d', coil([S[0] + ux * tube, S[1] + uy * tube], [T[0] - ux * 7, T[1] - uy * 7], 4, 5.5, 1))
  pin.setAttribute('cx', f(T[0]))
  pin.setAttribute('cy', f(T[1]))
}

tubeEl.setAttribute('d', `${bar(tube, 4)} M -6 ${tube - 2} L 6 ${tube - 2} L 6 ${tube} L -6 ${tube} Z`)
rodEl.setAttribute('d', `${bar(rod, 2)} M -6 5 L 6 5 L 6 7 L -6 7 Z`)

const far = pinAt(stop)
svg.querySelector('.mt-far').textContent = `strut ${Math.hypot(O[0] - S[0], O[1] - S[1]) - L} at centre, ${Math.hypot(far[0] - S[0], far[1] - S[1]).toFixed(1)} at a stop`

// The throw line (35% of the lever's box) sits exactly on the centre, so a throw is a snap across.
const hand = document.querySelector('#toggle-hand')
place(svg, hand, [-36, -40, 72, 130])
let side = 1
let toggle = null
let now = stop
const draw = (t) => pose((now = t))
const hold = glue(([t]) => draw(t))
const way = () => (side > 0 ? 'left' : 'right')
function arm() {
  toggle?.destroy()
  hand.setAttribute('aria-label', `Toggle lever, at the ${side > 0 ? 'right' : 'left'} stop`)
  // show
  toggle = detentThrow(hand, {
    directions: [way()],
    tilt: 0,
    onInput: (x) => hold.input(Math.max(-stop, Math.min(stop, side * stop + (x * stop) / (0.35 * hand.clientWidth)))),
    onThrow: () => {
      side = -side
      arm()
    },
  })
  // end
}
arm()
hand.addEventListener('keydown', (e) => {
  if (!['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
  e.preventDefault()
  toggle.throw(way())
})

// Past the middle the strut has already won, so a hand that takes it there finds it at the far stop.
export const leverRig = {
  hand,
  // When the machine lands the lever on the other stop, the control is re-armed for that side.
  set(v) {
    hold.input(v)
    if (Math.abs(v) >= stop - 0.01 && Math.sign(v) !== side) {
      side = Math.sign(v)
      arm()
    }
  },
  ease: () => hold.soften(),
  take() {
    const crossed = now * side < 0
    if (crossed) side = -side
    hold.from(now, side * stop)
    if (crossed) arm()
  },
}
