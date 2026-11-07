// Pure logic, run against the built dist: npm test builds first.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as detent from '../dist/index.js'

const { stepKey, attract, roundTo, lastStep, steps, wrap, createScrub, glide, springTo } = detent

test('importing on a server touches no window', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(typeof detent.detent, 'function')
  assert.equal(typeof detent.detentScroll, 'function')
  assert.equal(typeof detent.detent2d, 'function')
})

test('every low-level export from 0.0.1 is still there', () => {
  for (const name of ['clamp', 'wrap', 'roundTo', 'lastStep', 'steps', 'nearestMark', 'magnetTo', 'pull', 'attract', 'rubber', 'speedTracker', 'springTo', 'glide', 'follow', 'stepKey', 'wheelSteps', 'createScrub'])
    assert.equal(typeof detent[name], 'function', name)
})

test('roundTo leaves no float dust', () => {
  assert.equal(roundTo(0.1 + 0.2, 0.1), 0.3)
  assert.equal(lastStep(0, 1, 0.3), 0.9)
  assert.deepEqual(steps(0, 1, 0.25), [0, 0.25, 0.5, 0.75, 1])
  assert.equal(wrap(-1, 24), 23)
})

test('stepKey keeps its 0.0.1 behaviour', () => {
  const r = { min: 0, max: 100, step: 5, marks: [0, 25, 50, 75, 100] }
  assert.equal(stepKey('ArrowRight', 50, r), 55)
  assert.equal(stepKey('ArrowDown', 0, r), 0)
  assert.equal(stepKey('PageUp', 50, r), 75)
  assert.equal(stepKey('PageDown', 50, r), 25)
  assert.equal(stepKey('End', 50, r), 100)
  assert.equal(stepKey('Home', 50, r), 0)
  assert.equal(stepKey('PageUp', 50, { min: 0, max: 100, step: 1 }), 60)
  assert.equal(stepKey('a', 50, r), null)
})

test('stepKey: Page keys go to strong marks first', () => {
  const r = { min: 0, max: 100, step: 5, marks: [0, 10, 20, 50, 100], strong: [50, 100] }
  assert.equal(stepKey('PageUp', 0, r), 50)
  assert.equal(stepKey('PageDown', 100, r), 50)
  assert.equal(stepKey('PageDown', 50, r), 0)
})

test('stepKey: a loop goes round', () => {
  const r = { min: 0, max: 23, step: 1, loop: true }
  assert.equal(stepKey('ArrowUp', 23, r), 0)
  assert.equal(stepKey('ArrowDown', 0, r), 23)
  assert.equal(stepKey('PageUp', 20, r), 6)
  assert.equal(stepKey('PageUp', 20, { ...r, strong: [0, 6, 12, 18] }), 0)
  assert.equal(stepKey('PageDown', 0, { ...r, strong: [0, 6, 12, 18] }), 18)
})

test('attract: a strong mark wins inside its wider reach', () => {
  const marks = [{ at: 0 }, { at: 10, strong: true }]
  assert.equal(attract(10, marks, 10), 10)
  const near = attract(4, marks, 10)
  assert.ok(Math.abs(near - 10) < Math.abs(4 - 10), 'drawn toward the strong mark')
  assert.equal(attract(50, marks, 10), 50)
})

test('glide and spring with a period of 0 land at once', () => {
  const frames = []
  const g = glide({ from: 3, velocity: 500, land: (e) => Math.round(e / 10) * 10, period: 0, onFrame: (v) => frames.push(v) })
  assert.equal(g.to, 0, 'reduced motion lands under the hand, not where the flick would go')
  assert.deepEqual(frames, [0])
  let done = false
  springTo({ from: 0, to: 5, period: 0, onFrame: () => {}, onDone: () => (done = true) })
  assert.ok(done)
})

test('createScrub with no motion: keys and place settle once each', () => {
  const settled = []
  const s = createScrub({ value: 50, min: 0, max: 100, land: (v) => roundTo(v, 5), period: () => 0, onSettle: (v) => settled.push(v) })
  s.go(55)
  assert.equal(s.target, 55)
  s.place(20)
  assert.equal(s.at, 20)
  assert.deepEqual(settled, [55, 20])
})
