import { attract, roundTo, springTo } from '@hlmnhkl/detent'
import { still } from './ring.js'
import { ballRig } from './mech-ball.js'
import { glideRig } from './mech-glide.js'
import { leverRig } from './mech-toggle.js'
import { plateRig } from './mech-index.js'
import { spots } from './drive.js'

// Scroll drives the machine. Each step's mechanism runs while the page scrolls into that step, from
// 0 to 1, and is fully landed when the step reaches the top. The page scroll stays native: this only
// reads scrollY, once a frame, and measures the steps on resize.
const marks = (count, strongEvery = 0) => Array.from({ length: count + 1 }, (_, at) => ({ at, strong: strongEvery ? at % strongEvery === 0 : false }))
const ballMarks = marks(16, 4)
const unitMarks = marks(10)
const mechs = {
  ball: { rig: ballRig, rest: 0, at: (p) => attract(4 * p, ballMarks, 1), land: (v) => Math.round(v), unit: 22.5 },
  glide: { rig: glideRig, rest: 0, at: (p) => attract(4 * p, unitMarks, 1) * 36, land: (v) => roundTo(v, 36), unit: 1 },
  toggle: { rig: leverRig, rest: 20, at: (p) => (p < 0.5 ? 20 - 32 * p : -20), land: (v) => (v < 0 ? -20 : 20), unit: 1 },
  index: { rig: plateRig, rest: 0, at: (p) => -attract(2 * p, unitMarks, 1) * 45, land: (v) => roundTo(v, 45), unit: 1 },
}

const sheet = document.querySelector('.machine-sheet')
const steps = [...document.querySelectorAll('.m-step')]
const pinGrid = document.querySelector('.m-pin-grid')
const pin = document.querySelector('.m-pin')
let tops = []
let span = 1
let pinTop = 0
let gutter = 0
function measure() {
  tops = steps.map((s) => s.getBoundingClientRect().top + scrollY)
  span = steps[0].offsetHeight
  pinTop = pin.parentElement.getBoundingClientRect().top + scrollY
  gutter = pin.getBoundingClientRect().left
  const box = pin.getBoundingClientRect()
  Object.entries({ x: -50, y: -50, width: box.width + 100, height: box.height + 100 }).forEach(([k, v]) => pinGrid.setAttribute(k, v))
}

for (const m of Object.values(mechs)) {
  m.now = m.rest
  m.spring = null
  m.touched = false
  m.rig.set(m.rest)
  const take = () => {
    m.spring?.()
    m.spring = null
    m.rig.take()
    m.touched = true
  }
  m.rig.hand.addEventListener('pointerdown', take, true)
  m.rig.hand.addEventListener('keydown', take, true)
}

// Small changes follow the scroll at once; a big one (the toggle's snap, a fast scroll) springs, so
// no frame jumps. A hand that moved the part last hands over with the same spring.
function drive(m, to) {
  if (m.rig.hand.matches('[data-held], [data-moving]')) return
  if (m.touched) {
    m.touched = false
    m.rig.ease()
  }
  if (Math.abs(to - m.now) * m.unit <= 3) {
    m.spring?.()
    m.spring = null
    m.now = to
    m.rig.set(to)
    return
  }
  m.target = to
  if (m.spring) return
  const run = (from) => {
    const goal = m.target
    m.spring = springTo({
      from,
      to: goal,
      period: 260,
      damping: 1,
      rest: 0.01,
      onFrame: (v) => ((m.now = v), m.rig.set(v)),
      onDone: () => {
        m.spring = null
        if (m.target !== goal) run(m.now)
      },
    })
  }
  run(m.now)
}

let active = null
function show(name) {
  if (name === active) return
  active = name
  for (const [key, m] of Object.entries(mechs)) m.rig.hand.toggleAttribute('inert', key !== name)
}

// The morph. One number, u, runs from 0 (the whole machine in view) to 4 (the last step), and every
// moving thing here is drawn from it: the camera on the drawing, the frame round the step text, the
// heading's short slide, and the coral shuttle that runs down the line shaft to the next mechanism.
const order = steps.map((s) => s.dataset.mech)
const centres = { ball: ['.m-ball', [0, 0]], glide: ['.m-glide', [0, 0]], toggle: ['.m-toggle', [0, 30]], index: ['.m-index', [0, 0]] }
const frameBox = document.querySelector('.m-frame')
const cards = steps.map((s) => s.querySelector('.m-card'))
const slides = steps.map((s) => s.querySelector('.slide'))
const shuttle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
shuttle.setAttribute('class', 'g-hot m-shuttle')
shuttle.setAttribute('r', 5)
let views = []
let boxes = []
const ease = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

function measureMorph() {
  sheet.style.transform = ''
  const sb = sheet.getBoundingClientRect()
  const zoom = wide.matches ? 1.5 : 1.6
  const px = Math.round(sb.width / 2 / 10) * 10
  const py = Math.round(sb.height / 2 / 10) * 10
  views = [{ z: 1, x: 0, y: 0 }].concat(
    order.map((name) => {
      const [sel, at] = centres[name]
      const m = document.querySelector(sel).getScreenCTM()
      const cx = m.a * at[0] + m.e - sb.left
      const cy = m.d * at[1] + m.f - sb.top
      return { z: zoom, x: px - zoom * cx, y: py - zoom * cy }
    }),
  )
  const base = frameBox.parentElement.getBoundingClientRect()
  boxes = cards.map((c) => {
    const r = c.getBoundingClientRect()
    return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
  })
  const drive = document.querySelector('.drive')
  if (drive && shuttle.parentNode !== drive) drive.append(shuttle)
}
const wide = matchMedia('(min-width: 861px)')

