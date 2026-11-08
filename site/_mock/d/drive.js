import { f, watchShafts } from './mech.js'

// The machine's drive: a vertical line shaft down the gap between the drawing's two columns. Each
// mechanism has a pulley on its own shaft, belted to a loose drum on the line shaft. A loose drum
// turns free on the shaft, so a belt only moves when its own mechanism turns: belt speed is the
// pulley's turn times its radius.
const stations = [
  { name: 'ball', sel: '.m-ball', at: [0, 0], r: 14 },
  { name: 'glide', sel: '.m-glide', at: [0, 0], r: 15 },
  { name: 'index', sel: '.m-index', at: [0, 62 * Math.sin(Math.PI / 3)], r: 14, squash: Math.cos(Math.PI / 3), own: true },
  { name: 'toggle', sel: '.m-toggle', at: [0, 30], r: 9 },
]
const NS = 'http://www.w3.org/2000/svg'
const sheet = document.querySelector('.machine-sheet')
const svg = document.createElementNS(NS, 'svg')
svg.setAttribute('class', 'drive')
svg.setAttribute('aria-hidden', 'true')
sheet.append(svg)
const make = (tag, cls, parent = svg) => {
  const el = document.createElementNS(NS, tag)
  el.setAttribute('class', cls)
  parent.append(el)
  return el
}
const set = (el, attrs) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))

const zero = new Map()
const angles = new Map()
const live = new Map()
// Where each belt meets the line shaft, in the sheet's own px, for the shuttle that runs between them.
export const spots = new Map()
export const driveSvg = svg

function build() {
  svg.replaceChildren()
  live.clear()
  // Measured in the sheet's own px, so the camera's zoom on the sheet does not matter.
  const box = sheet.getBoundingClientRect()
  const k = box.width / sheet.offsetWidth
  set(svg, { width: sheet.offsetWidth, height: sheet.offsetHeight })
  const cells = sheet.querySelectorAll('.rig')
  const X = ((cells[0].getBoundingClientRect().right + cells[1].getBoundingClientRect().left) / 2 - box.left) / k
  const R = 12
  const points = stations.map((s) => {
    const el = document.querySelector(s.sel)
    const m = el.getScreenCTM()
    const s2 = (+el.dataset.scale || m.a / k)
    // A drawing that draws its own pulley hands the belt over at its right edge.
    const vb = el.viewBox.baseVal
    const x = s.own ? vb.x + vb.width : s.at[0]
    return { ...s, x: (m.a * x + m.e - box.left) / k, y: (m.d * s.at[1] + m.f - box.top) / k, rp: s.r * s2, ry: s.r * s2 * (s.squash ?? 1) }
  })
  const top = Math.min(...points.map((s) => s.y)) - 30
  const bottom = Math.max(...points.map((s) => s.y)) + 30

  const shaft = make('g', 'd-shaft')
  make('path', 'd-gap', shaft).setAttribute('d', `M ${X - 3} ${top} V ${bottom} M ${X + 3} ${top} V ${bottom}`)
  make('path', 'd-belt', shaft).setAttribute('d', `M ${X - 3} ${top} V ${bottom} M ${X + 3} ${top} V ${bottom} M ${X - 3} ${top} H ${X + 3} M ${X - 3} ${bottom} H ${X + 3}`)
  make('path', 'd-guide', shaft).setAttribute('d', `M ${X} ${top - 20} V ${bottom + 20}`)

  for (const s of points) {
    const g = make('g', 'd-station')
    const side = s.x < X ? 1 : -1
    const near = X - side * R
    const strands = [-1, 1].map((k) => `M ${f(s.x)} ${f(s.y + k * s.ry)} L ${f(near)} ${f(s.y + k * s.ry)}`)
    make('path', 'd-gap', g).setAttribute('d', strands.join(' '))
    make('path', 'd-belt', g).setAttribute('d', strands.join(' '))
    const runs = strands.map((d) => {
      const p = make('path', 'd-run', g)
      p.setAttribute('d', d)
      return p
    })
    set(make('rect', 'd-pulley', g), { x: X - R, y: f(s.y - s.ry - 3), width: 2 * R, height: f(2 * s.ry + 6) })
    const faceMark = make('path', 'd-mark', g)
    let mark = null
    if (!s.own) {
      set(make('ellipse', 'd-pulley', g), { cx: f(s.x), cy: f(s.y), rx: f(s.rp), ry: f(s.ry) })
      set(make('circle', 'd-pulley', g), { cx: f(s.x), cy: f(s.y), r: 3 })
      mark = make('path', 'd-mark', g)
    }
    live.set(s.name, { s, side, R, X, runs, faceMark, mark })
    spots.set(s.name, { x: X, y: s.y })
    turn(s.name)
  }
}

function turn(name) {
  const st = live.get(name)
  if (!st || !angles.has(name)) return
  const a = angles.get(name)
  const travel = ((a - zero.get(name)) * Math.PI * st.s.rp) / 180
  const t = (a * Math.PI) / 180
  st.mark?.setAttribute('d', `M ${f(st.s.x)} ${f(st.s.y)} L ${f(st.s.x + st.s.rp * Math.cos(t))} ${f(st.s.y + st.s.ry * Math.sin(t))}`)
  st.runs[0].style.strokeDashoffset = f(-st.side * travel)
  st.runs[1].style.strokeDashoffset = f(st.side * travel)
  const x = st.X + st.R * Math.sin(travel / st.R)
  st.faceMark.setAttribute('d', `M ${f(x)} ${f(st.s.y - st.s.ry - 3)} V ${f(st.s.y + st.s.ry + 3)}`)
}

watchShafts((name, angle) => {
  if (!zero.has(name)) zero.set(name, angle)
  angles.set(name, angle)
  turn(name)
})
addEventListener('sheetfit', build)
build()
