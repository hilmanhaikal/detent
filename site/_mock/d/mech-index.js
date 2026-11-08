import { detent3d } from '@hlmnhkl/detent'
import { deg, f, place, glue, shaft } from './mech.js'

// An index plate with a taper plunger, built as small 3D meshes and drawn through one orthographic
// camera. Each slot is a V with 30° flanks, apex 10 in from the rim, and the plunger's nose is a cone
// with the same 30° flanks, so it seats flush. Turning the plate pushes the nose up a flank and out
// over the rim; at the next slot the spring drives it back in.
const R = 64
const n = 8
const pitch = 360 / n
const apex = R - 10
const slope = Math.tan(30 * deg)
const pin = 4.5
const nose = pin / slope
const thick = 10
const axle = -thick / 2
const reachS = (-2 * apex * Math.cos(30 * deg) + Math.sqrt((2 * apex * Math.cos(30 * deg)) ** 2 + 4 * (R * R - apex * apex))) / 2
const lip = [apex + reachS * Math.cos(30 * deg), reachS * Math.sin(30 * deg)]
const lipAt = Math.atan2(lip[1], lip[0])

// World: x right, y toward the viewer, z up; the plate's top face is z = 0. The camera looks down 60°,
// so depth shrinks to cos 60° and height to sin 60° on the sheet. "near" grows toward the camera.
const cy = Math.cos(60 * deg)
const cz = Math.sin(60 * deg)
const view = [0, cz, cy]
const sx = (p) => p[0]
const sy = (p) => p[1] * cy - p[2] * cz
const near = (p) => p[1] * cz + p[2] * cy

// The slot profile, going round the plate. "sharp" marks a real corner; arc points join smoothly.
function profile(step) {
  const out = []
  for (let k = 0; k < n; k++) {
    const t = k * pitch * deg
    const put = (x, y, sharp) => out.push([x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t), sharp])
    put(lip[0], -lip[1], true)
    put(apex, 0, true)
    put(lip[0], lip[1], true)
    const span = pitch * deg - 2 * lipAt
    const parts = Math.max(1, Math.round(span / step))
    for (let i = 1; i < parts; i++) {
      const a = lipAt + (span * i) / parts
      put(R * Math.cos(a), R * Math.sin(a), false)
    }
  }
  return out
}
const fine = []
for (let k = 0; k < n; k++) {
  const t = k * pitch * deg
  const put = (x, y) => fine.push([x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)])
  for (let s = 0; s <= reachS; s += 0.2) {
    put(apex + s * Math.cos(30 * deg), s * Math.sin(30 * deg))
    put(apex + s * Math.cos(30 * deg), -s * Math.sin(30 * deg))
  }
  for (let a = lipAt; a <= pitch * deg - lipAt; a += 0.004) put(R * Math.cos(a), R * Math.sin(a))
}

// The nose sits as far in as the slot profile lets it, worked out in the plate's own plane.
function seat(turn) {
  const c = Math.cos(turn * deg)
  const s = Math.sin(turn * deg)
  let tip = 0
  for (const [x, y] of fine) {
    const px = x * c - y * s
    const py = x * s + y * c
    if (px > 0 && Math.abs(py) < pin) tip = Math.max(tip, px - Math.abs(py) / slope)
  }
  return tip
}

// A face: its points, its outward normal, and for each edge whether it is a hard crease or a smooth
// seam shared with a twin face. A seam is drawn only where the twin faces away: the silhouette.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
function face(pts, centre, cls, hard = pts.map(() => true)) {
  const c = pts.reduce((m, p) => [m[0] + p[0] / pts.length, m[1] + p[1] / pts.length, m[2] + p[2] / pts.length], [0, 0, 0])
  let nrm = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))
  if (dot(nrm, sub(c, centre)) < 0) nrm = nrm.map((v) => -v)
  return { pts, nrm, cls, hard, twins: pts.map(() => null) }
}

