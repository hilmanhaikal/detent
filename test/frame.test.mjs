// The shared frame, with a hand-driven requestAnimationFrame so frame times are exact.
import assert from 'node:assert/strict'
import { test } from 'node:test'

let queue = []
let asked = 0
globalThis.requestAnimationFrame = (fn) => (asked++, queue.push(fn), queue.length)
globalThis.cancelAnimationFrame = () => {}
const run = (now) => {
  const q = queue
  queue = []
  q.forEach((fn) => fn(now))
}

const { frame, frameBudget, springTo } = await import('../dist/index.js')

test('many jobs share one frame, and a cancelled one never runs', () => {
  asked = 0
  const seen = []
  frame(() => seen.push('a'))
  frame(() => seen.push('b'))
  const off = frame(() => seen.push('c'))
  off()
  assert.equal(asked, 1)
  run(16)
  assert.deepEqual(seen, ['a', 'b'])
})

test('a job cancelled by another in the same frame does not run', () => {
  const seen = []
  let off
  frame(() => off())
  off = frame(() => seen.push('late'))
  run(32)
  assert.deepEqual(seen, [])
})

test('long frames make the budget low, short frames bring it back', () => {
  let t = 100
  const spin = (gap, n) => {
    for (let i = 0; i < n; i++) {
      frame(() => {})
      run((t += gap))
    }
  }
  spin(16, 20)
  assert.equal(frameBudget.low, false)
  spin(40, 20)
  assert.equal(frameBudget.low, true)
  assert.ok(frameBudget.frameMs > 28)
  spin(24, 30)
  assert.equal(frameBudget.low, true, 'between the two lines it stays low')
  spin(16, 30)
  assert.equal(frameBudget.low, false)
})

test('when low, motion is drawn every other frame and still lands exactly', () => {
  frameBudget.force(true)
  let t = 1000
  let frames = 0
  let done = false
  let at = 0
  springTo({ from: 0, to: 100, period: 200, onFrame: (v) => (frames++, (at = v)), onDone: () => (done = true) })
  let ticks = 0
  while (!done && ticks < 400) {
    run((t += 16))
    ticks++
  }
  assert.equal(done, true)
  assert.equal(at, 100)
  assert.ok(frames <= ticks / 2 + 1, `${frames} drawn in ${ticks} frames`)
  frameBudget.force(null)
})

test('force(false) keeps every frame', () => {
  frameBudget.force(false)
  let t = 5000
  for (let i = 0; i < 30; i++) {
    frame(() => {})
    run((t += 60))
  }
  assert.equal(frameBudget.low, false)
  frameBudget.force(null)
})
