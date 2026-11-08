// animate and timeline maths, on plain objects, against the built dist. A small stand-in for the page
// clock lets play() run in Node.
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 4)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const { easing, cubicBezier, curve, animate, timeline } = await import('../dist/index.js')
const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) <= e, `${a} is not near ${b}`)

test('named eases start at 0, end at 1, and in mirrors out', () => {
  for (const name of ['linear', 'in', 'out', 'inOut']) {
    const e = easing(name)
    assert.equal(e(0), 0, name)
    assert.equal(e(1), 1, name)
  }
  near(easing('linear')(0.25), 0.25)
  near(easing('inOut')(0.5), 0.5)
  for (const p of [0.1, 0.3, 0.7]) near(easing('in')(p), 1 - easing('out')(1 - p))
  assert.ok(easing('out')(0.2) > 0.5, 'out is quick, then calm')
})

test('cubicBezier matches the CSS ease curve', () => {
  const ease = cubicBezier(0.25, 0.1, 0.25, 1)
  near(ease(0.5), 0.8024, 2e-3)
  near(cubicBezier(0, 0, 1, 1)(0.37), 0.37)
  assert.equal(easing([0.25, 0.1, 0.25, 1])(0.5), ease(0.5))
  assert.equal(easing((p) => p * p)(0.5), 0.25)
})

test('a duration curve runs on its ease, with a speed', () => {
  const c = curve(0, 100, { duration: 400, ease: 'linear' })
  assert.equal(c.duration, 400)
  assert.deepEqual(c.at(0)[0], 0)
  near(c.at(200)[0], 50)
  near(c.at(200)[1], 250, 0.5)
  assert.deepEqual(c.at(400), [100, 0])
  assert.deepEqual(c.at(900), [100, 0])
})

test('a spring never passes its target and settles to a 0.5 px rest', () => {
  for (const damping of [1, 1.4]) {
    const c = curve(0, 300, { period: 400, damping })
    let prev = 0
    for (let t = 0; t <= c.duration; t += 5) {
      const [x] = c.at(t)
      assert.ok(x <= 300 && x >= prev - 1e-9, `no bounce at ${t} ms`)
      prev = x
    }
    assert.ok(300 - c.at(c.duration - 0.01)[0] < 0.5)
    assert.ok(300 - c.at(c.duration - 40)[0] > 0.5, 'and not much sooner')
    assert.deepEqual(c.at(c.duration), [300, 0])
  }
})

test('spring settle time grows with period and damping, and a small move rests sooner', () => {
  const t = (o, d = 100) => curve(0, d, o).duration
  // Critically damped: (1 + wt) e^-wt = 0.5 / 100 at about wt = 7.43, with w = 2 pi / 0.4 s.
  near(t({ period: 400 }), 473, 3)
  assert.ok(t({ period: 800 }) > t({ period: 400 }) * 1.9)
  assert.ok(t({ period: 400, damping: 2 }) > t({ period: 400 }))
  assert.ok(t({ period: 400 }, 10) < t({ period: 400 }, 1000))
  // Opacity: 0.5% of the way, not 0.5 units.
  assert.ok(1 - curve(0, 1, { period: 400 }).at(480)[0] < 0.005)
  assert.equal(curve(5, 5, {}).duration, 0)
})

test('a spring keeps the speed it is given, so a take-over has no jump', () => {
  const c = curve(40, 0, { period: 400 }, 500)
  near(c.at(0)[0], 40)
  near(c.at(0)[1], 500)
  assert.ok(c.at(16)[0] > 40, 'still moving the old way for a moment')
})

test('timeline positions: absolute, +=, -=, < and labels', () => {
  const boxes = Array.from({ length: 6 }, () => ({ x: 0 }))
  const step = { to: { x: 100 }, duration: 100, ease: 'linear' }
  const tl = timeline({ paused: true })
    .add(boxes[0], step) // 0 to 100
    .add(boxes[1], step, '+=50') // 150 to 250
    .label('mid')
    .add(boxes[2], step, '-=30') // 220 to 320
    .add(boxes[3], step, '<') // 220 to 320
    .add(boxes[4], step, 'mid') // 250 to 350
    .add(boxes[5], step, 1000) // 1000 to 1100
    .label('late', 'later') // an unknown label is made at the end
  assert.equal(tl.duration, 1100)
  tl.seek(260)
  assert.deepEqual(boxes.map((b) => Math.round(b.x)), [100, 100, 40, 40, 10, 0])
  assert.deepEqual(tl.marks(), [{ at: 250 }, { at: 1100 }], 'one mark per time')
})