// A cylinder on any axis: rings of `seg` points at the two ends, smooth seams between side quads.
function cylinder(at, axis, r, len, cls, seg = 24, caps = [true, true]) {
  const [ax, u, v] = axis === 'z' ? [[0, 0, 1], [1, 0, 0], [0, 1, 0]] : [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  const ring = (t) => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * 2 * Math.PI
    return [0, 1, 2].map((k) => at[k] + ax[k] * t + r * (Math.cos(a) * u[k] + Math.sin(a) * v[k]))
  })
  const lo = ring(0)
  const hi = ring(len)
  const mid = [0, 1, 2].map((k) => at[k] + (ax[k] * len) / 2)
  const sides = lo.map((p, i) => face([p, lo[(i + 1) % seg], hi[(i + 1) % seg], hi[i]], mid, cls, [true, false, true, false]))
  sides.forEach((s, i) => {
    s.twins[1] = sides[(i + 1) % seg]
    s.twins[3] = sides[(i - 1 + seg) % seg]
  })
  const out = [...sides]
  if (caps[0]) out.push(face([...lo].reverse(), mid, cls))
  if (caps[1]) out.push(face(hi, mid, cls))
  return out
}

// A cone along x, from a ring of radius r at `base` to the apex.
function cone(base, apexX, r, cls, seg = 24) {
  const ring = Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * 2 * Math.PI
    return [base[0], base[1] + r * Math.cos(a), base[2] + r * Math.sin(a)]
  })
  const tipPt = [apexX, base[1], base[2]]
  const mid = [(base[0] + apexX) / 2, base[1], base[2]]
  const sides = ring.map((p, i) => face([p, ring[(i + 1) % seg], tipPt], mid, cls, [true, false, false]))
  sides.forEach((s, i) => {
    s.twins[1] = sides[(i + 1) % seg]
    s.twins[2] = sides[(i - 1 + seg) % seg]
  })
  return sides
}

// A low sphere for the knob: 10 bands of 20, every seam smooth.
function sphere(c, r, cls) {
  const rows = 10
  const cols = 20
  const p = (i, j) => {
    const a = (i / rows) * Math.PI
    const b = (j / cols) * 2 * Math.PI
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a) * Math.cos(b), c[2] + r * Math.sin(a) * Math.sin(b)]
  }
  const grid = []
  for (let i = 0; i < rows; i++) {
    grid.push([])
    for (let j = 0; j < cols; j++) {
      const q = i === 0 ? [p(0, 0), p(1, j + 1), p(1, j)] : i === rows - 1 ? [p(i, j), p(i, j + 1), p(rows, 0)] : [p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j)]
      grid[i].push(face(q, c, cls, q.map(() => false)))
    }
  }
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const fc = grid[i][j]
      const left = grid[i][(j - 1 + cols) % cols]
      const right = grid[i][(j + 1) % cols]
      if (i === 0) fc.twins = [right, grid[1][j], left]
      else if (i === rows - 1) fc.twins = [grid[i - 1][j], right, left]
      else fc.twins = [grid[i - 1][j], right, grid[i + 1][j], left]
    }
  return grid.flat()
}

// A box from two corners, with its 6 faces.
function box([x0, y0, z0], [x1, y1, z1], cls) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]
  const v = (x, y, z) => [x, y, z]
  return [
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x0, y1, z0), v(x1, y1, z0), v(x1, y0, z0)],
    [v(x0, y1, z0), v(x0, y1, z1), v(x1, y1, z1), v(x1, y1, z0)],
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)],
    [v(x0, y0, z0), v(x0, y0, z1), v(x0, y1, z1), v(x0, y1, z0)],
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)],
  ].map((q) => face(q, c, cls))
}

