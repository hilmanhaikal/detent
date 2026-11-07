// The rules of throw, pull and haptics, run against the built dist: npm test builds first.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as detent from '../dist/index.js'
import { reach, thrownWay, ways } from '../dist/throw.js'
import { resist } from '../dist/pull.js'
import { haptics } from '../dist/haptics.js'

const card = { w: 300, h: 400 }
const x = ways('x')

test('importing on a server touches no window, and the new functions are there', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  for (const name of ['detentThrow', 'detentPull', 'detentHold']) assert.equal(typeof detent[name], 'function', name)
})

test('throw: past 35% of the width it goes, short of it it stays', () => {
  assert.equal(thrownWay({ x: 104, y: 0 }, { x: 0, y: 0 }, card, x), null)
  assert.equal(thrownWay({ x: 105, y: 0 }, { x: 0, y: 0 }, card, x), 'right')
  assert.equal(thrownWay({ x: -120, y: 0 }, { x: 0, y: 0 }, card, x), 'left')
  assert.equal(thrownWay({ x: 200, y: 0 }, { x: 0, y: 0 }, card, ['left']), null, 'a way not allowed never throws')
})

test('throw: a slow short drag stays, a flick over 600 px/s that moved 40 px goes', () => {
  assert.equal(thrownWay({ x: 30, y: 0 }, { x: 200, y: 0 }, card, x), null)
  assert.equal(thrownWay({ x: 39, y: 0 }, { x: 900, y: 0 }, card, x), null, 'too short a flick')
  assert.equal(thrownWay({ x: 40, y: 0 }, { x: 601, y: 0 }, card, x), 'right')
  assert.equal(thrownWay({ x: 60, y: 0 }, { x: 599, y: 0 }, card, x), null, 'too slow a flick')
  assert.equal(thrownWay({ x: 60, y: 0 }, { x: -900, y: 0 }, card, x), null, 'a flick back the other way stays')
  assert.equal(thrownWay({ x: 0, y: -50 }, { x: 0, y: -800 }, card, ways('y')), 'up')
})

test('throw: up and down measure against the height, and the furthest past its line wins', () => {
  assert.equal(thrownWay({ x: 0, y: 139 }, { x: 0, y: 0 }, card, ways('both')), null)
  assert.equal(thrownWay({ x: 0, y: 140 }, { x: 0, y: 0 }, card, ways('both')), 'down')
  assert.equal(thrownWay({ x: 110, y: 200 }, { x: 0, y: 0 }, card, ways('both')), 'down')
  assert.deepEqual(reach({ x: 52.5, y: 0 }, card, x), { progress: 0.5, armed: null })
  assert.deepEqual(reach({ x: 300, y: 0 }, card, x), { progress: 1, armed: 'right' })
})

test('pull: it follows the hand at first, gets heavier, and never passes max', () => {
  assert.equal(resist(0, 128), 0)
  assert.equal(resist(-20, 128), 0)
  assert.ok(Math.abs(resist(4, 128) - 4) < 0.1, 'about 1 to 1 at the start')
  assert.ok(resist(200, 128) - resist(100, 128) < resist(100, 128) - resist(0, 128), 'heavier further out')
  assert.ok(resist(10000, 128) <= 128)
  assert.ok(resist(89, 128) >= 64 && resist(88, 128) < 64, 'arms at the 64 px line after about 89 px of hand')
})

const vibrations = []
globalThis.navigator.vibrate = (ms) => (vibrations.push(ms), true)

test('haptics: off by default, true ticks only strong ones, all ticks plain ones too', () => {
  vibrations.length = 0
  assert.equal(haptics(() => undefined).tick(true, 0), false)
  assert.equal(haptics(() => false).tick(true, 0), false)
  const gentle = haptics(() => true)
  assert.equal(gentle.tick(false, 0), false)
  assert.equal(gentle.tick(true, 0), true)
  const all = haptics(() => 'all')
  assert.equal(all.tick(false, 0), true)
  assert.deepEqual(vibrations, [12, 8], 'about 12 ms for a strong one, 8 ms for a plain one')
})