test('timeline seek is exact, and each step starts where the last one ended', () => {
  const box = { x: 0, o: 1 }
  const seen = []
  const tl = timeline({ paused: true })
    .add(box, { to: { x: 100 }, duration: 100, ease: 'linear' })
    .add(box, { to: { x: 300 }, duration: 200, ease: 'linear' })
    .add(box, { from: { o: 0 }, to: { o: 1 }, duration: 100, ease: 'linear', onDone: () => seen.push('faded') }, 50)
    .label('end')
  tl.seek(50)
  assert.deepEqual(box, { x: 50, o: 0 })
  tl.seek(200)
  assert.deepEqual(box, { x: 200, o: 1 })
  assert.deepEqual(seen, ['faded'])
  tl.seek(20)
  assert.deepEqual(box, { x: 20, o: 0 }, 'a step not reached yet shows its start')
  tl.seek('end')
  assert.equal(box.x, 300)
  assert.equal(tl.progress, 1)
})

test('timeline with a spring step lasts until it settles', () => {
  const tl = timeline({ paused: true }).add({ x: 0 }, { to: { x: 100 }, period: 400 })
  assert.equal(tl.duration, curve(0, 100, { period: 400 }).duration)
})

test('timeline marks work as detent marks for scrubbing', () => {
  const tl = timeline({ paused: true }).label('start').add({ x: 0 }, { to: { x: 1 }, duration: 300 }).label('done').label('half', 150)
  assert.deepEqual(tl.marks(), [{ at: 0 }, { at: 150 }, { at: 300 }])
})

test('reduced motion: play lands on the end, reverse on the start, and seek still works', async () => {
  const box = { x: 0 }
  let done = 0
  const tl = timeline({ paused: true, motion: 'reduce', onDone: () => done++ }).add(box, { to: { x: 10 }, duration: 500 })
  tl.play()
  assert.equal(box.x, 10)
  assert.equal(await tl.finished, true)
  tl.reverse()
  assert.equal(box.x, 0)
  assert.equal(done, 2)
  tl.seek(250)
  assert.ok(box.x > 0 && box.x < 10)
})

test('reverse plays back to the start', async () => {
  const box = { x: 0 }
  const tl = timeline({ paused: true }).add(box, { to: { x: 10 }, duration: 60, ease: 'linear' })
  tl.seek(60)
  tl.reverse()
  assert.equal(await tl.finished, true)
  assert.equal(box.x, 0)
  assert.equal(tl.progress, 0)
})

test('a timeline plays by itself unless paused', async () => {
  const box = { x: 0 }
  const tl = timeline().add(box, { to: { x: 10 }, duration: 40 })
  assert.equal(await tl.finished, true)
  assert.equal(box.x, 10)
})

test('animate: a number, with onUpdate, onDone and finished', async () => {
  const seen = []
  let done = false
  const a = animate(0, { to: 100, duration: 60, onUpdate: (v) => seen.push(v), onDone: () => (done = true) })
  assert.equal(await a.finished, true)
  assert.equal(seen.at(-1), 100)
  assert.ok(done)
  assert.equal(a.progress, 1)
})

test('animate: reduced motion lands at once and still reports', () => {
  const box = { x: 0 }
  const seen = []
  let done = false
  animate(box, { to: { x: 5 }, delay: 1000, motion: 'reduce', onUpdate: (v) => seen.push(v.x), onDone: () => (done = true) })
  assert.deepEqual([box.x, seen, done], [5, [5], true])
})

test('animate: stop and a take-over resolve false, with no onDone', async () => {
  const box = { x: 0 }
  let done = 0
  const a = animate(box, { to: { x: 100 }, onDone: () => done++ })
  await new Promise((r) => setTimeout(r, 40))
  const b = animate(box, { to: { x: 0 }, duration: 30 })
  assert.equal(await a.finished, false)
  assert.equal(await b.finished, true)
  const c = animate(box, { to: { x: 9 } })
  c.stop()
  assert.equal(await c.finished, false)
  assert.equal(done, 0)
})

test('animate: seek and progress, delay not counted', () => {
  const box = { x: 0 }
  const a = animate(box, { to: { x: 100 }, duration: 200, ease: 'linear', delay: 500 })
  a.pause()
  assert.equal(a.progress, 0)
  a.seek(100)
  assert.equal(box.x, 50)
  assert.equal(a.progress, 0.5)
  a.destroy()
})

test('animate: a signal stops it', async () => {
  const ac = new AbortController()
  const a = animate({ x: 0 }, { to: { x: 1 }, signal: ac.signal })
  ac.abort()
  assert.equal(await a.finished, false)
  ac.abort()
  const b = animate({ x: 0 }, { to: { x: 1 }, signal: ac.signal })
  assert.equal(await b.finished, false)
})