// The plate: top, bottom and one wall quad per profile edge. Arc walls join smoothly.
const outline = profile(4 * deg)
function plateMesh() {
  const top = outline.map(([x, y]) => [x, y, 0])
  const bottom = outline.map(([x, y]) => [x, y, -thick])
  const m = outline.length
  const walls = outline.map(([x, y, sharp], i) => {
    const [x2, y2, sharp2] = outline[(i + 1) % m]
    const out = [y2 - y, -(x2 - x), 0]
    const w = { pts: [top[i], bottom[i], bottom[(i + 1) % m], top[(i + 1) % m]], nrm: out, cls: 'g-part', hard: [!sharp ? false : true, true, !sharp2 ? false : true, true], twins: [null, null, null, null] }
    return w
  })
  walls.forEach((w, i) => {
    w.twins[0] = walls[(i - 1 + m) % m]
    w.twins[2] = walls[(i + 1) % m]
  })
  const topFace = { pts: top, nrm: [0, 0, 1], cls: 'g-part', hard: top.map(() => true), twins: top.map(() => null), top: true }
  const bottomFace = { pts: [...bottom].reverse(), nrm: [0, 0, -1], cls: 'g-part', hard: bottom.map(() => true), twins: bottom.map(() => null) }
  return [topFace, bottomFace, ...walls]
}

const pulley = { r: 14, low: -66, high: -58 }
const turning = [
  ...plateMesh(),
  ...cylinder([0, 0, 0], 'z', 16, 6, 'g-part'),
  ...cylinder([0, 0, 6], 'z', 6, 0.01, 'g-part', 24, [false, true]),
  ...cylinder([0, 0, pulley.high], 'z', 6, -thick - pulley.high, 'g-part', 24, [false, false]),
  ...cylinder([0, 0, pulley.low], 'z', pulley.r, pulley.high - pulley.low, 'g-part'),
]
const housing = box([-88, -10, axle - 10], [-70, 10, axle + 10], 'g-part').map((fc) => ({ ...fc, after: 50 }))

const svg = document.querySelector('.m-index')
const scene = svg.querySelector('.mi-scene')
const NS = 'http://www.w3.org/2000/svg'
const make = (cls) => {
  const el = document.createElementNS(NS, 'path')
  el.setAttribute('class', cls)
  scene.append(el)
  return el
}
const right = () => svg.viewBox.baseVal.x + svg.viewBox.baseVal.width
const beltY = -((pulley.low + pulley.high) / 2) * cz
const belt = make('g-part g-open')
const run = make('mi-run')
const pool = []
const pt = (p) => `${f(sx(p))} ${f(sy(p))}`

function spin(fc, c, s) {
  const r = (p) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]
  return { ...fc, pts: fc.pts.map(r), nrm: r(fc.nrm), base: fc }
}