test('haptics: at most one tick every 80 ms, and none after off()', () => {
  vibrations.length = 0
  const h = haptics(() => 'all')
  for (let t = 0; t < 400; t += 10) h.tick(false, t)
  assert.equal(vibrations.length, 5)
  h.off()
  h.tick(true, 1000)
  assert.equal(vibrations.length, 5)
})

// Just enough of an element for detent() to run in node: attributes, style and events.
function fakeElement() {
  const el = new EventTarget()
  const at = new Map([['aria-label', 'Volume']])
  Object.assign(el, {
    clientWidth: 100,
    clientHeight: 40,
    style: { touchAction: '', setProperty() {}, removeProperty() {} },
    hasAttribute: (n) => at.has(n),
    getAttribute: (n) => at.get(n) ?? null,
    setAttribute: (n, v) => at.set(n, String(v)),
    removeAttribute: (n) => at.delete(n),
    toggleAttribute: (n, on) => (on ? at.set(n, '') : at.delete(n)),
    setPointerCapture() {},
  })
  return el
}
const event = (type, props) => Object.assign(new Event(type), props)

test('haptics on detent(): one tick per value the hand crosses, none on go(), none when off', () => {
  globalThis.getComputedStyle = () => ({ touchAction: 'auto' })
  let now = 0
  const clock = performance.now
  performance.now = () => now
  try {
    const drag = (el, to, every = 100) => {
      el.dispatchEvent(event('pointerdown', { button: 0, pointerId: 1, clientX: 0, clientY: 0 }))
      for (let px = 10; px <= to; px += 10) {
        now += every
        el.dispatchEvent(event('pointermove', { pointerId: 1, clientX: px, clientY: 0 }))
      }
      now += 300
      el.dispatchEvent(event('pointerup', { pointerId: 1, clientX: to, clientY: 0 }))
    }
    const make = (haptics) => {
      const el = fakeElement()
      const marks = []
      const d = detent.detent(el, { min: 0, max: 100, step: 10, marks: [{ at: 50, strong: true }], size: 1, motion: 'reduce', haptics, onMark: (v) => marks.push(v) })
      return { el, d, marks }
    }

    vibrations.length = 0
    const all = make('all')
    drag(all.el, 100)
    assert.ok(all.marks.length >= 6, `crossed ${all.marks.length} values`)
    assert.equal(vibrations.length, all.marks.length, 'one tick per value crossed, and none more when it lands')
    assert.equal(vibrations.filter((v) => v === 12).length, 1, 'the strong mark ticks a little longer')

    vibrations.length = 0
    all.d.go(0)
    all.d.go(70)
    assert.equal(vibrations.length, 0, 'go() is not the person: no tick')

    vibrations.length = 0
    all.el.dispatchEvent(event('keydown', { key: 'End' }))
    assert.equal(all.d.value, 100)
    assert.deepEqual(vibrations, [8], 'a key lands once, with one tick')

    vibrations.length = 0
    const fast = make('all')
    drag(fast.el, 100, 10)
    assert.ok(vibrations.length <= 3, `a fast flick (two in the drag, one where it lands) ticks a few times, not every value: ${vibrations.length}`)

    vibrations.length = 0
    const gentle = make(true)
    drag(gentle.el, 100)
    assert.deepEqual(vibrations, [12], 'true ticks only the strong mark')

    vibrations.length = 0
    drag(make(undefined).el, 100)
    drag(make(false).el, 100)
    assert.equal(vibrations.length, 0, 'off by default')

    vibrations.length = 0
    all.d.destroy()
    drag(all.el, 100)
    all.el.dispatchEvent(event('keydown', { key: 'Home' }))
    assert.equal(vibrations.length, 0, 'nothing after destroy')
  } finally {
    performance.now = clock
    delete globalThis.getComputedStyle
  }
})