function paint(u) {
  sheet.dataset.u = u.toFixed(3)
  const i = Math.min(3, Math.floor(u))
  const t = still.matches ? Math.round(u - i) : ease(u - i)
  const a = views[i]
  const b = views[Math.min(4, i + 1)]
  sheet.style.transform = `translate(${lerp(a.x, b.x, t).toFixed(2)}px, ${lerp(a.y, b.y, t).toFixed(2)}px) scale(${lerp(a.z, b.z, t).toFixed(4)})`

  // The frame grows out of the first card's corner, then moves its edges from card to card.
  let r
  if (u < 1) {
    const c = boxes[0]
    r = { x: c.x, y: c.y, w: c.w * t, h: c.h * t }
  } else {
    const j = Math.min(3, Math.floor(u) - 1)
    const k = Math.min(3, j + 1)
    const tt = j === 3 ? 0 : still.matches ? Math.round(u - j - 1) : ease(u - j - 1)
    const c = boxes[j]
    const d = boxes[k]
    r = { x: lerp(c.x, d.x, tt), y: lerp(c.y, d.y, tt), w: lerp(c.w, d.w, tt), h: lerp(c.h, d.h, tt) }
  }
  Object.assign(frameBox.style, { transform: `translate(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px)`, width: `${r.w.toFixed(2)}px`, height: `${r.h.toFixed(2)}px`, visibility: r.w > 1 ? 'visible' : 'hidden' })

  slides.forEach((el, k) => {
    const local = Math.min(1, Math.max(0, u - k))
    el.style.transform = still.matches ? '' : `translateY(${((1 - ease(local)) * 10).toFixed(2)}px)`
  })

  // Between two steps the coral rides the shaft; at a step it is the mechanism's own moving part.
  const f = u - Math.round(u)
  const resting = Math.abs(f) < 0.002
  sheet.dataset.active = resting && Math.round(u) >= 1 ? order[Math.round(u) - 1] : 'none'
  const from = spots.get(order[Math.max(0, Math.floor(u) - 1)])
  const to = spots.get(order[Math.min(3, Math.floor(u))])
  if (!resting && u > 1 && from && to) {
    shuttle.setAttribute('cx', f2(from.x))
    shuttle.setAttribute('cy', f2(lerp(from.y, to.y, ease(u - Math.floor(u)))))
    shuttle.style.display = ''
  } else shuttle.style.display = 'none'
}
const f2 = (v) => v.toFixed(2)

// The morph never stays between two steps: when the scroll rests, u springs to the nearest whole step.
let shown = 0
let morph = null
let goal = null
let speed = 0
let stamp = 0
// A new goal restarts the spring from where the morph is, at the speed it has, so it never jumps or
// waits for the old spring to finish.
function drawU(to) {
  if (Math.abs(to - shown) <= 0.02 && !morph) {
    shown = to
    return paint(to)
  }
  if (morph && to === goal) return
  morph?.()
  goal = to
  stamp = performance.now()
  morph = springTo({
    from: shown,
    to,
    velocity: speed,
    period: 300,
    damping: 1,
    rest: 0.004,
    onFrame: (v) => {
      const now = performance.now()
      speed = ((v - shown) / Math.max(1, now - stamp)) * 1000
      stamp = now
      paint((shown = v))
    },
    onDone: () => {
      morph = null
      goal = null
      speed = 0
      paint((shown = to))
    },
  })
}

let raf = 0
let idle = 0
function frame() {
  raf = 0
  const y = scrollY
  let current = 0
  steps.forEach((s, i) => {
    if (tops[i] - span / 2 <= y) current = i
  })
  show(steps[current].dataset.mech)
  pinGrid.setAttribute('transform', `translate(${-(gutter % 50)} ${-(Math.max(pinTop, y) % 50)})`)
  let u = 0
  steps.forEach((s, i) => {
    const p = Math.min(1, Math.max(0, (y - (tops[i] - span)) / span))
    u += p
    if (!still.matches) drive(mechs[s.dataset.mech], mechs[s.dataset.mech].at(p))
  })
  if (still.matches) return paint(Math.round(u))
  drawU(u)
  clearTimeout(idle)
  idle = setTimeout(() => {
    drawU(Math.round(u))
    const m = mechs[active]
    if (!m.rig.hand.matches('[data-held], [data-moving]')) drive(m, m.land(m.now))
  }, 150)
}
const later = () => (raf ||= requestAnimationFrame(frame))
const remeasure = () => {
  measure()
  measureMorph()
  paint(shown)
  later()
}
addEventListener('scroll', later, { passive: true })
addEventListener('sheetfit', () => requestAnimationFrame(remeasure))
addEventListener('resize', remeasure)
measure()
measureMorph()
frame()