let drawn = 0
let ms = 0
function pose(turn) {
  const t0 = performance.now()
  drawn = turn
  shaft('index', turn)
  scene.dataset.turn = f(turn)
  const c = Math.cos(turn * deg)
  const s = Math.sin(turn * deg)
  const tip = seat(turn + 180)
  scene.dataset.tip = f(tip)

  const scale = +svg.dataset.scale || 1
  const travel = (turn * Math.PI * pulley.r) / 180
  const farY = f(beltY - pulley.r * cy)
  const nearY = f(beltY + pulley.r * cy)
  belt.setAttribute('d', `M 0 ${farY} H ${f(right())} M 0 ${nearY} H ${f(right())}`)
  run.setAttribute('d', `M ${f(right())} ${farY} H 0 M 0 ${nearY} H ${f(right())}`)
  run.style.strokeDasharray = `0 ${f(10 / scale)}`
  run.style.strokeDashoffset = f(-travel)

  // The plunger, along x on the plate's mid-plane, with its nose at the depth the slot allows.
  const x = (u) => -tip - u
  const plunger = [
    ...cylinder([x(57), 0, axle], 'x', pin, 57 - nose, 'g-hot', 24, [false, false]),
    ...cone([x(nose), 0, axle], x(0), pin, 'g-hot'),
    // The rod runs into the collar, the housing and the knob, so those are drawn after it.
    ...cylinder([x(47), 0, axle], 'x', 8, 2, 'g-part', 24, [false, false]).map((fc) => ({ ...fc, after: 50, base: fc })),
    ...sphere([x(62), 0, axle], 7, 'g-part').map((fc) => ({ ...fc, after: 50, base: fc })),
  ]
  const faces = [...turning.map((fc) => spin(fc, c, s)), ...housing, ...plunger]
  const shown = new Set()
  for (const fc of faces) if (dot(fc.nrm, view) > 1e-6) shown.add(fc.base ?? fc)
  const seen = (fc) => fc && shown.has(fc.base ?? fc)

  // The spring as short segments, each sorted with the faces, so the rod hides its back half.
  const lines = []
  let prev = null
  for (let i = 0; i <= 120; i++) {
    const u = i / 120
    const phi = u * 10 * Math.PI
    const p = [-88 + (x(45) + 88) * u, 7 * Math.cos(phi), axle + 7 * Math.sin(phi)]
    if (prev) lines.push({ line: [prev, p], depth: near([0, (prev[1] + p[1]) / 2, (prev[2] + p[2]) / 2]) })
    prev = p
  }
  const mark = { line: [[0, 0, pulley.high], [pulley.r * c, pulley.r * s, pulley.high]], depth: near([0, 0, pulley.high]) + 0.01 }

  // Three layers, then far to near inside each: all that lies below the top face's plane, the top
  // face, then all above it. From a camera above, the top face hides whatever under it projects onto it.
  const layer = (fc) => (fc.top ? 1 : Math.min(...fc.pts.map((p) => p[2])) > -0.001 ? 2 : 0)
  const items = faces
    .filter((fc) => shown.has(fc.base ?? fc))
    .map((fc) => ({ fc, layer: layer(fc), depth: (fc.after ?? 0) + near(fc.pts.reduce((m, p) => [0, m[1] + p[1] / fc.pts.length, m[2] + p[2] / fc.pts.length], [0, 0, 0])) }))
    .concat(lines.map((l) => ({ ...l, layer: 0 })), [{ ...mark, layer: 0 }])
  items.sort((a, b) => a.layer - b.layer || a.depth - b.depth)

  let i = 0
  const next = () => {
    if (!pool[i]) pool[i] = [make(''), make('')]
    return pool[i++]
  }
  for (const it of items) {
    const [fill, edge] = next()
    if (it.line) {
      fill.setAttribute('d', '')
      edge.setAttribute('class', 'g-spring')
      edge.setAttribute('d', `M ${pt(it.line[0])} L ${pt(it.line[1])}`)
      continue
    }
    const fc = it.fc
    fill.setAttribute('class', fc.cls === 'g-hot' ? 'mi-hot' : 'mi-wall')
    fill.setAttribute('d', 'M ' + fc.pts.map(pt).join(' L ') + ' Z')
    let d = ''
    const m = fc.pts.length
    for (let k = 0; k < m; k++) {
      const twin = fc.twins[k]
      if (fc.hard[k] || !seen(twin)) d += `M ${pt(fc.pts[k])} L ${pt(fc.pts[(k + 1) % m])} `
    }
    edge.setAttribute('class', 'g-part g-open')
    edge.setAttribute('d', d)
  }
  for (let k = i; k < pool.length; k++) pool[k].forEach((el) => el.setAttribute('d', ''))
  ms = performance.now() - t0
  scene.dataset.ms = ms.toFixed(2)
}

const hand = document.querySelector('#index-hand')
place(svg, hand, [-66, -34, 132, 68])
const hold = glue(([t]) => pose(t))
addEventListener('sheetfit', () => pose(drawn))
// show
const plateCtl = detent3d(hand, {
  faces: 'turntable',
  views: n,
  names: Array.from({ length: n }, (_, k) => `${k * pitch} degrees`),
  onInput: ({ yaw }) => hold.input(-yaw),
})
// end

export const plateRig = {
  hand,
  set: (v) => hold.input(v),
  ease: () => hold.soften(),
  take() {
    const view = (n - (Math.round(drawn / pitch) % n)) % n
    const base = -view * pitch
    hold.from(base + ((((drawn - base) % 360) + 540) % 360) - 180, base)
    plateCtl.go(view, { instant: true })
  },
}
