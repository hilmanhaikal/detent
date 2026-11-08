import { detent2d, roundTo, springTo } from '@hlmnhkl/detent'
import { f, chain, place, demo, glue, shaft } from './mech.js'

// A cross slide seen from above: the saddle runs on two fixed rails in x, the table runs on the
// saddle in y. Let go anywhere and the table lands on the nearest point of the 40 pitch grid.
const pitch = 40
// The x screw has a 4 lead: one turn moves the saddle 4.
const lead = 4
const reach = 40
const base = [-96, -80, 192, 160]
const half = 25
const grid = []
for (const y of [-reach, 0, reach]) for (const x of [-reach, 0, reach]) grid.push([x, y])
const rows = ['Top', 'Middle', 'Bottom']
const cols = ['left', 'centre', 'right']

const svg = document.querySelector('.m-cross')
const saddle = svg.querySelector('.mx-saddle')
const nut = svg.querySelector('.mx-xnut')
const table = svg.querySelector('.mx-table')
const mark = svg.querySelector('.mx-release')
const bounds = document.querySelector('#cross-bounds')
const hand = document.querySelector('#cross-hand')
const scale = place(svg, bounds, base)

// detent2d works in px from the base's top-left to the table's top-left.
const toPx = ([x, y]) => [(x - half - base[0]) * scale(), (y - half - base[1]) * scale()]
const toUnits = (x, y) => [x / scale() + base[0] + half, y / scale() + base[1] + half]

let drawn = [0, 0]
function pose([x, y]) {
  drawn = [x, y]
  saddle.setAttribute('transform', `translate(${f(x)} 0)`)
  nut.setAttribute('transform', `translate(${f(x)} 0)`)
  table.setAttribute('transform', `translate(${f(x)} ${f(y)})`)
  shaft('cross', (x / lead) * 360)
  const [px, py] = toPx([x, y])
  hand.style.translate = `${px}px ${py}px`
}
const hold = glue((v) => pose(v))
const points = () =>
  grid.map((g, i) => {
    const [x, y] = toPx(g)
    return { x, y, name: `${rows[Math.floor(i / 3)]} ${cols[i % 3]}` }
  })
const size = () => Object.assign(hand.style, { width: `${2 * half * scale()}px`, height: `${2 * half * scale()}px` })
size()
// show
const slide = detent2d(hand, {
  points: points(),
  bounds,
  value: 4,
  onInput: (x, y) => hold.input(toUnits(x, y)),
})
// end
const refit = () => {
  size()
  slide.set({ points: points() })
}
new ResizeObserver(refit).observe(svg)
addEventListener('sheetfit', refit)

// Before the first touch: pushed part way toward a neighbour, let go, and it lands on the nearest point.
const ways = [
  [1, 0, 0.7, 0],
  [0, 1, 0.4, 5],
  [0, 1, 0.65, -4],
  [-1, -1, 0.6, 0],
  [-1, 0, 0.35, -5],
  [-1, 0, 0.72, 4],
  [1, 1, 0.68, 0],
  [0, -1, 0.42, 4],
  [0, -1, 0.7, 0],
]
const inside = ([x, y]) => Math.abs(x) <= reach && Math.abs(y) <= reach
let at = [0, 0]
let i = 0
demo(
  hand,
  svg,
  (done) => {
    let way = ways[i % ways.length]
    for (let k = 0; !inside([at[0] + way[0] * pitch, at[1] + way[1] * pitch]) && k < ways.length; k++) way = ways[++i % ways.length]
    i++
    const [dx, dy, part, side] = way
    const len = Math.hypot(dx, dy)
    const from = at
    const off = [from[0] + dx * pitch * part - (dy / len) * side, from[1] + dy * pitch * part + (dx / len) * side]
    const to = [roundTo(off[0], pitch), roundTo(off[1], pitch)]
    const between = (p, q) => (t) => pose([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t])
    return chain(
      [
        (next) => springTo({ from: 0, to: 1, period: 1300, damping: 1, rest: 0.002, onFrame: between(from, off), onDone: next }),
        (next) => {
          mark.setAttribute('transform', `translate(${f(off[0])} ${f(off[1])})`)
          mark.removeAttribute('hidden')
          const t = setTimeout(next, 260)
          return () => clearTimeout(t)
        },
        (next) => springTo({ from: 0, to: 1, period: 320, damping: 1, rest: 0.002, onFrame: between(off, to), onDone: next }),
      ],
      () => {
        at = to
        setTimeout(() => mark.setAttribute('hidden', ''), 300)
        done()
      },
    )
  },
  () => {
    mark.setAttribute('hidden', '')
    pose(at)
  },
  700,
  () => {
    mark.setAttribute('hidden', '')
    const near = grid.reduce((b, g, i) => (Math.hypot(g[0] - drawn[0], g[1] - drawn[1]) < Math.hypot(grid[b][0] - drawn[0], grid[b][1] - drawn[1]) ? i : b), 0)
    hold.from(drawn, grid[near])
    slide.go(near, { instant: true })
  },
)
