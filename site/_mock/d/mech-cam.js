import { deg, f, ease, play, coil, shaft } from './mech.js'

// A disc cam with six dips and a roller follower that runs on the horizontal axis. The roller sits
// as far in as it can without entering the cam, so its travel is the cam's real profile.
const base = 52
const dips = 6
const pitch = 360 / dips
const width = 24
const depth = (k) => (k ? 6 : 10)
const rr = 7
const guide = 100

function radius(a) {
  let r = base
  for (let k = 0; k < dips; k++) {
    const d = Math.atan2(Math.sin(a - k * pitch * deg), Math.cos(a - k * pitch * deg)) / deg
    if (Math.abs(d) < width) r -= (depth(k) * (1 + Math.cos((Math.PI * d) / width))) / 2
  }
  return r
}
const rim = []
for (let i = 0; i < 1440; i++) rim.push([(i / 4) * deg, radius((i / 4) * deg)])
const camPath = rim.map(([a, r], i) => `${i ? 'L' : 'M'} ${f(r * Math.cos(a))} ${f(r * Math.sin(a))}`).join(' ') + ' Z'

function reach(w) {
  let x = 0
  for (const [a, r] of rim) {
    const d = a + w * deg
    const s = r * Math.sin(d)
    if (Math.cos(d) > 0.8 && Math.abs(s) < rr) x = Math.max(x, r * Math.cos(d) + Math.sqrt(rr * rr - s * s))
  }
  return x
}

const svg = document.querySelector('.m-cam')
const cam = svg.querySelector('.mc-cam')
const follower = svg.querySelector('.mc-follower')
const spring = svg.querySelector('.mc-spring')
cam.querySelector('.mc-edge').setAttribute('d', camPath)

function pose(w) {
  const x = reach(w)
  cam.setAttribute('transform', `rotate(${f(w)})`)
  shaft('cam', w)
  follower.setAttribute('transform', `translate(${f(x)} 0)`)
  spring.setAttribute('d', coil([x + 17, 0], [guide, 0], 5, 7))
}

let k = 0
play(
  svg,
  (done) =>
    ease(-k * pitch, -(k + 1) * pitch, 900, pose)(() => {
      k = (k + 1) % dips
      done()
    }),
  () => pose(-k * pitch),
  () => (k ? 1000 : 2000),
)
